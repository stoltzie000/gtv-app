"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Notification } from "@/app/components/notification";

export function DeleteAccountForm() {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const response = await fetch("/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation }),
    });
    const data = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    if (!response.ok) {
      setError(data?.error ?? "Unable to delete account");
      setPending(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  return (
    <form className="border border-red-300 rounded p-6" onSubmit={deleteAccount}>
      <h2 className="text-2xl font-bold text-red-700 mb-3">Delete Account</h2>
      <p className="mb-4">
        This permanently deletes every trip, file, update, poll, vote, and share link.
        Type <strong>DELETE</strong> to continue.
      </p>
      <input
        className="border p-2 w-full mb-4"
        onChange={(event) => setConfirmation(event.target.value)}
        required
        value={confirmation}
      />
      {error && <Notification className="mb-4" message={error} type="error" />}
      <button
        className="bg-red-600 text-white px-5 py-2 rounded disabled:opacity-60"
        disabled={pending || confirmation !== "DELETE"}
      >
        {pending ? "Deleting..." : "Delete Account"}
      </button>
    </form>
  );
}
