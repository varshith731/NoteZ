const express = require('express');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const router = express.Router();

// Helper: ensure favorites playlist exists and normalize returned id
async function getFavoritesIdForUser(userId) {
  const { data, error } = await supabase.rpc('ensure_favorites_playlist', { p_user_id: userId });
  if (error) throw error;
  let favId = data;
  if (Array.isArray(data) && data.length) favId = data[0];
  else if (data && typeof data === 'object') {
    favId = data.ensure_favorites_playlist || data.fav_id || Object.values(data)[0];
  }
  return favId;
}

// Middleware to verify Supabase access token and attach user id
const authenticateToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  if (token.split('.').length !== 3) {
    return res.status(400).json({ error: 'Malformed token' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error) throw error;
    if (!user) return res.status(403).json({ error: 'Invalid token' });

    req.user = { id: user.id, email: user.email };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Get user's favorite songs via Favorites playlist
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('\ud83c\udf86 Fetching favorites for user:', req.user.id);
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Ensure favorites playlist exists and get its id (normalize RPC result)
    let favIdData;
    try {
      favIdData = await getFavoritesIdForUser(req.user.id);
    } catch (err) {
      console.error('\u274c RPC error:', err);
      return res.status(500).json({ error: 'Failed to get Favorites playlist', details: err?.message || err });
    }
    console.debug('Favorites playlist id resolved to:', favIdData);

    // Join playlist_songs to songs for the favorites playlist
    const { data: favorites, error } = await supabase
      .from('playlist_songs')
      .select(`
        added_at,
        songs(
          id,
          title,
          artist,
          movie,
          audio_url,
          cover_url,
          duration,
          song_categories(name, color),
          creator:users!songs_creator_id_fkey(username, full_name, avatar_url)
        )
      `)
      .eq('playlist_id', favIdData)
      .order('added_at', { ascending: false })
      .range(offset, offset + limit - 1);

    console.debug('Favorites rows fetched:', Array.isArray(favorites) ? favorites.length : 0, { error });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch favorites' });
    }

    res.json({
        favorites: favorites.map(fav => ({
        id: fav.songs.id,
        songId: fav.songs.id,
        title: fav.songs.title,
        artist: fav.songs.artist,
        movie: fav.songs.movie,
        audioUrl: fav.songs.audio_url,
        coverUrl: fav.songs.cover_url,
        duration: fav.songs.duration,
        category: fav.songs.song_categories,
        creator: fav.songs.creator,
        favoritedAt: fav.added_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: favorites.length
      }
    });

  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add song to favorites (Favorites playlist)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { songId } = req.body;

    if (!songId) {
      return res.status(400).json({ error: 'Song ID is required' });
    }

    // Check if song exists and is public
    const { data: song, error: songError } = await supabase
      .from('songs')
      .select('id, title')
      .eq('id', songId)
      .eq('is_public', true)
      .single();

    if (songError || !song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Ensure favorites playlist exists and resolve id
    let favIdData;
    try {
      favIdData = await getFavoritesIdForUser(req.user.id);
    } catch (err) {
      console.error('Failed to get Favorites playlist id:', err);
      return res.status(500).json({ error: 'Failed to get Favorites playlist' });
    }

    // Get next position
    const { data: last, error: posError } = await supabase
      .from('playlist_songs')
      .select('position')
      .eq('playlist_id', favIdData)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (posError) return res.status(500).json({ error: 'Failed to update favorites' });
    const nextPos = last?.position ? last.position + 1 : 1;

    // Add to Favorites playlist
    const { error: favError } = await supabase
      .from('playlist_songs')
      .insert({
        playlist_id: favIdData,
        song_id: songId,
        position: nextPos
      });

    if (favError) {
      if (favError.code === '23505') { // Unique constraint violation
        return res.status(400).json({ error: 'Song already in favorites' });
      }
      return res.status(500).json({ error: 'Failed to add to favorites' });
    }

    // Optional: update stats via RPC if exists (removed debug raw SQL)
    console.warn('[favorites.js] Skipping optional stats update RPC placeholder');

    res.json({ 
      message: 'Song added to favorites',
      song: {
        id: song.id,
        title: song.title
      }
    });

  } catch (error) {
    console.error('Add to favorites error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove song from favorites (Favorites playlist)
router.delete('/:songId', authenticateToken, async (req, res) => {
  try {
    const { songId } = req.params;

    // Ensure favorites playlist exists and resolve id
    let favIdData;
    try {
      favIdData = await getFavoritesIdForUser(req.user.id);
    } catch (err) {
      console.error('Failed to get Favorites playlist id:', err);
      return res.status(500).json({ error: 'Failed to get Favorites playlist' });
    }

    // Remove from favorites playlist
    const { error } = await supabase
      .from('playlist_songs')
      .delete()
      .eq('playlist_id', favIdData)
      .eq('song_id', songId);

    if (error) {
      return res.status(500).json({ error: 'Failed to remove from favorites' });
    }

    // Optional: update stats via RPC if exists (removed debug raw SQL)
    console.warn('[favorites.js] Skipping optional stats decrement RPC placeholder');

    res.json({ message: 'Song removed from favorites' });

  } catch (error) {
    console.error('Remove from favorites error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if song is in user's favorites
router.get('/check/:songId', authenticateToken, async (req, res) => {
  try {
    const { songId } = req.params;

    // Ensure favorites playlist exists and resolve id
    let favIdData;
    try {
      favIdData = await getFavoritesIdForUser(req.user.id);
    } catch (err) {
      console.error('Failed to get Favorites playlist id:', err);
      return res.status(500).json({ error: 'Failed to get Favorites playlist' });
    }

    // Check if song is in Favorites playlist
    const { data: favorite, error } = await supabase
      .from('playlist_songs')
      .select('id')
      .eq('playlist_id', favIdData)
      .eq('song_id', songId)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: 'Failed to check favorite status' });
    }

    res.json({
      isFavorite: !!favorite,
      favoriteId: favorite?.id || null
    });

  } catch (error) {
    console.error('Check favorite status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's favorite songs by category
router.get('/category/:categoryName', authenticateToken, async (req, res) => {
  try {
    const { categoryName } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Ensure favorites playlist exists and resolve id
    let favIdData;
    try {
      favIdData = await getFavoritesIdForUser(req.user.id);
    } catch (err) {
      console.error('Failed to get Favorites playlist id:', err);
      return res.status(500).json({ error: 'Failed to get Favorites playlist' });
    }

    const { data: favorites, error } = await supabase
      .from('playlist_songs')
      .select(`
        added_at,
        songs(
          id,
          title,
          artist,
          movie,
          audio_url,
          cover_url,
          duration,
          song_categories(name, color),
          creator:users!songs_creator_id_fkey(username, full_name, avatar_url)
        )
      `)
      .eq('playlist_id', favIdData)
      .eq('songs.song_categories.name', categoryName)
      .order('added_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch favorites by category' });
    }

    res.json({
      favorites: favorites.map(fav => ({
        id: fav.songs.id,
        songId: fav.songs.id,
        title: fav.songs.title,
        artist: fav.songs.artist,
        movie: fav.songs.movie,
        audioUrl: fav.songs.audio_url,
        coverUrl: fav.songs.cover_url,
        duration: fav.songs.duration,
        category: fav.songs.song_categories,
        creator: fav.songs.creator,
  favoritedAt: fav.added_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: favorites.length
      }
    });

  } catch (error) {
    console.error('Get favorites by category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's favorite songs by creator
router.get('/creator/:creatorId', authenticateToken, async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Ensure favorites playlist exists and resolve id
    let favIdData;
    try {
      favIdData = await getFavoritesIdForUser(req.user.id);
    } catch (err) {
      console.error('Failed to get Favorites playlist id:', err);
      return res.status(500).json({ error: 'Failed to get Favorites playlist' });
    }

    const { data: favorites, error } = await supabase
      .from('playlist_songs')
      .select(`
        added_at,
        songs(
          id,
          title,
          artist,
          movie,
          audio_url,
          cover_url,
          duration,
          song_categories(name, color),
          creator:users!songs_creator_id_fkey(username, full_name, avatar_url)
        )
      `)
      .eq('playlist_id', favIdData)
      .eq('songs.creator_id', creatorId)
      .order('added_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch favorites by creator' });
    }

    res.json({
      favorites: favorites.map(fav => ({
        id: fav.songs.id,
        songId: fav.songs.id,
        title: fav.songs.title,
        artist: fav.songs.artist,
        movie: fav.songs.movie,
        audioUrl: fav.songs.audio_url,
        coverUrl: fav.songs.cover_url,
        duration: fav.songs.duration,
        category: fav.songs.song_categories,
        creator: fav.songs.creator,
  favoritedAt: fav.added_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: favorites.length
      }
    });

  } catch (error) {
    console.error('Get favorites by creator error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's favorite songs count
router.get('/count', authenticateToken, async (req, res) => {
  try {
    // Ensure favorites playlist exists and get its id
    let favIdData;
    try {
      favIdData = await getFavoritesIdForUser(req.user.id);
    } catch (err) {
      console.error('Failed to get Favorites playlist id:', err);
      return res.status(500).json({ error: 'Failed to get Favorites playlist' });
    }

    const { data: count, error } = await supabase
      .from('playlist_songs')
      .select('*', { count: 'exact', head: true })
      .eq('playlist_id', favIdData);

    if (error) {
      return res.status(500).json({ error: 'Failed to get favorites count' });
    }

    res.json({
      count: count || 0
    });

  } catch (error) {
    console.error('Get favorites count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

