import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center p-8 max-w-4xl mx-auto">

  <h1 className="text-5xl font-bold mt-10">
    GTV
  </h1>

  <p className="text-xl mt-4 text-center">
    A temporary website for your group trip.
  </p>

  <div className="mt-8 flex gap-4">
  <Link
    href="/create-trip"
    className="bg-blue-600 text-white px-6 py-3 rounded"
  >
    Create Trip
  </Link>

  <button className="border px-6 py-3 rounded">
    View Demo
  </button>
</div>

  <div className="mt-16 text-center">
    <h2 className="text-2xl font-semibold mb-4">
      How It Works
    </h2>

    <ol className="list-decimal text-left space-y-1">
  <li>Create Trip</li>
  <li>Publish</li>
  <li>Share QR Code</li>
  <li>Travelers Stay Informed</li>
</ol>
  </div>
  <div className="mt-16 text-center">
  <h2 className="text-2xl font-semibold mb-4">
    Features
  </h2>

  <p>✓ Overview</p>
  <p>✓ Travel Chain</p>
  <p>✓ Itinerary</p>
  <p>✓ Documents</p>
  <p>✓ Photos</p>
  <p>✓ Updates</p>
  <p>✓ Polls</p>
  <p>✓ QR Sharing</p>
</div>

<div className="mt-16 flex gap-6 text-sm text-gray-600">
  <Link href="/login" className="hover:text-blue-600">Login</Link>
  <Link href="/register" className="hover:text-blue-600">Register</Link>
</div>

<div className="mt-12 text-xs text-gray-500 text-center">
  <p>Privacy Policy</p>
  <p>Terms of Service</p>
</div>

</main>
  );
}
