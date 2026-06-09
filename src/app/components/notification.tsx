type NotificationType = "success" | "warning" | "error";

const notificationClasses: Record<NotificationType, string> = {
  success: "border-green-300 bg-green-50 text-green-800",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  error: "border-red-300 bg-red-50 text-red-800",
};

export function Notification({
  message,
  type,
  className = "",
}: {
  message: string;
  type: NotificationType;
  className?: string;
}) {
  return (
    <div
      aria-live="polite"
      className={`rounded-md border px-4 py-3 text-sm ${notificationClasses[type]} ${className}`}
      role={type === "error" ? "alert" : "status"}
    >
      {message}
    </div>
  );
}
