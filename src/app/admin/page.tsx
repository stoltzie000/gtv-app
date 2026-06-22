import { notFound } from "next/navigation";
import { verifyAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { daysAgo, DOCUMENT_LIMIT, PHOTO_LIMIT, TRIP_STORAGE_LIMIT } from "@/lib/platform";

type BackupRun = {
  id: number;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  storageKey: string | null;
  fileSizeBytes: number | null;
  errorMessage: string | null;
};

type PendingTrip = {
  id: number;
  tripName: string;
  isPublished: boolean;
  lastActivityAt: Date;
  endDate: Date;
  draftReminderAt: Date | null;
};

type PendingAccount = {
  id: number;
  email: string;
  lastActivityAt: Date;
  inactiveAt: Date | null;
  deletionRequestedAt: Date | null;
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function AdminPage() {
  if (!(await verifyAdmin())) notFound();

  const now = new Date();
  const reminderCutoff = daysAgo(15, now);
  const deleteCutoff = daysAgo(30, now);
  const accountCutoff = daysAgo(365, now);
  const backupRunQuery = prisma.backupRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 }) as unknown as Promise<BackupRun[]>;
  const pendingTripsQuery = prisma.trip.findMany({
    where: { OR: [{ isPublished: false, lastActivityAt: { lte: reminderCutoff } }, { endDate: { lte: deleteCutoff } }] },
    select: { id: true, tripName: true, isPublished: true, lastActivityAt: true, endDate: true, draftReminderAt: true },
    orderBy: { lastActivityAt: "asc" },
    take: 50,
  }) as unknown as Promise<PendingTrip[]>;
  const pendingAccountsQuery = prisma.user.findMany({
    where: { OR: [{ lastActivityAt: { lte: accountCutoff } }, { deletionRequestedAt: { not: null } }] },
    select: { id: true, email: true, lastActivityAt: true, inactiveAt: true, deletionRequestedAt: true },
    orderBy: { lastActivityAt: "asc" },
    take: 50,
  }) as unknown as Promise<PendingAccount[]>;

  const [
    totalAccounts,
    draftTrips,
    publishedTrips,
    activeTrips,
    completedTrips,
    pollVotes,
    viewTotals,
    documentStorage,
    photoStorage,
    reminderDue,
    draftDeletionDue,
    tripDeletionDue,
    inactiveDue,
    deletionRequests,
    pendingTrips,
    pendingAccounts,
    backupRuns,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.trip.count({ where: { isPublished: false } }),
    prisma.trip.count({ where: { isPublished: true } }),
    prisma.trip.count({ where: { endDate: { gte: now } } }),
    prisma.trip.count({ where: { endDate: { lt: now } } }),
    prisma.pollVote.count(),
    prisma.trip.aggregate({ _sum: { travelerViewCount: true, qrScanCount: true } }),
    prisma.tripDocument.aggregate({ _sum: { size: true }, _count: true }),
    prisma.tripPhoto.aggregate({ _sum: { size: true }, _count: true }),
    prisma.trip.count({ where: { isPublished: false, draftReminderAt: null, lastActivityAt: { lte: reminderCutoff, gt: deleteCutoff } } }),
    prisma.trip.count({ where: { isPublished: false, lastActivityAt: { lte: deleteCutoff } } }),
    prisma.trip.count({ where: { endDate: { lte: deleteCutoff } } }),
    prisma.user.count({ where: { lastActivityAt: { lte: accountCutoff }, inactivityWarningAt: { not: null } } }),
    prisma.user.count({ where: { deletionRequestedAt: { not: null } } }),
    pendingTripsQuery,
    pendingAccountsQuery,
    backupRunQuery,
  ]);

  const storageBytes = (documentStorage._sum.size ?? 0) + (photoStorage._sum.size ?? 0);
  const metrics = [
    ["Total accounts", totalAccounts], ["Draft trips", draftTrips], ["Published trips", publishedTrips],
    ["Active trips", activeTrips], ["Completed trips", completedTrips], ["QR scans", viewTotals._sum.qrScanCount ?? 0],
    ["Traveler views", viewTotals._sum.travelerViewCount ?? 0], ["Poll votes", pollVotes],
  ];

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">GTV Admin Dashboard</h1>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {metrics.map(([label, value]) => <div className="border rounded p-4" key={label}><p className="text-sm text-gray-600">{label}</p><p className="text-3xl font-bold">{value}</p></div>)}
      </section>

      <section className="border rounded p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4">Storage Utilization</h2>
        <p>Total stored: {formatBytes(storageBytes)}</p>
        <p>{photoStorage._count} photos, maximum {PHOTO_LIMIT} per trip</p>
        <p>{documentStorage._count} documents, maximum {DOCUMENT_LIMIT} per trip</p>
        <p>Per-trip cap: {formatBytes(TRIP_STORAGE_LIMIT)}</p>
      </section>

      <section className="border rounded p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4">Pending Lifecycle Actions</h2>
        <div className="grid sm:grid-cols-5 gap-4">
          <p>Draft reminders: <strong>{reminderDue}</strong></p>
          <p>Draft deletions: <strong>{draftDeletionDue}</strong></p>
          <p>Ended trip deletions: <strong>{tripDeletionDue}</strong></p>
          <p>Inactive accounts: <strong>{inactiveDue}</strong></p>
          <p>Deletion requests: <strong>{deletionRequests}</strong></p>
        </div>
      </section>

      <section className="border rounded p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4">Backup Status</h2>
        {backupRuns.length ? (
          <div className="grid gap-3">
            {backupRuns.map((backup: BackupRun) => (
              <div className="border-b pb-2" key={backup.id}>
                <p><strong>{backup.status}</strong> - {backup.startedAt.toLocaleString()}</p>
                <p className="text-sm text-gray-600">
                  {backup.storageKey ?? backup.errorMessage ?? "Backup in progress"}
                  {backup.fileSizeBytes ? ` (${formatBytes(backup.fileSizeBytes)})` : ""}
                </p>
              </div>
            ))}
          </div>
        ) : <p>No backup runs recorded.</p>}
      </section>

      <section className="grid lg:grid-cols-2 gap-8">
        <div className="border rounded p-6"><h2 className="text-xl font-bold mb-4">Pending Trips</h2><div className="grid gap-3">{pendingTrips.map((trip: PendingTrip) => <div className="border-b pb-2" key={trip.id}><p className="font-semibold">#{trip.id} {trip.tripName}</p><p className="text-sm">Last activity: {trip.lastActivityAt.toLocaleDateString()} | End date: {trip.endDate.toLocaleDateString()}</p></div>)}</div></div>
        <div className="border rounded p-6"><h2 className="text-xl font-bold mb-4">Pending Accounts</h2><div className="grid gap-3">{pendingAccounts.map((account: PendingAccount) => <div className="border-b pb-2" key={account.id}><p className="font-semibold">{account.email}</p><p className="text-sm">Last activity: {account.lastActivityAt.toLocaleDateString()} | {account.deletionRequestedAt ? "Deletion requested" : account.inactiveAt ? "Inactive" : "Due inactive"}</p></div>)}</div></div>
      </section>
    </main>
  );
}
