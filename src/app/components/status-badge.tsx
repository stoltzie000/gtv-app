const statusClasses: Record<string, string> = {
  "Not Started": "bg-gray-100 text-gray-700",
  "In Progress": "bg-blue-100 text-blue-800",
  Completed: "bg-green-100 text-green-800",
  Optional: "bg-purple-100 text-purple-800",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`text-sm font-medium px-3 py-1 rounded-full ${
        statusClasses[status] ?? statusClasses["Not Started"]
      }`}
    >
      {status}
    </span>
  );
}
