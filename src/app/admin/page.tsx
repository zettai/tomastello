"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ImageUpload from "@/components/ImageUpload";
import AudioUpload from "@/components/AudioUpload";
import AudioManager from "@/components/AudioManager";
import { LinkManager } from "@/components/LinkManager";
import { AdminToastProvider, useAdminToast } from "@/components/AdminToast";
import { AdminSaveProvider, useAdminSave } from "@/components/AdminSave";
import { ConfirmDeleteModal } from "@/components/OverlayModal";
import Image from "next/image";
import type { SecurityEvent, SystemLock } from "@/lib/securityEvents";
import { homePageImageCheckboxLabel } from "@/lib/imageSelectionLabel";

interface User {
  id: string;
  email: string;
  createdAt: string;
  lastLogin?: string;
}

interface ImageMetadata {
  key: string;
  url: string;
  size: number;
  lastModified: string;
}

const ABOUT_DEBOUNCE_MS = 1500;

function SecurityPanel() {
  const [lock, setLock] = useState<SystemLock | null>(null);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [unlocking, setUnlocking] = useState(false);

  const fetchSecurity = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/security");
      if (res.ok) {
        const data = await res.json() as { lock?: SystemLock; events?: SecurityEvent[] };
        setLock(data.lock ?? null);
        setEvents(data.events ?? []);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    fetchSecurity();
  }, [fetchSecurity]);

  const handleUnlock = async () => {
    setUnlocking(true);
    try {
      await fetch("/api/admin/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlock" }),
      });
      await fetchSecurity();
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="space-y-4">
      {lock?.locked && (
        <div className="admin-inset p-3 space-y-1" style={{ borderColor: "amber" }}>
          <p className="admin-text font-bold">! SYSTEM UPLOAD LOCK ACTIVE</p>
          {lock.lockedAt && (
            <p className="admin-text-secondary text-xs">
              Locked at: {new Date(lock.lockedAt).toLocaleString()}
            </p>
          )}
          {lock.reason && (
            <p className="admin-text-secondary text-xs">Reason: {lock.reason}</p>
          )}
          {lock.bytesIn24h !== undefined && (
            <p className="admin-text-secondary text-xs">
              Bytes in 24h: {(lock.bytesIn24h / (1024 * 1024)).toFixed(1)} MB
            </p>
          )}
          <button
            onClick={handleUnlock}
            disabled={unlocking}
            className="admin-button mt-2 text-xs"
          >
            {unlocking ? "[ UNLOCKING... ]" : "[ UNLOCK SYSTEM ]"}
          </button>
        </div>
      )}

      {events.length > 0 && (
        <div className="space-y-1">
          <p className="admin-text text-sm font-bold">Recent Security Events</p>
          {events.map((ev) => (
            <div
              key={`${ev.type}-${ev.ts}`}
              className="admin-inset p-2 text-xs flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0"
            >
              <span className="admin-text font-mono shrink-0">{ev.type}</span>
              <span className="admin-text-secondary break-all">
                {new Date(ev.ts).toLocaleString()}
              </span>
              {ev.ip && (
                <span className="admin-text-secondary break-all">IP: {ev.ip}</span>
              )}
              {ev.userEmail && (
                <span className="admin-text-secondary break-all">{ev.userEmail}</span>
              )}
              {ev.detail && (
                <span className="admin-text-secondary break-all">({ev.detail})</span>
              )}
            </div>
          ))}
        </div>
      )}

      {!lock?.locked && events.length === 0 && (
        <p className="admin-text-secondary text-xs">No security events.</p>
      )}
    </div>
  );
}

function photosFromSelection(
  images: ImageMetadata[],
  selected: Set<string>
): { id: string; url: string }[] {
  return images
    .filter((img) => selected.has(img.key))
    .map((img) => ({ id: img.key, url: img.url }));
}

function ImageManager({
  refreshTrigger,
}: Readonly<{
  refreshTrigger: number;
}>) {
  const { showSuccess, showError } = useAdminToast();
  const { saveSite } = useAdminSave();
  const [images, setImages] = useState<ImageMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [isReordering, setIsReordering] = useState(false);
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);
  const deleteTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    fetchImages();
    fetchSavedPhotos();
  }, [refreshTrigger]);

  const fetchSavedPhotos = async () => {
    try {
      const response = await fetch("/api/site");
      const data = await response.json();
      if (data.photos) {
        const savedPhotoKeys = new Set(
          data.photos.map((photo: { id: string }) => photo.id) as string[]
        );
        setSelectedImages(savedPhotoKeys);
      }
    } catch (error) {
      console.error("Failed to fetch saved photos:", error);
    }
  };

  const fetchImages = async () => {
    try {
      const response = await fetch("/api/images/list");
      const result = await response.json();
      if (result.success) {
        setImages(result.images);
      }
    } catch (error) {
      console.error("Failed to fetch images:", error);
    } finally {
      setLoading(false);
    }
  };

  const persistSelection = (
    nextSelected: Set<string>,
    nextImages: ImageMetadata[],
    previousSelected: Set<string>,
    previousImages: ImageMetadata[],
    successMessage: string
  ) => {
    const photos = photosFromSelection(nextImages, nextSelected);
    const previousPhotos = photosFromSelection(previousImages, previousSelected);
    saveSite({
      mutate: (data) => ({ ...data, photos }),
      successMessage,
      undo: () => {
        setSelectedImages(new Set(previousSelected));
        setImages(previousImages);
        saveSite({
          mutate: (data) => ({ ...data, photos: previousPhotos }),
          successMessage: "Photos restored",
        });
      },
    });
  };

  const requestDelete = (key: string, trigger: HTMLElement) => {
    deleteTriggerRef.current = trigger;
    setPendingDeleteKey(key);
  };

  const confirmDelete = async () => {
    const key = pendingDeleteKey;
    setPendingDeleteKey(null);
    if (!key) return;
    try {
      const response = await fetch(
        `/api/images/delete?key=${encodeURIComponent(key)}`,
        { method: "DELETE" }
      );
      const result = await response.json();
      if (result.success) {
        setImages((prev) => prev.filter((img) => img.key !== key));
        setSelectedImages((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        showSuccess("Image deleted");
      } else {
        showError(result.error || "Failed to delete image");
      }
    } catch (error) {
      console.error("Delete error:", error);
      showError("Failed to delete image");
    }
  };

  const pendingName = pendingDeleteKey
    ? pendingDeleteKey.split("/").pop() || pendingDeleteKey
    : "";

  const moveImage = (index: number, direction: "up" | "down") => {
    if (isReordering) return;
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= images.length) return;

    setIsReordering(true);
    const previousImages = images;
    const previousSelected = new Set(selectedImages);
    const newImages = [...images];
    [newImages[index], newImages[newIndex]] = [
      newImages[newIndex],
      newImages[index],
    ];
    setImages(newImages);
    persistSelection(
      selectedImages,
      newImages,
      previousSelected,
      previousImages,
      "Photo order saved"
    );
    requestAnimationFrame(() => {
      setIsReordering(false);
    });
  };

  const toggleSelection = (key: string, checked: boolean) => {
    const previousSelected = new Set(selectedImages);
    const previousImages = images;
    const next = new Set(selectedImages);
    if (checked) {
      next.add(key);
    } else {
      next.delete(key);
    }
    setSelectedImages(next);
    persistSelection(
      next,
      images,
      previousSelected,
      previousImages,
      checked ? "Photo shown on site" : "Photo hidden"
    );
  };

  if (loading) {
    return (
      <div className="p-4 text-center admin-text">
        [ LOADING IMAGES... ]
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {images.length === 0 && (
        <div className="p-4 text-center admin-text">[ NO IMAGES ]</div>
      )}
      <div className="grid grid-cols-1 gap-2">
        {images.map((image, index) => (
          <div
            key={image.key}
            className="admin-inset flex items-center space-x-4 p-3"
          >
            <input
              type="checkbox"
              aria-label={homePageImageCheckboxLabel(image.key)}
              checked={selectedImages.has(image.key)}
              onChange={(e) => {
                toggleSelection(image.key, e.target.checked);
              }}
              className="h-4 w-4"
            />
            <Image
              src={image.url}
              alt={image.key}
              width={64}
              height={64}
              className="object-cover h-auto"
              quality={50}
              loading="lazy"
              sizes="64px"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium admin-text break-words line-clamp-2">
                {image.key.split("/").pop()}
              </p>
              <p className="text-xs admin-text-secondary mt-1">
                {new Date(image.lastModified).toLocaleDateString()}
              </p>
            </div>
            <div className="flex space-x-1">
              <button
                onClick={() => moveImage(index, "up")}
                disabled={index === 0}
                className="admin-button px-2 py-1 text-xs disabled:opacity-50"
              >
                ↑
              </button>
              <button
                onClick={() => moveImage(index, "down")}
                disabled={index === images.length - 1}
                className="admin-button px-2 py-1 text-xs disabled:opacity-50"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={(e) => requestDelete(image.key, e.currentTarget)}
                className="admin-button px-2 py-1 text-xs"
              >
                DEL
              </button>
            </div>
          </div>
        ))}
      </div>
      <ConfirmDeleteModal
        open={pendingDeleteKey !== null}
        itemName={pendingName}
        onCancel={() => setPendingDeleteKey(null)}
        onConfirm={() => {
          void confirmDelete();
        }}
        returnFocusRef={deleteTriggerRef}
      />
    </div>
  );
}

function AdminPageInner() {
  const { saveSite } = useAdminSave();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [aboutContent, setAboutContent] = useState("");
  const aboutBaselineRef = useRef("");
  const aboutLoadedRef = useRef(false);
  const aboutTimerRef = useRef<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await fetch("/api/auth/profile");
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          router.push("/login");
        }
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [router]);

  useEffect(() => {
    const fetchAboutContent = async () => {
      try {
        const response = await fetch("/api/site");
        if (response.ok) {
          const data = await response.json();
          const content = data.about?.content || "";
          setAboutContent(content);
          aboutBaselineRef.current = content;
          aboutLoadedRef.current = true;
        }
      } catch {
        aboutLoadedRef.current = true;
      }
    };

    fetchAboutContent();
  }, []);

  useEffect(() => {
    return () => {
      if (aboutTimerRef.current !== null) {
        window.clearTimeout(aboutTimerRef.current);
      }
    };
  }, []);

  const queueAboutSave = useCallback(
    (content: string) => {
      if (content === aboutBaselineRef.current) return;
      saveSite({
        mutate: (data) => ({ ...data, about: { content } }),
        successMessage: "About text saved",
        onSuccess: () => {
          aboutBaselineRef.current = content;
        },
      });
    },
    [saveSite]
  );

  const flushAboutSave = useCallback(() => {
    if (aboutTimerRef.current !== null) {
      window.clearTimeout(aboutTimerRef.current);
      aboutTimerRef.current = null;
    }
    if (!aboutLoadedRef.current) return;
    queueAboutSave(aboutContent);
  }, [aboutContent, queueAboutSave]);

  const handleAboutChange = (value: string) => {
    setAboutContent(value);
    if (!aboutLoadedRef.current) return;
    if (aboutTimerRef.current !== null) {
      window.clearTimeout(aboutTimerRef.current);
    }
    aboutTimerRef.current = window.setTimeout(() => {
      aboutTimerRef.current = null;
      queueAboutSave(value);
    }, ABOUT_DEBOUNCE_MS);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch {
      // Ignore error
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center admin-page">
        <div className="admin-window">
          <div className="admin-title-bar">[ LOADING... ]</div>
          <div className="p-8 text-center">
            <p className="admin-text">PLEASE WAIT...</p>
          </div>
        </div>
      </div>
    );
  }

  const handleUploadSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen p-4 sm:p-8 admin-page">
      <main className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between mb-4">
          <Link href="/" className="admin-button text-sm">
            &lt;&lt; BACK TO SITE
          </Link>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleLogout}
              className="admin-button text-sm"
            >
              [ LOGOUT ]
            </button>
          </div>
        </div>

        <div className="admin-window">
          <div className="admin-title-bar">[ ADMIN.EXE ]</div>
          <div className="p-4 text-center">
            <p className="admin-text">
              &gt; LOGGED IN AS: {user?.email}
            </p>
          </div>
        </div>

        <div className="admin-window">
          <div className="admin-title-bar">[ SECURITY ]</div>
          <div className="p-4 m-2">
            <SecurityPanel />
          </div>
        </div>

        <div className="admin-window">
          <div className="admin-title-bar">[ UPDATE ABOUT TEXT ]</div>
          <div className="p-4 m-2 space-y-3">
            <textarea
              value={aboutContent}
              onChange={(e) => handleAboutChange(e.target.value)}
              onBlur={flushAboutSave}
              className="admin-textarea w-full"
              rows={10}
              maxLength={2000}
              placeholder="Enter about content (max 2000 characters)"
            />
            <div className="flex justify-between items-center">
              <p className="text-sm admin-text-secondary">
                {aboutContent.length}/2000 characters
              </p>
            </div>
          </div>
        </div>

        <div className="admin-window">
          <div className="admin-title-bar">[ MANAGE LINKS ]</div>
          <div className="p-4 m-2">
            <LinkManager refreshTrigger={refreshTrigger} />
          </div>
        </div>

        <div className="admin-window">
          <div className="admin-title-bar">[ UPLOAD IMAGES ]</div>
          <div className="p-4 m-2">
            <ImageUpload onUploadSuccess={handleUploadSuccess} adminMode />
          </div>
        </div>

        <div className="admin-window">
          <div className="admin-title-bar">[ IMAGE MANAGER ]</div>
          <div className="p-4 m-2">
            <ImageManager refreshTrigger={refreshTrigger} />
          </div>
        </div>

        <div className="admin-window">
          <div className="admin-title-bar">[ UPLOAD AUDIO ]</div>
          <div className="p-4 m-2">
            <AudioUpload onUploadSuccess={handleUploadSuccess} adminMode />
          </div>
        </div>

        <div className="admin-window">
          <div className="admin-title-bar">[ AUDIO MANAGER ]</div>
          <div className="p-4 m-2">
            <AudioManager refreshTrigger={refreshTrigger} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminToastProvider>
      <AdminSaveProvider>
        <AdminPageInner />
      </AdminSaveProvider>
    </AdminToastProvider>
  );
}
