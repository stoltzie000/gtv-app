import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runDailyBackup } from "@/lib/backup";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || !provided) return false;
  const expected = Buffer.from(secret);
  const actual = Buffer.from(provided);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await runDailyBackup());
  } catch {
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }
}
