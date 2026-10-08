import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { toPublicAudio } from "@/lib/publicView";
import { getAudioMetadata } from "@/lib/audioMetadata";

// uploadedBy is an admin email: only admins see it
export async function GET(request: NextRequest) {
  try {
    const audio = await getAudioMetadata();
    const sorted = [...audio].sort((a, b) => a.order - b.order);

    const token = request.cookies.get("auth-token")?.value;
    if (token && (await verifyToken(token))) {
      return NextResponse.json({ success: true, audio: sorted });
    }
    return NextResponse.json({
      success: true,
      audio: sorted.map(toPublicAudio),
    });
  } catch (error) {
    console.error("Audio list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch audio" },
      { status: 500 }
    );
  }
}
