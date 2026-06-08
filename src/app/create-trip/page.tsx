import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { TripForm } from "./trip-form";

export default async function CreateTripPage() {
  const session = await verifyToken();

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">Create New Trip</h1>
      <TripForm />
    </main>
  );
}
