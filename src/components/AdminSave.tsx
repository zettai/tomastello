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
import { useAdminToast } from "@/components/AdminToast";
import { readApiError } from "@/lib/readApiError";
import { loadSiteForSave, putSiteWithEtags } from "@/lib/siteSave";

export type SiteMutator = (
  data: Record<string, unknown>
) => Record<string, unknown>;

export interface SiteSaveOptions {
  mutate: SiteMutator;
  successMessage?: string;
  /** Enqueued through the same save queue when the toast Undo is clicked. */
  undo?: () => void;
  onSuccess?: () => void;
}

export interface AudioOrderSaveOptions {
  ids: string[];
  successMessage?: string;
  undo?: () => void;
  onSuccess?: () => void;
}

export interface AdminSaveApi {
  /** Serialize a site.json GET→mutate→PUT (ETag-safe). */
  saveSite: (options: SiteSaveOptions) => void;
  /** Serialize PUT /api/audio/reorder. */
  saveAudioOrder: (options: AudioOrderSaveOptions) => void;
  /** True while any queued save is running or waiting. */
  isInflight: boolean;
}

const AdminSaveContext = createContext<AdminSaveApi | null>(null);

/**
 * Single-flight queue for admin site/audio saves. Undo callbacks must call
 * saveSite/saveAudioOrder again so they share ETag ordering with normal saves.
 */
export function AdminSaveProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { showSuccess, showError } = useAdminToast();
  const queueRef = useRef<Array<() => Promise<void>>>([]);
  const pumpingRef = useRef(false);
  const [inflight, setInflight] = useState(0);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (inflight <= 0) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [inflight]);

  const pump = useCallback(async () => {
    if (pumpingRef.current) return;
    pumpingRef.current = true;
    while (queueRef.current.length > 0) {
      const job = queueRef.current.shift();
      if (!job) break;
      setInflight((n) => n + 1);
      try {
        await job();
      } finally {
        setInflight((n) => Math.max(0, n - 1));
      }
    }
    pumpingRef.current = false;
  }, []);

  const enqueue = useCallback(
    (job: () => Promise<void>) => {
      queueRef.current.push(job);
      void pump();
    },
    [pump]
  );

  const saveSite = useCallback(
    (options: SiteSaveOptions) => {
      enqueue(async () => {
        try {
          const { data, etags } = await loadSiteForSave();
          const response = await putSiteWithEtags(options.mutate(data), etags);
          if (!response.ok) {
            showError(await readApiError(response, "Save failed"));
            return;
          }
          // Next save always GETs fresh ETags; success path is enough to refresh.
          options.onSuccess?.();
          if (options.successMessage) {
            showSuccess(
              options.successMessage,
              options.undo ? { onUndo: options.undo } : undefined
            );
          }
        } catch (error) {
          showError(
            error instanceof Error ? error.message : "Save failed"
          );
        }
      });
    },
    [enqueue, showError, showSuccess]
  );

  const saveAudioOrder = useCallback(
    (options: AudioOrderSaveOptions) => {
      enqueue(async () => {
        try {
          const res = await fetch("/api/audio/reorder", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: options.ids }),
          });
          if (!res.ok) {
            showError(await readApiError(res, "Failed to save order"));
            return;
          }
          options.onSuccess?.();
          if (options.successMessage) {
            showSuccess(
              options.successMessage,
              options.undo ? { onUndo: options.undo } : undefined
            );
          }
        } catch (error) {
          showError(
            error instanceof Error ? error.message : "Failed to save order"
          );
        }
      });
    },
    [enqueue, showError, showSuccess]
  );

  const api = useMemo(
    () => ({
      saveSite,
      saveAudioOrder,
      isInflight: inflight > 0,
    }),
    [saveSite, saveAudioOrder, inflight]
  );

  return (
    <AdminSaveContext.Provider value={api}>{children}</AdminSaveContext.Provider>
  );
}

export function useAdminSave(): AdminSaveApi {
  const ctx = useContext(AdminSaveContext);
  if (!ctx) {
    throw new Error("useAdminSave must be used within AdminSaveProvider");
  }
  return ctx;
}
