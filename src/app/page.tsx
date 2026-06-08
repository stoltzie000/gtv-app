export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <h1 className="text-5xl font-bold mb-6">GTV</h1>

      <p className="text-xl mb-8">
        A temporary website for your group trip.
      </p>

      <div className="flex gap-4">
        <button className="px-6 py-3 rounded bg-blue-600 text-white">
          Create Trip
        </button>

        <button className="px-6 py-3 rounded border">
          View Demo
        </button>
      </div>
    </main>
  );
}