import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, UserPlus, UserCheck, Loader2, Play, ListPlus, Heart } from 'lucide-react';
// removed unused imports: useAuth, normalizeSongItem

interface CreatorProfile {
  id: string;
  username: string;
  fullName?: string;
  avatarUrl?: string;
  bio?: string;
  role?: string;
  followersCount?: number;
}

interface SongSimple {
  id: string;
  title: string;
  artist?: string;
  audioUrl?: string;
  coverUrl?: string;
  listens?: number;
}

interface AlbumSimple {
  id: string;
  title: string;
  coverUrl?: string;
}

interface PlaylistSimple {
  id: string;
  name: string;
  coverUrl?: string;
}

export default function CreatorDetail({ creatorId, onPlay, onAddToQueue, onToggleLike }: { creatorId: string | null; onPlay: (s: any) => void; onAddToQueue: (s: any) => void; onToggleLike: (s: any) => void; }) {
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [topSongs, setTopSongs] = useState<SongSimple[]>([]);
  const [albums, setAlbums] = useState<AlbumSimple[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSimple[]>([]);

  useEffect(() => {
    if (!creatorId) return;
    setLoading(true);
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const [pRes, songsRes, albumsRes, plsRes, followRes] = await Promise.all([
          fetch(`http://localhost:3001/api/users/profile/id/${creatorId}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`http://localhost:3001/api/users/creators/${creatorId}/top-songs?limit=5`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`http://localhost:3001/api/users/creators/${creatorId}/albums?limit=10`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`http://localhost:3001/api/users/creators/${creatorId}/playlists?limit=10`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`http://localhost:3001/api/users/follow/status/${creatorId}`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (pRes.ok) {
          const pd = await pRes.json();
          setProfile(pd.user || pd);
        }

        if (songsRes.ok) {
          const sd = await songsRes.json();
          const mapped = (sd.songs || sd.items || []).map((s: any) => ({ id: s.id, title: s.title || s.name || s.name, artist: s.artist || s.artist_name || '', audioUrl: s.audio_url || s.audioUrl, coverUrl: s.cover_url || s.coverUrl, listens: s.total_listens || s.listens || s.play_count || 0 }));
          setTopSongs(mapped);
        }

        if (albumsRes.ok) {
          const ad = await albumsRes.json();
          setAlbums((ad.albums || ad.items || []).map((a: any) => ({ id: a.id, title: a.title, coverUrl: a.cover_url || a.coverUrl })));
        }

        if (plsRes.ok) {
          const pd = await plsRes.json();
          setPlaylists((pd.playlists || pd.items || []).map((pl: any) => ({ id: pl.id, name: pl.name, coverUrl: pl.cover_url || pl.coverUrl })));
        }

        if (followRes.ok) {
          const fd = await followRes.json();
          setIsFollowing(fd.isFollowing || fd.following || false);
        }
      } catch (error) {
        console.error('Failed to load creator detail', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [creatorId]);

  const toggleFollow = async () => {
    if (!creatorId) return;
    const token = localStorage.getItem('token');
    try {
      const method = isFollowing ? 'DELETE' : 'POST';
      const res = await fetch(`http://localhost:3001/api/users/follow/${creatorId}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
      if (res.ok) {
        setIsFollowing(!isFollowing);
        window.dispatchEvent(new CustomEvent('followChanged', { detail: { creatorId, isFollowing: !isFollowing } }));
      } else {
        console.error('Follow toggle failed');
      }
    } catch (error) {
      console.error('Follow toggle error', error);
    }
  };

  if (!creatorId) return null;

  return (
    <Card className="bg-black/30 border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              {profile?.avatarUrl ? (
                <img src={profile.avatarUrl} className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-white" />
              )}
            </div>
            <div>
              <h3 className="text-xl text-white font-semibold">{profile?.fullName || profile?.username}</h3>
              <p className="text-gray-400">@{profile?.username}</p>
              {profile?.bio && <p className="text-sm text-gray-500 mt-1 max-w-lg">{profile.bio}</p>}
            </div>
          </div>

          <div>
            <Button onClick={toggleFollow} className={`${isFollowing ? 'bg-gray-600 hover:bg-gray-700' : 'bg-blue-500 hover:bg-blue-600'} text-white`}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : isFollowing ? <UserCheck className="w-4 h-4 mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
              {isFollowing ? 'Following' : 'Follow'}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {/* Top 5 Songs */}
        <div className="mb-6">
          <h4 className="text-white font-semibold mb-3">Top Songs</h4>
          {topSongs.length === 0 ? (
            <p className="text-gray-400">No songs found</p>
          ) : (
            <div className="space-y-3">
              {topSongs.map((s) => (
                <div key={s.id} className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors group cursor-pointer"
                  onClick={() => onPlay({ id: s.id, path: s.id, name: s.title, audioUrl: s.audioUrl, coverUrl: s.coverUrl })}
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                    {s.coverUrl ? <img src={s.coverUrl} className="w-full h-full rounded-lg object-cover" /> : <span className="text-white font-bold">{s.title.charAt(0)}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-white font-medium truncate">{s.title}</h5>
                    <p className="text-gray-400 text-sm truncate">{s.artist}</p>
                    <p className="text-xs text-gray-500">{s.listens ?? 0} listens</p>
                  </div>
                  <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => onAddToQueue({ id: s.id, path: s.id, name: s.title, audioUrl: s.audioUrl, coverUrl: s.coverUrl })}>
                      <Play className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => window.dispatchEvent(new CustomEvent('openAddToPlaylist', { detail: { song: { id: s.id, path: s.id, name: s.title, audioUrl: s.audioUrl, coverUrl: s.coverUrl } } }))}>
                      <ListPlus className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onToggleLike({ id: s.id, path: s.id, name: s.title, audioUrl: s.audioUrl, coverUrl: s.coverUrl })}>
                      <Heart className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Albums (horizontal scroll) */}
        <div className="mb-6">
          <h4 className="text-white font-semibold mb-3">Albums ({albums.length})</h4>
          {albums.length === 0 ? (
            <p className="text-gray-400">No albums</p>
          ) : (
            <div className="flex space-x-4 overflow-x-auto pb-4">
              {albums.map((a) => (
                <div key={a.id} className="w-44 flex-shrink-0 bg-white/5 hover:bg-white/10 transition-colors rounded-lg p-3 cursor-pointer">
                  <div className="w-full aspect-square rounded-lg overflow-hidden bg-white/5 mb-3">
                    {a.coverUrl ? (
                      <img src={a.coverUrl} className="w-full h-full object-cover" alt={a.title} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white bg-gradient-to-br from-purple-500 to-pink-500">
                        <span className="text-3xl font-bold">{a.title.charAt(0)}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-white font-medium truncate">{a.title}</p>
                    <p className="text-gray-400 text-sm mt-0.5">{a.songCount || 0} songs</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Playlists (horizontal scroll) */}
        <div>
          <h4 className="text-white font-semibold mb-3">Playlists</h4>
          {playlists.length === 0 ? (
            <p className="text-gray-400">No playlists</p>
          ) : (
            <div className="flex space-x-3 overflow-x-auto pb-2">
              {playlists.map((pl) => (
                <div key={pl.id} className="w-40 flex-shrink-0">
                  <div className="w-40 h-40 rounded-lg overflow-hidden bg-white/5">
                    {pl.coverUrl ? <img src={pl.coverUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white">{pl.name.charAt(0)}</div>}
                  </div>
                  <p className="text-white mt-2 truncate">{pl.name}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
