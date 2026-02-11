const express = require('express');
const supabase = require('../config/supabase');
const router = express.Router();

async function authenticateToken(req, res, next) {
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
    console.error('Auth error:', error);
    return res.status(403).json({ error: 'Invalid token' });
  }
}

function requireCreator(req, res, next) {
  if (req.user.role !== 'content_creator') {
    return res.status(403).json({ error: 'Content creator access required' });
  }
  next();
}

router.get('/creator', authenticateToken, requireCreator, (req, res) => {
  supabase
    .from('playlists')
    .select(`
      *,
      playlist_songs(
        songs(
          id,
          title,
          artist,
          audio_url,
          cover_url
        )
      )
    `)
    .eq('creator_id', req.user.id)
    .order('created_at', { ascending: false })
    .then(({ data: playlists, error }) => {
      if (error) {
        console.error('Error fetching creator playlists:', error);
        return res.status(500).json({ error: 'Failed to fetch playlists' });
      }

      res.json({
        playlists: playlists.map(playlist => ({
          id: playlist.id,
          name: playlist.name,
          description: playlist.description,
          coverUrl: playlist.cover_url,
          createdAt: playlist.created_at,
          songCount: (playlist.playlist_songs || []).length
        }))
      });
    })
    .catch(error => {
      console.error('Error fetching creator playlists:', error);
      res.status(500).json({ error: 'Failed to fetch playlists' });
    });
});

// Create a new playlist
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description = '', isPublic = true, isFavorites = false } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Playlist name is required' });
    }

    const { data: playlist, error } = await supabase
      .from('playlists')
      .insert([
        {
          name: name.trim(),
          description: description || '',
          creator_id: req.user.id,
          is_public: isPublic,
          is_favorites: isFavorites,
          cover_url: null
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating playlist:', error);
      return res.status(500).json({ error: 'Failed to create playlist' });
    }

    res.status(201).json({
      playlist: {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        coverUrl: playlist.cover_url,
        isPublic: playlist.is_public,
        isFavorites: playlist.is_favorites,
        createdAt: playlist.created_at,
        songCount: 0
      }
    });
  } catch (error) {
    console.error('Create playlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user's playlists (including Favorites)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // Ensure favorites playlist exists for the user (creates if missing)
    try {
      await supabase.rpc('ensure_favorites_playlist', { p_user_id: req.user.id });
    } catch (e) {
      // non-fatal: continue, we'll still attempt to fetch playlists
      console.warn('ensure_favorites_playlist RPC warning:', e?.message || e);
    }

    const { data: playlists, error } = await supabase
      .from('playlists')
      .select(`
        id,
        name,
        description,
        cover_url,
        is_public,
        is_favorites,
        created_at,
        songs:playlist_songs(count)
      `)
      .eq('creator_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user playlists:', error);
      return res.status(500).json({ error: 'Failed to fetch playlists' });
    }

    res.json({
      playlists: (playlists || []).map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        coverUrl: p.cover_url,
        isPublic: p.is_public,
        isFavorites: p.is_favorites,
        createdAt: p.created_at,
        songCount: p.songs?.[0]?.count || 0
      }))
    });
  } catch (error) {
    console.error('Get user playlists error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get songs for a playlist owned by current user
router.get('/me/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Playlist ID is required' });

    const { data: playlist, error: pErr } = await supabase
      .from('playlists')
      .select('id, creator_id, is_public, is_favorites')
      .eq('id', id)
      .single();

    if (pErr || !playlist) return res.status(404).json({ error: 'Playlist not found' });
    if (playlist.creator_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized to access this playlist' });

    const { data: entries, error: eErr } = await supabase
      .from('playlist_songs')
      .select(`
        position,
        songs(id, title, artist, movie, audio_url, cover_url, duration)
      `)
      .eq('playlist_id', id)
      .order('position', { ascending: true });

    if (eErr) return res.status(500).json({ error: 'Failed to fetch playlist songs' });

    const songs = (entries || []).map((row) => row.songs).filter(Boolean);
    res.json({ songs });
  } catch (error) {
    console.error('Get user playlist songs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public (or permitted) access to playlist songs
router.get('/:id/songs', tryAuthenticate, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Playlist ID is required' });

    const { data: playlist, error: pErr } = await supabase
      .from('playlists')
      .select('id, creator_id, is_public')
      .eq('id', id)
      .single();

    if (pErr || !playlist) return res.status(404).json({ error: 'Playlist not found' });

    let canSee = false;
    const viewerId = req.user?.id;
    if (playlist.is_public) canSee = true;
    if (viewerId && viewerId === playlist.creator_id) canSee = true;

    // If not public and not owner, check friendship
    if (!canSee && viewerId) {
      const { data: friendship } = await supabase
        .from('friend_requests')
        .select('*')
        .or(`(sender_id.eq.${viewerId},receiver_id.eq.${playlist.creator_id})`, `(sender_id.eq.${playlist.creator_id},receiver_id.eq.${viewerId})`)
        .eq('status', 'accepted')
        .maybeSingle();
      if (friendship) canSee = true;
    }

    if (!canSee) return res.status(403).json({ error: 'This playlist is private' });

    const { data: entries, error: eErr } = await supabase
      .from('playlist_songs')
      .select(`position, songs(id, title, artist, movie, audio_url, cover_url, duration)`)
      .eq('playlist_id', id)
      .order('position', { ascending: true });

    if (eErr) return res.status(500).json({ error: 'Failed to fetch playlist songs' });

    const songs = (entries || []).map((row) => row.songs).filter(Boolean);
    res.json({ songs });
  } catch (error) {
    console.error('Get playlist songs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search playlists (public only)
router.get('/search', tryAuthenticate, async (req, res) => {
  try {
    const { q = '', limit = 20, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    if (!q || String(q).trim() === '') {
      return res.json({ playlists: [] });
    }

    let query = supabase
      .from('playlists')
      .select(`
        *,
        creator:users!playlists_creator_id_fkey(
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('is_public', true)
      .is('is_favorites', false)
      .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: playlists, error } = await query;

    if (error) {
      console.error('Playlist search error:', error);
      return res.status(500).json({ error: 'Failed to search playlists' });
    }

    res.json({
      playlists: (playlists || []).map(pl => ({
        id: pl.id,
        name: pl.name,
        description: pl.description,
        coverUrl: pl.cover_url,
        createdAt: pl.created_at,
        creator: pl.creator ? {
          id: pl.creator.id,
          username: pl.creator.username,
          fullName: pl.creator.full_name,
          avatarUrl: pl.creator.avatar_url
        } : null
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Playlist search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get playlists by a specific user ID (for profile pages)
// router.get('/user/:userId', tryAuthenticate, async (req, res) => {
//   try {
//     const { userId } = req.params;
    
//     if (!userId) {
//       return res.status(400).json({ error: 'User ID is required' });
//     }

//     // Get playlists for the user (public only unless viewer is friend)
//     const { data: playlists, error } = await supabase
//       .from('playlists')
//       .select(`
//         id,
//         name,
//         description,
//         cover_url,
//         is_public,
//         is_favorites,
//         created_at,
//         updated_at,
//         songs:playlist_songs(count)
//       `)
//       .eq('creator_id', userId)
//       .order('created_at', { ascending: false });

//     if (error) {
//       console.error('Error fetching user playlists:', error);
//       return res.status(500).json({ error: 'Failed to fetch playlists' });
//     }

//     res.json({
//       playlists: (playlists || []).map(p => ({
//         id: p.id,
//         name: p.name,
//         description: p.description,
//         coverUrl: p.cover_url,
//         isPublic: p.is_public,
//         isFavorites: p.is_favorites,
//         createdAt: p.created_at,
//         songCount: p.songs?.[0]?.count || 0
//       }))
//     });
//   } catch (error) {
//     console.error('Get user playlists error:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

router.get('/user/:userId', tryAuthenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const viewerId = req.user?.id;
    let canSeePrivate = false;

    // Determine if viewer is self or friend
    if (viewerId && viewerId === userId) {
      canSeePrivate = true;
    } else if (viewerId) {
      // Check for friendship in friend_requests table
      const { data: friendship } = await supabase
        .from('friend_requests')
        .select('*')
        .or(`(sender_id.eq.${viewerId},receiver_id.eq.${userId})`, `(sender_id.eq.${userId},receiver_id.eq.${viewerId})`)
        .eq('status', 'accepted')
        .maybeSingle();
      if (friendship) canSeePrivate = true;
    }

    let query = supabase
      .from('playlists')
      .select(`
        id, name, description, cover_url, is_public, is_favorites, created_at, updated_at, songs:playlist_songs(count)
      `)
      .eq('creator_id', userId)
      .order('created_at', { ascending: false });

    if (!canSeePrivate) {
      query = query.eq('is_public', true);
    }

    const { data: playlists, error } = await query;

    if (error) {
      console.error('Error fetching user playlists:', error);
      return res.status(500).json({ error: 'Failed to fetch playlists' });
    }

    return res.json({
      playlists: (playlists || []).map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        coverUrl: p.cover_url,
        isPublic: p.is_public,
        isFavorites: p.is_favorites,
        createdAt: p.created_at,
        songCount: p.songs?.[0]?.count || 0
      }))
    });
  } catch (error) {
    console.error('Get user playlists error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a playlist
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isPublic } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Playlist ID is required' });
    }

    // Verify ownership
    const { data: playlist, error: fetchError } = await supabase
      .from('playlists')
      .select('creator_id')
      .eq('id', id)
      .single();

    if (fetchError || !playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    if (playlist.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to update this playlist' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description;
    if (isPublic !== undefined) updateData.is_public = isPublic;

    const { data: updatedPlaylist, error } = await supabase
      .from('playlists')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating playlist:', error);
      return res.status(500).json({ error: 'Failed to update playlist' });
    }

    res.json({
      playlist: {
        id: updatedPlaylist.id,
        name: updatedPlaylist.name,
        description: updatedPlaylist.description,
        coverUrl: updatedPlaylist.cover_url,
        isPublic: updatedPlaylist.is_public,
        isFavorites: updatedPlaylist.is_favorites,
        createdAt: updatedPlaylist.created_at
      }
    });
  } catch (error) {
    console.error('Update playlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a playlist
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Playlist ID is required' });
    }

    // Verify ownership
    const { data: playlist, error: fetchError } = await supabase
      .from('playlists')
      .select('creator_id')
      .eq('id', id)
      .single();

    if (fetchError || !playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    if (playlist.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to delete this playlist' });
    }

    const { error } = await supabase
      .from('playlists')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting playlist:', error);
      return res.status(500).json({ error: 'Failed to delete playlist' });
    }

    res.json({ message: 'Playlist deleted successfully' });
  } catch (error) {
    console.error('Delete playlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add song to playlist (if this endpoint exists in frontend)
router.post('/:id/songs/:songId', authenticateToken, async (req, res) => {
  try {
    const { id, songId } = req.params;

    // Verify playlist ownership
    const { data: playlist, error: fetchError } = await supabase
      .from('playlists')
      .select('creator_id')
      .eq('id', id)
      .single();

    if (fetchError || !playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    if (playlist.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to modify this playlist' });
    }

    // Add song to playlist
    const { error } = await supabase
      .from('playlist_songs')
      .insert([
        {
          playlist_id: id,
          song_id: songId
        }
      ]);

    if (error) {
      console.error('Error adding song to playlist:', error);
      return res.status(500).json({ error: 'Failed to add song to playlist' });
    }

    res.status(201).json({ message: 'Song added to playlist' });
  } catch (error) {
    console.error('Add song to playlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add song to playlist (accepts JSON body { songId })
router.post('/:id/songs', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { songId } = req.body;

    if (!id || !songId) return res.status(400).json({ error: 'Playlist ID and songId are required' });

    // Verify playlist ownership
    const { data: playlist, error: fetchError } = await supabase
      .from('playlists')
      .select('creator_id')
      .eq('id', id)
      .single();

    if (fetchError || !playlist) return res.status(404).json({ error: 'Playlist not found' });
    if (playlist.creator_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized to modify this playlist' });

    // Check if song already exists in playlist
    const { data: existing } = await supabase
      .from('playlist_songs')
      .select('id')
      .eq('playlist_id', id)
      .eq('song_id', songId)
      .maybeSingle();

    if (existing) return res.status(400).json({ error: 'Song already in playlist' });

    // Compute next position
    const { data: last } = await supabase
      .from('playlist_songs')
      .select('position')
      .eq('playlist_id', id)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    const position = last?.position ? last.position + 1 : 1;

    const { error } = await supabase
      .from('playlist_songs')
      .insert([{ playlist_id: id, song_id: songId, position }]);

    if (error) {
      console.error('Error adding song to playlist (body):', error);
      return res.status(500).json({ error: 'Failed to add song to playlist' });
    }

    res.status(201).json({ message: 'Song added to playlist' });
  } catch (error) {
    console.error('Add song to playlist error (body):', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove song from playlist
router.delete('/:id/songs/:songId', authenticateToken, async (req, res) => {
  try {
    const { id, songId } = req.params;

    // Verify playlist ownership
    const { data: playlist, error: fetchError } = await supabase
      .from('playlists')
      .select('creator_id')
      .eq('id', id)
      .single();

    if (fetchError || !playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    if (playlist.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to modify this playlist' });
    }

    // Remove song from playlist
    const { error } = await supabase
      .from('playlist_songs')
      .delete()
      .eq('playlist_id', id)
      .eq('song_id', songId);

    if (error) {
      console.error('Error removing song from playlist:', error);
      return res.status(500).json({ error: 'Failed to remove song from playlist' });
    }

    res.json({ message: 'Song removed from playlist' });
  } catch (error) {
    console.error('Remove song from playlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function tryAuthenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    authenticateToken(req, res, () => {
      req.user = req.user || { id: null };
      next();
    });
  } else {
    req.user = { id: null };
    next();
  }
}

module.exports = router;