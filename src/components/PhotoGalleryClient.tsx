"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { Photo } from "@/types/site";
import { OverlayModal } from "./OverlayModal";

function galleryCaption(index: number, total: number): string {
  return `Photo ${index + 1} of ${total} from Tomás Tello's gallery`;
}

export default function PhotoGalleryClient({ photos }: { photos: Photo[] }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const triggerRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const selected =
    selectedIndex === null ? null : (photos[selectedIndex] ?? null);
  const caption =
    selectedIndex === null || !selected
      ? ""
      : galleryCaption(selectedIndex, photos.length);

  const openAt = (index: number) => {
    returnFocusRef.current = triggerRefs.current[index];
    setSelectedIndex(index);
  };

  return (
    <>
      <div className="retro-window">
        <div className="retro-title-bar">[ IMAGES.DIR ]</div>
        <div className="p-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {photos.map((photo, index) => (
              <button
                key={photo.id}
                ref={(el) => {
                  triggerRefs.current[index] = el;
                }}
                type="button"
                className="retro-inset relative aspect-square cursor-pointer w-full bg-background overflow-hidden"
                onClick={() => openAt(index)}
                aria-label={galleryCaption(index, photos.length)}
              >
                <Image
                  src={photo.url}
                  alt={galleryCaption(index, photos.length)}
                  className="object-cover"
                  fill
                  sizes="(max-width: 768px) 50vw, 33vw"
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      <OverlayModal
        open={selected !== null}
        onClose={() => setSelectedIndex(null)}
        title={caption || "Photo"}
        panelClassName="retro-window"
        titleBarClassName="retro-title-bar"
        returnFocusRef={returnFocusRef}
        initialFocusRef={closeBtnRef}
      >
        {selected && (
          <>
            <div className="flex justify-end px-2 pt-2">
              <button
                ref={closeBtnRef}
                type="button"
                className="retro-button px-2 py-0 text-xs"
                onClick={() => setSelectedIndex(null)}
                aria-label="Close photo preview"
              >
                [X]
              </button>
            </div>
            <div className="retro-inset m-2 bg-background">
              <div className="relative w-full aspect-square">
                <Image
                  src={selected.url}
                  alt={caption}
                  className="object-contain"
                  fill
                  sizes="(max-width: 768px) 100vw, 896px"
                />
              </div>
            </div>
            <div className="p-2 text-center text-xs text-foreground-secondary">
              [ PRESS ESC OR CLICK OUTSIDE TO CLOSE ]
            </div>
          </>
        )}
      </OverlayModal>
    </>
  );
}
