"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Notification } from "@/app/components/notification";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      router.push("/login?notice=account-created");
      router.refresh();
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

      <form onSubmit={handleRegister}>
        <label className="block mb-2" htmlFor="email">Email Address</label>
        <input autoComplete="email" className="border p-2 w-full mb-6" id="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />

        <label className="block mb-2" htmlFor="password">Password</label>
        <input autoComplete="new-password" className="border p-2 w-full mb-6" id="password" minLength={8} required type="password" value={password} onChange={(event) => setPassword(event.target.value)} />

        <label className="block mb-2" htmlFor="confirmPassword">Confirm Password</label>
        <input autoComplete="new-password" className="border p-2 w-full mb-6" id="confirmPassword" minLength={8} required type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />

        {notice && <Notification className="mb-4" message={notice.text} type={notice.type} />}
        <button className="bg-blue-600 text-white px-6 py-3 rounded disabled:opacity-60" disabled={pending} type="submit">
          {pending ? "Creating..." : "Create Account"}
        </button>
      </form>
      <p className="mt-6 text-sm">Already registered? <Link className="text-blue-700 hover:underline" href="/login">Login</Link></p>
    </main>
  );
}
