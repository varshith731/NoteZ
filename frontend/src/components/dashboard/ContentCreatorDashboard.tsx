import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Music, Album, ListMusic, User, Settings, Eye, Edit, Trash2, Camera, Search, X, Bell, Play, ListPlus, Heart } from 'lucide-react';
import { NotificationsPanel } from '@/components/dashboard/NotificationsPanel';
import { BottomPlayer } from '@/components/dashboard/BottomPlayer';
import { AddToPlaylistDialog } from '@/components/dashboard/AddToPlaylistDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/apiClient';
import { normalizeSongItem, type SongItem } from '@/lib/songs';
import { supabase } from '@/config/supabase';

interface Song {
  id: string;
  title: string;
  artist: string;
  movie?: string;
  category: { name: string; color: string };
  audioUrl: string;
  coverUrl?: string;
  lyrics?: string;
  isPublic: boolean;
  createdAt: string;
  analytics: { play_count: number; listen_duration: number }[];
}

interface Album {
  id: string;
  title: string;
  description: string;
  coverUrl?: string;
  createdAt: string;
  songCount: number;
}

interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  createdAt: string;
  songCount: number;
}

interface CreatorProfile {
  id: string;
  username: string;
  fullName?: string;
  avatarUrl?: string;
  bio?: string;
  followersCount: number;
}

interface CreatorStats {
  totalSongs: number;
  totalListens: number;
  totalFavorites: number;
  monthlyListeners: number;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

export function ContentCreatorDashboard() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [activeTab, setActiveTab] = useState<'songs' | 'albums' | 'playlists'>('songs');
  
  const [profileEditForm, setProfileEditForm] = useState({
    username: '',
    fullName: '',
    bio: ''
  });
  
  const [albumForm, setAlbumForm] = useState({
    title: '',
    description: '',
    coverUrl: '',
    releaseDate: '',
    isPublic: true
  });
  
  const [playlistForm, setPlaylistForm] = useState({
    name: '',
    description: '',
    isPublic: true
  });
  
  const [uploadForm, setUploadForm] = useState({
    title: '',
    artist: '',
    movie: '',
    categoryId: '',
    lyrics: '',
    isPublic: true,
    audioFile: null as File | null,
  });

  const token = localStorage.getItem('token');

  // Search state (similar to user dashboard)
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SongItem[]>([]);
  const [artistResults, setArtistResults] = useState<any[]>([]);
  const [albumResults, setAlbumResults] = useState<any[]>([]);
  const [playlistResults, setPlaylistResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [queue, setQueue] = useState<SongItem[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const { logout } = useAuth();
  const navigate = useNavigate();
  // Notifications panel
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);

  // Player state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentSong, setCurrentSong] = useState<any | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volumePct, setVolumePct] = useState(80);

  // Edit album modal state
  const [showEditAlbum, setShowEditAlbum] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [albumEditForm, setAlbumEditForm] = useState({ title: '', description: '', coverUrl: '', releaseDate: '', isPublic: true });
  const [albumSongs, setAlbumSongs] = useState<any[]>([]); // songs currently in album
  const [availableSongs, setAvailableSongs] = useState<Song[]>([]); // songs not in album
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistSongs, setPlaylistSongs] = useState<any[]>([]);
  const [showPlaylistDetail, setShowPlaylistDetail] = useState(false);

  const handlePlaylistClick = async (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setShowPlaylistDetail(true);
    try {
      const response = await fetch(`http://localhost:3001/api/playlists/${playlist.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const songs = data.playlist?.songs || data.songs || [];
        setPlaylistSongs(songs);
      }
    } catch (error) {
      console.error('Failed to fetch playlist songs:', error);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchSongs();
    fetchAlbums();
    fetchPlaylists();
    fetchCategories();
    fetchStats();
  }, []);

  async function handleSearch() {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setArtistResults([]);
      setAlbumResults([]);
      setPlaylistResults([]);
      setShowSearchResults(false);
      return;
    }
    setIsSearching(true);
    try {
      const [songsData, artistsData, albumsData, playlistsData] = await Promise.allSettled([
        apiClient.get(`/api/songs?search=${encodeURIComponent(searchQuery)}`),
        apiClient.get(`/api/users/search?q=${encodeURIComponent(searchQuery)}`),
        apiClient.get(`/api/albums/search?q=${encodeURIComponent(searchQuery)}`),
        apiClient.get(`/api/playlists/search?q=${encodeURIComponent(searchQuery)}`)
      ]);

      if (songsData.status === 'fulfilled') {
        const mapped: SongItem[] = await Promise.all((songsData.value.songs || []).map(normalizeSongItem));
        setSearchResults(mapped);
      }

      if (artistsData.status === 'fulfilled') {
        const artists = artistsData.value;
        setArtistResults(artists.creators || artists.users || artists.items || []);
      }

      if (albumsData.status === 'fulfilled') {
        setAlbumResults(albumsData.value.albums || []);
      }

      if (playlistsData.status === 'fulfilled') {
        setPlaylistResults(playlistsData.value.playlists || playlistsData.value.items || []);
      }

      setShowSearchResults(true);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
      setArtistResults([]);
      setAlbumResults([]);
      setPlaylistResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  function clearSearch() {
    setSearchQuery("");
    setSearchResults([]);
    setArtistResults([]);
    setAlbumResults([]);
    setPlaylistResults([]);
    setShowSearchResults(false);
  }

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  }

  useEffect(() => {
    if (profile) {
      setProfileEditForm({
        username: profile.username || '',
        fullName: (profile as any).fullName || '',
        bio: profile.bio || ''
      });
    }
  }, [profile]);

  const fetchProfile = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/users/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      let followersCount = 0;
      try {
        const followersRes = await fetch(`http://localhost:3001/api/users/followers/${data.user.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (followersRes.ok) {
          const followersData = await followersRes.json();
          followersCount = followersData.count || 0;
        }
      } catch {}
      
      setProfile({ ...data.user, followersCount });
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    }
  };

  const fetchSongs = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/songs/creator', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setSongs(data.songs || []);
    } catch (error) {
      console.error('Failed to fetch songs:', error);
    }
  };

  const fetchAlbums = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/albums/creator', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      // Normalize backend snake_case fields to frontend camelCase
      const albums = (data.albums || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        coverUrl: a.cover_url || a.coverUrl || '',
        createdAt: a.created_at || a.createdAt,
        songCount: a.total_songs || a.song_count?.[0]?.count || a.songCount || 0
      }));
      setAlbums(albums);
    } catch (error) {
      console.error('Failed to fetch albums:', error);
    }
  };

  const fetchPlaylists = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/playlists/creator', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setPlaylists(data.playlists || []);
    } catch (error) {
      console.error('Failed to fetch playlists:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/categories');
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/analytics/creator', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setStats(data.overview);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  // Upload album cover to storage (use 'avatars' bucket only)
  const uploadAlbumCoverToStorage = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `album_${Date.now()}.${fileExt}`;
      const bucket = 'avatars';
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file, { upsert: true });
      if (uploadError) {
        throw uploadError;
      }

      // get public URL
      const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      const publicUrl = publicData?.publicUrl || '';
      if (!publicUrl) throw new Error('Failed to obtain public URL');
      return publicUrl;
    } catch (err) {
      console.error('uploadAlbumCoverToStorage error:', err);
      throw err;
    }
  };

  // ------- Simple player integration for creators -------
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = 'anonymous';
    }

    const audio = audioRef.current;

    const onTimeUpdate = () => {
      if (!audio || !duration) return;
      setProgressPct(duration ? (audio.currentTime / duration) * 100 : 0);
    };

    const onLoadedMeta = () => {
      setDuration(audio.duration || 0);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setProgressPct(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMeta);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMeta);
      audio.removeEventListener('ended', onEnded);
    };
  }, [duration]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = (volumePct || 0) / 100;
    }
  }, [volumePct]);

  const playSong = async (song: any) => {
    try {
      const normalized = await normalizeSongItem(song as any);
      setCurrentSong(normalized);
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current!.src = normalized.audioUrl;
      await audioRef.current!.play();
      setIsPlaying(true);
      setDuration(audioRef.current!.duration || 0);
    } catch (err) {
      console.error('Failed to play song:', err);
      alert('Failed to play song');
    }
  };

  const togglePlay = async () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.error('Play error:', err);
      }
    }
  };

  const seekPct = (pct: number) => {
    if (!audioRef.current || !duration) return;
    const t = (pct / 100) * duration;
    audioRef.current.currentTime = t;
    setProgressPct(pct);
  };

  // Local UI state for add-to-playlist modal and selected song
  const [selectedSong, setSelectedSong] = useState<any | null>(null);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);

  const addToQueue = async (song: any) => {
    try {
      const normalized = await normalizeSongItem(song as any);
      setQueue(prev => [...prev, normalized]);
    } catch (err) {
      console.error('Failed to add to queue:', err);
    }
  };

  const addToPlaylist = (song: any) => {
    setSelectedSong(song);
    setShowAddToPlaylist(true);
  };

  const toggleFavorite = async (song: any) => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No auth token found');
      return;
    }
    const songId = song?.id;
    if (!songId) return;

    const isLiked = likedIds.has(songId);
    setLikedIds(prev => {
      const next = new Set(prev);
      if (isLiked) next.delete(songId); else next.add(songId);
      return next;
    });

    try {
      if (isLiked) {
        const res = await fetch(`http://localhost:3001/api/favorites/${encodeURIComponent(songId)}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to remove favorite');
      } else {
        const res = await fetch('http://localhost:3001/api/favorites', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ songId })
        });
        if (!res.ok) throw new Error('Failed to add favorite');
      }
    } catch (err) {
      console.error('Favorite toggle failed:', err);
    }
  };

  // Listen for global UI events (some shared components dispatch these)
  useEffect(() => {
    const handleAddToQueue = async (event: CustomEvent) => {
      const song = event.detail as any;
      if (song) await addToQueue(song);
    };

    const handleOpenAddToPlaylist = (event: CustomEvent) => {
      const song = event.detail as any;
      if (song) addToPlaylist(song);
    };

    const handleToggleLike = (event: CustomEvent) => {
      const song = event.detail as any;
      if (song) toggleFavorite(song);
    };

  window.addEventListener('addToQueue', handleAddToQueue as unknown as EventListener);
  window.addEventListener('openAddToPlaylist', handleOpenAddToPlaylist as unknown as EventListener);
  window.addEventListener('toggleLike', handleToggleLike as unknown as EventListener);

    return () => {
  window.removeEventListener('addToQueue', handleAddToQueue as unknown as EventListener);
  window.removeEventListener('openAddToPlaylist', handleOpenAddToPlaylist as unknown as EventListener);
  window.removeEventListener('toggleLike', handleToggleLike as unknown as EventListener);
    };
  }, []);

  const changeVolumePct = (v: number) => {
    setVolumePct(v);
    if (audioRef.current) audioRef.current.volume = v / 100;
  };

  const playPrev = () => {
    if (!currentSong) return;
    const idx = songs.findIndex(s => s.id === (currentSong as any).id);
    if (idx > 0) playSong(songs[idx - 1]);
  };

  const playNext = () => {
    if (!currentSong) return;
    const idx = songs.findIndex(s => s.id === (currentSong as any).id);
    if (idx >= 0 && idx < songs.length - 1) playSong(songs[idx + 1]);
  };

  // Open edit album modal and load album songs
  const openEditAlbum = async (album: Album) => {
    try {
      setEditingAlbum(album);
      setAlbumEditForm({
        title: album.title || '',
        description: album.description || '',
        coverUrl: album.coverUrl || '',
        releaseDate: album.createdAt ? String(album.createdAt).split('T')[0] : '',
        isPublic: true
      });

      // Fetch songs in album
      const token = localStorage.getItem('token');
      const resp = await fetch(`http://localhost:3001/api/albums/${album.id}/songs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      let albumSongIds: string[] = [];
      if (resp.ok) {
        const data = await resp.json();
        setAlbumSongs(data.songs || []);
        albumSongIds = (data.songs || []).map((s: any) => s.id);
      }

      // compute available songs (those not in album)
      const avail = songs.filter(s => !albumSongIds.includes(s.id));
      setAvailableSongs(avail);
      setSelectedSongIds([]);
      setShowEditAlbum(true);
    } catch (error) {
      console.error('Failed to open edit album:', error);
      alert('Failed to load album details');
    }
  };

  const handleAlbumSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAlbum) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/albums/${editingAlbum.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: albumEditForm.title,
          description: albumEditForm.description,
          cover_url: albumEditForm.coverUrl,
          release_date: albumEditForm.releaseDate || null,
          isPublic: albumEditForm.isPublic
        })
      });

      if (response.ok) {
        alert('Album updated');
        setShowEditAlbum(false);
        fetchAlbums();
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to update album');
      }
    } catch (error) {
      console.error('Update album error:', error);
      alert('Failed to update album');
    }
  };

  const handleAddSongsToAlbum = async () => {
    if (!editingAlbum || selectedSongIds.length === 0) return;
    try {
      const token = localStorage.getItem('token');
      // Add songs sequentially or in parallel
      await Promise.all(selectedSongIds.map(id =>
        fetch(`http://localhost:3001/api/albums/${editingAlbum.id}/songs`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ songId: id })
        })
      ));
      alert('Songs added to album');
      // refresh
      fetchAlbums();
      setShowEditAlbum(false);
    } catch (error) {
      console.error('Failed to add songs to album:', error);
      alert('Failed to add songs to album');
    }
  };

  const handleRemoveSongFromAlbum = async (songId: string) => {
    if (!editingAlbum) return;
    if (!confirm('Remove this song from the album?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/albums/${editingAlbum.id}/songs/${songId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        // remove locally
        setAlbumSongs(prev => prev.filter(s => s.id !== songId));
        alert('Song removed from album');
      } else {
        const err = await response.json().catch(() => ({}));
        alert(err.error || 'Failed to remove song');
      }
    } catch (error) {
      console.error('Failed to remove song from album:', error);
      alert('Failed to remove song from album');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.audioFile || !uploadForm.title || !uploadForm.artist || !uploadForm.categoryId) {
      alert('Please fill in all required fields and select an audio file');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('audio', uploadForm.audioFile);
    formData.append('title', uploadForm.title);
    formData.append('artist', uploadForm.artist);
    formData.append('categoryId', uploadForm.categoryId);
    formData.append('movie', uploadForm.movie);
    formData.append('lyrics', uploadForm.lyrics);
    formData.append('isPublic', uploadForm.isPublic.toString());

    try {
      console.log('Uploading with form data:', Object.fromEntries(formData.entries()));
      const response = await fetch('http://localhost:3001/api/songs/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        alert('Song uploaded successfully!');
        setShowUploadForm(false);
        setUploadForm({ title: '', artist: '', movie: '', categoryId: '', lyrics: '', isPublic: true, audioFile: null });
        fetchSongs();
        fetchStats();
      } else {
        const error = await response.json();
        console.error('Upload failed:', error);
        alert(`Upload failed: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const deleteSong = async (songId: string) => {
    if (!confirm('Are you sure you want to delete this song?')) return;

    try {
      const response = await fetch(`http://localhost:3001/api/songs/${songId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        alert('Song deleted successfully!');
        fetchSongs();
        fetchStats();
      } else {
        const error = await response.json();
        alert(error.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Delete failed');
    }
  };

  const getTotalPlays = (song: Song) => {
    return song.analytics?.reduce((sum, a) => sum + (a.play_count || 0), 0) || 0;
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:3001/api/users/me', {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: profileEditForm.username,
          fullName: profileEditForm.fullName,
          bio: profileEditForm.bio
        })
      });

      if (response.ok) {
        alert('Profile updated successfully!');
        setShowProfileEdit(false);
        fetchProfile();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      alert('Failed to update profile');
    }
  };

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:3001/api/albums', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: albumForm.title,
          description: albumForm.description,
          cover_url: albumForm.coverUrl,
          release_date: albumForm.releaseDate || null,
          isPublic: albumForm.isPublic
        })
      });

      if (response.ok) {
        alert('Album created successfully!');
        setShowCreateAlbum(false);
        setAlbumForm({ title: '', description: '', coverUrl: '', releaseDate: '', isPublic: true });
        fetchAlbums();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create album');
      }
    } catch (error) {
      console.error('Create album error:', error);
      alert('Failed to create album');
    }
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:3001/api/playlists', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: playlistForm.name,
          description: playlistForm.description,
          isPublic: playlistForm.isPublic
        })
      });

      if (response.ok) {
        alert('Playlist created successfully!');
        setShowCreatePlaylist(false);
        setPlaylistForm({ name: '', description: '', isPublic: true });
        fetchPlaylists();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create playlist');
      }
    } catch (error) {
      console.error('Create playlist error:', error);
      alert('Failed to create playlist');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 pb-28">
      {/* Search bar at top */}
      <div className="sticky top-0 z-50 bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 border-b border-white/10">
        <div className="flex justify-center">
          <div className="w-full max-w-2xl mx-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search songs, artists, or albums..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                className="w-full pl-10 pr-24 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {searchQuery && (
                  <button onClick={clearSearch} className="p-1.5 text-gray-400 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  aria-label="Search"
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-md transition-all disabled:opacity-50"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSearchResults && (
        <div className="p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Search Results</h3>
              <Button variant="ghost" size="sm" onClick={clearSearch} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Songs */}
            {searchResults.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm text-gray-300 font-medium mb-3">Songs</h4>
                <div className="grid grid-cols-1 gap-3">
                  {searchResults.map(s => (
                    <div
                      key={s.id || s.path}
                      onClick={() => playSong(s)}
                      className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                          <Music className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{s.name}</p>
                          <p className="text-gray-400 text-sm truncate">{s.movie || 'Unknown'}</p>
                        </div>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="ghost" onClick={() => playSong(s)} title="Play">
                            <Play className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => addToQueue(s)} title="Add to Queue">
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => addToPlaylist(s)} title="Add to Playlist">
                            <ListPlus className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => toggleFavorite(s)}
                            title="Toggle Favorite"
                            className={likedIds.has(s.id) ? 'text-pink-500' : ''}
                          >
                            <Heart className={`w-4 h-4 ${likedIds.has(s.id) ? 'fill-current' : ''}`} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Albums */}
            {albumResults.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm text-gray-300 font-medium mb-3">Albums</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {albumResults.map(album => (
                    <div
                      key={album.id}
                      className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition"
                      onClick={() => window.dispatchEvent(new CustomEvent('openAlbum', { detail: { albumId: album.id } }))}
                    >
                      <div className="w-full aspect-square rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 mb-2 flex items-center justify-center">
                        <Album className="w-8 h-8 text-white" />
                      </div>
                      <p className="text-white font-medium text-sm truncate">{album.title || album.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Playlists */}
            {playlistResults.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm text-gray-300 font-medium mb-3">Playlists</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {playlistResults.map(playlist => (
                    <div
                      key={playlist.id}
                      className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition"
                      onClick={() => handlePlaylistClick(playlist)}
                    >
                      <div className="w-full aspect-square rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 mb-2 flex items-center justify-center">
                        <ListMusic className="w-8 h-8 text-white" />
                      </div>
                      <p className="text-white font-medium text-sm truncate">{playlist.name || playlist.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Artists */}
            {artistResults.length > 0 && (
              <div>
                <h4 className="text-sm text-gray-300 font-medium mb-3">Artists</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {artistResults.map(artist => (
                    <div
                      key={artist.id}
                      className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition"
                      onClick={() => window.dispatchEvent(new CustomEvent('openCreator', { detail: { creatorId: artist.id } }))}
                    >
                      <div className="w-full aspect-square rounded-full bg-gradient-to-br from-purple-500 to-pink-500 mb-2 flex items-center justify-center mx-auto">
                        <User className="w-8 h-8 text-white" />
                      </div>
                      <p className="text-white font-medium text-sm truncate text-center">{artist.name || artist.username}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searchResults.length === 0 && albumResults.length === 0 && playlistResults.length === 0 && artistResults.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-400">No results found</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="p-6 pt-6">
        {/* Profile Section */}
        {profile && (
          <Card className="bg-black/40 border-white/20 mb-6">
            <CardContent className="p-6 pt-8">
            <div className="flex items-center gap-6">
              <img 
                src={profile.avatarUrl || '/default-avatar.png'} 
                alt={profile.username}
                className="w-20 h-20 rounded-full"
              />
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white">{profile.username}</h2>
                {profile.fullName && <p className="text-gray-400">{profile.fullName}</p>}
                {profile.bio && <p className="text-sm text-gray-300 mt-2">{profile.bio}</p>}
                <div className="flex items-center gap-4 mt-3">
                  <span className="text-sm text-gray-400">
                    <strong className="text-white">{profile.followersCount}</strong> Followers
                  </span>
                </div>
        </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setShowNotificationsPanel(true)} className="text-white/60 hover:text-white">
                    <Bell className="w-5 h-5" />
                  </Button>
                  <Button variant="outline" className="border-white/20 text-white" onClick={() => setShowProfileEdit(true)}>
                    <Settings className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Button>
                </div>
                <Button variant="outline" className="border-white/20 text-white" onClick={handleLogout}>
                  Sign Out
                </Button>
              </div>
      </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Album Modal */}
      {showEditAlbum && editingAlbum && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-3xl bg-black/90 border-white/30">
            <CardHeader>
              <CardTitle className="text-white">Edit Album</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAlbumSave} className="space-y-4">
                <input
                  type="text"
                  placeholder="Album Title *"
                  value={albumEditForm.title}
                  onChange={(e) => setAlbumEditForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full p-2 bg-white/5 border border-white/20 rounded text-white"
                  required
                />
                <textarea
                  placeholder="Description"
                  value={albumEditForm.description}
                  onChange={(e) => setAlbumEditForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full p-2 bg-white/5 border border-white/20 rounded text-white"
                />
                <input
                  type="text"
                  placeholder="Cover Image URL"
                  value={albumEditForm.coverUrl}
                  onChange={(e) => setAlbumEditForm(prev => ({ ...prev, coverUrl: e.target.value }))}
                  className="w-full p-2 bg-white/5 border border-white/20 rounded text-white"
                />
                <div className="mt-2">
                  <label className="cursor-pointer inline-flex items-center gap-2 text-sm text-gray-400">
                    <Camera className="w-4 h-4" />
                    <span>Upload cover image</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const publicUrl = await uploadAlbumCoverToStorage(file);
                          setAlbumEditForm(prev => ({ ...prev, coverUrl: publicUrl }));
                        } catch (err) {
                          console.error('Failed to upload album cover:', err);
                          alert('Failed to upload album cover');
                        }
                      }}
                    />
                  </label>
                </div>
                <input
                  type="date"
                  placeholder="Release Date"
                  value={albumEditForm.releaseDate}
                  onChange={(e) => setAlbumEditForm(prev => ({ ...prev, releaseDate: e.target.value }))}
                  className="w-full p-2 bg-white/5 border border-white/20 rounded text-white"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="albumEditPublic"
                    checked={albumEditForm.isPublic}
                    onChange={(e) => setAlbumEditForm(prev => ({ ...prev, isPublic: e.target.checked }))}
                  />
                  <label htmlFor="albumEditPublic" className="text-white">Make album public</label>
                </div>

                {/* Songs management */}
                <div className="mt-4">
                  <h4 className="text-white font-medium mb-2">Album songs</h4>
                  {albumSongs.length > 0 && (
                    <div className="mb-3 p-2 bg-white/5 rounded max-h-28 overflow-auto">
                      {albumSongs.map((s: any) => (
                        <div key={s.id} className="flex items-center justify-between text-gray-200 text-sm py-1">
                          <div>{s.title || s.name}</div>
                          <div>
                            <button
                              type="button"
                              onClick={() => handleRemoveSongFromAlbum(s.id)}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <h4 className="text-white font-medium mb-2">Add songs to album</h4>
                  {availableSongs.length === 0 ? (
                    <div className="text-gray-400">No available songs to add</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-auto p-2 bg-white/5 rounded">
                      {availableSongs.map(s => (
                        <label key={s.id} className="flex items-center gap-2 p-2">
                          <input type="checkbox" value={s.id} checked={selectedSongIds.includes(s.id)} onChange={(e) => {
                            const id = e.target.value;
                            setSelectedSongIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
                          }} />
                          <div className="text-white">{s.title}</div>
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Button type="button" onClick={handleAddSongsToAlbum} className="bg-purple-500">Add Selected</Button>
                    <Button type="submit" className="bg-green-600">Save Changes</Button>
                    <Button type="button" variant="outline" onClick={() => setShowEditAlbum(false)}>Cancel</Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}


      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-black/40 border-white/20">
            <CardContent className="p-6 pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Music className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.totalSongs}</p>
                  <p className="text-sm text-gray-400">Total Songs</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/40 border-white/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Eye className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.totalListens}</p>
                  <p className="text-sm text-gray-400">Total Listens</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/40 border-white/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <Eye className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.totalFavorites}</p>
                  <p className="text-sm text-gray-400">Total Favorites</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/40 border-white/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <User className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.monthlyListeners}</p>
                  <p className="text-sm text-gray-400">Monthly Listeners</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={activeTab === 'songs' ? 'default' : 'outline'}
          onClick={() => setActiveTab('songs')}
          className={activeTab === 'songs' ? 'bg-purple-500' : 'border-white/20 text-white'}
        >
          <Music className="w-4 h-4 mr-2" />
          Songs
        </Button>
        <Button
          variant={activeTab === 'albums' ? 'default' : 'outline'}
          onClick={() => setActiveTab('albums')}
          className={activeTab === 'albums' ? 'bg-purple-500' : 'border-white/20 text-white'}
        >
          <Album className="w-4 h-4 mr-2" />
          Albums
        </Button>
        <Button
          variant={activeTab === 'playlists' ? 'default' : 'outline'}
          onClick={() => setActiveTab('playlists')}
          className={activeTab === 'playlists' ? 'bg-purple-500' : 'border-white/20 text-white'}
        >
          <ListMusic className="w-4 h-4 mr-2" />
          Playlists
        </Button>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'songs' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white">Your Songs</h3>
            <Button onClick={() => setShowUploadForm(true)} className="bg-gradient-to-r from-purple-500 to-pink-500">
              <Plus className="w-4 h-4 mr-2" /> Upload Song
            </Button>
          </div>
          <Card className="bg-black/40 border-white/20">
            <CardContent className="p-4">
              {songs.length === 0 ? (
                <div className="text-center py-8 text-gray-400">No songs yet</div>
              ) : (
                <div className="space-y-3">
                  {songs.map((song) => (
                    <div key={song.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Music className="w-8 h-8 text-purple-400" />
                        <div>
                          <h4 className="text-white font-medium">{song.title}</h4>
                          <p className="text-sm text-gray-400">{song.artist}</p>
                          <p className="text-xs text-gray-500">{getTotalPlays(song)} plays</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="border-white/20" onClick={() => playSong(song)}>
                          <Play className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="border-white/20">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="border-white/20" onClick={() => deleteSong(song.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'albums' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white">Your Albums</h3>
            <Button className="bg-gradient-to-r from-purple-500 to-pink-500" onClick={() => setShowCreateAlbum(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create Album
            </Button>
          </div>
          <Card className="bg-black/40 border-white/20">
            <CardContent className="p-4">
              {albums.length === 0 ? (
                <div className="text-center py-8 text-gray-400">No albums yet</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {albums.map((album) => (
                    <div key={album.id} className="p-4 bg-white/5 rounded-lg">
                      <img src={album.coverUrl || '/placeholder-album.jpg'} alt={album.title} className="w-full aspect-square rounded-lg mb-2" />
                      <h4 className="text-white font-medium">{album.title}</h4>
                      <p className="text-sm text-gray-400">{album.songCount} songs</p>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" className="border-white/20" onClick={() => openEditAlbum(album)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="border-white/20" onClick={() => openEditAlbum(album)}>
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'playlists' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white">Your Playlists</h3>
            <Button className="bg-gradient-to-r from-purple-500 to-pink-500" onClick={() => setShowCreatePlaylist(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create Playlist
            </Button>
          </div>
          <Card className="bg-black/40 border-white/20">
            <CardContent className="p-4">
              {playlists.length === 0 ? (
                <div className="text-center py-8 text-gray-400">No playlists yet</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {playlists.map((playlist) => (
                    <div 
                      key={playlist.id} 
                      className="p-4 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition"
                      onClick={() => handlePlaylistClick(playlist)}
                    >
                      <img src={playlist.coverUrl || '/placeholder-playlist.jpg'} alt={playlist.name} className="w-full aspect-square rounded-lg mb-2" />
                      <h4 className="text-white font-medium">{playlist.name}</h4>
                      <p className="text-sm text-gray-400">{playlist.songCount || 0} songs</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upload Form */}
      {showUploadForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-2xl bg-black/90 border-white/30">
          <CardHeader>
            <CardTitle className="text-white">Upload New Song</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Title *"
                    value={uploadForm.title}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                    className="p-2 bg-white/5 border border-white/20 rounded text-white"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Artist *"
                    value={uploadForm.artist}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, artist: e.target.value }))}
                    className="p-2 bg-white/5 border border-white/20 rounded text-white"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Movie (Optional)"
                    value={uploadForm.movie}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, movie: e.target.value }))}
                    className="p-2 bg-white/5 border border-white/20 rounded text-white"
                  />
                  <select
                    value={uploadForm.categoryId}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, categoryId: e.target.value }))}
                    className="p-2 bg-white/5 border border-white/20 rounded text-white"
                    required
                  >
                    <option value="">Select category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setUploadForm(prev => ({ ...prev, audioFile: e.target.files?.[0] || null }))}
                  className="p-2 bg-white/5 border border-white/20 rounded text-white"
                  required
                />
                <textarea
                  placeholder="Lyrics (Optional)"
                  value={uploadForm.lyrics}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, lyrics: e.target.value }))}
                  rows={4}
                  className="w-full p-2 bg-white/5 border border-white/20 rounded text-white"
                />
                <div className="flex gap-2">
                  <Button type="submit" disabled={isUploading} className="bg-purple-500">
                    {isUploading ? 'Uploading...' : 'Upload'}
                </Button>
                  <Button type="button" onClick={() => setShowUploadForm(false)} variant="outline">
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
            </div>
          )}

      {/* Edit Profile Modal */}
      {showProfileEdit && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-2xl bg-black/90 border-white/30">
            <CardHeader>
              <CardTitle className="text-white">Edit Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <input
                  type="text"
                  placeholder="Username"
                  value={profileEditForm.username}
                  onChange={(e) => setProfileEditForm(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full p-2 bg-white/5 border border-white/20 rounded text-white"
                  required
                />
                {/* Avatar Upload */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-white mb-2">Profile Photo</label>
                  <div className="flex items-center space-x-4">
                    <div className="relative group">
                      <div className="w-24 h-24 rounded-full overflow-hidden bg-white/5 border border-white/20">
                        {profile?.avatarUrl ? (
                          <img
                            src={profile.avatarUrl}
                            alt="Profile"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="w-12 h-12 text-gray-400" />
                          </div>
                        )}
                        {/* Upload overlay */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <label className="cursor-pointer">
                            <Camera className="w-8 h-8 text-white" />
                            <input
                              type="file"
                              accept="image/*"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file || !profile) return;

                                try {
                                  const fileExt = file.name.split('.').pop();
                                  const fileName = `${profile.id}_${Date.now()}.${fileExt}`;
                                  const filePath = `avatars/${fileName}`;

                                  // Upload to Supabase Storage
                                  const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
                                  if (uploadError) throw uploadError;

                                  // Get public URL
                                  const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                                  const publicUrl = publicData?.publicUrl || '';

                                  if (!publicUrl) throw new Error('Failed to obtain public URL');

                                  // Update user's avatarUrl in DB directly via Supabase
                                  const { error: updateError } = await supabase
                                    .from('users')
                                    .update({ avatar_url: publicUrl })
                                    .eq('id', profile.id);

                                  if (updateError) {
                                    throw new Error('Failed to update avatar in database: ' + updateError.message);
                                  }

                                  fetchProfile(); // Refresh profile to show new avatar
                                } catch (error) {
                                  console.error('Failed to upload avatar to Supabase:', error);
                                  alert('Failed to upload avatar');
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-400">Upload a new profile photo</p>
                      <p className="text-xs text-gray-500 mt-1">Recommended: Square image, at least 400x400px</p>
                    </div>
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Full Name"
                  value={profileEditForm.fullName}
                  onChange={(e) => setProfileEditForm(prev => ({ ...prev, fullName: e.target.value }))}
                  className="w-full p-2 bg-white/5 border border-white/20 rounded text-white"
                />
                <textarea
                  placeholder="Bio"
                  value={profileEditForm.bio}
                  onChange={(e) => setProfileEditForm(prev => ({ ...prev, bio: e.target.value }))}
                  rows={4}
                  className="w-full p-2 bg-white/5 border border-white/20 rounded text-white"
                />
                <div className="flex gap-2">
                  <Button type="submit" className="bg-purple-500">Save</Button>
                  <Button type="button" onClick={() => setShowProfileEdit(false)} variant="outline">Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Notifications Panel (overlay) */}
      {showNotificationsPanel && (
        <NotificationsPanel
          isOpen={showNotificationsPanel}
          onClose={() => setShowNotificationsPanel(false)}
          onFriendRequestAction={() => {
            // Refresh counts/data if needed
            fetchProfile();
          }}
        />
      )}

      {/* Create Album Modal */}
      {showCreateAlbum && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-2xl bg-black/90 border-white/30">
            <CardHeader>
              <CardTitle className="text-white">Create Album</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateAlbum} className="space-y-4">
                <input
                  type="text"
                  placeholder="Album Title *"
                  value={albumForm.title}
                  onChange={(e) => setAlbumForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full p-2 bg-white/5 border border-white/20 rounded text-white"
                  required
                />
                <textarea
                  placeholder="Description"
                  value={albumForm.description}
                  onChange={(e) => setAlbumForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full p-2 bg-white/5 border border-white/20 rounded text-white"
                />
                <input
                  type="text"
                  placeholder="Cover Image URL"
                  value={albumForm.coverUrl}
                  onChange={(e) => setAlbumForm(prev => ({ ...prev, coverUrl: e.target.value }))}
                  className="w-full p-2 bg-white/5 border border-white/20 rounded text-white"
                />
                <div className="mt-2">
                  <label className="cursor-pointer inline-flex items-center gap-2 text-sm text-gray-400">
                    <Camera className="w-4 h-4" />
                    <span>Upload cover image</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const publicUrl = await uploadAlbumCoverToStorage(file);
                          setAlbumForm(prev => ({ ...prev, coverUrl: publicUrl }));
                        } catch (err) {
                          console.error('Failed to upload album cover:', err);
                          alert('Failed to upload album cover');
                        }
                      }}
                    />
                  </label>
                </div>
                <input
                  type="date"
                  placeholder="Release Date"
                  value={albumForm.releaseDate}
                  onChange={(e) => setAlbumForm(prev => ({ ...prev, releaseDate: e.target.value }))}
                  className="w-full p-2 bg-white/5 border border-white/20 rounded text-white"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="albumPublic"
                    checked={albumForm.isPublic}
                    onChange={(e) => setAlbumForm(prev => ({ ...prev, isPublic: e.target.checked }))}
                  />
                  <label htmlFor="albumPublic" className="text-white">Make album public</label>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="bg-purple-500">Create</Button>
                  <Button type="button" onClick={() => setShowCreateAlbum(false)} variant="outline">Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Playlist Modal */}
      {showCreatePlaylist && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-2xl bg-black/90 border-white/30">
            <CardHeader>
              <CardTitle className="text-white">Create Playlist</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreatePlaylist} className="space-y-4">
                <input
                  type="text"
                  placeholder="Playlist Name *"
                  value={playlistForm.name}
                  onChange={(e) => setPlaylistForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-2 bg-white/5 border border-white/20 rounded text-white"
                  required
                />
                <textarea
                  placeholder="Description"
                  value={playlistForm.description}
                  onChange={(e) => setPlaylistForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full p-2 bg-white/5 border border-white/20 rounded text-white"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="playlistPublic"
                    checked={playlistForm.isPublic}
                    onChange={(e) => setPlaylistForm(prev => ({ ...prev, isPublic: e.target.checked }))}
                  />
                  <label htmlFor="playlistPublic" className="text-white">Make playlist public</label>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="bg-purple-500">Create</Button>
                  <Button type="button" onClick={() => setShowCreatePlaylist(false)} variant="outline">Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add to playlist dialog (shared) */}
      <AddToPlaylistDialog
        isOpen={showAddToPlaylist}
        onClose={() => { setShowAddToPlaylist(false); setSelectedSong(null); }}
        songPath={selectedSong?.id || ''}
      />

      {/* Playlist Detail Modal */}
      {showPlaylistDetail && selectedPlaylist && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-4xl bg-black/95 border-white/30 max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white text-2xl">{selectedPlaylist.name}</CardTitle>
                <p className="text-gray-400 mt-1">{selectedPlaylist.description || 'No description'}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setShowPlaylistDetail(false); setSelectedPlaylist(null); }}>
                <X className="w-5 h-5" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {playlistSongs.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">No songs in this playlist</div>
                ) : (
                  playlistSongs.map((song, index) => (
                    <div
                      key={song.id}
                      className="flex items-center gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 cursor-pointer transition"
                      onClick={() => playSong(song)}
                    >
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{song.title || song.name}</p>
                        <p className="text-gray-400 text-sm truncate">{song.artist || song.movie || 'Unknown'}</p>
                      </div>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" onClick={() => playSong(song)} title="Play">
                          <Play className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => addToQueue(song)} title="Add to Queue">
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => addToPlaylist(song)} title="Add to Playlist">
                          <ListPlus className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => toggleFavorite(song)}
                          title="Toggle Favorite"
                          className={likedIds.has(song.id) ? 'text-pink-500' : ''}
                        >
                          <Heart className={`w-4 h-4 ${likedIds.has(song.id) ? 'fill-current' : ''}`} />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bottom player for creator - allows basic listening */}
      <BottomPlayer
        song={currentSong}
        isPlaying={isPlaying}
        progressPct={progressPct}
        duration={duration}
        volumePct={volumePct}
        onTogglePlay={togglePlay}
        onSeekPct={seekPct}
        onVolumePct={changeVolumePct}
        onPrev={playPrev}
        onNext={playNext}
        onToggleFavorite={() => toggleFavorite(currentSong)}
        onAddToPlaylist={() => addToPlaylist(currentSong)}
        onToggleQueue={() => { console.log('Toggle queue clicked'); }}
        onShowLyrics={() => window.dispatchEvent(new CustomEvent('showLyrics', { detail: { lyrics: currentSong?.lyrics, title: (currentSong as any)?.title || (currentSong as any)?.name, artist: (currentSong as any)?.artist } }))}
        queueLength={queue.length}
      />
      </div>
    </div>
  );
}
