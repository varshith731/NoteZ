import { Music, UserCircle2, Search, X, Bell, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { MainDashboard } from '@/components/dashboard/MainDashboard';
import { MobileNav } from '@/components/dashboard/MobileNav';
import { NotificationsPanel } from '@/components/dashboard/NotificationsPanel';
import { FriendRequestModal } from '@/components/dashboard/FriendRequestModal';
import { useEffect, useState, useRef, useCallback } from 'react';
import { type SongItem, normalizeSongItem } from '@/lib/songs';
import { apiClient } from '@/lib/apiClient';

interface UserProfile {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  bio?: string;
  gender?: string;
}

export default function Dashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SongItem[]>([]);
  const [artistResults, setArtistResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  // New state for modals and panels
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const [showFriendRequestModal, setShowFriendRequestModal] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  // Profile dropdown state
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Set document title for Dashboard
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = 'NoteZ — Dashboard';
    }
  }, []);

  // Fetch user profile on mount and check role
  useEffect(() => {
    if (currentUser) {
      fetchUserProfile();
      // Check if user is content creator and redirect
      const token = localStorage.getItem('token');
      if (token) {
        fetch('http://localhost:3001/api/users/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(r => r.json())
          .then(data => {
            const role = data?.user?.role;
            if (role === 'content_creator' && location.pathname === '/dashboard') {
              navigate('/creator');
            }
          })
          .catch(() => {
            // Ignore errors
          });
      }
    }
  }, [currentUser, navigate, location.pathname]);

  // Handle clicks outside profile dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchUserProfile = async () => {
    try {
      console.log('🔍 Fetching user profile...');
      const data = await apiClient.get('/api/users/me');
      console.log('✅ User profile data received:', data);
      setUserProfile(data.user);
      console.log('📋 User profile state set:', data.user);
    } catch (error) {
      console.error('❌ Failed to fetch user profile:', error);
    }
  };

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    setIsSearching(true);
    try {
      const params = new URLSearchParams({ search: searchQuery });
      const data = await apiClient.get(`/api/songs?${params}`);
      const mapped: SongItem[] = await Promise.all((data.songs || []).map(normalizeSongItem));
      setSearchResults(mapped);
      setShowSearchResults(true);
      // Also fetch matching creators/artists so MainDashboard can render them
      try {
        const artists = await apiClient.get(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
        setArtistResults(artists.creators || artists.users || artists.items || []);
      } catch (e) {
        console.warn('Failed to fetch artist search results', e);
        setArtistResults([]);
      }
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  function clearSearch() {
    setSearchQuery("");
    setSearchResults([]);
    setShowSearchResults(false);
  }


  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [pendingFriendRequestsCount, setPendingFriendRequestsCount] = useState(0);
  const lastCountsFetch = useRef(0);
  const COUNT_REFRESH_INTERVAL = 60000; // 60 seconds
  const THROTTLE_WINDOW = 5000; // 5 seconds minimum between fetches

  // Optimized notification counts fetching with throttling
  const fetchNotificationCounts = useCallback(async (force = false) => {
    const now = Date.now();
    
    // Throttle requests - don't fetch if we fetched recently unless forced
    if (!force && now - lastCountsFetch.current < THROTTLE_WINDOW) {
      return;
    }

    try {
      lastCountsFetch.current = now;

      // Use the new API client with deduplication and retry logic
      const [notificationsData, friendRequestsData] = await Promise.allSettled([
        apiClient.get('/api/users/notifications'),
        apiClient.get('/api/friends/requests/pending')
      ]);

      // Handle notifications count
      if (notificationsData.status === 'fulfilled') {
        const unreadCount = (notificationsData.value.notifications || [])
          .filter((n: any) => !n.isRead && n.type !== 'friend_request').length;
        setUnreadNotificationsCount(unreadCount);
      } else {
        console.warn('Failed to fetch notifications:', notificationsData.reason);
      }

      // Handle friend requests count
      if (friendRequestsData.status === 'fulfilled') {
        setPendingFriendRequestsCount((friendRequestsData.value.requests || []).length);
      } else {
        console.warn('Failed to fetch friend requests:', friendRequestsData.reason);
      }
    } catch (error) {
      console.error('Failed to fetch notification counts:', error);
    }
  }, []);

  // Fetch counts on mount and set up interval
  useEffect(() => {
    if (!currentUser) return;

    // Fetch immediately
    fetchNotificationCounts(true);

    // Set up interval for regular updates
    const interval = setInterval(() => {
      fetchNotificationCounts();
    }, COUNT_REFRESH_INTERVAL);

    // Fetch when window gains focus (user comes back to tab)
    const handleFocus = () => {
      fetchNotificationCounts();
    };
    
    // Fetch when window becomes visible (user switches to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchNotificationCounts();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser, fetchNotificationCounts]);

  const getUnreadNotificationsCount = () => {
    return unreadNotificationsCount;
  };

  const getPendingFriendRequestsCount = () => {
    return pendingFriendRequestsCount;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <header className="bg-black/20 backdrop-blur-xl border-b border-white/10 sticky top-0 z-40">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mr-3">
                    <Music className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xl font-bold text-white">NoteZ</span>
                </div>
              </div>
            </div>
            
            {/* Center search */}
            <div className="flex-1 flex justify-center">
              <div className="hidden sm:block w-full max-w-2xl mx-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search songs, artists, or movies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                    className="w-full pl-10 pr-24 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {searchQuery && (
                      <button onClick={clearSearch} className="p-1.5 text-gray-400 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      aria-label="Search"
                      onClick={handleSearch}
                      disabled={isSearching}
                      className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-md transition-all disabled:opacity-50"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right side - notifications, friend requests, and profile */}
            <div className="flex items-center space-x-4 ml-auto">
              {/* Notifications Button */}
              <button
                onClick={() => setShowNotificationsPanel(true)}
                className="relative p-2 text-gray-300 hover:text-white transition-colors"
              >
                <Bell className="w-6 h-6" />
                {getUnreadNotificationsCount() > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {getUnreadNotificationsCount()}
                  </span>
                )}
              </button>

              {/* Friend Requests Button */}
              <button
                onClick={() => setShowFriendRequestModal(true)}
                className="relative p-2 text-gray-300 hover:text-white transition-colors"
              >
                <UserPlus className="w-6 h-6" />
                {getPendingFriendRequestsCount() > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                    {getPendingFriendRequestsCount()}
                  </span>
                )}
              </button>

              {/* Profile Dropdown */}
              <div className="relative" ref={profileDropdownRef}>
                <button 
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="p-1 rounded-full hover:bg-white/10 transition-colors"
                >
                  {userProfile?.avatarUrl ? (
                    <img
                      src={userProfile.avatarUrl}
                      alt="Profile"
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <UserCircle2 className="w-8 h-8 text-gray-200" />
                  )}
                </button>
                
                {/* Profile Dropdown Menu */}
                {showProfileDropdown && (
                  <div className="absolute right-0 mt-2 w-48 rounded-lg border border-white/10 bg-black/80 backdrop-blur-xl shadow-xl">
                    <div className="py-2">
                      <div className="px-4 py-2 border-b border-white/10">
                        <p className="text-sm font-medium text-white">
                          {userProfile?.fullName || userProfile?.username || 'User'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {userProfile?.email}
                        </p>
                      </div>
                      
                      <button
                        onClick={() => {
                          console.log('👆 View Profile button clicked');
                          console.log('📋 Current userProfile:', userProfile);
                          if (userProfile) {
                            const profileUrl = `/profile/${userProfile.id}`;
                            console.log('🌐 Navigating to:', profileUrl);
                            navigate(profileUrl);
                          } else {
                            console.warn('⚠️ userProfile is null or undefined');
                          }
                          setShowProfileDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-white/10 transition-colors"
                      >
                        View Profile
                      </button>
                      
                      <button
                        onClick={() => {
                          setShowNotificationsPanel(true);
                          setShowProfileDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-white/10 transition-colors"
                      >
                        Notifications
                        {getUnreadNotificationsCount() > 0 && (
                          <span className="ml-2 px-2 py-1 text-xs bg-red-500 text-white rounded-full">
                            {getUnreadNotificationsCount()}
                          </span>
                        )}
                      </button>
                      
                      <button
                        onClick={() => {
                          setShowFriendRequestModal(true);
                          setShowProfileDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-white/10 transition-colors"
                      >
                        Add Friends
                        {getPendingFriendRequestsCount() > 0 && (
                          <span className="ml-2 px-2 py-1 text-xs bg-blue-500 text-white rounded-full">
                            {getPendingFriendRequestsCount()}
                          </span>
                        )}
                      </button>
                      
                      <button
                        onClick={() => {
                          navigate('/settings');
                          setShowProfileDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-white/10 transition-colors"
                      >
                        Settings
                      </button>
                      
                      <div className="border-t border-white/10 mt-2 pt-2">
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          Sign out
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
      
      <main className="px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-20 md:pb-8">
        <MainDashboard
          external={{
            searchQuery,
            setSearchQuery,
            searchResults,
            isSearching,
            showSearchResults,
            onSearch: handleSearch,
            onClear: clearSearch,
            artistResults,
            setArtistResults,
          }}
        />
      </main>
      
      <MobileNav />
      
      {/* Modals and Panels */}
      
      <NotificationsPanel
        isOpen={showNotificationsPanel}
        onClose={() => setShowNotificationsPanel(false)}
        onFriendRequestAction={fetchNotificationCounts}
      />
      
      <FriendRequestModal
        isOpen={showFriendRequestModal}
        onClose={() => setShowFriendRequestModal(false)}
      />
    </div>
  );
}