import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; kind: string; mediaId: string }> }
) {
  const { token, kind, mediaId: rawId } = await params;
  const mediaId = Number(rawId);
  if (!Number.isInteger(mediaId)) return new Response("Not found", { status: 404 });

  const owner = { trip: { shareToken: token, isPublished: true } };
  const media = kind === "documents"
    ? await prisma.tripDocument.findFirst({ where: { id: mediaId, ...owner } })
    : kind === "photos"
      ? await prisma.tripPhoto.findFirst({ where: { id: mediaId, ...owner } })
      : null;
  if (!media) return new Response("Not found", { status: 404 });

  return new Response(media.data, {
    headers: {
      "Content-Type": media.mimeType,
      "Content-Length": String(media.size),
      "Content-Disposition": `${kind === "documents" ? "attachment" : "inline"}; filename="${media.name.replace(/["\\]/g, "_")}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
