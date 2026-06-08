"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { StatusBadge } from "@/app/components/status-badge";
import { TRAVEL_SEGMENT_TYPES, TRIP_STATUSES } from "@/lib/trips";

type Item = { id: number; date?: string; time?: string; type?: string; title: string; description: string };
type Media = { id: number; name: string; size: number };
type TripSectionsProps = {
  tripId: number;
  description: string;
  notes: string;
  destination: string;
  startLocation: string;
  statuses: Record<"overview" | "itinerary" | "travel" | "documents" | "photos", string>;
  itinerary: Item[];
  segments: Item[];
  documents: Media[];
  photos: Media[];
};

function StatusSelect({ name, value }: { name: string; value: string }) {
  return (
    <select className="border rounded p-2" defaultValue={value} name={name}>
      {TRIP_STATUSES.map((status) => <option key={status}>{status}</option>)}
    </select>
  );
}

export function TripSections(props: TripSectionsProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const endpoint = `/api/trips/${props.tripId}/sections`;

  async function jsonRequest(method: string, body: Record<string, unknown>) {
    setError("");
    setPending(true);
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to save changes");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to save changes");
    } finally {
      setPending(false);
    }
  }

  function fields(form: HTMLFormElement) {
    return Object.fromEntries(new FormData(form).entries());
  }

  async function submitForm(event: FormEvent<HTMLFormElement>, action: string, method = "PATCH") {
    event.preventDefault();
    await jsonRequest(method, { action, ...fields(event.currentTarget) });
  }

  async function upload(event: FormEvent<HTMLFormElement>, kind: "documents" | "photos") {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const response = await fetch(`/api/trips/${props.tripId}/media/${kind}`, {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Upload failed");
      event.currentTarget.reset();
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
    } finally {
      setPending(false);
    }
  }

  async function removeMedia(kind: "documents" | "photos", id: number) {
    if (!window.confirm("Delete this file?")) return;
    setPending(true);
    const response = await fetch(`/api/trips/${props.tripId}/media/${kind}/${id}`, { method: "DELETE" });
    if (!response.ok) setError("Unable to delete file");
    router.refresh();
    setPending(false);
  }

  return (
    <div className="mt-10 grid gap-8">
      {error && <p className="text-red-600">{error}</p>}

      <section className="border rounded-lg p-6">
        <header className="flex justify-between gap-4 mb-4"><h2 className="text-2xl font-bold">Overview</h2><StatusBadge status={props.statuses.overview} /></header>
        <form className="grid gap-4" onSubmit={(event) => submitForm(event, "overview")}>
          <input className="border p-2 rounded" defaultValue={props.destination} name="destination" placeholder="Destination" />
          <textarea className="border p-2 rounded" defaultValue={props.description} name="description" placeholder="Description" rows={4} />
          <textarea className="border p-2 rounded" defaultValue={props.notes} name="notes" placeholder="Notes" rows={3} />
          <div className="flex gap-3"><StatusSelect name="status" value={props.statuses.overview} /><button className="bg-blue-600 text-white px-4 py-2 rounded" disabled={pending}>Save Overview</button></div>
        </form>
      </section>

      <section className="border rounded-lg p-6">
        <header className="flex justify-between gap-4 mb-4"><h2 className="text-2xl font-bold">Itinerary</h2><StatusBadge status={props.statuses.itinerary} /></header>
        <form className="flex gap-3 mb-5" onSubmit={(event) => submitForm(event, "sectionStatus")}>
          <input name="section" type="hidden" value="itinerary" /><StatusSelect name="status" value={props.statuses.itinerary} /><button className="border px-4 rounded" disabled={pending}>Update Status</button>
        </form>
        <form className="grid sm:grid-cols-2 gap-3 mb-6" onSubmit={(event) => submitForm(event, "itinerary", "POST")}>
          <input className="border p-2" name="date" required type="date" /><input className="border p-2" name="time" required type="time" />
          <input className="border p-2 sm:col-span-2" name="title" placeholder="Title" required /><textarea className="border p-2 sm:col-span-2" name="description" placeholder="Description" />
          <button className="bg-blue-600 text-white px-4 py-2 rounded w-fit" disabled={pending}>Add Item</button>
        </form>
        <div className="grid gap-3">{props.itinerary.map((item) => (
          <form className="grid sm:grid-cols-2 gap-2 border rounded p-4" key={item.id} onSubmit={(event) => submitForm(event, "itinerary")}>
            <input name="itemId" type="hidden" value={item.id} /><input className="border p-2" defaultValue={item.date} name="date" required type="date" /><input className="border p-2" defaultValue={item.time} name="time" required type="time" />
            <input className="border p-2 sm:col-span-2" defaultValue={item.title} name="title" required /><textarea className="border p-2 sm:col-span-2" defaultValue={item.description} name="description" />
            <div className="flex gap-2"><button className="border px-3 py-1 rounded" disabled={pending}>Save</button><button className="text-red-600" disabled={pending} onClick={() => jsonRequest("DELETE", { action: "itinerary", itemId: item.id })} type="button">Delete</button></div>
          </form>
        ))}</div>
      </section>

      <section className="border rounded-lg p-6">
        <header className="flex justify-between gap-4 mb-4"><h2 className="text-2xl font-bold">Travel</h2><StatusBadge status={props.statuses.travel} /></header>
        <form className="grid sm:grid-cols-2 gap-3 mb-6" onSubmit={(event) => submitForm(event, "travel")}>
          <input className="border p-2" defaultValue={props.startLocation} name="startLocation" placeholder="Start location" /><input className="border p-2" defaultValue={props.destination} name="destination" placeholder="Destination" />
          <StatusSelect name="status" value={props.statuses.travel} /><button className="bg-blue-600 text-white px-4 py-2 rounded w-fit" disabled={pending}>Save Travel</button>
        </form>
        <form className="grid sm:grid-cols-2 gap-3 mb-6" onSubmit={(event) => submitForm(event, "segment", "POST")}>
          <select className="border p-2" name="type">{TRAVEL_SEGMENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select><input className="border p-2" name="title" placeholder="Segment title" required />
          <textarea className="border p-2 sm:col-span-2" name="description" placeholder="Details" /><button className="bg-blue-600 text-white px-4 py-2 rounded w-fit" disabled={pending}>Add Segment</button>
        </form>
        <div className="grid gap-3">{props.segments.map((item) => (
          <form className="grid sm:grid-cols-2 gap-2 border rounded p-4" key={item.id} onSubmit={(event) => submitForm(event, "segment")}>
            <input name="itemId" type="hidden" value={item.id} /><select className="border p-2" defaultValue={item.type} name="type">{TRAVEL_SEGMENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select><input className="border p-2" defaultValue={item.title} name="title" required />
            <textarea className="border p-2 sm:col-span-2" defaultValue={item.description} name="description" /><div className="flex gap-2"><button className="border px-3 py-1 rounded" disabled={pending}>Save</button><button className="text-red-600" disabled={pending} onClick={() => jsonRequest("DELETE", { action: "segment", itemId: item.id })} type="button">Delete</button></div>
          </form>
        ))}</div>
      </section>

      {(["documents", "photos"] as const).map((kind) => {
        const media = kind === "documents" ? props.documents : props.photos;
        return <section className="border rounded-lg p-6" key={kind}>
          <header className="flex justify-between gap-4 mb-4"><h2 className="text-2xl font-bold capitalize">{kind}</h2><StatusBadge status={props.statuses[kind]} /></header>
          <form className="flex flex-wrap gap-3 mb-4" onSubmit={(event) => submitForm(event, "sectionStatus")}><input name="section" type="hidden" value={kind} /><StatusSelect name="status" value={props.statuses[kind]} /><button className="border px-4 rounded" disabled={pending}>Update Status</button></form>
          <form className="flex flex-wrap gap-3 mb-5" onSubmit={(event) => upload(event, kind)}><input accept={kind === "documents" ? "application/pdf" : "image/jpeg,image/png,image/webp,image/gif"} name="file" required type="file" /><button className="bg-blue-600 text-white px-4 py-2 rounded" disabled={pending}>Upload</button></form>
          <div className={kind === "photos" ? "grid grid-cols-2 sm:grid-cols-3 gap-4" : "grid gap-2"}>{media.map((file) => <div className="border rounded p-3" key={file.id}>
            {kind === "photos" && <Image alt={file.name} className="w-full h-32 object-cover rounded mb-2" height={128} src={`/api/trips/${props.tripId}/media/photos/${file.id}`} unoptimized width={200} />}
            <a className="text-blue-700 break-all" href={`/api/trips/${props.tripId}/media/${kind}/${file.id}`}>{file.name}</a><p className="text-xs text-gray-500">{Math.ceil(file.size / 1024)} KB</p><button className="text-red-600 text-sm mt-2" disabled={pending} onClick={() => removeMedia(kind, file.id)} type="button">Delete</button>
          </div>)}</div>
        </section>;
      })}
    </div>
  );
}
