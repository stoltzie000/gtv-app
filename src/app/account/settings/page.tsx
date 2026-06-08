import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { DeleteAccountForm } from "./delete-account-form";

export default async function AccountSettingsPage() {
  const session = await verifyToken();
  if (!session) redirect("/login");

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <Link className="text-blue-600" href="/dashboard">Back to Dashboard</Link>
      <h1 className="text-4xl font-bold mt-8 mb-2">Account Settings</h1>
      <p className="mb-8">Signed in as {session.email}</p>
      <DeleteAccountForm />
    </main>
  );
}
