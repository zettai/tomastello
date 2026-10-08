"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { Photo } from "@/types/site";

export default function PhotoGalleryClient({ photos }: { photos: Photo[] }) {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedPhoto(null);
    };
    globalThis.addEventListener("keydown", handleEsc);
    return () => globalThis.removeEventListener("keydown", handleEsc);
  }, []);

  return (
    <>
      <div className="retro-window">
        <div className="retro-title-bar">[ IMAGES.DIR ]</div>
        <div className="p-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                className="retro-inset relative aspect-square cursor-pointer w-full bg-background overflow-hidden"
                onClick={() => setSelectedPhoto(photo)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setSelectedPhoto(photo);
                }}
                aria-label={`View photo ${photo.id}`}
              >
                <Image
                  src={photo.url}
                  alt={`Photo ${photo.id}`}
                  className="object-cover"
                  fill
                  sizes="(max-width: 768px) 50vw, 33vw"
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {selectedPhoto && (
        <dialog open className="fixed inset-0 z-50 p-0 bg-transparent border-none">
          <button
            type="button"
            className="fixed inset-0 w-full h-full"
            style={{ backgroundColor: "var(--background)", opacity: 0.95 }}
            onClick={() => setSelectedPhoto(null)}
            aria-label="Close photo preview"
          />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="retro-window relative w-full max-w-4xl">
              <div className="retro-title-bar flex justify-between items-center">
                <span>[ IMAGE_VIEWER.EXE - {selectedPhoto.id} ]</span>
                <button
                  type="button"
                  onClick={() => setSelectedPhoto(null)}
                  className="retro-button px-2 py-0 text-xs ml-2"
                  aria-label="Close photo preview"
                >
                  [X]
                </button>
              </div>
              <div className="retro-inset m-2 bg-background">
                <div className="relative w-full aspect-square">
                  <Image
                    src={selectedPhoto.url}
                    alt={`Photo ${selectedPhoto.id}`}
                    className="object-contain"
                    fill
                    sizes="(max-width: 768px) 100vw, 896px"
                  />
                </div>
              </div>
              <div className="p-2 text-center text-xs text-foreground-secondary">
                [ PRESS ESC OR CLICK [X] TO CLOSE ]
              </div>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
