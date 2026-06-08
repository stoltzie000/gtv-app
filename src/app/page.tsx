export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center p-8">

  <h1 className="text-5xl font-bold mt-10">
    GTV
  </h1>

  <p className="text-xl mt-4 text-center">
    A temporary website for your group trip.
  </p>

  <div className="mt-8 flex gap-4">
    <button className="bg-blue-600 text-white px-6 py-3 rounded">
      Create Trip
    </button>

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

</main>
  );
}