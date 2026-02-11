const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for rate limiting (important if behind reverse proxy)
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting - different settings for dev vs production
const isDevelopment = process.env.NODE_ENV !== 'production';

const limiter = rateLimit({
  windowMs: isDevelopment ? 1 * 60 * 1000 : 15 * 60 * 1000, // 1 min in dev, 15 min in prod
  max: isDevelopment ? 2000 : 300, // 2000 in dev, 300 in prod
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: isDevelopment ? 60 : 900
  },
  // Skip rate limiting for health checks
  skip: (req) => req.path === '/health'
});

// Apply basic rate limiting to all API routes
app.use('/api/', limiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/songs', require('./routes/songs'));
app.use('/api/users', require('./routes/users'));
app.use('/api/playlists', require('./routes/playlists'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/friends', require('./routes/friends'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/recommendations', require('./routes/recommendations'));
app.use('/api/trending', require('./routes/trending'));
app.use('/api/albums', require('./routes/albums'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Export the app so it can be used by serverless adapters
module.exports = app;

// Start the server only when this file is run directly (not when required by serverless)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
  });
}
