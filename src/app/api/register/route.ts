import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitIdentity, requestIp } from "@/lib/rate-limit";

const REGISTRATION_WINDOW_MS = 60 * 60 * 1000;

function limited(retryAfter: number) {
  return NextResponse.json(
    { error: "Too many registration attempts. Try again later." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const ip = requestIp(request);
  const ipLimit = await checkRateLimit(`register:ip:${ip}`, 10, REGISTRATION_WINDOW_MS);
  if (!ipLimit.allowed) return limited(ipLimit.retryAfter);
  const accountLimit = await checkRateLimit(`register:account:${ip}:${rateLimitIdentity(email || "missing")}`, 3, REGISTRATION_WINDOW_MS);
  if (!accountLimit.allowed) return limited(accountLimit.retryAfter);

  if (!email || password.length < 8) {
    return NextResponse.json(
      { error: "A valid email and password of at least 8 characters are required." },
      { status: 400 }
    );
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
    },
  });

  return NextResponse.json({
    id: user.id,
    email: user.email,
  });
}
