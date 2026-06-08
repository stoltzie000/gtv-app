"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type TripActionsProps = {
  id: number;
  tripName: string;
  isPublished: boolean;
};

export function TripActions({ id, tripName, isPublished }: TripActionsProps) {
  const router = useRouter();
  const [published, setPublished] = useState(isPublished);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handlePublicationChange() {
    setError("");
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
      router.refresh();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update publication state"
      );
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${tripName}"? This cannot be undone.`)) {
      return;
    }

    setError("");
    setPending(true);

    try {
      const response = await fetch(`/api/trips/${id}`, { method: "DELETE" });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error ?? "Unable to delete trip");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Unable to delete trip"
      );
      setPending(false);
    }
  }

  return (
    <div className="mt-8">
      {error && <p className="text-red-600 mb-4">{error}</p>}
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
          onClick={handleDelete}
          type="button"
        >
          Delete Trip
        </button>
      </div>
    </div>
  );
}
