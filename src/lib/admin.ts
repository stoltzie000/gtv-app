import { verifyToken } from "@/lib/auth";

export async function verifyAdmin() {
  const session = await verifyToken();
  if (!session) return null;

  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return admins.includes(session.email.toLowerCase()) ? session : null;
}
