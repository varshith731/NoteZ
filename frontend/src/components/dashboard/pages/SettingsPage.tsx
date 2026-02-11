import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { ArrowLeft, Camera, Save, User, Mail, Edit3, Loader2, Settings, Bell, Shield, Palette } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UserProfile {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  bio?: string;
  gender?: string;
  role?: string;
}

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeSection, setActiveSection] = useState('profile');
  const [loading, setLoading] = useState(true);

  // Profile form state
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    bio: '',
    gender: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const settingsSections: SettingsSection[] = [
    {
      id: 'profile',
      title: 'Profile',
      icon: <User className="w-5 h-5" />,
      description: 'Manage your profile information'
    },
    {
      id: 'notifications',
      title: 'Notifications',
      icon: <Bell className="w-5 h-5" />,
      description: 'Configure notification preferences'
    },
    {
      id: 'privacy',
      title: 'Privacy',
      icon: <Shield className="w-5 h-5" />,
      description: 'Control your privacy settings'
    },
    {
      id: 'appearance',
      title: 'Appearance',
      icon: <Palette className="w-5 h-5" />,
      description: 'Customize the look and feel'
    }
  ];

  useEffect(() => {
    fetchUserProfile();
  }, []);

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        fullName: user.fullName || '',
        bio: user.bio || '',
        gender: user.gender || ''
      });
      setError('');
      setSuccess('');
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch('http://localhost:3001/api/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        throw new Error('Failed to fetch profile');
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/users/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: formData.username,
          fullName: formData.fullName,
          bio: formData.bio,
          gender: formData.gender
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setSuccess('Profile updated successfully!');
      if (user) {
        setUser({
          ...user,
          username: formData.username,
          fullName: formData.fullName,
          bio: formData.bio,
          gender: formData.gender
        });
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch('http://localhost:3001/api/users/me/avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload avatar');
      }

      setSuccess('Avatar updated successfully!');
      if (user) {
        setUser({ ...user, avatarUrl: data.avatarUrl });
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload avatar');
    } finally {
      setIsUploading(false);
    }
  };

  const renderProfileSettings = () => (
    <div className="space-y-6">
      {/* Avatar Section */}
      <div className="flex flex-col items-center space-y-4">
        <div className="relative group">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={`${user.fullName || user.username}'s profile picture`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-12 h-12 text-white" aria-hidden="true" />
              </div>
            )}
          </div>
          
          {/* Upload overlay */}
          <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <label className="cursor-pointer" tabIndex={0} role="button" aria-label="Upload profile picture">
              <Camera className="w-8 h-8 text-white" aria-hidden="true" />
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={isUploading}
                aria-label="Select profile picture file"
              />
            </label>
          </div>
        </div>
        
        {isUploading && (
          <div className="flex items-center space-x-2 text-purple-400" role="status" aria-live="polite">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            <span className="text-sm">Uploading...</span>
          </div>
        )}
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg" role="alert">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg" role="status">
          <p className="text-green-400 text-sm">{success}</p>
        </div>
      )}

      {/* Profile Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Username */}
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium text-white flex items-center space-x-2">
              <User className="w-4 h-4" aria-hidden="true" />
              <span>Username</span>
            </label>
            <input
              id="username"
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              className="w-full p-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Enter username"
              required
              aria-describedby="username-hint"
            />
          </div>

          {/* Full Name */}
          <div className="space-y-2">
            <label htmlFor="fullName" className="text-sm font-medium text-white flex items-center space-x-2">
              <Edit3 className="w-4 h-4" aria-hidden="true" />
              <span>Full Name</span>
            </label>
            <input
              id="fullName"
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleInputChange}
              className="w-full p-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Enter full name"
              required
            />
          </div>
        </div>

        {/* Gender */}
        <div className="space-y-2">
          <label htmlFor="gender" className="text-sm font-medium text-white">Gender</label>
          <select
            id="gender"
            name="gender"
            value={formData.gender}
            onChange={handleInputChange}
            className="w-full p-3 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <label htmlFor="bio" className="text-sm font-medium text-white">Bio</label>
          <textarea
            id="bio"
            name="bio"
            value={formData.bio}
            onChange={handleInputChange}
            rows={4}
            className="w-full p-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Tell us about yourself..."
            maxLength={500}
            aria-describedby="bio-hint"
          />
          <p id="bio-hint" className="text-xs text-gray-500">
            {formData.bio.length}/500 characters
          </p>
        </div>

        {/* Email (Read-only) */}
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-white flex items-center space-x-2">
            <Mail className="w-4 h-4" aria-hidden="true" />
            <span>Email</span>
          </label>
          <input
            id="email"
            type="email"
            value={user?.email || ''}
            className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-gray-400 cursor-not-allowed"
            disabled
            aria-describedby="email-hint"
          />
          <p id="email-hint" className="text-xs text-gray-500">Email cannot be changed</p>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4">
          <Button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" aria-hidden="true" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white">Email Notifications</h3>
        <div className="space-y-3">
          {[
            { id: 'friend-requests', label: 'Friend Requests', description: 'Get notified when someone sends you a friend request' },
            { id: 'new-followers', label: 'New Followers', description: 'Get notified when someone follows you' },
            { id: 'playlist-shares', label: 'Playlist Shares', description: 'Get notified when someone shares a playlist with you' },
            { id: 'weekly-summary', label: 'Weekly Summary', description: 'Receive a weekly summary of your activity' }
          ].map((notification) => (
            <div key={notification.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg">
              <div>
                <label htmlFor={notification.id} className="text-sm font-medium text-white cursor-pointer">
                  {notification.label}
                </label>
                <p className="text-xs text-gray-400 mt-1">{notification.description}</p>
              </div>
              <input
                id={notification.id}
                type="checkbox"
                className="w-4 h-4 text-purple-500 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                defaultChecked
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPrivacySettings = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white">Profile Visibility</h3>
        <div className="space-y-3">
          {[
            { id: 'public-profile', label: 'Public Profile', description: 'Allow others to see your profile information' },
            { id: 'show-playlists', label: 'Show Public Playlists', description: 'Display your public playlists on your profile' },
            { id: 'show-activity', label: 'Show Recent Activity', description: 'Display your recent listening activity to friends' },
            { id: 'allow-friend-requests', label: 'Allow Friend Requests', description: 'Let others send you friend requests' }
          ].map((setting) => (
            <div key={setting.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg">
              <div>
                <label htmlFor={setting.id} className="text-sm font-medium text-white cursor-pointer">
                  {setting.label}
                </label>
                <p className="text-xs text-gray-400 mt-1">{setting.description}</p>
              </div>
              <input
                id={setting.id}
                type="checkbox"
                className="w-4 h-4 text-purple-500 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                defaultChecked
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderAppearanceSettings = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white">Theme</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { id: 'dark', label: 'Dark', preview: 'bg-gray-900' },
            { id: 'light', label: 'Light', preview: 'bg-gray-100' },
            { id: 'auto', label: 'Auto', preview: 'bg-gradient-to-br from-gray-900 to-gray-100' }
          ].map((theme) => (
            <div key={theme.id} className="relative">
              <input
                id={theme.id}
                name="theme"
                type="radio"
                className="sr-only"
                defaultChecked={theme.id === 'dark'}
              />
              <label
                htmlFor={theme.id}
                className="flex flex-col items-center p-4 border border-white/20 rounded-lg cursor-pointer hover:bg-white/5 transition-colors"
              >
                <div className={`w-16 h-10 rounded-lg ${theme.preview} mb-2`}></div>
                <span className="text-sm font-medium text-white">{theme.label}</span>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSettingsContent = () => {
    switch (activeSection) {
      case 'profile':
        return renderProfileSettings();
      case 'notifications':
        return renderNotificationSettings();
      case 'privacy':
        return renderPrivacySettings();
      case 'appearance':
        return renderAppearanceSettings();
      default:
        return renderProfileSettings();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
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
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center space-x-3">
                <Settings className="w-8 h-8" aria-hidden="true" />
                <span>Settings</span>
              </h1>
              <p className="text-gray-400 mt-1">Manage your account preferences</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card className="bg-black/30 border-white/10 sticky top-4">
              <CardContent className="p-4">
                <nav className="space-y-1" role="navigation" aria-label="Settings navigation">
                  {settingsSections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center space-x-3 px-3 py-2 text-left rounded-lg transition-colors ${
                        activeSection === section.id
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                      aria-current={activeSection === section.id ? 'page' : undefined}
                    >
                      {section.icon}
                      <div>
                        <div className="font-medium">{section.title}</div>
                        <div className="text-xs opacity-75">{section.description}</div>
                      </div>
                    </button>
                  ))}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Card className="bg-black/30 border-white/10">
              <CardHeader>
                <CardTitle className="text-xl text-white">
                  {settingsSections.find(s => s.id === activeSection)?.title}
                </CardTitle>
              </CardHeader>
              
              <CardContent>
                {renderSettingsContent()}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
