"use client";

import { useState } from "react";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleRegister() {
    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const data = await response.json();

    console.log(data);
    alert("Account created");
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
        className="bg-blue-600 text-white px-6 py-3 rounded"
      >
        Create Account
      </button>
    </main>
  );
}