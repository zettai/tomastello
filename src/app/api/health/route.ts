import { NextResponse } from "next/server";

// Static on purpose: monitors poll this every 20 s. Prerendered, the CDN answers it and no
// serverless function runs (the uncached version cost a paid Netlify function pack, 2026-11).
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
