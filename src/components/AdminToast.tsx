"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Portal } from "./Portal";

export type ToastKind = "success" | "error";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface AdminToastApi {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

const AdminToastContext = createContext<AdminToastApi | null>(null);

const AUTO_DISMISS_MS = 4000;

/** Retro fixed toast; success uses role=status, errors use role=alert. */
function ToastList({
  toasts,
  onDismiss,
}: Readonly<{
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}>) {
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      window.setTimeout(() => onDismiss(t.id), AUTO_DISMISS_MS)
    );
    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
  }, [toasts, onDismiss]);

  if (toasts.length === 0) return null;

  return (
    <Portal>
      <div className="admin-toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={`admin-toast admin-window ${t.kind === "error" ? "admin-toast-error" : "admin-toast-success"}`}
          >
            <div className="admin-title-bar">
              {t.kind === "error" ? "[ ERROR ]" : "[ OK ]"}
            </div>
            <div className="admin-inset p-3 m-1 admin-text text-sm">
              {t.message}
            </div>
          </div>
        ))}
      </div>
    </Portal>
  );
}

export function AdminToastProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showSuccess = useCallback((message: string) => {
    setToasts((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), kind: "success", message },
    ]);
  }, []);

  const showError = useCallback((message: string) => {
    setToasts((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), kind: "error", message },
    ]);
  }, []);

  const api = useMemo(
    () => ({ showSuccess, showError }),
    [showSuccess, showError]
  );

  return (
    <AdminToastContext.Provider value={api}>
      {children}
      <ToastList toasts={toasts} onDismiss={dismiss} />
    </AdminToastContext.Provider>
  );
}

export function useAdminToast(): AdminToastApi {
  const ctx = useContext(AdminToastContext);
  if (!ctx) {
    throw new Error("useAdminToast must be used within AdminToastProvider");
  }
  return ctx;
}
