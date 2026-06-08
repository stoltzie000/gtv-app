export default function RegisterPage() {
  return (
    <main className="min-h-screen p-8 max-w-md mx-auto">

      <h1 className="text-4xl font-bold mb-8">
        Create Account
      </h1>

      <p className="mb-2">Email Address</p>

      <input
        className="border p-2 w-full mb-6"
        type="email"
      />

      <p className="mb-2">Password</p>

      <input
        className="border p-2 w-full mb-6"
        type="password"
      />

      <p className="mb-2">Confirm Password</p>

      <input
        className="border p-2 w-full mb-6"
        type="password"
      />

      <button
        className="bg-blue-600 text-white px-6 py-3 rounded"
      >
        Create Account
      </button>

    </main>
  );
}