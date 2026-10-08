import { NextResponse } from "next/server";

/** 303 with a relative Location so the browser keeps the current host (Netlify vs prod). */
export function seeOther(path: string): NextResponse {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error(`seeOther: not a same-site path: ${path}`);
  }
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}
