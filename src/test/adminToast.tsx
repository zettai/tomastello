import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { AdminToastProvider } from "@/components/AdminToast";

function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
  return <AdminToastProvider>{children}</AdminToastProvider>;
}

/** Render with AdminToastProvider (required by LinkManager / AudioManager). */
export function renderWithToast(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, { wrapper: Wrapper, ...options });
}
