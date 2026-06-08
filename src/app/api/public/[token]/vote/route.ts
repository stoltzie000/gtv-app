import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const VOTER_COOKIE = "gtv_voter";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await request.json().catch(() => null);
  const pollId = Number(body?.pollId);
  const optionId = Number(body?.optionId);
  if (!Number.isInteger(pollId) || !Number.isInteger(optionId)) {
    return NextResponse.json({ error: "Invalid vote" }, { status: 400 });
  }

  const poll = await prisma.poll.findFirst({
    where: { id: pollId, isClosed: false, trip: { shareToken: token, isPublished: true }, options: { some: { id: optionId } } },
    select: { id: true },
  });
  if (!poll) return NextResponse.json({ error: "Poll not found or closed" }, { status: 404 });

  const cookieStore = await cookies();
  const existingVoter = cookieStore.get(VOTER_COOKIE)?.value;
  const voterId = existingVoter ?? randomUUID();

  try {
    await prisma.pollVote.create({ data: { pollId, optionId, voterId } });
  } catch {
    const existingVote = await prisma.pollVote.findUnique({ where: { pollId_voterId: { pollId, voterId } } });
    if (existingVote) return NextResponse.json({ error: "You already voted in this poll" }, { status: 409 });
    return NextResponse.json({ error: "Unable to record vote" }, { status: 500 });
  }

  const response = NextResponse.json({ success: true });
  if (!existingVoter) {
    response.cookies.set(VOTER_COOKIE, voterId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  return response;
}
