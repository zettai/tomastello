"use client";

import { useEffect, useState } from "react";
import type { AudioMetadata } from "@/types/audio";

export default function SongPlayer() {
  const [songs, setSongs] = useState<AudioMetadata[]>([]);

  useEffect(() => {
    const fetchSongs = async () => {
      try {
        const res = await fetch("/api/audio/list");
        const data = await res.json();
        if (data.success && Array.isArray(data.audio)) {
          setSongs(data.audio);
        }
      } catch (err) {
        console.error("Failed to load songs:", err);
      }
    };
    fetchSongs();
  }, []);

  if (songs.length === 0) return null;

  return (
    <div className="retro-window">
      <div className="retro-title-bar">[ MUSIC.DIR ]</div>
      <div className="p-4 space-y-3">
        {songs.map((song) => (
          <div key={song.id} className="retro-inset p-3 space-y-1">
            <p className="text-sm font-medium text-foreground">{song.title}</p>
            <audio controls src={song.url} className="w-full">
              <track kind="captions" />
            </audio>
          </div>
        ))}
      </div>
    </div>
  );
}
