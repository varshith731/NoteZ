# NoteZ Backend API

A comprehensive backend API for the NoteZ music application, built with Express.js and Supabase.

## 🚀 Features

- User Authentication
- Content Creator Dashboard
- Song Management
- Analytics
- Playlists
- Categories
- AI Mood Detection (Hugging Face)

## 🛠️ Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```env
PORT=3001
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-here
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
FRONTEND_URL=http://localhost:5173
# Hugging Face
HUGGINGFACE_API_KEY=your-huggingface-token
```

### 3. Supabase Setup

1. Create a Supabase project
2. Run schema from `supabase/schema.sql`
3. Create a storage bucket named `songs`

### 4. Run the Server

```bash
npm run dev
```

## 🔐 API Endpoints

- Auth: `/api/auth/*`
- Songs: `/api/songs/*`
- Analytics: `/api/analytics/*`
- Users: `/api/users/*`
- Playlists: `/api/playlists/*`
- Categories: `/api/categories/*`
- AI: `/api/ai/mood` (POST)

### AI Endpoint

- Request
```json
{
  "text": "I feel so stressed and tired today"
}
```
- Response
```json
{
  "input": "I feel so stressed and tired today",
  "modelLabel": "nervousness",
  "recommendation": { "name": "Lo‑fi Chill Beats", "tag": "chill" }
}
```

## 📊 Database Schema

The application uses the following main tables:

- **users**: User accounts with role-based access
- **songs**: Music tracks with metadata and categories
- **song_categories**: Predefined emotion/mood categories
- **song_analytics**: Play tracking and listener statistics
- **playlists**: User-created music collections
- **user_favorites**: User's favorite songs
- **listening_history**: User listening activity
- **creator_stats**: Content creator performance metrics

## 🔐 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration with role selection
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/profile` - Update user profile

### Songs
- `POST /api/songs/upload` - Upload new song (Content Creator only)
- `GET /api/songs` - Search and filter songs
- `GET /api/songs/:id` - Get song details
- `PUT /api/songs/:id` - Update song (Creator only)
- `DELETE /api/songs/:id` - Delete song (Creator only)

### Analytics
- `GET /api/analytics/creator` - Creator dashboard analytics
- `GET /api/analytics/song/:id` - Song-specific analytics
- `POST /api/analytics/track-play` - Track song play
- `GET /api/analytics/trending` - Trending songs

### Users
- `GET /api/users/profile/:username` - Get user profile
- `GET /api/users/me` - Get current user
- `PUT /api/users/me` - Update current user
- `GET /api/users/search` - Search users

### Playlists
- `POST /api/playlists` - Create playlist
- `GET /api/playlists/me` - Get user's playlists
- `GET /api/playlists/:id` - Get playlist details
- `PUT /api/playlists/:id` - Update playlist
- `DELETE /api/playlists/:id` - Delete playlist

### Categories
- `GET /api/categories` - Get all song categories
- `GET /api/categories/:name` - Get category by name

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Different permissions for users vs creators
- **Row Level Security**: Database-level access control
- **Rate Limiting**: API request throttling
- **Input Validation**: Comprehensive request validation
- **CORS Protection**: Cross-origin request security

## 📈 Analytics Features

### For Content Creators
- **Song Performance**: Play counts, listen duration, unique listeners
- **Trending Analysis**: Daily play patterns and growth metrics
- **Audience Insights**: Listener demographics and behavior
- **Revenue Tracking**: Performance-based analytics

### For Users
- **Listening History**: Personal music consumption tracking
- **Favorite Management**: Curated song collections
- **Playlist Analytics**: Usage patterns and sharing metrics

## 🎵 Song Categories

The system includes 15 predefined emotion/mood categories:
- Happy, Sad, Angry, Energetic, Calm
- Romantic, Motivational, Chill, Party, Workout
- Study, Sleep, Travel, Nostalgic, Inspirational

## 🚀 Getting Started for Development

1. **Clone the repository**
2. **Install dependencies**: `npm install`
3. **Set up environment variables**
4. **Run database migrations**
5. **Start the server**: `npm run dev`
6. **Test endpoints** using Postman or similar tool

## 📝 API Documentation

### Request Headers
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Response Format
```json
{
  "message": "Success message",
  "data": { ... },
  "pagination": { ... }
}
```

### Error Format
```json
{
  "error": "Error message",
  "details": "Additional error details"
}
```

## 🔧 Development Tools

- **Nodemon**: Auto-reload during development
- **ESLint**: Code quality and consistency
- **Prettier**: Code formatting
- **Jest**: Unit testing (coming soon)

## 📞 Support

For questions or issues, please refer to the project documentation or create an issue in the repository.

## 📄 License

This project is licensed under the MIT License.


