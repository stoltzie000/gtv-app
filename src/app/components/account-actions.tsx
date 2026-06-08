"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AccountActions() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
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
  );
}
