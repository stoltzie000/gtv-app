"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Notification } from "@/app/components/notification";

type TripActionsProps = {
  id: number;
  tripName: string;
  isPublished: boolean;
};

export function TripActions({ id, tripName, isPublished }: TripActionsProps) {
  const router = useRouter();
  const [published, setPublished] = useState(isPublished);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handlePublicationChange() {
    setMessage(null);
    setPending(true);

    try {
      const response = await fetch(`/api/trips/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !published }),
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to update publication state");
      }

      setPublished(!published);
      setMessage({ type: "success", text: published ? "Trip unpublished successfully" : "Trip published successfully" });
      router.refresh();
    } catch (updateError) {
      setMessage({ type: "error", text: updateError instanceof Error ? updateError.message : "Unable to update publication state" });
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    setMessage(null);
    setPending(true);

    try {
      const response = await fetch(`/api/trips/${id}`, { method: "DELETE" });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error ?? "Unable to delete trip");
      }

      router.push("/dashboard?notice=trip-deleted");
      router.refresh();
    } catch (deleteError) {
      setMessage({ type: "error", text: deleteError instanceof Error ? deleteError.message : "Unable to delete trip" });
      setPending(false);
    }
  }

  return (
    <div className="mt-8">
      {message && <Notification className="mb-4" message={message.text} type={message.type} />}
      <div className="flex flex-wrap gap-3">
        <Link
          className="bg-blue-600 text-white px-5 py-2 rounded"
          href={`/trips/${id}/edit`}
        >
          Edit Trip
        </Link>
        <Link className="border px-5 py-2 rounded" href={`/trips/${id}/preview`}>
          Preview
        </Link>
        <button
          className="border px-5 py-2 rounded disabled:opacity-60"
          disabled={pending}
          onClick={handlePublicationChange}
          type="button"
        >
          {published ? "Unpublish" : "Publish"}
        </button>
        <button
          className="bg-red-600 text-white px-5 py-2 rounded disabled:opacity-60"
          disabled={pending}
          onClick={() => setConfirmingDelete(true)}
          type="button"
        >
          Delete Trip
        </button>
      </div>
      {confirmingDelete && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <p className="mb-3">Delete &quot;{tripName}&quot;? This cannot be undone.</p>
          <div className="flex gap-3">
            <button className="bg-red-600 text-white px-4 py-2 rounded disabled:opacity-60" disabled={pending} onClick={handleDelete} type="button">
              {pending ? "Deleting..." : "Confirm Delete"}
            </button>
            <button className="border px-4 py-2 rounded" disabled={pending} onClick={() => setConfirmingDelete(false)} type="button">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
