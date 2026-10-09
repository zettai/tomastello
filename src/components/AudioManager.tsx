"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { AudioMetadata } from "@/types/audio";
import { useAdminToast } from "@/components/AdminToast";
import { ConfirmDeleteModal } from "@/components/OverlayModal";
import { readApiError } from "@/lib/readApiError";

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

  const moveAudio = useCallback(
    (index: number, direction: "up" | "down") => {
      if (isReordering) return;
      setIsReordering(true);

      setAudioList((prev) => {
        const next = [...prev];
        const newIndex = direction === "up" ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= next.length) {
          setIsReordering(false);
          return prev;
        }
        [next[index], next[newIndex]] = [next[newIndex], next[index]];
        return next;
      });

      requestAnimationFrame(() => {
        setIsReordering(false);
      });
    },
    [isReordering]
  );

  const handleSaveOrder = async () => {
    try {
      const ids = audioList.map((a) => a.id);
      const res = await fetch("/api/audio/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        showError(await readApiError(res, "Failed to save order"));
        return;
      }
      await fetchAudio();
      showSuccess("Audio order saved");
    } catch (err) {
      console.error("Reorder error:", err);
      showError(err instanceof Error ? err.message : "Failed to save order");
    }
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
        <button onClick={handleSaveOrder} className="admin-button">
          [ SAVE ORDER ]
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {audioList.map((audio, index) => (
          <div
            key={audio.id}
            className="admin-inset flex items-center space-x-2 p-3 min-w-0"
          >
            <div className="flex-1 min-w-0 overflow-hidden">
              {renamingId === audio.id ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="admin-inset px-1 py-0.5 text-sm flex-1"
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
                <>
                  <p className="text-sm font-medium admin-text truncate">
                    {audio.title}
                  </p>
                  <p className="text-xs admin-text-secondary break-all">
                    {formatSize(audio.size)} • {audio.mimeType}
                  </p>
                </>
              )}
            </div>

            <div className="flex space-x-1 shrink-0">
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
