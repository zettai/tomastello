import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { AdminToastProvider } from "@/components/AdminToast";
import { AdminSaveProvider } from "@/components/AdminSave";

function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AdminToastProvider>
      <AdminSaveProvider>{children}</AdminSaveProvider>
    </AdminToastProvider>
  );
}

/** Render with AdminToastProvider + AdminSaveProvider (admin managers). */
export function renderWithToast(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, { wrapper: Wrapper, ...options });
}
