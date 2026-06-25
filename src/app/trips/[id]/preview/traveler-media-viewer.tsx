"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type MediaItem = { id: number; name: string; size: number };
type Point = { x: number; y: number };

const MIN_SCALE = 1;
const MAX_SCALE = 5;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distance(left: Point, right: Point) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function midpoint(left: Point, right: Point) {
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
}

function withDownload(url: string) {
  return `${url}?download=1`;
}

function ZoomablePhoto({ src, name, onPrevious, onNext }: { src: string; name: string; onPrevious: () => void; onNext: () => void }) {
  const activePointers = useRef(new Map<number, Point>());
  const lastPoint = useRef<Point | null>(null);
  const lastPinch = useRef<{ distance: number; scale: number; midpoint: Point } | null>(null);
  const swipeStart = useRef<Point | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

  const reset = useCallback(() => {
    activePointers.current.clear();
    lastPoint.current = null;
    lastPinch.current = null;
    swipeStart.current = null;
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => reset(), [reset, src]);

  const zoomAt = useCallback((nextScale: number, center: Point) => {
    setScale((current) => {
      const bounded = clamp(nextScale, MIN_SCALE, MAX_SCALE);
      const ratio = bounded / current;
      setOffset((currentOffset) => ({
        x: center.x - (center.x - currentOffset.x) * ratio,
        y: center.y - (center.y - currentOffset.y) * ratio,
      }));
      if (bounded === MIN_SCALE) setOffset({ x: 0, y: 0 });
      return bounded;
    });
  }, []);

  const moveBy = useCallback((delta: Point) => {
    setOffset((current) => ({
      x: current.x + delta.x,
      y: current.y + delta.y,
    }));
  }, []);

  return (
    <div
      className="relative h-full w-full touch-none overflow-hidden"
      onDoubleClick={(event) => {
        zoomAt(scale > 1 ? 1 : 2.5, { x: event.clientX, y: event.clientY });
      }}
      onPointerCancel={(event) => {
        activePointers.current.delete(event.pointerId);
        lastPoint.current = null;
        lastPinch.current = null;
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        const point = { x: event.clientX, y: event.clientY };
        activePointers.current.set(event.pointerId, point);
        if (activePointers.current.size === 1) {
          lastPoint.current = point;
          swipeStart.current = point;
        }
        if (activePointers.current.size === 2) {
          const [first, second] = [...activePointers.current.values()];
          lastPinch.current = { distance: distance(first, second), scale, midpoint: midpoint(first, second) };
        }
      }}
      onPointerMove={(event) => {
        if (!activePointers.current.has(event.pointerId)) return;
        const point = { x: event.clientX, y: event.clientY };
        activePointers.current.set(event.pointerId, point);

        if (activePointers.current.size === 2) {
          const [first, second] = [...activePointers.current.values()];
          const currentDistance = distance(first, second);
          const currentMidpoint = midpoint(first, second);
          const pinch = lastPinch.current;
          if (pinch && pinch.distance > 0) {
            zoomAt(pinch.scale * (currentDistance / pinch.distance), currentMidpoint);
          }
          lastPinch.current = { distance: currentDistance, scale, midpoint: currentMidpoint };
          return;
        }

        if (scale > 1 && lastPoint.current) {
          moveBy({ x: point.x - lastPoint.current.x, y: point.y - lastPoint.current.y });
        }
        lastPoint.current = point;
      }}
      onPointerUp={(event) => {
        const start = swipeStart.current;
        const end = { x: event.clientX, y: event.clientY };
        activePointers.current.delete(event.pointerId);
        lastPoint.current = null;
        lastPinch.current = null;
        if (scale === 1 && start) {
          const deltaX = end.x - start.x;
          const deltaY = end.y - start.y;
          if (Math.abs(deltaX) > 70 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
            if (deltaX < 0) onNext();
            else onPrevious();
          }
        }
        swipeStart.current = null;
      }}
      onWheel={(event) => {
        event.preventDefault();
        const nextScale = scale + (event.deltaY < 0 ? 0.3 : -0.3);
        zoomAt(nextScale, { x: event.clientX, y: event.clientY });
      }}
    >
      <img
        alt={name}
        className="h-full w-full select-none object-contain"
        draggable={false}
        src={src}
        style={{
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
          transformOrigin: "0 0",
          transition: activePointers.current.size ? "none" : "transform 120ms ease-out",
        }}
      />
    </div>
  );
}

export function TravelerMediaViewer({ documents, photos, mediaBase }: { documents: MediaItem[]; photos: MediaItem[]; mediaBase: string }) {
  const [selectedDocument, setSelectedDocument] = useState<MediaItem | null>(null);
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);
  const currentPhoto = photoIndex === null ? null : photos[photoIndex] ?? null;
  const photoSources = useMemo(() => photos.map((photo) => `${mediaBase}/photos/${photo.id}`), [mediaBase, photos]);

  const closePhoto = useCallback(() => setPhotoIndex(null), []);
  const showPrevious = useCallback(() => setPhotoIndex((index) => index === null ? null : (index + photos.length - 1) % photos.length), [photos.length]);
  const showNext = useCallback(() => setPhotoIndex((index) => index === null ? null : (index + 1) % photos.length), [photos.length]);

  useEffect(() => {
    if (!currentPhoto && !selectedDocument) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [currentPhoto, selectedDocument]);

  useEffect(() => {
    if (!currentPhoto) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePhoto();
      if (event.key === "ArrowLeft") showPrevious();
      if (event.key === "ArrowRight") showNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePhoto, currentPhoto, showNext, showPrevious]);

  return (
    <>
      <section className="bg-white border rounded-lg p-6 sm:p-8" id="documents"><h2 className="text-2xl font-bold text-gray-950 mb-4">Documents</h2>
        {documents.length ? <ul className="grid gap-2">{documents.map((document) => {
          const url = `${mediaBase}/documents/${document.id}`;
          return <li className="flex items-center justify-between gap-3 rounded border p-3" key={document.id}>
            <a className="min-w-0 text-left font-medium text-blue-800 underline-offset-2 hover:underline" href={url} onClick={(event) => {
              event.preventDefault();
              setSelectedDocument(document);
            }}>
              <span className="block break-all">{document.name}</span>
            </a>
            <a className="shrink-0 rounded border px-3 py-2 text-sm font-medium text-gray-900" download={document.name} href={withDownload(url)}>Download</a>
          </li>;
        })}</ul> : <p className="text-gray-900">No documents.</p>}
      </section>

      <section className="bg-white border rounded-lg p-6 sm:p-8" id="photos"><h2 className="text-2xl font-bold text-gray-950 mb-4">Photos</h2>
        {photos.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">{photos.map((photo, index) => {
          const src = photoSources[index];
          return <button aria-label={`Open ${photo.name}`} className="group aspect-[3/2] overflow-hidden rounded bg-gray-100" key={photo.id} onClick={() => setPhotoIndex(index)} type="button">
            <Image alt={photo.name} className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-[1.02]" height={320} src={src} unoptimized width={480} />
          </button>;
        })}</div> : <p className="text-gray-900">No photos.</p>}
      </section>

      {selectedDocument && <div aria-modal="true" className="fixed inset-0 z-50 grid place-items-end bg-black/55 p-0 sm:place-items-center sm:p-6" role="dialog">
        <div className="w-full rounded-t-lg bg-white p-5 text-gray-950 shadow-xl sm:max-w-md sm:rounded-lg">
          <h3 className="mb-1 text-lg font-semibold">Open document</h3>
          <p className="mb-4 break-all text-sm text-gray-700">{selectedDocument.name}</p>
          <div className="grid gap-2">
            <a className="rounded bg-blue-700 px-4 py-3 text-center font-semibold text-white" href={`${mediaBase}/documents/${selectedDocument.id}`} rel="noreferrer" target="_blank">Open in New Tab</a>
            <a className="rounded border px-4 py-3 text-center font-semibold text-gray-950" download={selectedDocument.name} href={withDownload(`${mediaBase}/documents/${selectedDocument.id}`)}>Download</a>
            <button className="rounded px-4 py-3 font-semibold text-gray-800" onClick={() => setSelectedDocument(null)} type="button">Cancel</button>
          </div>
        </div>
      </div>}

      {currentPhoto && photoIndex !== null && <div aria-modal="true" className="fixed inset-0 z-50 bg-black text-white" role="dialog">
        <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-sm font-medium">{photoIndex + 1} of {photos.length}</div>
        <button aria-label="Close photo viewer" className="absolute right-3 top-3 z-10 rounded-full bg-black/60 px-4 py-2 text-2xl leading-none text-white" onClick={closePhoto} type="button">x</button>
        {photos.length > 1 && <>
          <button aria-label="Previous photo" className="absolute left-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/55 px-4 py-3 text-3xl leading-none text-white sm:block" onClick={showPrevious} type="button">{"<"}</button>
          <button aria-label="Next photo" className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/55 px-4 py-3 text-3xl leading-none text-white sm:block" onClick={showNext} type="button">{">"}</button>
        </>}
        <ZoomablePhoto name={currentPhoto.name} onNext={showNext} onPrevious={showPrevious} src={photoSources[photoIndex]} />
      </div>}
    </>
  );
}
