"use client";

import { useState } from "react";
import { Notification } from "@/app/components/notification";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function handleRegister() {
    if (password !== confirmPassword) {
      setNotice({ type: "error", text: "Passwords do not match" });
      return;
    }
    setNotice(null);
    setPending(true);
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to create account");
      setNotice({ type: "success", text: "Account created successfully" });
    } catch (registerError) {
      setNotice({ type: "error", text: registerError instanceof Error ? registerError.message : "Unable to create account" });
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen p-8 max-w-md mx-auto">
      <h1 className="text-4xl font-bold mb-8">
        Create Account
      </h1>

      <p className="mb-2">Email Address</p>

      <input
        className="border p-2 w-full mb-6"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <p className="mb-2">Password</p>

      <input
        className="border p-2 w-full mb-6"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <p className="mb-2">Confirm Password</p>

      <input
        className="border p-2 w-full mb-6"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />

      <button
        onClick={handleRegister}
        className="bg-blue-600 text-white px-6 py-3 rounded disabled:opacity-60"
        disabled={pending}
      >
        {pending ? "Creating..." : "Create Account"}
      </button>
      {notice && <Notification className="mt-4" message={notice.text} type={notice.type} />}
    </main>
  );
}
