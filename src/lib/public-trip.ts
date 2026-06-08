import { prisma } from "@/lib/prisma";

export async function getPublishedTrip(token: string) {
  return prisma.trip.findFirst({
    where: { shareToken: token, isPublished: true },
    include: {
      itineraryItems: { orderBy: [{ date: "asc" }, { time: "asc" }] },
      travelSegments: { orderBy: { createdAt: "asc" } },
      documents: { select: { id: true, name: true, size: true } },
      photos: { select: { id: true, name: true, size: true } },
      updates: { orderBy: { createdAt: "desc" } },
      polls: {
        orderBy: { createdAt: "desc" },
        include: { options: { include: { _count: { select: { votes: true } } } }, _count: { select: { votes: true } } },
      },
    },
  });
}
