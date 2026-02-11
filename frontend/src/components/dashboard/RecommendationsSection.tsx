import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Music, Disc3, ListMusic, Play } from "lucide-react";
import { useEffect, useState } from "react";

interface Song {
  id: string;
  title: string;
  artist: string;
  movie?: string;
  audioUrl: string;
  coverUrl?: string;
  category?: string;
  categoryColor?: string;
}

interface Album {
  id: string;
  title: string;
  description?: string;
  coverUrl?: string;
  releaseDate?: string;
  songCount: number;
  totalListens: number;
  creator: string;
}

interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  creator: string;
  songCount: number;
}

type TabType = 'songs' | 'albums' | 'playlists';

export function RecommendationsSection() {
  const [activeTab, setActiveTab] = useState<TabType>('songs');
  const [songs, setSongs] = useState<Song[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRecommendations(activeTab);
  }, [activeTab]);

  const fetchRecommendations = async (type: TabType) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      // Try recommendations endpoint (personalized if token present)
      const url = `http://localhost:3001/api/recommendations/${type}?limit=5`;
      const opts: RequestInit = token ? { headers: { 'Authorization': `Bearer ${token}` } } : {};

      let response = await fetch(url, opts);
      // If recommendations endpoint is not available or returns error, fall back for songs to public songs
      if (!response.ok) {
        if (type === 'songs') {
          response = await fetch(`http://localhost:3001/api/songs?limit=5`);
        }
      }

      if (response.ok) {
        const data = await response.json();
        if (type === 'songs') {
          // Support multiple possible shapes returned by API
          const list = data.recommendations || data.songs || data.items || [];
          setSongs(list || []);
        } else if (type === 'albums') {
          const list = data.albums || data.items || [];
          setAlbums(list || []);
        } else if (type === 'playlists') {
          const list = data.playlists || data.items || [];
          setPlaylists(list || []);
        }
      }
    } catch (error) {
      console.error(`Failed to fetch ${type} recommendations:`, error);
    } finally {
      setLoading(false);
    }
  };

  const handleSongPlay = (song: Song) => {
    window.dispatchEvent(new CustomEvent('playSongFromAI', { detail: song }));
  };

  const handleAlbumClick = (album: Album) => {
    console.log('Open album:', album);
    // TODO: Implement album view
  };

  const handlePlaylistClick = (playlist: Playlist) => {
    window.dispatchEvent(new CustomEvent('playlistSelected', { 
      detail: { 
        id: playlist.id, 
        name: playlist.name,
        songCount: playlist.songCount,
        coverUrl: playlist.coverUrl
      } 
    }));
  };

  const tabs = [
    { id: 'songs' as TabType, label: 'Songs', icon: Music },
    { id: 'albums' as TabType, label: 'Albums', icon: Disc3 },
    { id: 'playlists' as TabType, label: 'Playlists', icon: ListMusic }
  ];

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <span className="text-accent">🎯</span>
            For You
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTab(tab.id)}
                  className={activeTab === tab.id ? "bg-accent text-white" : ""}
                >
                  <Icon className="w-4 h-4 mr-1" />
                  {tab.label}
                </Button>
              );
            })}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
              <p className="text-muted-foreground text-sm">Crafting your recommendations...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Grid of Items */}
            {((activeTab === 'songs' && songs.length > 0) ||
              (activeTab === 'albums' && albums.length > 0) ||
              (activeTab === 'playlists' && playlists.length > 0)) && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {activeTab === 'songs' && songs.map(song => (
                  <div
                    key={song.id}
                    className="group relative aspect-square bg-secondary/30 rounded-lg overflow-hidden hover:bg-secondary/50 transition-all cursor-pointer"
                    onClick={() => handleSongPlay(song)}
                  >
                    <img
                      src={song.coverUrl || '/assets/album-placeholder.jpg'}
                      alt={song.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="w-12 h-12 text-white" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-xs font-medium text-white truncate">{song.title}</p>
                      <p className="text-xs text-gray-300 truncate">{song.artist}</p>
                    </div>
                  </div>
                ))}

                {activeTab === 'albums' && albums.map(album => (
                  <div
                    key={album.id}
                    className="group relative aspect-square bg-secondary/30 rounded-lg overflow-hidden hover:bg-secondary/50 transition-all cursor-pointer"
                    onClick={() => handleAlbumClick(album)}
                  >
                    <img
                      src={album.coverUrl || '/assets/album-placeholder.jpg'}
                      alt={album.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Disc3 className="w-12 h-12 text-white" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-xs font-medium text-white truncate">{album.title}</p>
                      <p className="text-xs text-gray-300 truncate">{album.songCount} songs</p>
                    </div>
                  </div>
                ))}

                {activeTab === 'playlists' && playlists.map(playlist => (
                  <div
                    key={playlist.id}
                    className="group relative aspect-square bg-secondary/30 rounded-lg overflow-hidden hover:bg-secondary/50 transition-all cursor-pointer"
                    onClick={() => handlePlaylistClick(playlist)}
                  >
                    <img
                      src={playlist.coverUrl || '/assets/album-placeholder.jpg'}
                      alt={playlist.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <ListMusic className="w-12 h-12 text-white" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-xs font-medium text-white truncate">{playlist.name}</p>
                      <p className="text-xs text-gray-300 truncate">{playlist.songCount} songs</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State Messages */}
            {!loading && (
              (activeTab === 'songs' && songs.length === 0) ||
              (activeTab === 'albums' && albums.length === 0) ||
              (activeTab === 'playlists' && playlists.length === 0)
            ) && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-secondary/30 rounded-full flex items-center justify-center mb-4">
                  {activeTab === 'songs' && <Music className="w-8 h-8 text-accent" />}
                  {activeTab === 'albums' && <Disc3 className="w-8 h-8 text-accent" />}
                  {activeTab === 'playlists' && <ListMusic className="w-8 h-8 text-accent" />}
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No {activeTab} found</h3>
                <p className="text-muted-foreground max-w-sm">
                  {activeTab === 'songs' && "We're still learning your taste! Start by exploring and playing some songs."}
                  {activeTab === 'albums' && "Looking forward to showing you some great albums. Start exploring our collection!"}
                  {activeTab === 'playlists' && "Start following other users to discover their public playlists here!"}
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

