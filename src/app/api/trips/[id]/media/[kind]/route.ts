import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnedTripId } from "@/lib/trip-access";
import { detectUploadType } from "@/lib/file-validation";
import {
  DOCUMENT_LIMIT,
  FILE_SIZE_LIMIT,
  PHOTO_LIMIT,
  TRIP_STORAGE_LIMIT,
  UPLOAD_REQUEST_SIZE_LIMIT,
} from "@/lib/platform";

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

async function readLimitedBody(request: Request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > UPLOAD_REQUEST_SIZE_LIMIT) return null;
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > UPLOAD_REQUEST_SIZE_LIMIT) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

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

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "Upload must use multipart form data" }, { status: 400 });
  }
  const requestBody = await readLimitedBody(request);
  if (!requestBody) {
    return NextResponse.json({ error: "Upload request is too large. Files must be 5 MB or smaller." }, { status: 413 });
  }
  const formData = await new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: requestBody,
  }).formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Select a file" }, { status: 400 });
  }

  const isDocument = values.kind === "documents";
  const isPhoto = values.kind === "photos";
  if (!isDocument && !isPhoto) {
    return NextResponse.json({ error: "Invalid media type" }, { status: 400 });
  }
  if (file.size > FILE_SIZE_LIMIT) {
    return NextResponse.json({ error: "File must be 5 MB or smaller" }, { status: 413 });
  }
  const fileData = new Uint8Array(await file.arrayBuffer());
  const detectedType = detectUploadType(fileData);
  if (isDocument && detectedType !== "application/pdf") {
    return NextResponse.json({ error: "Document must be a valid PDF file" }, { status: 400 });
  }
  if (isPhoto && (!detectedType || !PHOTO_TYPES.has(detectedType))) {
    return NextResponse.json({ error: "Photo must be a valid JPEG, PNG, WebP, or GIF file" }, { status: 400 });
  }

  const record = {
    tripId: owned.tripId,
    name: file.name.slice(0, 255),
    mimeType: detectedType!,
    size: file.size,
    data: fileData,
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
