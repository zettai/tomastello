"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ImageUpload from "@/components/ImageUpload";
import AudioUpload from "@/components/AudioUpload";
import AudioManager from "@/components/AudioManager";
import { LinkManager } from "@/components/LinkManager";
import { AdminToastProvider, useAdminToast } from "@/components/AdminToast";
import Image from "next/image";
import type { SecurityEvent, SystemLock } from "@/lib/securityEvents";
import { homePageImageCheckboxLabel } from "@/lib/imageSelectionLabel";
import { readApiError } from "@/lib/readApiError";
import { loadSiteForSave, putSiteWithEtags } from "@/lib/siteSave";

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

function ImageManager({
  refreshTrigger,
}: Readonly<{
  refreshTrigger: number;
}>) {
  const { showSuccess, showError } = useAdminToast();
  const [images, setImages] = useState<ImageMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [isReordering, setIsReordering] = useState(false);

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

  const handleDelete = async (key: string) => {
    if (!confirm("Are you sure you want to delete this image?")) return;

    try {
      const response = await fetch(
        `/api/images/delete?key=${encodeURIComponent(key)}`,
        {
          method: "DELETE",
        }
      );
      const result = await response.json();
      if (result.success) {
        setImages(images.filter((img) => img.key !== key));
        setSelectedImages((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  const moveImage = useCallback(
    (index: number, direction: "up" | "down") => {
      if (isReordering) return;
      setIsReordering(true);

      setImages((prevImages) => {
        const newImages = [...prevImages];
        const newIndex = direction === "up" ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= newImages.length) {
          setIsReordering(false);
          return prevImages;
        }

        [newImages[index], newImages[newIndex]] = [
          newImages[newIndex],
          newImages[index],
        ];
        return newImages;
      });

      requestAnimationFrame(() => {
        setIsReordering(false);
      });
    },
    [isReordering]
  );

  const handleSave = async () => {
    const selectedImagesArray = images
      .filter((img) => selectedImages.has(img.key))
      .map((img) => ({ id: img.key, url: img.url }));

    try {
      const { data, etags } = await loadSiteForSave();
      const response = await putSiteWithEtags(
        { ...data, photos: selectedImagesArray },
        etags
      );
      if (!response.ok) {
        showError(await readApiError(response, "Failed to update site data"));
        return;
      }
      showSuccess("Photo selection saved");
    } catch (error) {
      console.error("Failed to save image selection:", error);
      showError(
        error instanceof Error
          ? error.message
          : "Failed to save image selection"
      );
    }
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
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold admin-text">
          [ MANAGE IMAGES ]
        </h2>
        <button
          onClick={handleSave}
          className="admin-button"
        >
          [ SAVE SELECTION ]
        </button>
      </div>
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
                const next = new Set(selectedImages);
                if (e.target.checked) {
                  next.add(image.key);
                } else {
                  next.delete(image.key);
                }
                setSelectedImages(next);
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
                onClick={() => handleDelete(image.key)}
                className="admin-button px-2 py-1 text-xs"
              >
                DEL
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminPageInner() {
  const { showSuccess, showError } = useAdminToast();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [aboutContent, setAboutContent] = useState("");
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
          setAboutContent(data.about?.content || "");
        }
      } catch {
        // Ignore error
      }
    };

    fetchAboutContent();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch {
      // Ignore error
    }
  };

  const handleAboutUpdate = async (content: string) => {
    try {
      const { data, etags } = await loadSiteForSave();
      const response = await putSiteWithEtags(
        { ...data, about: { content } },
        etags
      );
      if (!response.ok) {
        showError(await readApiError(response, "Failed to update about content"));
        return;
      }
      showSuccess("About text saved");
    } catch (error) {
      console.error("Failed to update about content:", error);
      showError(
        error instanceof Error
          ? error.message
          : "Failed to update about content"
      );
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
        {/* Header */}
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

        {/* User Info Window */}
        <div className="admin-window">
          <div className="admin-title-bar">[ ADMIN.EXE ]</div>
          <div className="p-4 text-center">
            <p className="admin-text">
              &gt; LOGGED IN AS: {user?.email}
            </p>
          </div>
        </div>

        {/* Security Panel */}
        <div className="admin-window">
          <div className="admin-title-bar">[ SECURITY ]</div>
          <div className="p-4 m-2">
            <SecurityPanel />
          </div>
        </div>

        {/* About Section */}
        <div className="admin-window">
          <div className="admin-title-bar">[ UPDATE ABOUT TEXT ]</div>
          <div className="p-4 m-2 space-y-3">
            <textarea
              value={aboutContent}
              onChange={(e) => setAboutContent(e.target.value)}
              className="admin-textarea w-full"
              rows={10}
              maxLength={2000}
              placeholder="Enter about content (max 2000 characters)"
            />
            <div className="flex justify-between items-center">
              <p className="text-sm admin-text-secondary">
                {aboutContent.length}/2000 characters
              </p>
              <button
                onClick={() => handleAboutUpdate(aboutContent)}
                className="admin-button"
              >
                [ SAVE ]
              </button>
            </div>
          </div>
        </div>

        {/* Link Manager */}
        <div className="admin-window">
          <div className="admin-title-bar">[ MANAGE LINKS ]</div>
          <div className="p-4 m-2">
            <LinkManager refreshTrigger={refreshTrigger} />
          </div>
        </div>

        {/* Upload Section */}
        <div className="admin-window">
          <div className="admin-title-bar">[ UPLOAD IMAGES ]</div>
          <div className="p-4 m-2">
            <ImageUpload onUploadSuccess={handleUploadSuccess} adminMode />
          </div>
        </div>

        {/* Image Manager */}
        <div className="admin-window">
          <div className="admin-title-bar">[ IMAGE MANAGER ]</div>
          <div className="p-4 m-2">
            <ImageManager refreshTrigger={refreshTrigger} />
          </div>
        </div>

        {/* Upload Audio Section */}
        <div className="admin-window">
          <div className="admin-title-bar">[ UPLOAD AUDIO ]</div>
          <div className="p-4 m-2">
            <AudioUpload onUploadSuccess={handleUploadSuccess} adminMode />
          </div>
        </div>

        {/* Audio Manager */}
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
      <AdminPageInner />
    </AdminToastProvider>
  );
}
