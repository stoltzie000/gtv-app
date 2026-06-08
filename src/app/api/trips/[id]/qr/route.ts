import QRCode from "qrcode";
import { getOwnedTripId } from "@/lib/trip-access";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const owned = Number.isInteger(id) ? await getOwnedTripId(id) : null;
  if (!owned?.session || !owned.tripId) return new Response("Not found", { status: 404 });
  const trip = await prisma.trip.findUnique({ where: { id: owned.tripId }, select: { shareToken: true } });
  if (!trip?.shareToken) return new Response("Share link not generated", { status: 404 });

  const url = new URL(`/share/${trip.shareToken}?source=qr`, request.url).toString();
  const png = await QRCode.toBuffer(url, { type: "png", width: 512, margin: 2 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="trip-${id}-qr.png"`,
      "Cache-Control": "private, no-store",
    },
  });
}
