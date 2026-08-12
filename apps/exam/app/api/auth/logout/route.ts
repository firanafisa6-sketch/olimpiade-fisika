import { NextResponse } from "next/server";
import { revokeCurrentParticipantSession } from "@/lib/auth";

export async function POST(request: Request) {
  await revokeCurrentParticipantSession();
  return NextResponse.redirect(new URL("/", request.url));
}
