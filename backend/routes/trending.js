const express = require('express');
const supabase = require('../config/supabase');

const router = express.Router();

// Get trending songs with filters
router.get('/songs', async (req, res) => {
  try {
    const { 
      period = '7',  // days
      limit = '10',
      scope = 'global',  // global, national
      language,
      category
    } = req.query;

    const periodDate = new Date();
    periodDate.setDate(periodDate.getDate() - parseInt(period));

    // Build query for trending songs
    let songsQuery = supabase
      .from('song_analytics')
      .select(`
        song_id,
        play_count,
        songs!inner(
          id,
          title,
          artist,
          movie,
          audio_url,
          cover_url,
          language,
          category_id,
          song_categories(id, name, color),
          users!songs_creator_id_fkey(username, full_name, avatar_url)
        )
      `)
      .eq('songs.is_public', true)
      .gte('last_played', periodDate.toISOString());

    // Apply language filter if provided
    if (language && language !== 'all') {
      songsQuery = songsQuery.eq('songs.language', language);
    }

    // Apply category filter if provided
    if (category && category !== 'all') {
      songsQuery = songsQuery.eq('songs.song_categories.name', category);
    }

    const { data: analytics, error } = await songsQuery.order('play_count', { ascending: false });

    if (error) {
      console.error('Error fetching trending songs:', error);
      return res.status(500).json({ error: 'Failed to fetch trending songs' });
    }

    // Group by song and sum play counts
    const songStats = {};
    (analytics || []).forEach(entry => {
      const songId = entry.songs.id;
      if (!songStats[songId]) {
        songStats[songId] = {
          song: entry.songs,
          totalPlays: 0
        };
      }
      songStats[songId].totalPlays += entry.play_count || 0;
    });

    // Sort and format
    const trending = Object.values(songStats)
      .sort((a, b) => b.totalPlays - a.totalPlays)
      .slice(0, parseInt(limit))
      .map((stat, index) => ({
        rank: index + 1,
        id: stat.song.id,
        title: stat.song.title,
        artist: stat.song.artist,
        movie: stat.song.movie,
        audioUrl: stat.song.audio_url,
        coverUrl: stat.song.cover_url,
        language: stat.song.language,
        category: stat.song.song_categories?.name,
        categoryColor: stat.song.song_categories?.color,
        creator: stat.song.users?.username,
        totalPlays: stat.totalPlays
      }));

    res.json({
      type: 'songs',
      period: `${period} days`,
      scope,
      filters: { language, category },
      trending,
      count: trending.length
    });

  } catch (error) {
    console.error('Trending songs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get trending albums with filters
router.get('/albums', async (req, res) => {
  try {
    const { 
      period = '30',
      limit = '10',
      scope = 'global',
      language,
      category
    } = req.query;

    const periodDate = new Date();
    periodDate.setDate(periodDate.getDate() - parseInt(period));

    // Fetch albums with song data to filter by language/category
    let albumsQuery = supabase
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
        users!albums_creator_id_fkey(username, full_name, avatar_url),
        songs(id, language, category_id, song_categories(name))
      `)
      .eq('is_public', true)
      .gt('total_songs', 0)
      .gte('created_at', periodDate.toISOString());

    const { data: albums, error } = await albumsQuery
      .order('total_listens', { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      console.error('Error fetching trending albums:', error);
      return res.status(500).json({ error: 'Failed to fetch trending albums' });
    }

    // Filter and format albums
    let filteredAlbums = albums || [];

    // Apply language filter
    if (language && language !== 'all') {
      filteredAlbums = filteredAlbums.filter(album => 
        album.songs && album.songs.some(song => song.language === language)
      );
    }

    // Apply category filter
    if (category && category !== 'all') {
      filteredAlbums = filteredAlbums.filter(album => 
        album.songs && album.songs.some(song => 
          song.song_categories?.name === category
        )
      );
    }

    const trending = filteredAlbums.map((album, index) => ({
      rank: index + 1,
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
      type: 'albums',
      period: `${period} days`,
      scope,
      filters: { language, category },
      trending,
      count: trending.length
    });

  } catch (error) {
    console.error('Trending albums error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get trending playlists with filters
router.get('/playlists', async (req, res) => {
  try {
    const { 
      period = '30',
      limit = '10',
      scope = 'global',
      language,
      category
    } = req.query;

    const periodDate = new Date();
    periodDate.setDate(periodDate.getDate() - parseInt(period));

    // Fetch playlists with song data
    let playlistsQuery = supabase
      .from('playlists')
      .select(`
        id,
        name,
        description,
        cover_url,
        created_at,
        users!playlists_creator_id_fkey(username, full_name, avatar_url),
        playlist_songs(
          id,
          songs(
            id,
            language,
            category_id,
            song_categories(name)
          )
        )
      `)
      .eq('is_public', true)
      .eq('is_favorites', false)
      .gte('created_at', periodDate.toISOString());

    const { data: playlists, error } = await playlistsQuery
      .order('created_at', { ascending: false })
      .limit(parseInt(limit) * 2); // Fetch more to account for filtering

    if (error) {
      console.error('Error fetching trending playlists:', error);
      return res.status(500).json({ error: 'Failed to fetch trending playlists' });
    }

    // Filter and format playlists
    let filteredPlaylists = playlists || [];

    // Apply language filter
    if (language && language !== 'all') {
      filteredPlaylists = filteredPlaylists.filter(playlist => 
        playlist.playlist_songs && playlist.playlist_songs.some(ps => 
          ps.songs?.language === language
        )
      );
    }

    // Apply category filter
    if (category && category !== 'all') {
      filteredPlaylists = filteredPlaylists.filter(playlist => 
        playlist.playlist_songs && playlist.playlist_songs.some(ps => 
          ps.songs?.song_categories?.name === category
        )
      );
    }

    const trending = filteredPlaylists
      .slice(0, parseInt(limit))
      .map((playlist, index) => ({
        rank: index + 1,
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        coverUrl: playlist.cover_url,
        songCount: playlist.playlist_songs?.length || 0,
        creator: playlist.users?.username || 'Unknown'
      }));

    res.json({
      type: 'playlists',
      period: `${period} days`,
      scope,
      filters: { language, category },
      trending,
      count: trending.length
    });

  } catch (error) {
    console.error('Trending playlists error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get available filters (languages and categories)
router.get('/filters', async (req, res) => {
  try {
    // Get all unique languages from songs
    const { data: songs, error: songsError } = await supabase
      .from('songs')
      .select('language')
      .eq('is_public', true)
      .not('language', 'is', null);

    // Get all categories
    const { data: categories, error: categoriesError } = await supabase
      .from('song_categories')
      .select('id, name, color')
      .order('name');

    if (songsError || categoriesError) {
      console.error('Error fetching filters:', songsError || categoriesError);
      return res.status(500).json({ error: 'Failed to fetch filters' });
    }

    // Extract unique languages
    const languages = [...new Set((songs || []).map(s => s.language).filter(Boolean))];

    res.json({
      languages: languages.sort(),
      categories: categories || []
    });

  } catch (error) {
    console.error('Filters error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

