"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Portal } from "./Portal";

export type ToastKind = "success" | "error";

export interface ToastSuccessOptions {
  /** Optional Undo control; caller should enqueue undo through useAdminSave. */
  onUndo?: () => void;
}

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  onUndo?: () => void;
}

export interface AdminToastApi {
  showSuccess: (message: string, options?: ToastSuccessOptions) => void;
  showError: (message: string) => void;
}

const AdminToastContext = createContext<AdminToastApi | null>(null);

const PLAIN_SUCCESS_MS = 4000;
const UNDO_SUCCESS_MS = 10000;
const ERROR_MS = 10000;

function dismissMs(toast: ToastItem): number {
  if (toast.kind === "error") return ERROR_MS;
  if (toast.onUndo) return UNDO_SUCCESS_MS;
  return PLAIN_SUCCESS_MS;
}

/** Single toast with auto-dismiss; pauses while hovered or focused. */
function ToastCard({
  toast,
  onDismiss,
}: Readonly<{
  toast: ToastItem;
  onDismiss: (id: number) => void;
}>) {
  const remainingRef = useRef(dismissMs(toast));
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const pausedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const armTimer = useCallback(() => {
    clearTimer();
    if (pausedRef.current || remainingRef.current <= 0) return;
    startedAtRef.current = Date.now();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onDismiss(toast.id);
    }, remainingRef.current);
  }, [clearTimer, onDismiss, toast.id]);

  useEffect(() => {
    remainingRef.current = dismissMs(toast);
    pausedRef.current = false;
    armTimer();
    return clearTimer;
  }, [toast, armTimer, clearTimer]);

  const pause = () => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    if (startedAtRef.current !== null) {
      const elapsed = Date.now() - startedAtRef.current;
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
      startedAtRef.current = null;
    }
    clearTimer();
  };

  const resume = () => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    armTimer();
  };

  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      className={`admin-toast admin-window ${toast.kind === "error" ? "admin-toast-error" : "admin-toast-success"}`}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      <div className="admin-title-bar">
        {toast.kind === "error" ? "[ ERROR ]" : "[ OK ]"}
      </div>
      <div className="admin-inset p-3 m-1 admin-text text-sm flex items-start justify-between gap-3">
        <span>{toast.message}</span>
        {toast.onUndo && (
          <button
            type="button"
            className="admin-button text-xs shrink-0"
            onClick={() => {
              const undo = toast.onUndo;
              onDismiss(toast.id);
              undo?.();
            }}
          >
            Undo
          </button>
        )}
      </div>
    </div>
  );
}

/** Retro fixed toast stack (top-right); success uses role=status, errors use role=alert. */
function ToastList({
  toasts,
  onDismiss,
}: Readonly<{
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}>) {
  if (toasts.length === 0) return null;

  return (
    <Portal>
      <div className="admin-toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
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

  const pushToast = useCallback((item: ToastItem) => {
    // Newest on top; keep at most two so Undo does not slide under the pointer.
    setToasts((prev) => [item, ...prev].slice(0, 2));
  }, []);

  const showSuccess = useCallback(
    (message: string, options?: ToastSuccessOptions) => {
      pushToast({
        id: Date.now() + Math.random(),
        kind: "success",
        message,
        onUndo: options?.onUndo,
      });
    },
    [pushToast]
  );

  const showError = useCallback(
    (message: string) => {
      pushToast({
        id: Date.now() + Math.random(),
        kind: "error",
        message,
      });
    },
    [pushToast]
  );

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

/** Optional toast for components that may render outside the admin shell. */
export function useOptionalAdminToast(): AdminToastApi | null {
  return useContext(AdminToastContext);
}
