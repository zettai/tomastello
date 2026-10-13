import { NextRequest, NextResponse } from "next/server";
import { getImageMetadata } from "@/lib/metadata";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const token = request.cookies.get("auth-token")?.value;
    if (!token) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userPayload = await verifyToken(token);
    if (!userPayload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const metadata = await getImageMetadata();

    return NextResponse.json({
      success: true,
      metadata,
    });
  } catch (error) {
    console.error("Metadata fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch metadata" },
      { status: 500 }
    );
  }
}
