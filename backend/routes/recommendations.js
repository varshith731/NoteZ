const express = require('express');
const supabase = require('../config/supabase');

const router = express.Router();

// Middleware to verify Supabase access token
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

// Get song recommendations
router.get('/songs', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 5;

    // Get user's recently played songs and their categories
    const { data: recentSongs, error: recentError } = await supabase
      .from('listening_history')
      .select(`
        song_id,
        songs!inner(
          id,
          category_id,
          song_categories(name)
        )
      `)
      .eq('user_id', userId)
      .order('listened_at', { ascending: false })
      .limit(20);

    if (recentError) {
      console.error('Error fetching recent songs:', recentError);
    }

    // Extract category IDs from user history
    const categoryIds = new Set();
    
    if (recentSongs && recentSongs.length > 0) {
      recentSongs.forEach(item => {
        if (item.songs?.category_id) {
          categoryIds.add(item.songs.category_id);
        }
      });
    }

    // Get already played song IDs to exclude them
    const playedSongIds = new Set();
    if (recentSongs) {
      recentSongs.forEach(item => playedSongIds.add(item.song_id));
    }

    let recommendations = [];

    // Step 3: If user has history, recommend similar songs
    if (categoryIds.size > 0) {
      const { data: similarSongs, error: similarError } = await supabase
        .from('songs')
        .select(`
          id,
          title,
          artist,
          movie,
          audio_url,
          cover_url,
          category_id,
          song_categories(name, color)
        `)
        .in('category_id', Array.from(categoryIds))
        .eq('is_public', true)
        .not('id', 'in', `(${Array.from(playedSongIds).join(',')})`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!similarError && similarSongs) {
        recommendations = similarSongs;
      }
    }

    // Step 4: If not enough recommendations, add popular/trending songs
    if (recommendations.length < limit) {
      const popularQuery = supabase
        .from('songs')
        .select(`
          id,
          title,
          artist,
          movie,
          audio_url,
          cover_url,
          category_id,
          song_categories(name, color)
        `)
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      // Only exclude played songs if we have some
      if (playedSongIds.size > 0) {
        popularQuery.not('id', 'in', `(${Array.from(playedSongIds).join(',')})`);
      }

      const { data: popularSongs, error: popularError } = await popularQuery
        .limit(limit - recommendations.length);

      if (!popularError && popularSongs) {
        recommendations = [...recommendations, ...popularSongs];
      }

      // If still no songs, try one last time without any filters
      if (recommendations.length === 0) {
        const { data: anySongs, error: anyError } = await supabase
          .from('songs')
          .select(`
            id,
            title,
            artist,
            movie,
            audio_url,
            cover_url,
            category_id,
            song_categories(name, color)
          `)
          .eq('is_public', true)
          .limit(limit);

        if (!anyError && anySongs) {
          recommendations = anySongs;
        }
      }
    }

    // Format response
    const formattedRecommendations = recommendations.slice(0, limit).map(song => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      movie: song.movie,
      audioUrl: song.audio_url,
      coverUrl: song.cover_url,
      category: song.song_categories?.name,
      categoryColor: song.song_categories?.color
    }));

    res.json({
      songs: formattedRecommendations,
      basedOn: categoryIds.size > 0 ? 'user_history' : 'popular',
      count: formattedRecommendations.length
    });

  } catch (error) {
    console.error('Song recommendations error:', error);
    res.status(500).json({ error: 'Failed to fetch song recommendations' });
  }
});

// Get personalized recommendations for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 5;

    // Get user's recently played songs and their categories
    const { data: recentSongs, error: recentError } = await supabase
      .from('listening_history')
      .select(`
        song_id,
        songs!inner(
          id,
          category_id,
          song_categories(name)
        )
      `)
      .eq('user_id', userId)
      .order('listened_at', { ascending: false })
      .limit(20);

    if (recentError) {
      console.error('Error fetching recent songs:', recentError);
    }

    // Extract category IDs from user history
    const categoryIds = new Set();
    
    if (recentSongs && recentSongs.length > 0) {
      recentSongs.forEach(item => {
        if (item.songs?.category_id) {
          categoryIds.add(item.songs.category_id);
        }
      });
    }

    // Get already played song IDs to exclude them
    const playedSongIds = new Set();
    if (recentSongs) {
      recentSongs.forEach(item => playedSongIds.add(item.song_id));
    }

    let recommendations = [];

    // Step 3: If user has history, recommend similar songs
    if (categoryIds.size > 0) {
      const { data: similarSongs, error: similarError } = await supabase
        .from('songs')
        .select(`
          id,
          title,
          artist,
          movie,
          audio_url,
          cover_url,
          category_id,
          song_categories(name, color)
        `)
        .in('category_id', Array.from(categoryIds))
        .eq('is_public', true)
        .not('id', 'in', `(${Array.from(playedSongIds).join(',')})`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!similarError && similarSongs) {
        recommendations = similarSongs;
      }
    }

    // Step 4: If not enough recommendations, add popular/trending songs
    if (recommendations.length < limit) {
      const popularQuery = supabase
        .from('songs')
        .select(`
          id,
          title,
          artist,
          movie,
          audio_url,
          cover_url,
          category_id,
          song_categories(name, color),
          song_analytics(play_count)
        `)
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      // Only exclude played songs if we have some
      if (playedSongIds.size > 0) {
        popularQuery.not('id', 'in', `(${Array.from(playedSongIds).join(',')})`);
      }

      const { data: popularSongs, error: popularError } = await popularQuery
        .limit(limit - recommendations.length);

      if (!popularError && popularSongs) {
        recommendations = [...recommendations, ...popularSongs];
      }

      // If still no songs, try one last time without any filters
      if (recommendations.length === 0) {
        const { data: anySongs, error: anyError } = await supabase
          .from('songs')
          .select(`
            id,
            title,
            artist,
            movie,
            audio_url,
            cover_url,
            category_id,
            song_categories(name, color)
          `)
          .eq('is_public', true)
          .limit(limit);

        if (!anyError && anySongs) {
          recommendations = anySongs;
        }
      }
    }

    // Format response
    const formattedRecommendations = recommendations.slice(0, limit).map(song => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      movie: song.movie,
      audioUrl: song.audio_url,
      coverUrl: song.cover_url,
      category: song.song_categories?.name,
      categoryColor: song.song_categories?.color
    }));

    res.json({
      recommendations: formattedRecommendations,
      basedOn: categoryIds.size > 0 ? 'user_history' : 'popular',
      count: formattedRecommendations.length
    });

  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

// Get recommendations for albums based on user listening history
router.get('/albums', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 5;

    // Get user's preferred categories from listening history
    const { data: recentSongs, error: recentError } = await supabase
      .from('listening_history')
      .select(`
        songs!inner(
          category_id,
          language
        )
      `)
      .eq('user_id', userId)
      .order('listened_at', { ascending: false })
      .limit(20);

    if (recentError) {
      console.error('Error fetching recent songs for albums:', recentError);
    }

    // Extract preferences
    const categoryIds = new Set();
    const languages = new Set();
    
    if (recentSongs && recentSongs.length > 0) {
      recentSongs.forEach(item => {
        if (item.songs?.category_id) categoryIds.add(item.songs.category_id);
        if (item.songs?.language) languages.add(item.songs.language);
      });
    }

    // Fetch recommended albums
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
        creator_id,
        users!albums_creator_id_fkey(username, full_name)
      `)
      .eq('is_public', true)
      .gt('total_songs', 0)
      .order('created_at', { ascending: false });

    const { data: albums, error } = await query.limit(limit);

    if (error) {
      console.error('Error fetching album recommendations:', error);
      return res.status(500).json({ error: 'Failed to fetch album recommendations' });
    }

    const formattedAlbums = (albums || []).map(album => ({
      id: album.id,
      title: album.title,
      description: album.description,
      coverUrl: album.cover_url,
      releaseDate: album.release_date,
      songCount: album.total_songs,
      totalListens: album.total_listens,
      creator: album.users?.username || 'Unknown'
    }));

    res.json({
      albums: formattedAlbums,
      count: formattedAlbums.length
    });

  } catch (error) {
    console.error('Album recommendations error:', error);
    res.status(500).json({ error: 'Failed to fetch album recommendations' });
  }
});

// Get recommendations for playlists based on user preferences
router.get('/playlists', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 3;

    // Get public playlists excluding user's own playlists
    const { data: playlists, error } = await supabase
      .from('playlists')
      .select(`
        id,
        name,
        description,
        cover_url,
        creator_id,
        users!playlists_creator_id_fkey(username, full_name, avatar_url),
        playlist_songs(count)
      `)
      .eq('is_public', true)
      .eq('is_favorites', false)
      .neq('creator_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching playlist recommendations:', error);
      return res.status(500).json({ error: 'Failed to fetch playlist recommendations' });
    }

    const formattedPlaylists = (playlists || []).map(playlist => ({
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      coverUrl: playlist.cover_url,
      creator: playlist.users?.username || 'Unknown',
      songCount: playlist.playlist_songs?.[0]?.count || 0
    }));

    res.json({
      playlists: formattedPlaylists,
      count: formattedPlaylists.length
    });

  } catch (error) {
    console.error('Playlist recommendations error:', error);
    res.status(500).json({ error: 'Failed to fetch playlist recommendations' });
  }
});

module.exports = router;

