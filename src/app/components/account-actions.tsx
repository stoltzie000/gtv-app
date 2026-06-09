"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Notification } from "@/app/components/notification";

export function AccountActions() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/logout", { method: "POST" });
      if (!response.ok) throw new Error("Unable to log out");
      router.replace("/login");
      router.refresh();
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Unable to log out");
      setPending(false);
    }
  }

  return (
    <div>
      {error && <Notification className="mb-3" message={error} type="error" />}
      <div className="flex gap-3">
        <Link className="border px-4 py-2 rounded" href="/account/settings">
          Account Settings
        </Link>
        <button
          className="border px-4 py-2 rounded disabled:opacity-60"
          disabled={pending}
          onClick={logout}
          type="button"
        >
          {pending ? "Logging out..." : "Logout"}
        </button>
      </div>
    </div>
  );
}
