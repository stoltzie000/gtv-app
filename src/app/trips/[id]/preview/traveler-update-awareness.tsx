"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type LinkedUpdate = {
  id: number;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  updateType: string;
  updateKind: string;
  travelSegmentId: number | null;
  itineraryItemId: number | null;
  originalDate: Date | null;
  originalTime: string | null;
  newDate: Date | null;
  newTime: string | null;
  expiresAt: Date | null;
};

const UpdateContext = createContext<{ now: number }>({ now: 0 });

function isActive(update: LinkedUpdate, now: number) {
  return update.expiresAt === null || update.expiresAt.getTime() > now;
}

export function TravelerUpdateProvider({ initialNow, children }: { initialNow: number; children: ReactNode }) {
  const [now, setNow] = useState(initialNow);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const value = useMemo(() => ({ now }), [now]);
  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>;
}

export function TripWideUpdateBadge({ updates }: { updates: LinkedUpdate[] }) {
  const { now } = useContext(UpdateContext);
  if (!updates.some((update) => isActive(update, now))) return null;
  return <span className="animate-pulse rounded bg-red-600 px-2 py-1 text-xs font-bold text-white">UPDATE</span>;
}

export function LinkedUpdateBadge({ updates }: { updates: LinkedUpdate[] }) {
  const { now } = useContext(UpdateContext);
  if (!updates.some((update) => isActive(update, now))) return null;
  return <span className="animate-pulse rounded bg-red-600 px-2 py-1 text-xs font-bold text-white">UPDATE</span>;
}

function UpdateCard({ update }: { update: LinkedUpdate }) {
  return <article className="border-l-4 border-blue-600 pl-4" id={`update-${update.id}`}>
    <p className="text-sm text-gray-500">{update.createdAt.toLocaleString("en-US")}</p>
    <p className="text-xs font-semibold uppercase text-gray-600">{update.updateType.toLowerCase()} update</p>
    <h3 className="text-lg font-semibold">{update.title}</h3><p className="whitespace-pre-wrap">{update.content}</p>
  </article>;
}

function scheduleLabel(date: Date | null, time: string | null) {
  const dateText = date?.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) ?? "No date";
  return `${dateText}${time ? ` at ${time}` : ""}`;
}

function ScheduleHistory({ update }: { update: LinkedUpdate }) {
  if (update.updateKind !== "SCHEDULE_CHANGE") return null;
  return <p className="mt-2 text-xs text-gray-600">Schedule changed from {scheduleLabel(update.originalDate, update.originalTime)} to {scheduleLabel(update.newDate, update.newTime)}.</p>;
}

export function TravelerUpdatesFeed({ updates }: { updates: LinkedUpdate[] }) {
  const { now } = useContext(UpdateContext);
  const activeUpdates = updates.filter((update) => isActive(update, now));
  return activeUpdates.length ? <div className="grid gap-4">{activeUpdates.map((update) => <UpdateCard key={update.id} update={update} />)}</div> : <p>No updates.</p>;
}

export function InlineLinkedUpdates({ updates }: { updates: LinkedUpdate[] }) {
  if (!updates.length) return null;
  const [latest, ...history] = updates;
  return <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4">
    <p className="text-xs font-bold uppercase text-red-700">Latest Update</p>
    <p className="mt-1 font-semibold">{latest.title}</p>
    <p className="whitespace-pre-wrap text-sm">{latest.content}</p>
    <p className="mt-1 text-xs text-gray-600">{latest.createdAt.toLocaleString("en-US")}</p>
    <ScheduleHistory update={latest} />
    {history.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-red-800">Show {history.length} earlier update{history.length === 1 ? "" : "s"}</summary><div className="mt-3 grid gap-3">{history.map((update) => <div className="border-t border-red-200 pt-3" key={update.id}><p className="font-semibold">{update.title}</p><p className="whitespace-pre-wrap text-sm">{update.content}</p><p className="text-xs text-gray-600">{update.createdAt.toLocaleString("en-US")}</p><ScheduleHistory update={update} /></div>)}</div></details>}
  </div>;
}
