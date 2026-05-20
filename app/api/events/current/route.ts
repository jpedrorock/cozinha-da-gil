import { NextResponse } from "next/server";
import { getEventSessionStatus } from "@/lib/event-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getEventSessionStatus();
  return NextResponse.json(status);
}
