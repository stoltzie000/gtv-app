"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Notification } from "@/app/components/notification";

type EditableTrip = {
  id: number;
  tripName: string;
  tripType: string;
  startDate: string;
  endDate: string;
  travelerCount: number;
};

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

export function EditTripForm({ trip }: { trip: EditableTrip }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch(`/api/trips/${trip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripName: form.get("tripName"),
          tripType: form.get("tripType"),
          startDate: form.get("startDate"),
          endDate: form.get("endDate"),
          travelerCount: Number(form.get("travelerCount")),
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to update trip");
      }

      router.push(`/trips/${trip.id}?notice=trip-saved`);
      router.refresh();
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "Unable to update trip"
      );
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className="block mb-2" htmlFor="tripName">Trip Name</label>
      <input className="border p-2 w-full mb-6" defaultValue={trip.tripName} id="tripName" name="tripName" required />

      <label className="block mb-2" htmlFor="tripType">Trip Type</label>
      <select className="border p-2 w-full mb-6" defaultValue={trip.tripType} id="tripType" name="tripType" required>
        {tripTypes.map((type) => <option key={type}>{type}</option>)}
      </select>

      <label className="block mb-2" htmlFor="startDate">Start Date</label>
      <p className="text-sm text-gray-600 mb-2">The day the traveler leaves home and the trip begins.</p>
      <input className="border p-2 w-full mb-6" defaultValue={trip.startDate} id="startDate" name="startDate" type="date" required />

      <label className="block mb-2" htmlFor="endDate">End Date</label>
      <p className="text-sm text-gray-600 mb-2">The day the traveler returns home and the trip is completely finished.</p>
      <input className="border p-2 w-full mb-6" defaultValue={trip.endDate} id="endDate" name="endDate" type="date" required />

      <label className="block mb-2" htmlFor="travelerCount">Traveler Count</label>
      <input className="border p-2 w-full mb-6" defaultValue={trip.travelerCount} id="travelerCount" min="1" name="travelerCount" type="number" required />

      {error && <Notification className="mb-4" message={error} type="error" />}
      <button className="bg-blue-600 text-white px-6 py-3 rounded disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}
