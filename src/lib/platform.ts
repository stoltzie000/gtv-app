import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { cleanExpiredRateLimits } from "@/lib/rate-limit";

export const PHOTO_LIMIT = 25;
export const DOCUMENT_LIMIT = 15;
export const FILE_SIZE_LIMIT = 5 * 1024 * 1024;
export const UPLOAD_REQUEST_SIZE_LIMIT = FILE_SIZE_LIMIT + 64 * 1024;
export const TRIP_STORAGE_LIMIT = 200 * 1024 * 1024;

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysAgo(days: number, now = new Date()) {
  return new Date(now.getTime() - days * DAY_MS);
}

export async function touchTrip(tripId: number, userId: number) {
  const now = new Date();
  await prisma.$transaction([
    prisma.trip.updateMany({
      where: { id: tripId, ownerId: userId },
      data: { lastActivityAt: now, draftReminderAt: null },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { lastActivityAt: now, inactiveAt: null, inactivityWarningAt: null },
    }),
  ]);
}

export async function runLifecycleJobs(now = new Date()) {
  await cleanExpiredRateLimits();
  const reminderCutoff = daysAgo(15, now);
  const draftDeleteCutoff = daysAgo(30, now);
  const accountWarningCutoff = daysAgo(335, now);
  const accountCutoff = daysAgo(365, now);

  const reminderTrips = await prisma.trip.findMany({
    where: {
      isPublished: false,
      draftReminderAt: null,
      lastActivityAt: { lte: reminderCutoff, gt: draftDeleteCutoff },
    },
    select: { id: true, tripName: true, owner: { select: { email: true } } },
  });

  let remindersDelivered = 0;
  let notificationFailures = 0;
  for (const trip of reminderTrips) {
    const claimed = await prisma.trip.updateMany({
      where: { id: trip.id, draftReminderAt: null },
      data: { draftReminderAt: now },
    });
    if (!claimed.count) continue;

    try {
      await sendEmail({
        to: trip.owner.email,
        subject: `Your GTV draft "${trip.tripName}" needs attention`,
        text: `Your trip draft has been inactive for 15 days. Sign in to GTV to keep working on it. Drafts are automatically deleted after 30 days of inactivity.`,
      });
      remindersDelivered += 1;
    } catch {
      await prisma.trip.updateMany({
        where: { id: trip.id, draftReminderAt: now },
        data: { draftReminderAt: null },
      });
      notificationFailures += 1;
    }
  }

  const warningAccounts = await prisma.user.findMany({
    where: {
      lastActivityAt: { lte: accountWarningCutoff },
      inactivityWarningAt: null,
    },
    select: { id: true, email: true },
  });

  let accountWarningsDelivered = 0;
  for (const account of warningAccounts) {
    const claimed = await prisma.user.updateMany({
      where: { id: account.id, inactivityWarningAt: null },
      data: { inactivityWarningAt: now },
    });
    if (!claimed.count) continue;

    try {
      await sendEmail({
        to: account.email,
        subject: "Your GTV account is scheduled for deletion",
        text: "Your GTV account has been inactive for 11 months. Sign in within 30 days to prevent automatic account and trip deletion.",
      });
      accountWarningsDelivered += 1;
    } catch {
      await prisma.user.updateMany({
        where: { id: account.id, inactivityWarningAt: now },
        data: { inactivityWarningAt: null },
      });
      notificationFailures += 1;
    }
  }

  const deletedTrips = await prisma.trip.deleteMany({
    where: {
      OR: [
        { isPublished: false, lastActivityAt: { lte: draftDeleteCutoff } },
        { endDate: { lte: draftDeleteCutoff } },
      ],
    },
  });

  const accountsToDelete = await prisma.user.findMany({
    where: {
      lastActivityAt: { lte: accountCutoff },
      inactivityWarningAt: { lte: daysAgo(30, now) },
    },
    select: { id: true, email: true },
  });

  let accountsDeleted = 0;
  for (const account of accountsToDelete) {
    await prisma.$transaction([
      prisma.accountDeletionAudit.create({
        data: {
          userId: account.id,
          email: account.email,
          reason: "INACTIVITY_1_YEAR",
          deletedAt: now,
        },
      }),
      prisma.user.delete({ where: { id: account.id } }),
    ]);
    accountsDeleted += 1;
  }

  return {
    remindersDelivered,
    accountWarningsDelivered,
    notificationFailures,
    tripsDeleted: deletedTrips.count,
    accountsDeleted,
    ranAt: now,
  };
}
