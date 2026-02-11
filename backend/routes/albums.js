const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// Optional authentication middleware
const tryAuthenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token || token.split('.').length !== 3) {
    return next();
  }
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) {
      req.user = { id: user.id };
    }
  } catch {}
  next();
};

// Search albums (with optional filters)
router.get('/search', tryAuthenticate, async (req, res) => {
  try {
    const { q = '', page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    if (!q || String(q).trim() === '') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Build query to search albums and include creator info
    let query = supabase
      .from('albums')
      .select(`
        id,
        title,
        description,
        cover_url,
        release_date,
        total_songs,
        total_listens,
        created_at,
        creator:users!albums_creator_id_fkey(
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('is_public', true)
      .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
      .order('total_listens', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: albums, error, count } = await query;

    if (error) {
      console.error('Album search error:', error);
      return res.status(500).json({ error: 'Failed to search albums' });
    }

    res.json({
      albums: albums.map(album => ({
        id: album.id,
        title: album.title,
        description: album.description,
        coverUrl: album.cover_url,
        releaseDate: album.release_date,
        songCount: album.total_songs,
        totalListens: album.total_listens,
        createdAt: album.created_at,
        creator: album.creator ? {
          id: album.creator.id,
          username: album.creator.username,
          fullName: album.creator.full_name,
          avatarUrl: album.creator.avatar_url
        } : null
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || albums.length
      }
    });

  } catch (error) {
    console.error('Album search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Authenticate middleware
const authenticateToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    const { data: dbUser } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();
    req.user = {
      id: user.id,
      email: user.email,
      role: dbUser?.role
    };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Middleware to check if user is content creator
const requireCreator = (req, res, next) => {
  if (req.user.role !== 'content_creator') {
    return res.status(403).json({ error: 'Content creator access required' });
  }
  next();
};

// Get current creator's albums
router.get('/creator', authenticateToken, requireCreator, async (req, res) => {
  try {
    const { data: albums, error } = await supabase
      .from('albums')
      .select('id, title, description, cover_url, total_songs, total_listens, created_at, updated_at')
      .eq('creator_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching creator albums:', error);
      return res.status(500).json({ error: 'Failed to fetch albums' });
    }

    res.json({
      albums: albums.map(album => ({
        id: album.id,
        title: album.title,
        description: album.description,
        cover_url: album.cover_url,
        coverUrl: album.cover_url,
        total_songs: album.total_songs || 0,
        songCount: album.total_songs || 0,
        total_listens: album.total_listens || 0,
        createdAt: album.created_at,
        updated_at: album.updated_at
      }))
    });
  } catch (error) {
    console.error('Get creator albums error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;