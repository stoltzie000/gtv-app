import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function verifyAdmin() {
  const session = await verifyToken();
  if (!session) return null;

  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (!admins.includes(session.email.toLowerCase())) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });

  return user && user.email.toLowerCase() === session.email.toLowerCase() ? session : null;
}
