import { NextResponse } from "next/server";
import { getCurrentParticipant } from "@/lib/auth";

export async function GET() {
  const participant = await getCurrentParticipant();
  if (!participant) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, participantId: participant.id });
}
