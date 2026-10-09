"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import { displayFileName } from "@/lib/displayFileName";

interface User {
  id: string;
  email: string;
  createdAt: string;
  lastLogin?: string;
}

interface ImageListItem {
  key: string;
  url: string;
  size: number;
  lastModified: string;
  originalName?: string;
}

interface SitePhoto {
  id: string;
  url: string;
}

const ABOUT_DEBOUNCE_MS = 1500;

const SECTION_JUMPS = [
  { id: "photos", label: "Photos" },
  { id: "audio", label: "Audio" },
  { id: "links", label: "Links" },
  { id: "about", label: "About" },
] as const;

function SecurityPanel() {
  const [lock, setLock] = useState<SystemLock | null>(null);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [unlocking, setUnlocking] = useState(false);
  const [loaded, setLoaded] = useState(false);

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
    } finally {
      setLoaded(true);
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

  const hasContent = Boolean(lock?.locked) || events.length > 0;
  if (!loaded || !hasContent) {
    return null;
  }

  return (
    <details className="admin-window">
      <summary className="admin-title-bar cursor-pointer list-none">
        [ SECURITY ]
      </summary>
      <div className="p-4 m-2 space-y-4">
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
      </div>
    </details>
  );
}

function toSitePhotos(
  orderedKeys: string[],
  byKey: Map<string, ImageListItem>
): SitePhoto[] {
  return orderedKeys
    .map((key) => {
      const img = byKey.get(key);
      return img ? { id: img.key, url: img.url } : null;
    })
    .filter((p): p is SitePhoto => p !== null);
}

function ImageManager({
  refreshTrigger,
}: Readonly<{
  refreshTrigger: number;
}>) {
  const { showSuccess, showError } = useAdminToast();
  const { saveSite } = useAdminSave();
  const [images, setImages] = useState<ImageListItem[]>([]);
  const [onSiteKeys, setOnSiteKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReordering, setIsReordering] = useState(false);
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);
  const deleteTriggerRef = useRef<HTMLElement | null>(null);

  const byKey = useMemo(
    () => new Map(images.map((img) => [img.key, img])),
    [images]
  );

  const onSiteImages = useMemo(
    () => onSiteKeys.map((k) => byKey.get(k)).filter((img): img is ImageListItem => Boolean(img)),
    [onSiteKeys, byKey]
  );

  const notShownImages = useMemo(() => {
    const onSite = new Set(onSiteKeys);
    return images.filter((img) => !onSite.has(img.key));
  }, [images, onSiteKeys]);

  useEffect(() => {
    const load = async () => {
      try {
        const [listRes, siteRes, metaRes] = await Promise.all([
          fetch("/api/images/list"),
          fetch("/api/site"),
          fetch("/api/images/metadata"),
        ]);
        const listJson = await listRes.json();
        const siteJson = await siteRes.json();
        const metaJson = await metaRes.json();
        const list: ImageListItem[] = listJson.success ? listJson.images : [];
        const metaByFile = new Map<string, string>();
        if (metaJson.success && Array.isArray(metaJson.metadata)) {
          for (const m of metaJson.metadata as { fileName?: string; originalName?: string }[]) {
            if (m.fileName && m.originalName) {
              metaByFile.set(m.fileName, m.originalName);
            }
          }
        }
        const enriched = list.map((img) => ({
          ...img,
          originalName: metaByFile.get(img.key),
        }));
        setImages(enriched);
        const photos: SitePhoto[] = Array.isArray(siteJson.photos) ? siteJson.photos : [];
        const known = new Set(enriched.map((i) => i.key));
        setOnSiteKeys(photos.map((p) => p.id).filter((id) => known.has(id)));
      } catch (error) {
        console.error("Failed to fetch images:", error);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [refreshTrigger]);

  const persistPhotos = (
    nextKeys: string[],
    previousKeys: string[],
    successMessage: string
  ) => {
    const photos = toSitePhotos(nextKeys, byKey);
    const previousPhotos = toSitePhotos(previousKeys, byKey);
    saveSite({
      mutate: (data) => ({ ...data, photos }),
      successMessage,
      undo: () => {
        setOnSiteKeys(previousKeys);
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
        setOnSiteKeys((prev) => prev.filter((k) => k !== key));
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
    ? displayFileName(
        pendingDeleteKey,
        byKey.get(pendingDeleteKey)?.originalName
      )
    : "";

  const moveOnSite = (index: number, direction: "up" | "down") => {
    if (isReordering) return;
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= onSiteKeys.length) return;

    setIsReordering(true);
    const previous = onSiteKeys;
    const next = [...onSiteKeys];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    setOnSiteKeys(next);
    persistPhotos(next, previous, "Photo order saved");
    requestAnimationFrame(() => {
      setIsReordering(false);
    });
  };

  const hidePhoto = (key: string) => {
    if (!onSiteKeys.includes(key)) return;
    const previous = onSiteKeys;
    const next = onSiteKeys.filter((k) => k !== key);
    setOnSiteKeys(next);
    persistPhotos(next, previous, "Photo hidden");
  };

  const showPhoto = (key: string) => {
    if (onSiteKeys.includes(key)) return;
    const previous = onSiteKeys;
    const next = [...onSiteKeys, key];
    setOnSiteKeys(next);
    persistPhotos(next, previous, "Photo shown on site");
  };

  const renderRow = (
    image: ImageListItem,
    group: "on-site" | "not-shown",
    index: number,
    groupLength: number
  ) => (
    <div
      key={image.key}
      className="admin-inset flex items-center space-x-4 p-3"
      data-photo-group={group}
    >
      <Image
        src={image.url}
        alt={displayFileName(image.key, image.originalName)}
        width={64}
        height={64}
        className="object-cover h-auto"
        quality={50}
        loading="lazy"
        sizes="64px"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium admin-text break-words line-clamp-2">
          {displayFileName(image.key, image.originalName)}
        </p>
        <p className="text-xs admin-text-secondary mt-1">
          {new Date(image.lastModified).toLocaleDateString()}
        </p>
      </div>
      <div className="flex space-x-1">
        {group === "on-site" && (
          <>
            <button
              type="button"
              onClick={() => moveOnSite(index, "up")}
              disabled={index === 0}
              className="admin-button px-2 py-1 text-xs disabled:opacity-50"
              aria-label={`Move ${displayFileName(image.key, image.originalName)} up`}
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => moveOnSite(index, "down")}
              disabled={index === groupLength - 1}
              className="admin-button px-2 py-1 text-xs disabled:opacity-50"
              aria-label={`Move ${displayFileName(image.key, image.originalName)} down`}
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => hidePhoto(image.key)}
              className="admin-button px-2 py-1 text-xs"
              aria-label={`Hide ${displayFileName(image.key, image.originalName)} from site`}
            >
              HIDE
            </button>
          </>
        )}
        {group === "not-shown" && (
          <button
            type="button"
            onClick={() => showPhoto(image.key)}
            className="admin-button px-2 py-1 text-xs"
            aria-label={`Show ${displayFileName(image.key, image.originalName)} on site`}
          >
            SHOW
          </button>
        )}
        <button
          type="button"
          onClick={(e) => requestDelete(image.key, e.currentTarget)}
          className="admin-button px-2 py-1 text-xs"
        >
          DEL
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="p-4 text-center admin-text">
        [ LOADING IMAGES... ]
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {images.length === 0 && (
        <div className="p-4 text-center admin-text">[ NO IMAGES ]</div>
      )}

      <section aria-labelledby="on-site-heading" className="space-y-2">
        <h3 id="on-site-heading" className="admin-text font-bold">
          On the site ({onSiteImages.length})
        </h3>
        {onSiteImages.length === 0 ? (
          <p className="admin-text-secondary text-sm">No photos on the site.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {onSiteImages.map((image, index) =>
              renderRow(image, "on-site", index, onSiteImages.length)
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="not-shown-heading" className="space-y-2">
        <h3 id="not-shown-heading" className="admin-text font-bold">
          Not shown ({notShownImages.length})
        </h3>
        {notShownImages.length === 0 ? (
          <p className="admin-text-secondary text-sm">All photos are on the site.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {notShownImages.map((image, index) =>
              renderRow(image, "not-shown", index, notShownImages.length)
            )}
          </div>
        )}
      </section>

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

        <nav
          aria-label="Admin sections"
          className="admin-window"
        >
          <div className="admin-title-bar">[ JUMP ]</div>
          <ul className="p-3 m-2 flex flex-wrap gap-2 list-none">
            {SECTION_JUMPS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="admin-button text-sm">
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <section id="photos" className="admin-window scroll-mt-4">
          <div className="admin-title-bar">[ PHOTOS ]</div>
          <div className="p-4 m-2 space-y-6">
            <ImageUpload onUploadSuccess={handleUploadSuccess} adminMode />
            <ImageManager refreshTrigger={refreshTrigger} />
          </div>
        </section>

        <section id="audio" className="admin-window scroll-mt-4">
          <div className="admin-title-bar">[ AUDIO ]</div>
          <div className="p-4 m-2 space-y-6">
            <AudioUpload onUploadSuccess={handleUploadSuccess} adminMode />
            <AudioManager refreshTrigger={refreshTrigger} />
          </div>
        </section>

        <section id="links" className="admin-window scroll-mt-4">
          <div className="admin-title-bar">[ LINKS ]</div>
          <div className="p-4 m-2">
            <LinkManager refreshTrigger={refreshTrigger} />
          </div>
        </section>

        <section id="about" className="admin-window scroll-mt-4">
          <div className="admin-title-bar">[ ABOUT ]</div>
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
        </section>

        <SecurityPanel />
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
