"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Notification } from "@/app/components/notification";

const tripTypes = [
  "Cruise",
  "Vacation",
  "Business Travel",
  "Wedding",
  "Motorcycle Ride",
  "RV Trip",
  "Family Reunion",
  "Custom",
];

export function TripForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripName: form.get("tripName"),
          tripType: form.get("tripType"),
          startDate: form.get("startDate"),
          endDate: form.get("endDate"),
          travelerCount: Number(form.get("travelerCount")),
        }),
      });

      if (response.ok) {
        router.push("/dashboard?notice=trip-created");
        router.refresh();
        return;
      }

      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(data?.error ?? "Unable to create trip");
    } catch {
      setError("Unable to create trip");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className="block mb-2" htmlFor="tripName">
        Trip Name
      </label>
      <input
        className="border p-2 w-full mb-6"
        id="tripName"
        name="tripName"
        type="text"
        required
      />

      <label className="block mb-2" htmlFor="tripType">
        Trip Type
      </label>
      <select
        className="border p-2 w-full mb-6"
        id="tripType"
        name="tripType"
        required
      >
        {tripTypes.map((type) => (
          <option key={type}>{type}</option>
        ))}
      </select>

      <label className="block mb-2" htmlFor="startDate">
        Start Date
      </label>
      <p className="text-sm text-gray-600 mb-2">
        The day the traveler leaves home and the trip begins.
      </p>
      <input
        className="border p-2 w-full mb-6"
        id="startDate"
        name="startDate"
        type="date"
        required
      />

      <label className="block mb-2" htmlFor="endDate">
        End Date
      </label>
      <p className="text-sm text-gray-600 mb-2">
        The day the traveler returns home and the trip is completely finished.
      </p>
      <input
        className="border p-2 w-full mb-6"
        id="endDate"
        name="endDate"
        type="date"
        required
      />

      <label className="block mb-2" htmlFor="travelerCount">
        Traveler Count
      </label>
      <input
        className="border p-2 w-full mb-6"
        id="travelerCount"
        name="travelerCount"
        type="number"
        min="1"
        required
      />

      {error && <Notification className="mb-4" message={error} type="error" />}

      <button
        className="bg-blue-600 text-white px-6 py-3 rounded disabled:opacity-60"
        type="submit"
        disabled={submitting}
      >
        {submitting ? "Saving..." : "Save Draft"}
      </button>
    </form>
  );
}
