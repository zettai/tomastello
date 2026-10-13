"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

function subscribeToMount() {
  return () => {};
}

/**
 * Renders children into `document.body` (Story 4 delete modal can reuse this).
 */
export function Portal({ children }: Readonly<{ children: ReactNode }>) {
  const mounted = useSyncExternalStore(subscribeToMount, () => true, () => false);

  if (!mounted) return null;
  return createPortal(children, document.body);
}
