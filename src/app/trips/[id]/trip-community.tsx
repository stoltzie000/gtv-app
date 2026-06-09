"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Notification } from "@/app/components/notification";

type UpdateType = "GENERAL" | "TRAVEL" | "ITINERARY";
type Update = { id: number; title: string; content: string; createdAt: string; updateType: UpdateType; travelSegmentId: number | null; itineraryItemId: number | null };
type LinkedItem = { id: number; label: string };
type Poll = { id: number; question: string; isClosed: boolean; options: Array<{ id: number; label: string; votes: number }>; totalVotes: number };

function UpdateFields({ update, travelSegments, itineraryItems }: { update?: Update; travelSegments: LinkedItem[]; itineraryItems: LinkedItem[] }) {
  const [updateType, setUpdateType] = useState<UpdateType>(update?.updateType ?? "GENERAL");
  return <>
    <select className="border p-2" defaultValue={update?.updateType ?? "GENERAL"} name="updateType" onChange={(event) => setUpdateType(event.target.value as UpdateType)}>
      <option value="GENERAL">General Update</option><option value="TRAVEL">Travel Update</option><option value="ITINERARY">Itinerary Update</option>
    </select>
    {updateType === "TRAVEL" && <select className="border p-2" defaultValue={update?.travelSegmentId ?? ""} name="travelSegmentId" required><option disabled value="">Select affected travel segment</option>{travelSegments.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>}
    {updateType === "ITINERARY" && <select className="border p-2" defaultValue={update?.itineraryItemId ?? ""} name="itineraryItemId" required><option disabled value="">Select affected itinerary item</option>{itineraryItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>}
  </>;
}

export function TripUpdates({ tripId, updates, travelSegments, itineraryItems }: { tripId: number; updates: Update[]; travelSegments: LinkedItem[]; itineraryItems: LinkedItem[] }) {
  const router = useRouter();
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const endpoint = `/api/trips/${tripId}/community`;

  async function request(method: string, body: Record<string, unknown>, successMessage: string) {
    setNotice(null); setPending(true);
    try {
      const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to save changes");
      setNotice({ type: "success", text: successMessage });
      router.refresh();
      return true;
    } catch (requestError) {
      setNotice({ type: "error", text: requestError instanceof Error ? requestError.message : "Unable to save changes" });
      return false;
    }
    finally { setPending(false); }
  }

  async function submitUpdate(event: FormEvent<HTMLFormElement>, updateId?: number) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const saved = await request(updateId ? "PATCH" : "POST", {
      action: "update", updateId, title: form.get("title"), content: form.get("content"), updateType: form.get("updateType"), travelSegmentId: form.get("travelSegmentId"), itineraryItemId: form.get("itineraryItemId"),
    }, "Update saved.");
    if (!updateId && saved && formElement.isConnected) formElement.reset();
  }

  return (
    <section className="border rounded-lg p-6">
      {notice && <Notification message={notice.text} type={notice.type} />}
      <h2 className="text-2xl font-bold mb-4">Updates</h2>
        <form className="grid gap-3 mb-6" onSubmit={(event) => submitUpdate(event)}><UpdateFields itineraryItems={itineraryItems} travelSegments={travelSegments} /><input className="border p-2" name="title" placeholder="Update title" required /><textarea className="border p-2" name="content" placeholder="Update" required /><button className="bg-blue-600 text-white px-4 py-2 rounded w-fit" disabled={pending}>Add Update</button></form>
        <div className="grid gap-4">{updates.map((update) => <form className="border rounded p-4 grid gap-2" key={update.id} onSubmit={(event) => submitUpdate(event, update.id)}><p className="text-sm text-gray-500">{new Date(update.createdAt).toLocaleString()}</p><UpdateFields itineraryItems={itineraryItems} travelSegments={travelSegments} update={update} /><input className="border p-2" defaultValue={update.title} name="title" required /><textarea className="border p-2" defaultValue={update.content} name="content" required /><div className="flex gap-3"><button className="border px-3 py-1 rounded" disabled={pending}>Save</button><button className="text-red-600" disabled={pending} onClick={() => request("DELETE", { updateId: update.id }, "Update deleted.")} type="button">Delete</button></div></form>)}</div>
    </section>
  );
}

export function TripPolls({ tripId, polls, initialShareToken }: { tripId: number; polls: Poll[]; initialShareToken: string | null }) {
  const router = useRouter();
  const [shareToken, setShareToken] = useState(initialShareToken);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const endpoint = `/api/trips/${tripId}/community`;

  async function request(method: string, body: Record<string, unknown>, successMessage: string) {
    setNotice(null); setPending(true);
    try {
      const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to save changes");
      setNotice({ type: "success", text: successMessage });
      router.refresh();
      return true;
    } catch (requestError) {
      setNotice({ type: "error", text: requestError instanceof Error ? requestError.message : "Unable to save changes" });
      return false;
    } finally { setPending(false); }
  }

  async function createPoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const created = await request("POST", { action: "poll", question: form.get("question"), choices: String(form.get("choices") ?? "").split("\n") }, "Poll saved.");
    if (created && formElement.isConnected) formElement.reset();
  }

  async function generateShareLink() {
    setNotice(null); setPending(true);
    try {
      const response = await fetch(`/api/trips/${tripId}/share`, { method: "POST" });
      const data = (await response.json()) as { shareToken?: string; error?: string };
      if (!response.ok || !data.shareToken) throw new Error(data.error ?? "Unable to generate link");
      setShareToken(data.shareToken);
      setNotice({ type: "success", text: "Public share link saved." });
      router.refresh();
    } catch (shareError) {
      setNotice({ type: "error", text: shareError instanceof Error ? shareError.message : "Unable to generate link" });
    } finally { setPending(false); }
  }

  return (
    <div className="grid gap-8">
      {notice && <Notification message={notice.text} type={notice.type} />}
      <section className="border rounded-lg p-6"><h2 className="text-2xl font-bold mb-4">Public Share</h2>
        {shareToken ? <div className="grid gap-4"><a className="text-blue-700 break-all" href={`/share/${shareToken}`} target="_blank">/share/{shareToken}</a><Image alt="Public trip QR code" height={220} src={`/api/trips/${tripId}/qr`} unoptimized width={220} /><a className="border rounded px-4 py-2 w-fit" href={`/api/trips/${tripId}/qr?download=1`}>Download QR PNG</a></div> : <button className="bg-blue-600 text-white px-4 py-2 rounded" disabled={pending} onClick={generateShareLink}>Generate Public Link</button>}
      </section>

      <section className="border rounded-lg p-6"><h2 className="text-2xl font-bold mb-4">Polls</h2>
        <form className="grid gap-3 mb-6" onSubmit={createPoll}><input className="border p-2" name="question" placeholder="Poll question" required /><textarea className="border p-2" name="choices" placeholder="One choice per line" required /><button className="bg-blue-600 text-white px-4 py-2 rounded w-fit" disabled={pending}>Create Poll</button></form>
        <div className="grid gap-4">{polls.map((poll) => <div className="border rounded p-4" key={poll.id}><div className="flex justify-between gap-4"><h3 className="font-semibold">{poll.question}</h3><span>{poll.isClosed ? "Closed" : "Open"}</span></div>{poll.options.map((option) => <p key={option.id}>{option.label}: {option.votes}</p>)}<p className="text-sm text-gray-500">{poll.totalVotes} total votes</p>{!poll.isClosed && <button className="border px-3 py-1 rounded mt-2" disabled={pending} onClick={() => request("PATCH", { action: "closePoll", pollId: poll.id }, "Poll closed successfully")}>Close Poll</button>}</div>)}</div>
      </section>
    </div>
  );
}
