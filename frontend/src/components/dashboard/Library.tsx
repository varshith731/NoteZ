import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, ListMusic, Users, Plus, X, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface Song {
  id: string;
  title: string;
  artist: string;
  movie?: string;
  audioUrl: string;
  coverUrl?: string;
}

interface Playlist {
  id: string;
  name: string;
  description?: string;
  songCount: number;
  coverUrl?: string;
  isPublic: boolean;
  /** added: server maps to is_favorites */
  isFavorites?: boolean;
}

interface Creator {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  bio?: string;
}

interface LibraryProps {
  onPlay: (song: Song) => void;
  onPlaylistSelect?: (playlist: Playlist) => void;
}

export function Library({ onPlay, onPlaylistSelect }: LibraryProps) {
  const [activeTab, setActiveTab] = useState<'playlists' | 'creators'>('playlists');
  const [favorites, setFavorites] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [followedCreators, setFollowedCreators] = useState<Creator[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistPublic, setNewPlaylistPublic] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  const [showPlaylistMenu, setShowPlaylistMenu] = useState<string | null>(null);
  const [showEditPlaylist, setShowEditPlaylist] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [editPlaylistName, setEditPlaylistName] = useState('');
  const [editPlaylistDescription, setEditPlaylistDescription] = useState('');
  const [editPlaylistPublic, setEditPlaylistPublic] = useState(true);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingPlaylist, setDeletingPlaylist] = useState<Playlist | null>(null);

  const { currentUser } = useAuth();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchLibraryData();
    }
  }, [activeTab]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!showPlaylistMenu) return;
      const target = e.target as Node;
      // If click is inside the open menu or its button, do nothing
      const menuEl = document.querySelector(`[data-playlist-menu="${showPlaylistMenu}"]`);
      if (menuEl && menuEl.contains(target)) return;
      const btnEl = document.querySelector(`[data-playlist-btn="${showPlaylistMenu}"]`);
      if (btnEl && btnEl.contains(target)) return;
      setShowPlaylistMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPlaylistMenu]);

  // Realtime subscriptions
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel('library-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'playlists' },
        (payload) => {
          const record: any = payload.new || payload.old;
          if (!record) return;
          if (record.creator_id === currentUser.id) refreshPlaylists();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'playlist_songs' },
        () => refreshPlaylists()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  // Listen for favorites change events from elsewhere in the app
  useEffect(() => {
    const handler = (event: CustomEvent) => {
      const token = localStorage.getItem('token');
      if (token) {
        fetch('http://localhost:3001/api/favorites?limit=50', {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => (r.ok ? r.json() : Promise.reject('Failed to fetch favorites')))
          .then((data) => setFavorites(data.favorites || []))
          .catch((e) => console.error('Error refreshing favorites:', e));
      }
    };
    window.addEventListener('favoritesChanged', handler as EventListener);
    return () => window.removeEventListener('favoritesChanged', handler as EventListener);
  }, []);

  // Listen for follow changes to refresh the followed creators list
  useEffect(() => {
    const handler = (event: CustomEvent) => {
      const token = localStorage.getItem('token');
      if (token) {
        fetchFollowedCreators(token).catch((e) => console.error('Error refreshing followed creators:', e));
      }
    };
    window.addEventListener('followChanged', handler as EventListener);
    return () => window.removeEventListener('followChanged', handler as EventListener);
  }, []);

  // Remove ensureFavoritesExists - favorites playlist creation is now handled by the favorites API via ensure_favorites_playlist RPC

  const fetchLibraryData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      if (activeTab === 'playlists') {
        try {
          const [playlistResponse, favoritesResponse] = await Promise.all([
            fetch('http://localhost:3001/api/playlists/me', {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch('http://localhost:3001/api/favorites?limit=50', {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);

          if (playlistResponse.ok) {
            const data = await playlistResponse.json();
            let list: Playlist[] = (data.playlists || []).map((p: any) => ({
              ...p,
              // Use isFavorites field from backend
              isFavorites: p.isFavorites ?? false,
            }));
            // Make sure Favorites (isFavorites) are shown at the top
            list = list.sort((a, b) => (a.isFavorites === b.isFavorites ? 0 : a.isFavorites ? -1 : 1));
            setPlaylists(list);
          }

          if (favoritesResponse.ok) {
            const data = await favoritesResponse.json();
            setFavorites(data.favorites || []);
          }
        } catch (error) {
          console.error('Error fetching playlists or favorites:', error);
        }
      } else {
        try {
          await fetchFollowedCreators(token);
        } catch (error) {
          console.error('Error fetching followed creators:', error);
        }
      }
    } catch (error) {
      console.error('Failed to fetch library data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshPlaylists = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(
        'http://localhost:3001/api/playlists/me?fields=id,name,description,songCount,isPublic,coverUrl,isFavorites',
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        let list: Playlist[] = (data.playlists || []).map((p: any) => ({
          ...p,
          isFavorites: p.isFavorites ?? false,
        }));
        list = list.sort((a, b) => (a.isFavorites === b.isFavorites ? 0 : a.isFavorites ? -1 : 1));
        setPlaylists(list);
      }

      // keep favorites songs cached fresh too (optional)
      try {
        const favResp = await fetch('http://localhost:3001/api/favorites?limit=50', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (favResp.ok) {
          const data = await favResp.json();
          setFavorites(data.favorites || []);
        }
      } catch {}
    } catch (error) {
      console.error('Failed to fetch playlists:', error);
    }
  };

  const fetchFollowedCreators = async (token: string) => {
    try {
      const response = await fetch('http://localhost:3001/api/users/following', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setFollowedCreators(data.creators || []);
      }
    } catch (error) {
      console.error('Failed to fetch followed creators:', error);
    }
  };

  const createPlaylist = async () => {
    if (!newPlaylistName.trim()) return;

    setIsCreating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/playlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newPlaylistName.trim(),
          description: '',
          isPublic: newPlaylistPublic,
          isFavorites: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const newPlaylist: Playlist = {
          ...data.playlist,
          isFavorites:
            data.playlist.isFavorites ?? data.playlist.is_favorites ?? false,
        };
        setPlaylists((prev) => [...prev, newPlaylist]);

        setCreateSuccess('Playlist created successfully!');
        setCreateError('');
        setNewPlaylistName('');
        setShowCreatePlaylist(false);
        setNewPlaylistPublic(true);

        await fetchLibraryData();

        setTimeout(() => setCreateSuccess(''), 3000);
      } else {
        const errorData = await response.json();
        console.error('Failed to create playlist:', errorData);
        setCreateError(errorData.error || 'Failed to create playlist');
      }
    } catch (error) {
      console.error('Failed to create playlist:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handlePlaylistClick = (playlist: Playlist) => {
    if (onPlaylistSelect) onPlaylistSelect(playlist);
  };

  const handleEditPlaylist = (playlist: Playlist) => {
    if (playlist.isFavorites) return; // Favorites immutable
    setEditingPlaylist(playlist);
    setEditPlaylistName(playlist.name);
    setEditPlaylistDescription(playlist.description || '');
    setEditPlaylistPublic(playlist.isPublic);
    setShowEditPlaylist(true);
    setShowPlaylistMenu(null);
  };

  const handleDeletePlaylist = (playlist: Playlist) => {
    if (playlist.isFavorites) return; // cannot delete
    setDeletingPlaylist(playlist);
    setShowDeleteConfirm(true);
    setShowPlaylistMenu(null);
  };

  const updatePlaylist = async () => {
    if (!editingPlaylist || !editPlaylistName.trim()) return;
    if (editingPlaylist.isFavorites) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/playlists/${editingPlaylist.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editPlaylistName.trim(),
          description: editPlaylistDescription.trim(),
          isPublic: editPlaylistPublic,
        }),
      });

      if (response.ok) {
        setPlaylists((prev) =>
          prev.map((p) =>
            p.id === editingPlaylist.id
              ? { ...p, name: editPlaylistName.trim(), description: editPlaylistDescription.trim(), isPublic: editPlaylistPublic }
              : p
          )
        );
        setShowEditPlaylist(false);
        setEditingPlaylist(null);
        setEditPlaylistName('');
        setEditPlaylistDescription('');
        setEditPlaylistPublic(true);
      } else {
        console.error('Failed to update playlist');
      }
    } catch (error) {
      console.error('Error updating playlist:', error);
    }
  };

  const deletePlaylist = async () => {
    if (!deletingPlaylist) return;
    if (deletingPlaylist.isFavorites) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/playlists/${deletingPlaylist.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setPlaylists((prev) => prev.filter((p) => p.id !== deletingPlaylist.id));
        setShowDeleteConfirm(false);
        setDeletingPlaylist(null);
      } else {
        console.error('Failed to delete playlist');
      }
    } catch (error) {
      console.error('Error deleting playlist:', error);
    }
  };

  const renderPlaylists = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">Your Playlists</h3>
        <Button
          size="sm"
          onClick={() => {
            setShowCreatePlaylist(true);
            setCreateError('');
            setCreateSuccess('');
            setNewPlaylistName('');
            setNewPlaylistPublic(true);
          }}
          className="bg-purple-500 hover:bg-purple-600 text-white p-2 rounded-lg transition-all"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {createSuccess && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-green-400 text-sm">{createSuccess}</p>
        </div>
      )}

      {playlists.length === 0 ? (
        <div className="text-center py-8">
          <ListMusic className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-400">No playlists yet</p>
          <p className="text-sm text-gray-500">Create your first playlist</p>
        </div>
      ) : (
        <div className="space-y-3">
          {playlists.map((playlist) => {
            const isFav = !!playlist.isFavorites;
            return (
              <div
                key={playlist.id}
                className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors group cursor-pointer ${
                  isFav
                    ? 'bg-gradient-to-r from-red-500/20 to-pink-500/20 border-red-500/30 hover:bg-red-500/30'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
                onClick={() => handlePlaylistClick(playlist)}
              >
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    isFav ? 'bg-gradient-to-br from-red-500 to-pink-500' : 'bg-gradient-to-br from-purple-500 to-pink-500'
                  }`}
                >
                  {playlist.coverUrl ? (
                    <img src={playlist.coverUrl} alt="Cover" className="w-full h-full rounded-lg object-cover" />
                  ) : isFav ? (
                    <Heart className="w-6 h-6 text-white" />
                  ) : (
                    <ListMusic className="w-6 h-6 text-white" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h4
                    className={`text-white font-medium truncate transition-colors ${
                      isFav ? 'group-hover:text-red-300' : 'group-hover:text-purple-300'
                    }`}
                  >
                    {playlist.name}
                  </h4>
                  {playlist.description && <p className="text-gray-400 text-sm truncate">{playlist.description}</p>}
                  {!isFav && (
                    <div className="flex items-center space-x-2 text-xs">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          playlist.isPublic
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}
                      >
                        {playlist.isPublic ? 'Public' : 'Private'}
                      </span>
                    </div>
                  )}
                </div>

                {!isFav && (
                  <div className="relative">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPlaylistMenu(showPlaylistMenu === playlist.id ? null : playlist.id);
                      }}
                      data-playlist-btn={playlist.id}
                      className="text-gray-400 hover:text-white p-2 rounded-lg transition-all"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>

                    {showPlaylistMenu === playlist.id && (
                      <div data-playlist-menu={playlist.id} className="absolute right-0 top-10 z-50 bg-black/90 border border-white/20 rounded-lg shadow-lg min-w-[120px]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditPlaylist(playlist);
                          }}
                          className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePlaylist(playlist);
                          }}
                          className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderFollowedCreators = () => (
    <div className="space-y-3">
      {followedCreators.length === 0 ? (
        <div className="text-center py-8">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-400">Not following anyone yet</p>
          <p className="text-sm text-gray-500">Follow content creators to see their updates</p>
        </div>
      ) : (
        followedCreators.map((creator) => (
          <div
            key={creator.id}
            className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors group cursor-pointer"
            onClick={() => window.dispatchEvent(new CustomEvent('openCreator', { detail: { creatorId: creator.id } }))}
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              {creator.avatarUrl ? (
                <img src={creator.avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-white font-medium text-lg">{creator.username.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-white font-medium truncate group-hover:text-purple-300 transition-colors">
                {creator.fullName || creator.username}
              </h4>
              <p className="text-gray-400 text-sm truncate">@{creator.username}</p>
              {creator.bio && <p className="text-gray-500 text-xs truncate">{creator.bio}</p>}
            </div>
            <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white p-2 rounded-lg transition-all" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        ))
      )}
    </div>
  );

  return (
    <Card className="bg-black/30 border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-white">Library</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Vertical Tab Navigation */}
        <div className="flex flex-col space-y-2">
          <button
            onClick={() => setActiveTab('playlists')}
            className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'playlists' ? 'bg-purple-500 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <ListMusic className="w-5 h-5" />
            <span>Playlists</span>
            <span className="px-2 py-1 text-xs bg-white/20 rounded-full">{playlists.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('creators')}
            className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'creators' ? 'bg-purple-500 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Users className="w-5 h-5" />
            <span>Following</span>
            <span className="px-2 py-1 text-xs bg-white/20 rounded-full">{followedCreators.length}</span>
          </button>
        </div>

        {/* Content */}
        <div className="min-h-[400px]">
          {isLoading ? (
            <div className="space-y-3">
              {activeTab === 'playlists' && (
                <>
                  <div className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg animate-pulse">
                    <div className="w-12 h-12 bg-gray-600 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-600 rounded w-1/3 mb-2"></div>
                      <div className="h-3 bg-gray-600 rounded w-1/4"></div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg animate-pulse">
                    <div className="w-12 h-12 bg-gray-600 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-600 rounded w-1/2 mb-2"></div>
                      <div className="h-3 bg-gray-600 rounded w-1/3"></div>
                    </div>
                  </div>
                </>
              )}
              {activeTab === 'creators' && (
                <>
                  <div className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg animate-pulse">
                    <div className="w-12 h-12 bg-gray-600 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-600 rounded w-1/3 mb-2"></div>
                      <div className="h-3 bg-gray-600 rounded w-1/4"></div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              {activeTab === 'playlists' && renderPlaylists()}
              {activeTab === 'creators' && renderFollowedCreators()}
            </>
          )}
        </div>
      </CardContent>

      {/* Create Playlist Modal */}
      {showCreatePlaylist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-black/30 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-xl text-white">Create Playlist</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowCreatePlaylist(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </Button>
            </CardHeader>

            <CardContent className="space-y-4">
              {createError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-red-400 text-sm">{createError}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Playlist Name</label>
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="Enter playlist name..."
                  className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Privacy</label>
                <div className="flex space-x-3">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="radio" checked={newPlaylistPublic} onChange={() => setNewPlaylistPublic(true)} />
                    <span className="text-white">Public</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="radio" checked={!newPlaylistPublic} onChange={() => setNewPlaylistPublic(false)} />
                    <span className="text-white">Private</span>
                  </label>
                </div>
              </div>

              <div className="flex space-x-3">
                <Button
                  onClick={createPlaylist}
                  disabled={isCreating || !newPlaylistName.trim()}
                  className="flex-1 bg-purple-500 hover:bg-purple-600 text-white"
                >
                  {isCreating ? 'Creating...' : 'Create Playlist'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCreatePlaylist(false)}
                  className="flex-1 border-white/20 text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Playlist Modal */}
      {showEditPlaylist && editingPlaylist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-black/30 border-white/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-xl text-white">Edit Playlist</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowEditPlaylist(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </Button>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Playlist Name</label>
                <input
                  type="text"
                  value={editPlaylistName}
                  onChange={(e) => setEditPlaylistName(e.target.value)}
                  placeholder="Enter playlist name..."
                  className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Description</label>
                <textarea
                  value={editPlaylistDescription}
                  onChange={(e) => setEditPlaylistDescription(e.target.value)}
                  placeholder="Enter playlist description..."
                  rows={3}
                  className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Privacy</label>
                <div className="flex space-x-3">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={editPlaylistPublic}
                      onChange={() => setEditPlaylistPublic(true)}
                      className="text-purple-500 focus:ring-purple-500"
                    />
                    <span className="text-white">Public</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={!editPlaylistPublic}
                      onChange={() => setEditPlaylistPublic(false)}
                      className="text-purple-500 focus:ring-purple-500"
                    />
                    <span className="text-white">Private</span>
                  </label>
                </div>
              </div>

              <div className="flex space-x-3">
                <Button onClick={updatePlaylist} disabled={!editPlaylistName.trim()} className="flex-1 bg-purple-500 hover:bg-purple-600 text-white">
                  Update Playlist
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowEditPlaylist(false)}
                  className="flex-1 border-white/20 text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deletingPlaylist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-black/30 border-white/10">
            <CardHeader>
              <CardTitle className="text-xl text-white">Delete Playlist</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <p className="text-gray-300">
                Are you sure you want to delete "<span className="text-white font-medium">{deletingPlaylist.name}</span>"? This action cannot be undone.
              </p>

              <div className="flex space-x-3">
                <Button onClick={deletePlaylist} className="flex-1 bg-red-500 hover:bg-red-600 text-white">
                  Delete
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 border-white/20 text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Card>
  );
}
