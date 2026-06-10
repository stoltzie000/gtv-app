import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import {
  AUTH_COOKIE_NAME,
  AUTH_TOKEN_MAX_AGE,
  createToken,
} from "@/lib/auth";
import { checkRateLimit, clearRateLimit, rateLimitIdentity, requestIp } from "@/lib/rate-limit";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function limited(retryAfter: number) {
  return NextResponse.json(
    { error: "Too many login attempts. Try again later." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const ip = requestIp(request);
  const ipLimit = await checkRateLimit(`login:ip:${ip}`, 20, LOGIN_WINDOW_MS);
  if (!ipLimit.allowed) return limited(ipLimit.retryAfter);

  const accountKey = `login:account:${ip}:${rateLimitIdentity(email || "missing")}`;
  const accountLimit = await checkRateLimit(accountKey, 8, LOGIN_WINDOW_MS);
  if (!accountLimit.allowed) return limited(accountLimit.retryAfter);

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user || !user.password) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const validPassword = await bcrypt.compare(password, user.password);

  if (!validPassword) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  await clearRateLimit(accountKey);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      lastActivityAt: new Date(),
      inactiveAt: null,
      inactivityWarningAt: null,
    },
  });

  const token = createToken(user.id, user.email);
  const response = NextResponse.json({
    success: true,
    userId: user.id,
    email: user.email,
  });

  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: AUTH_TOKEN_MAX_AGE,
    path: "/",
  });

  return response;
}
