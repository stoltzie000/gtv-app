import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { TripList } from "./trip-list";
import { AccountActions } from "@/app/components/account-actions";
import { Notification } from "@/app/components/notification";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const session = await verifyToken();

  if (!session) {
    redirect("/login");
  }
  const notice = (await searchParams).notice;

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h1 className="text-4xl font-bold">Dashboard</h1>
        <AccountActions />
      </div>
      <p>Welcome to GTV, {session.email}.</p>
      {notice === "trip-created" && <Notification className="mt-6" message="Trip saved." type="success" />}
      {notice === "trip-deleted" && <Notification className="mt-6" message="Trip deleted." type="success" />}

      <Link
        className="inline-block mt-8 bg-blue-600 text-white px-6 py-3 rounded"
        href="/create-trip"
      >
        Create New Trip
      </Link>

      <TripList />
    </main>
  );
}
