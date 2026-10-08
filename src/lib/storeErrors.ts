import { NextResponse } from "next/server";
import { ConflictError } from "./jsonStore";

/** 409 for a save that kept colliding with other saves (see jsonStore), otherwise null. */
export function conflictResponse(error: unknown): NextResponse | null {
  if (!(error instanceof ConflictError)) return null;
  return NextResponse.json(
    { error: "Someone else saved at the same moment. Reload and try again." },
    { status: 409 }
  );
}
