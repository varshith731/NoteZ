import { Library } from './Library';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { FriendRequestModal } from './FriendRequestModal';

interface SongItem {
  id: string;
  name: string;
  movie: string;
  audioUrl: string;
  coverUrl: string;
}

interface Playlist {
  id: string;
  name: string;
  description?: string;
  songCount: number;
  coverUrl?: string;
  isPublic: boolean;
}

export function LeftSidebar() {
  const [showFriendRequestModal, setShowFriendRequestModal] = useState(false);

  const handlePlay = (song: SongItem) => {
    // This will be handled by the parent component
    console.log('Play song:', song);
  };

  const handlePlaylistSelect = (playlist: Playlist) => {
    // This will be handled by the parent component to show playlist songs in main dashboard
    console.log('Playlist selected:', playlist);
    // You can emit an event or use a callback to communicate with the parent
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('playlistSelected', { detail: playlist }));
    }
  };

  return (
    <div className="space-y-4">
      {/* Library Section */}
      <Library onPlay={handlePlay} onPlaylistSelect={handlePlaylistSelect} />
      
      {/* Add Friends Button */}
      <div className="relative">
        <button
          onClick={() => setShowFriendRequestModal(true)}
          className="w-full p-3 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all flex items-center justify-center space-x-2"
          title="Manage Friends"
        >
          <UserPlus className="w-5 h-5" />
          <span>Friends</span>
        </button>
      </div>
      
      {/* Friend Request Modal */}
      <FriendRequestModal
        isOpen={showFriendRequestModal}
        onClose={() => setShowFriendRequestModal(false)}
      />
    </div>
  );
}


