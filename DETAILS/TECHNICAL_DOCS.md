# Technical Documentation

## Database Schema

### Current Schema Analysis

#### ✅ Working Well
1. **UUIDs**: Using UUIDs for primary keys
2. **Relationships**: Proper foreign key definitions
3. **Timestamps**: Tracking with created_at/updated_at
4. **Enums**: Using song_category enum for data integrity
5. **History Tracking**: Separate listening_history table
6. **Security**: Row Level Security implementation

#### Tables Overview

##### Users
- UUID primary key
- Role-based access (normal_user, content_creator)
- Profile details (name, bio, avatar)
- Security settings and preferences

##### Songs
- UUID primary key
- Metadata (title, artist, duration)
- Category and tags
- Upload details and permissions
- Analytics integration

##### Playlists
- UUID primary key
- User associations
- Song collections
- Privacy settings
- Collaborative features

##### Analytics
- Song play counts
- User engagement metrics
- Creator statistics
- Trend analysis

### AI Implementation

#### Emotion Detection
```javascript
EMOTION_TO_CATEGORIES = {
  joy: ['happy', 'party', 'energetic'],
  happy: ['happy', 'party', 'energetic'],
  neutral: ['chill', 'calm', 'study'],
  sadness: ['motivational', 'inspirational', 'calm'],
  anger: ['calm', 'chill', 'workout'],
  disgust: ['calm', 'inspirational']
}
```

#### Recommendation Algorithm

1. **Data Collection**
   - Recent plays
   - Listening frequency
   - Category preferences
   - User interactions

2. **Processing**
   - Emotion analysis
   - Genre mapping
   - Preference weighting
   - Social factors

3. **Output Generation**
   - Ranked suggestions
   - Mood-based playlists
   - Similar songs
   - Friend recommendations

### Security Implementation

#### Authentication
- JWT token validation
- Role-based access control
- Session management
- Security headers

#### Database Security
- Row Level Security policies
- Prepared statements
- Input validation
- Data encryption

### API Structure

#### User Routes
- Authentication endpoints
- Profile management
- Social interactions
- Preferences

#### Music Routes
- Song management
- Playlist operations
- Streaming endpoints
- Upload handling

#### Analytics Routes
- Usage statistics
- Performance metrics
- Trend analysis
- Creator insights

### Development Guidelines

#### Code Style
- Consistent naming
- Clear documentation
- Error handling
- Type safety

#### Testing
- Unit tests
- Integration tests
- Performance testing
- Security audits

#### Deployment
- Environment setup
- Database migrations
- Monitoring
- Backup procedures