"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Notification } from "@/app/components/notification";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;

      if (!response.ok || !data?.success) {
        setError(data?.error ?? "Unable to log in. Please try again.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen p-8 max-w-md mx-auto">
      <h1 className="text-4xl font-bold mb-8">Login</h1>

      <form onSubmit={handleLogin}>
        <label className="block mb-2" htmlFor="email">
          Email Address
        </label>
        <input
          autoComplete="email"
          className="border p-2 w-full mb-6"
          id="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />

        <label className="block mb-2" htmlFor="password">
          Password
        </label>
        <input
          autoComplete="current-password"
          className="border p-2 w-full mb-6"
          id="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />

        {error && <Notification className="mb-4" message={error} type="error" />}

        <button
          className="bg-blue-600 text-white px-6 py-3 rounded disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? "Logging in..." : "Login"}
        </button>
      </form>
    </main>
  );
}
