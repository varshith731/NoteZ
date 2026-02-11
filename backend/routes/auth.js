const express = require('express');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const router = express.Router();

// User Registration with Role Selection
router.post('/register', async (req, res) => {
  try {
    const { email, password, username, fullName, role } = req.body;

    if (!email || !password || !username || !fullName || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (!['normal_user', 'content_creator'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }

    // Check if profile already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .or(`email.eq.${email},username.eq.${username}`)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create user in Supabase Auth with PLAIN password (Supabase hashes internally)
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    // Create profile row
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .insert({
        id: authUser.user.id,
        email,
        username,
        full_name: fullName,
        role
      })
      .select()
      .single();

    if (profileError) {
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return res.status(500).json({ error: 'Failed to create user profile' });
    }

    if (role === 'content_creator') {
      await supabase.from('creator_stats').insert({ creator_id: authUser.user.id }).single();
    }

    // Issue app JWT
    const token = jwt.sign(
      { userId: profile.id, email: profile.email, role: profile.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: profile.id,
        email: profile.email,
        username: profile.username,
        fullName: profile.full_name,
        role: profile.role
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Let Supabase Auth verify credentials
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (signInError || !signInData?.user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Load profile
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', signInData.user.id)
      .single();
    if (userError || !user) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Issue app JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        avatarUrl: user.avatar_url,
        bio: user.bio
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Current User
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) return res.status(404).json({ error: 'User not found' });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        avatarUrl: user.avatar_url,
        bio: user.bio,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Update User Profile
router.put('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const { username, fullName, bio, avatarUrl } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .update({
        username: username || undefined,
        full_name: fullName || undefined,
        bio: bio || undefined,
        avatar_url: avatarUrl || undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', decoded.userId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: 'Failed to update profile' });

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        avatarUrl: user.avatar_url,
        bio: user.bio
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
