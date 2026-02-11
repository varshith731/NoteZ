import { supabase } from "@/config/supabase";

export type SongItem = {
  movie: string;
  name: string;
  path: string; // usually the backend song id or storage path
  coverUrl: string;
  audioUrl: string;
  lyrics?: string;
  id?: string;
};

async function getSignedUrl(bucket: string, path: string): Promise<string> {
  try {
    if (!path) return "";
    
    // If it's already a full URL and not expired, return it
    if (path.startsWith('http') && !path.includes('?token=')) {
      return path;
    }

    // Clean the path (remove any existing signed URL parameters)
    const cleanPath = path.split('?')[0];
    
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(cleanPath, 3600);
    if (error) {
      console.error('[getSignedUrl] Error:', error);
      return "";
    }
    return data?.signedUrl ?? "";
  } catch (error) {
    console.error('[getSignedUrl] Unexpected error:', error);
    return "";
  }
}

// Helper function to normalize song data from different sources
export async function normalizeSongItem(song: any): Promise<SongItem> {
  // If we only have an ID but no audio_url, fetch the full song details from backend
  const songId = song.id || song.path;
  if (songId && !song.audioUrl && !song.audio_url && !song.path?.includes('/')) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/songs/${songId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (response.ok) {
        const data = await response.json();
        if (data.song) {
          // Merge fetched song data with existing data
          Object.assign(song, {
            audio_url: data.song.audioUrl || data.song.audio_url,
            cover_url: data.song.coverUrl || data.song.cover_url,
            title: data.song.title || song.title || song.name,
            artist: data.song.artist || song.artist,
            movie: data.song.movie || song.movie
          });
        }
      }
    } catch (error) {
      console.error('[normalizeSongItem] Failed to fetch song details:', error);
    }
  }

  // Get audio URL from song data
  let audioUrl = song.audioUrl || song.audio_url || "";
  let coverUrl = song.coverUrl || song.cover_url || "/assets/album-placeholder.jpg";

  // If audioUrl is empty or expired, try to get a new signed URL
  if (!audioUrl || audioUrl.includes('?token=') || audioUrl.includes('&token=')) {
    // First, check if audio_url from database is a storage path (not a UUID)
    const audioPath = song.audio_url || song.audioUrl || "";
    
    // Only try to get signed URL if:
    // 1. audioPath looks like a storage path (contains slash, not a UUID format)
    // 2. OR song.path exists and looks like a storage path (not a UUID)
    let storagePath = null;
    
    // Check if audio_url is a storage path (has slash and doesn't look like UUID)
    if (audioPath && audioPath.includes('/') && !audioPath.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      storagePath = audioPath.split('?')[0]; // Remove any query params
    }
    // Check if song.path is a storage path
    else if (song.path && song.path.includes('/') && !song.path.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      storagePath = song.path.split('?')[0];
    }
    
    // Only get signed URL if we have a valid storage path (not a UUID)
    if (storagePath) {
      try {
        const newUrl = await getSignedUrl("songs", storagePath);
        if (newUrl) audioUrl = newUrl;
      } catch (error) {
        console.error("Error getting signed URL for song:", error);
        // If it's already a full URL, use it (might be a direct URL)
        if (audioPath && audioPath.startsWith('http')) {
          audioUrl = audioPath;
        }
      }
    } else if (audioPath && audioPath.startsWith('http')) {
      // If it's already a full HTTP URL, use it directly
      audioUrl = audioPath;
    }
  }

  // If coverUrl is a storage path, get a signed URL
  if (coverUrl && coverUrl.startsWith('songs/')) {
    try {
      const newCoverUrl = await getSignedUrl("songs", coverUrl);
      if (newCoverUrl) coverUrl = newCoverUrl;
    } catch (error) {
      console.error("Error getting signed URL for cover:", error);
      coverUrl = "/assets/album-placeholder.jpg";
    }
  }

  return {
    movie: song.movie || "",
    name: (() => {
      // Prefer explicit title/name fields
      let n = song.title || song.name || "";
      if (!n) {
        // Try to derive from storage path or audioUrl filename
        const candidate = song.path || song.audioUrl || song.audio_url || "";
        if (candidate) {
          try {
            const parts = candidate.split('/');
            let last = parts[parts.length - 1] || parts[parts.length - 2] || candidate;
            last = decodeURIComponent(last);
            n = last.replace(/\.mp3$/i, '').replace(/[-_]+/g, ' ').trim();
          } catch (e) {
            // ignore and fallback
          }
        }
      }
      return n || "Unknown";
    })(),
    path: song.id ? String(song.id) : (song.path || ""),
    id: song.id ? String(song.id) : undefined,
    coverUrl,
    audioUrl,
    lyrics: song.lyrics || undefined,
  };
}

export async function fetchRandomSongs(limit: number): Promise<SongItem[]> {
  console.log("[songs] fetchRandomSongs called with limit:", limit);
  const bucket = "songs";
  const { data: root, error } = await supabase.storage.from(bucket).list("", { limit: 1000, offset: 0 });
  if (error) throw error;
  console.log("[songs] root entries:", root?.map(e => e.name));
  const movieFolders = (root || []).filter((e) => e.name && e.metadata === null);
  const allSongs: SongItem[] = [];
  for (const folder of movieFolders) {
    const prefix = `${folder.name}/`;
    const { data: entries } = await supabase.storage.from(bucket).list(prefix, { limit: 1000, offset: 0 });
    console.log(`[songs] folder ${prefix} entries:`, entries?.map(e => e.name));
    const coverEntry = entries?.find((e) => e.name.toLowerCase().startsWith("cover"))?.name;
    const coverPath = coverEntry ? `${prefix}${coverEntry}` : undefined;
    const coverUrl = coverPath ? await getSignedUrl(bucket, coverPath) : "/assets/album-placeholder.jpg";
    for (const file of entries || []) {
      if (file.name.toLowerCase().endsWith(".mp3")) {
        const audioPath = `${prefix}${file.name}`;
        const audioUrl = await getSignedUrl(bucket, audioPath);
        console.log(`[songs] mp3 found:`, audioPath, Boolean(audioUrl));
        allSongs.push({
          movie: folder.name,
          name: file.name.replace(/\.mp3$/i, ""),
          path: audioPath,
          coverUrl,
          audioUrl,
        });
      }
    }
  }
  for (let i = allSongs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allSongs[i], allSongs[j]] = [allSongs[j], allSongs[i]];
  }
  console.log(`[songs] total mp3 collected:`, allSongs.length);
  return allSongs.slice(0, limit);
}


