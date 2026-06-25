import { prisma } from "@/lib/prisma";
import { getOwnedTripId } from "@/lib/trip-access";

async function context(params: Promise<{ id: string; kind: string; mediaId: string }>) {
  const values = await params;
  const tripId = Number(values.id);
  const mediaId = Number(values.mediaId);
  if (!Number.isInteger(tripId) || !Number.isInteger(mediaId)) return null;
  const owned = await getOwnedTripId(tripId);
  return owned.session && owned.tripId ? { ...values, tripId, mediaId } : null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; kind: string; mediaId: string }> }
) {
  const values = await context(params);
  if (!values) return new Response("Not found", { status: 404 });

  const media = values.kind === "documents"
    ? await prisma.tripDocument.findFirst({ where: { id: values.mediaId, tripId: values.tripId } })
    : values.kind === "photos"
      ? await prisma.tripPhoto.findFirst({ where: { id: values.mediaId, tripId: values.tripId } })
      : null;
  if (!media) return new Response("Not found", { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  const disposition = download ? "attachment" : "inline";

  return new Response(media.data, {
    headers: {
      "Content-Type": media.mimeType,
      "Content-Length": String(media.size),
      "Content-Disposition": `${disposition}; filename="${media.name.replace(/["\\]/g, "_")}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; kind: string; mediaId: string }> }
) {
  const values = await context(params);
  if (!values) return new Response(null, { status: 404 });

  const result = values.kind === "documents"
    ? await prisma.tripDocument.deleteMany({ where: { id: values.mediaId, tripId: values.tripId } })
    : values.kind === "photos"
      ? await prisma.tripPhoto.deleteMany({ where: { id: values.mediaId, tripId: values.tripId } })
      : null;
  return new Response(null, { status: result?.count ? 204 : 404 });
}
