// Search public playlists
router.get('/search', tryAuthenticate, async (req, res) => {
  try {
    const { q = '', limit = 20, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    if (!q || String(q).trim() === '') {
      return res.status(400).json({ error: 'Search query is required' });
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
        ),
        songs:playlist_songs(count)
      `)
      .eq('is_public', true)
      .is('is_favorites', false)
      .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: playlists, error, count } = await query;

    if (error) {
      console.error('Playlist search error:', error);
      return res.status(500).json({ error: 'Failed to search playlists' });
    }

    res.json({
      playlists: playlists.map(pl => ({
        id: pl.id,
        name: pl.name,
        description: pl.description,
        coverUrl: pl.cover_url,
        songCount: pl.songs?.[0]?.count || 0,
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
        limit: parseInt(limit),
        total: count || playlists.length
      }
    });

  } catch (error) {
    console.error('Playlist search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});