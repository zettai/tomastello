import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/routeAuth";
import { getChunkSizeMb, getUploadMode } from "@/lib/uploads";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  return NextResponse.json({ mode: getUploadMode(), chunkSizeMb: getChunkSizeMb() });
}
