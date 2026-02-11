// Simplified version for testing
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { useState, useEffect } from "react";
// Uses backend APIs to ensure only the current user's playlists are shown

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
}

export const AddToPlaylistDialog = ({
  isOpen,
  onClose,
  songPath,
}: {
  isOpen: boolean;
  onClose: () => void;
  songPath: string;
}) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPlaylists();
    }
  }, [isOpen]);

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/api/playlists/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load playlists');
      const json = await res.json();
      const data = json.playlists || [];
      setPlaylists(data.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        coverUrl: p.coverUrl || null,
      })));
    } catch (err) {
      console.error("Failed to load playlists:", err);
      setError("Failed to load playlists");
    } finally {
      setLoading(false);
    }
  };

  const addToPlaylist = async (playlistId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Optimistic UI: emit event so listeners can update immediately
      window.dispatchEvent(new CustomEvent('songAddedToPlaylist', { detail: { playlistId, songId: songPath } }));

      // Add via backend to enforce ownership and RLS
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3001/api/playlists/${encodeURIComponent(playlistId)}/songs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ songId: songPath })
      });
      if (!res.ok) {
        if (res.status === 400) {
          setError("This song is already in the playlist");
          window.dispatchEvent(new CustomEvent('songAddToPlaylistFailed', { detail: { playlistId, songId: songPath } }));
          return;
        }
        window.dispatchEvent(new CustomEvent('songAddToPlaylistFailed', { detail: { playlistId, songId: songPath } }));
        const e = await res.json().catch(()=>({}));
        throw new Error(e.error || 'Failed to add song');
      }

      onClose();
    } catch (err) {
      console.error("Failed to add song to playlist:", err);
      setError("Failed to add song to playlist. Please try again.");
      window.dispatchEvent(new CustomEvent('songAddToPlaylistFailed', { detail: { playlistId, songId: songPath } }));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#0a0a0a]/90 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md p-6 space-y-4 bg-[#121212] border-[#2a2a2a] text-white">
        <h2 className="text-xl font-semibold border-b border-[#2a2a2a] pb-4 flex items-center gap-2">
          <span className="text-purple-500">Add to Playlist</span>
        </h2>

        {error && (
          <div className="p-2 text-sm text-red-400 bg-red-900/20 rounded-lg border border-red-900/50">
            {error}
          </div>
        )}

        <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="text-center py-4 text-gray-400">Loading...</div>
          ) : playlists.length === 0 ? (
            <div className="text-center py-4 text-gray-400">No playlists found</div>
          ) : (
            playlists.map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => addToPlaylist(playlist.id)}
                className="w-full p-3 text-left hover:bg-[#2a2a2a] rounded-lg flex items-center space-x-3 transition-colors border border-transparent hover:border-purple-500/20"
              >
                <div className="w-12 h-12 bg-[#2a2a2a] rounded-lg flex-shrink-0 overflow-hidden">
                  {playlist.coverUrl ? (
                    <img
                      src={playlist.coverUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-purple-500/10">
                      <svg className="w-6 h-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-medium text-white">{playlist.name}</div>
                  {playlist.description && (
                    <div className="text-sm text-gray-400">
                      {playlist.description}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="flex justify-end pt-4 border-t border-[#2a2a2a] mt-4">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="bg-[#2a2a2a] hover:bg-[#323232] text-white border-purple-500/20 hover:border-purple-500/40"
          >
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
};
