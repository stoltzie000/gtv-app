"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/app/components/status-badge";
import type { TripStatus } from "@/lib/trips";
import { Notification } from "@/app/components/notification";

type Trip = {
  id: number;
  tripName: string;
  tripType: string;
  startDate: string;
  endDate: string;
  travelerCount: number;
  status: TripStatus;
  isPublished: boolean;
  overviewStatus: string;
  itineraryStatus: string;
  travelStatus: string;
  documentsStatus: string;
  photosStatus: string;
  draftReminderAt: string | null;
};

export function TripList() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadTrips() {
      try {
        const response = await fetch("/api/trips");
        const data = (await response.json()) as {
          trips?: Trip[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load trips");
        }

        if (active) {
          setTrips(data.trips ?? []);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load trips"
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadTrips();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <p className="mt-8">Loading trips...</p>;
  }

  if (error) {
    return <Notification className="mt-8" message={error} type="error" />;
  }

  if (trips.length === 0) {
    return <p className="mt-8">No trips yet.</p>;
  }

  return (
    <ul className="mt-8 grid gap-4">
      {trips.map((trip) => (
        <li className="border rounded p-4" key={trip.id}>
          <div className="flex items-center justify-between gap-4 mb-2">
            <Link
              className="text-xl font-semibold text-blue-700 hover:underline"
              href={`/trips/${trip.id}`}
            >
              {trip.tripName}
            </Link>
            <StatusBadge status={trip.status} />
          </div>
          <p>{trip.tripType}</p>
          <p>
            Leaves home {trip.startDate.slice(0, 10)} - Returns home {trip.endDate.slice(0, 10)}
          </p>
          <p>
            {trip.travelerCount} traveler
            {trip.travelerCount === 1 ? "" : "s"}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            {trip.isPublished ? "Published" : "Unpublished"}
          </p>
          {trip.draftReminderAt && (
            <p className="text-sm text-amber-700 mt-2">
              Draft inactive for at least 15 days. It will be deleted after 30 days of inactivity.
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4 text-xs">
            {[["Overview", trip.overviewStatus], ["Travel", trip.travelStatus], ["Itinerary", trip.itineraryStatus], ["Documents", trip.documentsStatus], ["Photos", trip.photosStatus]].map(([label, status]) => <div key={label}><p className="mb-1">{label}</p><StatusBadge status={status} /></div>)}
          </div>
        </li>
      ))}
    </ul>
  );
}
