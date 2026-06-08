export default function CreateTripPage() {
  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">

      <h1 className="text-4xl font-bold mb-8">
        Create New Trip
      </h1>

      <p className="mb-2">Trip Name</p>

      <input
        className="border p-2 w-full mb-6"
        type="text"
      />

      <p className="mb-2">Trip Type</p>

      <select className="border p-2 w-full mb-6">
        <option>Cruise</option>
        <option>Vacation</option>
        <option>Business Travel</option>
        <option>Wedding</option>
        <option>Motorcycle Ride</option>
        <option>RV Trip</option>
        <option>Family Reunion</option>
        <option>Custom</option>
      </select>

      <p className="mb-2">Start Date</p>

<input
  className="border p-2 w-full mb-6"
  type="date"
/>

<p className="mb-2">End Date</p>

<input
  className="border p-2 w-full mb-6"
  type="date"
/>

<p className="mb-2">Traveler Count</p>

<input
  className="border p-2 w-full mb-6"
  type="number"
  min="1"
/>

<button
  className="bg-blue-600 text-white px-6 py-3 rounded"
>
  Save Draft
</button>

    </main>
  );
}