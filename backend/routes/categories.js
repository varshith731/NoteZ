const express = require('express');
const supabase = require('../config/supabase');

const router = express.Router();

// Get all song categories
router.get('/', async (req, res) => {
  try {
    const { data: categories, error } = await supabase
      .from('song_categories')
      .select('*')
      .order('name');

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch categories' });
    }

    res.json({
      categories: categories.map(category => ({
        id: category.id,
        name: category.name,
        description: category.description,
        color: category.color,
        createdAt: category.created_at
      }))
    });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get category by name
router.get('/:name', async (req, res) => {
  try {
    const { name } = req.params;

    const { data: category, error } = await supabase
      .from('song_categories')
      .select('*')
      .eq('name', name)
      .single();

    if (error || !category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({
      category: {
        id: category.id,
        name: category.name,
        description: category.description,
        color: category.color,
        createdAt: category.created_at
      }
    });

  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
