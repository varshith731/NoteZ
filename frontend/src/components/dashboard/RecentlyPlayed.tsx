import { useEffect, useState } from "react";
import { Play, Trash2, Heart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SongItem } from "@/lib/songs";

const STORAGE_KEY = "recently_played_v1";

function loadRecentlyPlayed(): SongItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as SongItem[];
    if (!Array.isArray(list)) return [];
    return list;
  } catch {
    return [];
  }
}

export function RecentlyPlayed({ 
  onPlay, 
  onToggleFavorite,
  likedIds 
}: { 
  onPlay: (song: SongItem) => void;
  onToggleFavorite?: (song: SongItem) => void;
  likedIds?: Set<string>;
}) {
  const [items, setItems] = useState<SongItem[]>([]);

  useEffect(() => {
    setItems(loadRecentlyPlayed().slice(0, 4));
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setItems(loadRecentlyPlayed().slice(0, 4));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const removeFromRecentlyPlayed = (songToRemove: SongItem) => {
    try {
      const current = loadRecentlyPlayed();
      const filtered = current.filter(
        (s) => s.path !== songToRemove.path && s.audioUrl !== songToRemove.audioUrl && s.name !== songToRemove.name
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      // Trigger listeners to update UI
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    } catch {
      // ignore
    }
  };

  if (items.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-accent">⏱️</span>
            Recently played
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Your last 4 songs will appear here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-accent">⏱️</span>
          Recently played
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {items.slice(0, 4).map((song) => {
            const isLiked = likedIds && song.id ? likedIds.has(song.id) : false;
            return (
              <div
                key={song.path || song.name}
                className="group relative flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/40 transition"
              >
                <img src={song.coverUrl} alt="cover" className="w-12 h-12 rounded object-cover" />
                <div className="min-w-0 text-left flex-1" onClick={() => onPlay(song)} style={{ cursor: 'pointer' }}>
                  <div className="text-white truncate">{song.name || (song as any).title || 'Unknown'}</div>
                  <div className="text-xs text-muted-foreground truncate">{song.movie || (song as any).artist || ''}</div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlay(song);
                    }}
                    className="w-7 h-7 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center hover:scale-105 transition"
                    aria-label="Play song"
                  >
                    <Play className="w-3.5 h-3.5 text-white" />
                  </button>
                  {onToggleFavorite && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(song);
                      }}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition ${
                        isLiked 
                          ? 'bg-pink-500/20 text-pink-400 hover:bg-pink-500/30' 
                          : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white'
                      }`}
                      aria-label={isLiked ? 'Remove from favorites' : 'Add to favorites'}
                      disabled={!song.id}
                    >
                      <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-pink-400' : ''}`} />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromRecentlyPlayed(song);
                    }}
                    className="w-7 h-7 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/30 hover:text-red-300 transition"
                    aria-label="Remove from recently played"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper to clear all recently played songs
export function clearRecentlyPlayed() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  } catch {
    // ignore
  }
}

// Helper to push a song into the recently played list
export function pushRecentlyPlayed(song: SongItem) {
  try {
    // Ensure the song has proper data structure
    if (!song.id && !song.audioUrl) {
      console.warn('Cannot add song to recently played - missing ID and audioUrl:', song);
      return;
    }
    
    const current = loadRecentlyPlayed();
    // Remove duplicates by ID first, then by path, audioUrl, or name
    const filtered = current.filter((s) => {
      if (song.id && s.id) return s.id !== song.id;
      return s.path !== song.path && s.audioUrl !== song.audioUrl && s.name !== song.name;
    });
    
    const next = [song, ...filtered].slice(0, 20);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    // Trigger listeners
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  } catch {
    // ignore
  }
}



