import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: Request) {
  const session = await verifyToken();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (body?.confirmation !== "DELETE") {
    return NextResponse.json(
      { error: "Type DELETE to confirm account deletion" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.accountDeletionAudit.create({
      data: {
        userId: user.id,
        email: user.email,
        reason: "USER_REQUEST",
      },
    }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(0),
    path: "/",
  });
  return response;
}
