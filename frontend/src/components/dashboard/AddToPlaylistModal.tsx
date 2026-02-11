import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
// Use fetch to call backend API endpoints instead of supabase client helper here

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  isPublic: boolean;
}

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  songId: string;
  onSuccess: () => void;
}

export const AddToPlaylistModal = ({ isOpen, onClose, songId, onSuccess }: AddToPlaylistModalProps) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchPlaylists();
    }
  }, [isOpen]);

  const fetchPlaylists = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/playlists/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error(`Failed to fetch playlists: ${response.status}`);

      const playlistsData = await response.json();

      setPlaylists(playlistsData.playlists || playlistsData || []);
    } catch (err) {
      setError('Failed to load playlists');
      console.error('Error fetching playlists:', err);
    } finally {
      setLoading(false);
    }
  };

  const addToPlaylist = async (playlistId: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/playlists/${playlistId}/songs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ songId })
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`Failed to add to playlist: ${response.status} ${errBody}`);
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError('Failed to add song to playlist');
      console.error('Error adding song to playlist:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-96 p-4 max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Add to Playlist</h2>
        
        {error && (
          <div className="bg-red-100 text-red-600 p-2 rounded mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-4">Loading...</div>
        ) : playlists.length === 0 ? (
          <div className="text-center py-4">
            No playlists found. Create a playlist first.
          </div>
        ) : (
          <div className="space-y-2">
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => addToPlaylist(playlist.id)}
                className="w-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg flex items-center space-x-2"
              >
                <div className="w-10 h-10 bg-gray-200 rounded flex-shrink-0">
                  {playlist.coverUrl && (
                    <img
                      src={playlist.coverUrl}
                      alt={playlist.name}
                      className="w-full h-full object-cover rounded"
                    />
                  )}
                </div>
                <div className="flex-grow text-left">
                  <div className="font-medium">{playlist.name}</div>
                  {playlist.description && (
                    <div className="text-sm text-gray-500 truncate">
                      {playlist.description}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
};
