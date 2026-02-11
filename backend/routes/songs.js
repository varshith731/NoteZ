const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const router = express.Router();

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

// Supabase auth: verify access token and attach user with role
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

    // Fetch role from users table
    const { data: dbUser } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    req.user = { id: user.id, email: user.email, role: dbUser?.role };
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

// Middleware to verify Supabase access token (for favorites endpoints)
const authenticateSupabaseToken = async (req, res, next) => {
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
    req.supaUser = { id: user.id, email: user.email };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Upload new song (Content Creator only)
router.post('/upload', authenticateToken, requireCreator, upload.single('audio'), async (req, res) => {
  try {
    const { title, artist, movie, categoryId, lyrics, isPublic } = req.body;
    const audioFile = req.file;

    if (!title || !artist || !categoryId || !audioFile) {
      return res.status(400).json({ error: 'Title, artist, category, and audio file are required' });
    }

    // Upload audio file to Supabase Storage
    // Sanitize filename by removing special characters and spaces
    const sanitizedName = audioFile.originalname
      .replace(/[\[\]{}()*+?.,\\^$|#\s]/g, '_')
      .replace(/-+/g, '-');
    const fileName = `${Date.now()}-${sanitizedName}`;
    
    console.log('Uploading file with sanitized name:', fileName);
    
    const { data: audioData, error: audioError } = await supabase.storage
      .from('songs')
      .upload(fileName, audioFile.buffer, {
        contentType: audioFile.mimetype,
        cacheControl: '3600'
      });

    if (audioError) {
      console.error('Supabase storage upload error:', audioError);
      return res.status(500).json({ 
        error: 'Failed to upload audio file', 
        details: audioError.message || audioError 
      });
    }

    // Get public URL for audio
    const { data: audioUrl } = supabase.storage
      .from('songs')
      .getPublicUrl(fileName);

    // Create song record in database
    const { data: song, error: songError } = await supabase
      .from('songs')
      .insert({
        title,
        artist,
        movie: movie || null,
        category_id: categoryId,
        creator_id: req.user.id,
        audio_url: audioUrl.publicUrl,
        lyrics: lyrics || null,
        is_public: isPublic !== 'false',
        duration: 0 // Will be updated later
      })
      .select(`
        *,
        song_categories(name, color),
        users(username, full_name)
      `)
      .single();

    if (songError) {
      // Clean up uploaded file if database insert fails
      await supabase.storage.from('songs').remove([fileName]);
      return res.status(500).json({ error: 'Failed to create song record' });
    }

    res.status(201).json({
      message: 'Song uploaded successfully',
      song: {
        id: song.id,
        title: song.title,
        artist: song.artist,
        movie: song.movie,
        category: song.song_categories,
        audioUrl: song.audio_url,
        lyrics: song.lyrics,
        isPublic: song.is_public,
        createdAt: song.created_at
      }
    });

  } catch (error) {
    console.error('Song upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get songs for a content creator
router.get('/creator', authenticateToken, requireCreator, async (req, res) => {
  try {
    const { data: songs, error } = await supabase
      .from('songs')
      .select(`
        *,
        song_categories(name, color),
        users(username, full_name, avatar_url)
      `)
      .eq('creator_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching creator songs:', error);
      return res.status(500).json({ error: 'Failed to fetch songs' });
    }

    res.json({
      songs: songs.map(song => ({
        id: song.id,
        title: song.title,
        artist: song.artist,
        movie: song.movie,
        category: song.song_categories,
        audioUrl: song.audio_url,
        lyrics: song.lyrics,
        isPublic: song.is_public,
        createdAt: song.created_at,
        analytics: song.analytics || []
      }))
    });
  } catch (error) {
    console.error('Error fetching creator songs:', error);
    res.status(500).json({ error: 'Failed to fetch songs' });
  }
});

// Get all songs with search and filtering
router.get('/', async (req, res) => {
  try {
    const { 
      search, 
      category, 
      creator, 
      page = 1, 
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    let query = supabase
      .from('songs')
      .select(`
        *,
        song_categories!inner(name, color, description),
        users(username, full_name, avatar_url),
        creator:users!songs_creator_id_fkey(username, full_name, avatar_url)
      `)
      .eq('is_public', true);

    // Apply search filter
    if (search) {
      query = query.or(`title.ilike.%${search}%,artist.ilike.%${search}%,movie.ilike.%${search}%`);
    }

    // Apply category filter (filter on the joined table)
    if (category) {
      query = query.eq('song_categories.name', category);
    }

    // Apply creator filter
    if (creator) {
      query = query.eq('creator.username', creator);
    }

    // Apply sorting
    if (sortBy === 'title') {
      query = query.order('title', { ascending: sortOrder === 'asc' });
    } else if (sortBy === 'artist') {
      query = query.order('artist', { ascending: sortOrder === 'asc' });
    } else if (sortBy === 'popularity') {
      // This would need a join with analytics table
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: sortOrder === 'asc' });
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: songs, error, count } = await query;

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch songs' });
    }

    res.json({
      songs: songs.map(song => ({
        id: song.id,
        title: song.title,
        artist: song.artist,
        movie: song.movie,
        category: song.song_categories,
        audioUrl: song.audio_url,
        coverUrl: song.cover_url,
        lyrics: song.lyrics,
        duration: song.duration,
        isPublic: song.is_public,
        creator: song.creator,
        createdAt: song.created_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || songs.length
      }
    });

  } catch (error) {
    console.error('Get songs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get song by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: song, error } = await supabase
      .from('songs')
      .select(`
        *,
        song_categories(name, color, description),
        creator:users!songs_creator_id_fkey(username, full_name, avatar_url, bio),
        song_analytics(play_count, listen_duration)
      `)
      .eq('id', id)
      .eq('is_public', true)
      .single();

    if (error || !song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    res.json({
      song: {
        id: song.id,
        title: song.title,
        artist: song.artist,
        movie: song.movie,
        category: song.song_categories,
        audioUrl: song.audio_url,
        coverUrl: song.cover_url,
        lyrics: song.lyrics,
        duration: song.duration,
        isPublic: song.is_public,
        creator: song.creator,
        analytics: song.song_analytics,
        createdAt: song.created_at
      }
    });

  } catch (error) {
    console.error('Get song error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update song (Creator only)
router.put('/:id', authenticateToken, requireCreator, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, artist, movie, categoryId, lyrics, isPublic } = req.body;

    // Check if song exists and belongs to user
    const { data: existingSong, error: checkError } = await supabase
      .from('songs')
      .select('id, creator_id')
      .eq('id', id)
      .single();

    if (checkError || !existingSong) {
      return res.status(404).json({ error: 'Song not found' });
    }

    if (existingSong.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only update your own songs' });
    }

    // Update song
    const { data: song, error: updateError } = await supabase
      .from('songs')
      .update({
        title: title || undefined,
        artist: artist || undefined,
        movie: movie || undefined,
        category_id: categoryId || undefined,
        lyrics: lyrics || undefined,
        is_public: isPublic !== undefined ? isPublic : undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        song_categories(name, color)
      `)
      .single();

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update song' });
    }

    res.json({
      message: 'Song updated successfully',
      song: {
        id: song.id,
        title: song.title,
        artist: song.artist,
        movie: song.movie,
        category: song.song_categories,
        lyrics: song.lyrics,
        isPublic: song.is_public,
        updatedAt: song.updated_at
      }
    });

  } catch (error) {
    console.error('Update song error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete song (Creator only)
router.delete('/:id', authenticateToken, requireCreator, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if song exists and belongs to user
    const { data: song, error: checkError } = await supabase
      .from('songs')
      .select('id, creator_id, audio_url')
      .eq('id', id)
      .single();

    if (checkError || !song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    if (song.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own songs' });
    }

    // Delete song from database
    const { error: deleteError } = await supabase
      .from('songs')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return res.status(500).json({ error: 'Failed to delete song' });
    }

    // Extract filename from audio_url and delete from storage
    if (song.audio_url) {
      const fileName = song.audio_url.split('/').pop();
      if (fileName) {
        await supabase.storage.from('songs').remove([fileName]);
      }
    }

    res.json({ message: 'Song deleted successfully' });

  } catch (error) {
    console.error('Delete song error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get songs by current creator (authenticated)
router.get('/creator', authenticateToken, requireCreator, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const { data: songs, error } = await supabase
      .from('songs')
      .select(`
        *,
        song_categories(name, color)
      `)
      .eq('creator_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching creator songs:', error);
      return res.status(500).json({ error: 'Failed to fetch songs' });
    }

    res.json({
      songs: songs.map(song => ({
        id: song.id,
        title: song.title,
        artist: song.artist,
        movie: song.movie,
        category: song.song_categories,
        audioUrl: song.audio_url,
        coverUrl: song.cover_url,
        duration: song.duration,
        lyrics: song.lyrics,
        isPublic: song.is_public,
        createdAt: song.created_at,
        analytics: song.song_analytics || []
      }))
    });
  } catch (error) {
    console.error('Get creator songs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get songs by creator
router.get('/creator/:creatorId', async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const offset = (page - 1) * limit;

    const { data: songs, error } = await supabase
      .from('songs')
      .select(`
        *,
        song_categories(name, color),
        song_analytics(play_count, listen_duration)
      `)
      .eq('creator_id', creatorId)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch creator songs' });
    }

    res.json({
      songs: songs.map(song => ({
        id: song.id,
        title: song.title,
        artist: song.artist,
        movie: song.movie,
        category: song.song_categories,
        audioUrl: song.audio_url,
        coverUrl: song.cover_url,
        duration: song.duration,
        analytics: song.song_analytics,
        createdAt: song.created_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: songs.length
      }
    });

  } catch (error) {
    console.error('Get creator songs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
// Favorites toggle endpoints under songs
router.post('/:id/favorite', authenticateSupabaseToken, async (req, res) => {
  try {
    const songId = req.params.id;

    // Validate song exists and public
    const { data: song, error: songError } = await supabase
      .from('songs')
      .select('id, title, is_public')
      .eq('id', songId)
      .eq('is_public', true)
      .single();
    if (songError || !song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Ensure favorites playlist exists
    const { data: favIdData, error: favIdError } = await supabase
      .rpc('ensure_favorites_playlist', { p_user_id: req.supaUser.id });
    if (favIdError) return res.status(500).json({ error: 'Failed to get Favorites playlist' });

    // Determine next position
    const { data: last, error: posError } = await supabase
      .from('playlist_songs')
      .select('position')
      .eq('playlist_id', favIdData)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (posError) return res.status(500).json({ error: 'Failed to update favorites' });
    const nextPos = last?.position ? last.position + 1 : 1;

    // Insert
    const { error: insError } = await supabase
      .from('playlist_songs')
      .insert({ playlist_id: favIdData, song_id: songId, position: nextPos });
    if (insError) {
      if (insError.code === '23505') {
        return res.status(400).json({ error: 'Song already in favorites' });
      }
      return res.status(500).json({ error: 'Failed to add to favorites' });
    }

    res.json({ message: 'Song added to favorites' });
  } catch (error) {
    console.error('POST /songs/:id/favorite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/favorite', authenticateSupabaseToken, async (req, res) => {
  try {
    const songId = req.params.id;

    const { data: favIdData, error: favIdError } = await supabase
      .rpc('ensure_favorites_playlist', { p_user_id: req.supaUser.id });
    if (favIdError) return res.status(500).json({ error: 'Failed to get Favorites playlist' });

    const { error } = await supabase
      .from('playlist_songs')
      .delete()
      .eq('playlist_id', favIdData)
      .eq('song_id', songId);
    if (error) {
      return res.status(500).json({ error: 'Failed to remove from favorites' });
    }
    res.json({ message: 'Song removed from favorites' });
  } catch (error) {
    console.error('DELETE /songs/:id/favorite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
