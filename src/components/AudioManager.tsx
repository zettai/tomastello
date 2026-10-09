"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { AudioMetadata } from "@/types/audio";
import { useAdminToast } from "@/components/AdminToast";
import { useAdminSave } from "@/components/AdminSave";
import { ConfirmDeleteModal } from "@/components/OverlayModal";

interface AudioManagerProps {
  readonly refreshTrigger: number;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export default function AudioManager({
  refreshTrigger,
}: AudioManagerProps) {
  const { showSuccess, showError } = useAdminToast();
  const { saveAudioOrder } = useAdminSave();
  const [audioList, setAudioList] = useState<AudioMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReordering, setIsReordering] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pendingDelete, setPendingDelete] = useState<AudioMetadata | null>(
    null
  );
  const deleteTriggerRef = useRef<HTMLElement | null>(null);

  const fetchAudio = useCallback(async () => {
    try {
      const res = await fetch("/api/audio/list");
      const data = await res.json();
      if (data.success && Array.isArray(data.audio)) {
        setAudioList(data.audio);
      }
    } catch (err) {
      console.error("Failed to fetch audio:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAudio();
  }, [fetchAudio, refreshTrigger]);

  const persistOrder = (
    next: AudioMetadata[],
    previous: AudioMetadata[]
  ) => {
    const ids = next.map((a) => a.id);
    const previousIds = previous.map((a) => a.id);
    saveAudioOrder({
      ids,
      successMessage: "Audio order saved",
      onSuccess: () => {
        void fetchAudio();
      },
      undo: () => {
        setAudioList(previous);
        saveAudioOrder({
          ids: previousIds,
          successMessage: "Audio order restored",
          onSuccess: () => {
            void fetchAudio();
          },
        });
      },
    });
  };

  const moveAudio = (index: number, direction: "up" | "down") => {
    if (isReordering) return;
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= audioList.length) return;

    setIsReordering(true);
    const previous = audioList;
    const next = [...audioList];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    setAudioList(next);
    persistOrder(next, previous);
    requestAnimationFrame(() => {
      setIsReordering(false);
    });
  };

  const handleRename = async (id: string) => {
    if (!renameValue.trim()) return;
    try {
      const res = await fetch(`/api/audio/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: renameValue.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setAudioList((prev) =>
          prev.map((a) => (a.id === id ? { ...a, title: renameValue.trim() } : a))
        );
        setRenamingId(null);
        setRenameValue("");
        showSuccess("Track renamed");
      } else {
        showError(data.error ?? "Rename failed");
      }
    } catch (err) {
      console.error("Rename error:", err);
      showError(err instanceof Error ? err.message : "Rename failed");
    }
  };

  const confirmDelete = async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    try {
      const res = await fetch(`/api/audio/${target.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setAudioList((prev) => prev.filter((a) => a.id !== target.id));
        showSuccess("Audio deleted");
      } else {
        showError(data.error ?? "Delete failed");
      }
    } catch (err) {
      console.error("Delete error:", err);
      showError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center admin-text">[ LOADING AUDIO... ]</div>
    );
  }

  if (audioList.length === 0) {
    return (
      <div className="p-4 text-center admin-text">[ NO AUDIO FILES ]</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold admin-text">[ AUDIO FILES ]</h2>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {audioList.map((audio, index) => (
          <div
            key={audio.id}
            className="admin-inset admin-media-row p-3 min-w-0"
          >
            <div className="admin-media-row-main min-w-0">
              {renamingId === audio.id ? (
                <div className="flex flex-wrap items-center gap-2 min-w-0 w-full">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="admin-inset px-1 py-0.5 text-sm flex-1 min-w-0"
                    aria-label="New title"
                  />
                  <button
                    onClick={() => handleRename(audio.id)}
                    className="admin-button px-2 py-1 text-xs"
                  >
                    OK
                  </button>
                  <button
                    onClick={() => {
                      setRenamingId(null);
                      setRenameValue("");
                    }}
                    className="admin-button px-2 py-1 text-xs"
                  >
                    X
                  </button>
                </div>
              ) : (
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium admin-text break-all">
                    {audio.title}
                  </p>
                  <p className="text-xs admin-text-secondary break-all">
                    {formatSize(audio.size)} • {audio.mimeType}
                  </p>
                </div>
              )}
            </div>

            <div className="admin-media-row-controls">
              <button
                onClick={() => moveAudio(index, "up")}
                disabled={index === 0}
                className="admin-button px-2 py-1 text-xs disabled:opacity-50"
              >
                ↑
              </button>
              <button
                onClick={() => moveAudio(index, "down")}
                disabled={index === audioList.length - 1}
                className="admin-button px-2 py-1 text-xs disabled:opacity-50"
              >
                ↓
              </button>
              <button
                onClick={() => {
                  setRenamingId(audio.id);
                  setRenameValue(audio.title);
                }}
                className="admin-button px-2 py-1 text-xs"
              >
                REN
              </button>
              <button
                type="button"
                onClick={(e) => {
                  deleteTriggerRef.current = e.currentTarget;
                  setPendingDelete(audio);
                }}
                className="admin-button px-2 py-1 text-xs"
              >
                DEL
              </button>
            </div>
          </div>
        ))}
      </div>
      <ConfirmDeleteModal
        open={pendingDelete !== null}
        itemName={pendingDelete?.title ?? ""}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          void confirmDelete();
        }}
        returnFocusRef={deleteTriggerRef}
      />
    </div>
  );
}
