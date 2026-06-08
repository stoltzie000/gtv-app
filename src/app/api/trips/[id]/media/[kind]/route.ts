import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnedTripId } from "@/lib/trip-access";
import {
  DOCUMENT_LIMIT,
  FILE_SIZE_LIMIT,
  PHOTO_LIMIT,
  TRIP_STORAGE_LIMIT,
} from "@/lib/platform";

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; kind: string }> }
) {
  const values = await params;
  const tripId = Number(values.id);
  const owned = Number.isInteger(tripId) ? await getOwnedTripId(tripId) : null;
  if (!owned?.session || !owned.tripId) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Select a file" }, { status: 400 });
  }

  const isDocument = values.kind === "documents";
  const isPhoto = values.kind === "photos";
  if (!isDocument && !isPhoto) {
    return NextResponse.json({ error: "Invalid media type" }, { status: 400 });
  }
  if (isDocument && (file.type !== "application/pdf" || file.size > FILE_SIZE_LIMIT)) {
    return NextResponse.json({ error: "PDF must be 5 MB or smaller" }, { status: 400 });
  }
  if (isPhoto && (!PHOTO_TYPES.includes(file.type) || file.size > FILE_SIZE_LIMIT)) {
    return NextResponse.json({ error: "Photo must be JPEG, PNG, WebP, or GIF and 5 MB or smaller" }, { status: 400 });
  }

  const record = {
    tripId: owned.tripId,
    name: file.name.slice(0, 255),
    mimeType: file.type,
    size: file.size,
    data: new Uint8Array(await file.arrayBuffer()),
  };
  try {
    const media = await prisma.$transaction(async (tx) => {
      const [documents, photos] = await Promise.all([
        tx.tripDocument.aggregate({
          where: { tripId: owned.tripId! },
          _count: true,
          _sum: { size: true },
        }),
        tx.tripPhoto.aggregate({
          where: { tripId: owned.tripId! },
          _count: true,
          _sum: { size: true },
        }),
      ]);

      if (isDocument && documents._count >= DOCUMENT_LIMIT) {
        throw new Error("DOCUMENT_LIMIT");
      }
      if (isPhoto && photos._count >= PHOTO_LIMIT) {
        throw new Error("PHOTO_LIMIT");
      }

      const used = (documents._sum.size ?? 0) + (photos._sum.size ?? 0);
      if (used + file.size > TRIP_STORAGE_LIMIT) {
        throw new Error("STORAGE_LIMIT");
      }

      return isDocument
        ? tx.tripDocument.create({ data: record, select: { id: true, name: true, size: true } })
        : tx.tripPhoto.create({ data: record, select: { id: true, name: true, size: true } });
    }, { isolationLevel: "Serializable" });

    return NextResponse.json({ media }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "DOCUMENT_LIMIT") {
      return NextResponse.json({ error: "Maximum 15 documents per trip" }, { status: 409 });
    }
    if (message === "PHOTO_LIMIT") {
      return NextResponse.json({ error: "Maximum 25 photos per trip" }, { status: 409 });
    }
    if (message === "STORAGE_LIMIT") {
      return NextResponse.json({ error: "Maximum 200 MB storage per trip" }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to upload file" }, { status: 500 });
  }
}
