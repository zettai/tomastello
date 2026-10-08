import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { apiDocsEnabled } from "@/lib/apiDocs";

// Decided per request from the runtime environment, not at build time.
export const dynamic = "force-dynamic";

export default function SwaggerLayout({ children }: Readonly<{ children: ReactNode }>) {
  if (!apiDocsEnabled()) notFound();
  return children;
}
