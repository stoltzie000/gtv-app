"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Poll = {
  id: number;
  question: string;
  isClosed: boolean;
  options: Array<{ id: number; label: string; votes: number }>;
  totalVotes: number;
};

export function TravelerPolls({ polls, token, readOnly }: { polls: Poll[]; token: string; readOnly: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<number | null>(null);
  const [messages, setMessages] = useState<Record<number, string>>({});

  async function vote(pollId: number, optionId: number) {
    setPending(pollId);
    const response = await fetch(`/api/public/${token}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pollId, optionId }),
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    setMessages((current) => ({ ...current, [pollId]: response.ok ? "Vote recorded" : data?.error ?? "Unable to vote" }));
    setPending(null);
    if (response.ok) router.refresh();
  }

  return (
    <section className="bg-white border rounded-lg p-8">
      <h2 className="text-2xl font-bold mb-4">Polls</h2>
      {polls.length ? <div className="grid gap-6">{polls.map((poll) => (
        <div className="border rounded p-4" key={poll.id}>
          <div className="flex justify-between gap-4 mb-3"><h3 className="font-semibold">{poll.question}</h3>{poll.isClosed && <span className="text-sm text-gray-500">Closed</span>}</div>
          <div className="grid gap-2">{poll.options.map((option) => (
            <button className="border rounded p-3 text-left disabled:cursor-default" disabled={readOnly || poll.isClosed || pending === poll.id} key={option.id} onClick={() => vote(poll.id, option.id)} type="button">
              <span className="flex justify-between gap-3"><span>{option.label}</span><span>{option.votes} vote{option.votes === 1 ? "" : "s"}</span></span>
            </button>
          ))}</div>
          <p className="text-sm text-gray-500 mt-2">{poll.totalVotes} total vote{poll.totalVotes === 1 ? "" : "s"}</p>
          {messages[poll.id] && <p className="text-sm mt-2">{messages[poll.id]}</p>}
        </div>
      ))}</div> : <p>No polls.</p>}
    </section>
  );
}
