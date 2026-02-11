import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { 
  ArrowLeft, 
  User, 
  UserPlus, 
  UserCheck, 
  UserMinus, 
  Heart, 
  Play, 
  Music, 
  Lock, 
  Globe, 
  Calendar,
  MapPin,
  Edit,
  Settings,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  bio?: string;
  avatarUrl?: string;
  role: 'normal_user' | 'content_creator';
  createdAt: string;
  followersCount?: number;
  followingCount?: number;
}

interface Playlist {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  songCount: number;
  createdAt: string;
  coverUrl?: string;
}

interface RecentActivity {
  id: string;
  listenedAt: string;
  duration: number;
  song?: {
    id: string;
    title: string;
    artist: string;
    cover_url: string;
    audio_url: string;
  };
  type?: 'played_song' | 'created_playlist' | 'liked_song';
  description?: string;
  timestamp?: string;
  metadata?: any;
}

type FriendshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'friends';
type FollowStatus = 'not_following' | 'following';

export default function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  console.log('🎯 PublicProfilePage mounted with userId:', userId);
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus>('none');
  const [followStatus, setFollowStatus] = useState<FollowStatus>('not_following');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const isOwnProfile = currentUser?.id === userId;
  const canSeePlatilists = isOwnProfile || friendshipStatus === 'friends' || profile?.role === 'content_creator';
  const canSeeActivity = isOwnProfile || friendshipStatus === 'friends';

  // Set document title for debugging
  useEffect(() => {
    document.title = `NoteZ — Profile (${userId || 'loading...'})`;
  }, [userId]);

  useEffect(() => {
    console.log('🔄 useEffect triggered with userId:', userId, 'currentUser:', currentUser?.id);
    if (userId) {
      fetchProfileData();
      if (!isOwnProfile) {
        checkRelationshipStatus();
      }
    }
  }, [userId, currentUser]);

  const fetchProfileData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      // Fetch user profile
      const profileResponse = await fetch(`http://localhost:3001/api/users/profile/id/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        setProfile(profileData.user);
      } else if (profileResponse.status === 404) {
        setError('User not found');
        setLoading(false);
        return;
      }

      // Fetch playlists (public ones, or all if friends/own profile)
      await fetchPlaylists();

      // Fetch recent activity (if allowed)
      if (canSeeActivity) {
        await fetchRecentActivity();
      }

    } catch (error) {
      console.error('Failed to fetch profile data:', error);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlaylists = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/playlists/user/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Filter playlists based on visibility rules
        let filteredPlaylists = data.playlists || [];
        
        if (!isOwnProfile && friendshipStatus !== 'friends') {
          // Only show public playlists for non-friends
          filteredPlaylists = filteredPlaylists.filter((playlist: Playlist) => playlist.isPublic);
        }
        
        setPlaylists(filteredPlaylists);
      }
    } catch (error) {
      console.error('Failed to fetch playlists:', error);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/analytics/activity/${userId}?limit=10`, {
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : {}
      });

      if (response.ok) {
        const data = await response.json();
        setRecentActivity(data.recentActivity || []);
      }
    } catch (error) {
      console.error('Failed to fetch recent activity:', error);
    }
  };

  const checkRelationshipStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Check friendship status
      const friendshipResponse = await fetch(`http://localhost:3001/api/friends/status/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (friendshipResponse.ok) {
        const friendshipData = await friendshipResponse.json();
        setFriendshipStatus(friendshipData.status);
      }

      // Check follow status (if target is content creator)
      if (profile?.role === 'content_creator') {
        const followResponse = await fetch(`http://localhost:3001/api/users/follow/status/${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (followResponse.ok) {
          const followData = await followResponse.json();
          setFollowStatus(followData.isFollowing ? 'following' : 'not_following');
        }
      }
    } catch (error) {
      console.error('Failed to check relationship status:', error);
    }
  };

  const handleFriendRequest = async () => {
    if (!userId || actionLoading) return;
    
    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/friends/${userId}/request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setFriendshipStatus('pending_sent');
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to send friend request');
      }
    } catch (error) {
      console.error('Failed to send friend request:', error);
      alert('Failed to send friend request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnfriend = async () => {
    if (!userId || actionLoading) return;
    
    if (!confirm('Are you sure you want to remove this friend?')) return;
    
    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/friends/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setFriendshipStatus('none');
        // Refresh playlists as visibility might have changed
        fetchPlaylists();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to remove friend');
      }
    } catch (error) {
      console.error('Failed to remove friend:', error);
      alert('Failed to remove friend');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!userId || actionLoading) return;
    
    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const method = followStatus === 'following' ? 'DELETE' : 'POST';
      const response = await fetch(`http://localhost:3001/api/users/follow/${userId}`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setFollowStatus(followStatus === 'following' ? 'not_following' : 'following');
      } else {
        const error = await response.json();
        alert(error.message || `Failed to ${followStatus === 'following' ? 'unfollow' : 'follow'}`);
      }
    } catch (error) {
      console.error(`Failed to ${followStatus === 'following' ? 'unfollow' : 'follow'}:`, error);
      alert(`Failed to ${followStatus === 'following' ? 'unfollow' : 'follow'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const renderActionButton = () => {
    if (isOwnProfile) {
      return (
        <Button
          onClick={() => navigate('/settings')}
          className="bg-purple-500 hover:bg-purple-600 text-white"
        >
          <Edit className="w-4 h-4 mr-2" />
          Edit Profile
        </Button>
      );
    }

    if (profile?.role === 'content_creator') {
      return (
        <Button
          onClick={handleFollow}
          disabled={actionLoading}
          className={`${
            followStatus === 'following'
              ? 'bg-gray-600 hover:bg-gray-700'
              : 'bg-blue-500 hover:bg-blue-600'
          } text-white`}
        >
          {actionLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : followStatus === 'following' ? (
            <UserCheck className="w-4 h-4 mr-2" />
          ) : (
            <UserPlus className="w-4 h-4 mr-2" />
          )}
          {followStatus === 'following' ? 'Following' : 'Follow'}
        </Button>
      );
    }

    // Regular user - show friend request button
    switch (friendshipStatus) {
      case 'friends':
        return (
          <Button
            onClick={handleUnfriend}
            disabled={actionLoading}
            variant="outline"
            className="border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
          >
            {actionLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <UserMinus className="w-4 h-4 mr-2" />
            )}
            Remove Friend
          </Button>
        );
      case 'pending_sent':
        return (
          <Button disabled className="bg-gray-600 text-white cursor-not-allowed">
            <UserCheck className="w-4 h-4 mr-2" />
            Request Sent
          </Button>
        );
      case 'pending_received':
        return (
          <Button
            onClick={() => navigate('/dashboard')} // Go to notifications to accept
            className="bg-green-500 hover:bg-green-600 text-white"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Accept Friend Request
          </Button>
        );
      default:
        return (
          <Button
            onClick={handleFriendRequest}
            disabled={actionLoading}
            className="bg-purple-500 hover:bg-purple-600 text-white"
          >
            {actionLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4 mr-2" />
            )}
            Add Friend
          </Button>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Card className="bg-black/30 border-white/10 p-8 text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Profile Not Found</h2>
          <p className="text-gray-400 mb-4">{error || 'This user does not exist.'}</p>
          <Button onClick={() => navigate('/dashboard')} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
            aria-label="Go back to dashboard"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>

        {/* Profile Header */}
        <Card className="bg-black/30 border-white/10 mb-8">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-start md:items-center space-y-6 md:space-y-0 md:space-x-8">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500">
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={`${profile.fullName || profile.username}'s profile picture`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-16 h-16 text-white" aria-hidden="true" />
                    </div>
                  )}
                </div>
              </div>

              {/* Profile Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-3 mb-2">
                  <h1 className="text-3xl font-bold text-white truncate">
                    {profile.fullName || profile.username}
                  </h1>
                  {profile.role === 'content_creator' && (
                    <span className="px-3 py-1 text-xs font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full">
                      Creator
                    </span>
                  )}
                </div>
                <p className="text-gray-400 mb-1">@{profile.username}</p>
                {profile.bio && (
                  <p className="text-gray-300 mb-4 max-w-2xl">{profile.bio}</p>
                )}
                
                <div className="flex items-center space-x-6 text-sm text-gray-400 mb-4">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4" />
                    <span>Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
                  </div>
                  {profile.followersCount !== undefined && (
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4" />
                      <span>{profile.followersCount} followers</span>
                    </div>
                  )}
                </div>

                {/* Action Button */}
                <div className="flex items-center space-x-3">
                  {renderActionButton()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Playlists Section */}
            <Card className="bg-black/30 border-white/10">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-xl text-white flex items-center space-x-2">
                  <Music className="w-5 h-5" />
                  <span>Playlists</span>
                  {!canSeePlatilists && (
                    <Lock className="w-4 h-4 text-gray-400" title="Private - Only friends can see" />
                  )}
                </CardTitle>
                {!canSeePlatilists && (
                  <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <EyeOff className="w-4 h-4" />
                    <span>Private</span>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {canSeePlatilists ? (
                  playlists.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {playlists.map((playlist) => (
                        <div
                          key={playlist.id}
                          className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                          onClick={() => {/* Navigate to playlist */}}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                              {playlist.coverUrl ? (
                                <img
                                  src={playlist.coverUrl}
                                  alt={`${playlist.name} cover`}
                                  className="w-full h-full rounded-lg object-cover"
                                />
                              ) : (
                                <Music className="w-6 h-6 text-white" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <h3 className="font-medium text-white truncate">{playlist.name}</h3>
                                {playlist.isPublic ? (
                                  <Globe className="w-3 h-3 text-green-400" title="Public playlist" />
                                ) : (
                                  <Lock className="w-3 h-3 text-gray-400" title="Private playlist" />
                                )}
                              </div>
                              <p className="text-sm text-gray-400">{playlist.songCount} songs</p>
                              {playlist.description && (
                                <p className="text-xs text-gray-500 mt-1 truncate">{playlist.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Music className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-400">No playlists yet</p>
                    </div>
                  )
                ) : (
                  <div className="text-center py-8">
                    <Lock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-400">Playlists are private</p>
                    <p className="text-sm text-gray-500">Become friends to see their playlists</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Recent Activity */}
            <Card className="bg-black/30 border-white/10">
              <CardHeader>
                <CardTitle className="text-lg text-white flex items-center space-x-2">
                  <Eye className="w-5 h-5" />
                  <span>Recent Activity</span>
                  {!canSeeActivity && (
                    <Lock className="w-4 h-4 text-gray-400" title="Private - Only friends can see" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {canSeeActivity ? (
                  recentActivity.length > 0 ? (
                    <div className="space-y-3">
                      {recentActivity.slice(0, 5).map((activity) => (
                        <div key={activity.id} className="flex items-center space-x-3 text-sm p-2 rounded-lg hover:bg-white/5 transition">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                            {activity.song?.cover_url ? (
                              <img src={activity.song.cover_url} alt="Cover" className="w-full h-full rounded-lg object-cover" />
                            ) : (
                              <Music className="w-5 h-5 text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">
                              {activity.song ? `${activity.song.title} by ${activity.song.artist}` : activity.description || 'Listened to music'}
                            </p>
                            <p className="text-xs text-gray-400">{new Date(activity.listenedAt || activity.timestamp || '').toLocaleDateString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-400 text-sm">No recent activity</p>
                    </div>
                  )
                ) : (
                  <div className="text-center py-4">
                    <EyeOff className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Activity is private</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
