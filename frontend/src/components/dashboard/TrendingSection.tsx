import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Music, Disc3, ListMusic, Play, Maximize2, Plus, Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { TrendingModal } from "./TrendingModal";

interface TrendingItem {
  rank: number;
  id: string;
  title?: string;
  name?: string;
  artist?: string;
  audioUrl?: string;
  coverUrl?: string;
  songCount?: number;
  totalPlays?: number;
  creator?: string;
}

type TabType = 'songs' | 'albums' | 'playlists';

export function TrendingSection() {
  const [activeTab, setActiveTab] = useState<TabType>('songs');
  const [songs, setSongs] = useState<TrendingItem[]>([]);
  const [albums, setAlbums] = useState<TrendingItem[]>([]);
  const [playlists, setPlaylists] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchTrending(activeTab);
  }, [activeTab]);

  const fetchTrending = async (type: TabType) => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:3001/api/trending/${type}?limit=5&period=7`);

      if (response.ok) {
        const data = await response.json();
        if (type === 'songs') {
          setSongs(data.trending || []);
        } else if (type === 'albums') {
          setAlbums(data.trending || []);
        } else if (type === 'playlists') {
          setPlaylists(data.trending || []);
        }
      }
    } catch (error) {
      console.error(`Failed to fetch trending ${type}:`, error);
    } finally {
      setLoading(false);
    }
  };

  const handleSongPlay = (song: TrendingItem) => {
    window.dispatchEvent(new CustomEvent('playSongFromAI', { 
      detail: { 
        id: song.id, 
        name: song.title,
        title: song.title,
        artist: song.artist,
        audioUrl: song.audioUrl,
        coverUrl: song.coverUrl
      } 
    }));
  };

  const handleAlbumClick = (album: TrendingItem) => {
    console.log('Open album:', album);
    // TODO: Implement album view
  };

  const handlePlaylistClick = (playlist: TrendingItem) => {
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

  const getCurrentItems = () => {
    switch (activeTab) {
      case 'songs': return songs;
      case 'albums': return albums;
      case 'playlists': return playlists;
    }
  };

  return (
    <>
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <span className="text-accent">🔥</span>
              Trending
            </CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowModal(true)}
                className="hover:bg-accent/20"
              >
                <Maximize2 className="w-4 h-4 mr-1" />
                View All
              </Button>
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {getCurrentItems().map((item) => (
                <div
                  key={item.id}
                  className="group relative aspect-square bg-secondary/30 rounded-lg overflow-hidden hover:bg-secondary/50 transition-all cursor-pointer"
                  onClick={() => {
                    if (activeTab === 'songs') handleSongPlay(item);
                    else if (activeTab === 'albums') handleAlbumClick(item);
                    else handlePlaylistClick(item);
                  }}
                >
                  {/* Rank Badge */}
                  <div className="absolute top-2 left-2 z-10 bg-accent text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                    {item.rank}
                  </div>
                  
                  <img
                    src={item.coverUrl || '/assets/album-placeholder.jpg'}
                    alt={item.title || item.name}
                    className="w-full h-full object-cover"
                  />
                  
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    {activeTab === 'songs' && <Play className="w-12 h-12 text-white" />}
                    {activeTab === 'albums' && <Disc3 className="w-12 h-12 text-white" />}
                    {activeTab === 'playlists' && <ListMusic className="w-12 h-12 text-white" />}
                  </div>
                  
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-xs font-medium text-white truncate">
                      {item.title || item.name}
                    </p>
                    <p className="text-xs text-gray-300 truncate">
                      {activeTab === 'songs' && item.artist}
                      {activeTab === 'albums' && `${item.songCount} songs`}
                      {activeTab === 'playlists' && `${item.songCount} songs`}
                    </p>
                    {activeTab === 'songs' && (
                      <div className="absolute right-2 bottom-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          aria-label="Add to queue"
                          className="w-8 h-8 flex items-center justify-center rounded-md bg-white/10 hover:bg-white/15 text-white transition"
                          onClick={() => window.dispatchEvent(new CustomEvent('addToQueue', { detail: {
                            id: item.id,
                            name: item.title || item.name,
                            movie: item.artist,
                            audioUrl: item.audioUrl,
                            coverUrl: item.coverUrl,
                            path: item.id
                          } }))}
                        >
                          <Plus className="w-4 h-4" />
                        </button>

                        <button
                          aria-label="Add to playlist"
                          className="w-8 h-8 flex items-center justify-center rounded-md bg-white/10 hover:bg-white/15 text-white transition"
                          onClick={() => window.dispatchEvent(new CustomEvent('openAddToPlaylist', { detail: {
                            id: item.id,
                            name: item.title || item.name,
                            movie: item.artist,
                            audioUrl: item.audioUrl,
                            coverUrl: item.coverUrl,
                            path: item.id
                          } }))}
                        >
                          <ListMusic className="w-4 h-4" />
                        </button>

                        <button
                          aria-label="Like"
                          className="w-8 h-8 flex items-center justify-center rounded-md bg-white/10 hover:bg-white/15 text-white transition"
                          onClick={() => window.dispatchEvent(new CustomEvent('toggleLike', { detail: {
                            id: item.id,
                            name: item.title || item.name,
                            movie: item.artist,
                            audioUrl: item.audioUrl,
                            coverUrl: item.coverUrl,
                            path: item.id
                          } }))}
                        >
                          <Heart className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {!loading && getCurrentItems().length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No trending {activeTab} available.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <TrendingModal 
        open={showModal} 
        onClose={() => setShowModal(false)} 
      />
    </>
  );
}

