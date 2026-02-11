import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, UserPlus, Search, Loader2, Users, UserMinus } from 'lucide-react';

interface User {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  role: string;
}

interface Friend {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  role: string;
}

interface FriendRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FriendRequestModal({ isOpen, onClose }: FriendRequestModalProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'friends' | 'search'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch existing friends when modal opens
  useEffect(() => {
    if (isOpen && activeTab === 'friends') {
      fetchFriends();
    }
  }, [isOpen, activeTab]);

  const fetchFriends = async () => {
    setIsLoadingFriends(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/friends', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setFriends(data.friends || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch friends');
      }
    } catch (error) {
      setError('Failed to fetch friends');
    } finally {
      setIsLoadingFriends(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setError('');
    setSearchResults([]);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/users/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.users || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Search failed');
      }
    } catch (error) {
      setError('Failed to search users');
    } finally {
      setIsSearching(false);
    }
  };

  const sendFriendRequest = async (username: string) => {
    setIsSending(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      // Find the selected user in current search results to get id
      const selected = searchResults.find(u => u.username === username);
      if (!selected) throw new Error('User not found in results');
      const response = await fetch(`http://localhost:3001/api/friends/${encodeURIComponent(selected.id)}/request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Friend request sent to @${username}!`);
        // Remove the user from search results
        setSearchResults(prev => prev.filter(user => user.username !== username));
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Failed to send friend request');
      }
    } catch (error) {
      setError('Failed to send friend request');
    } finally {
      setIsSending(false);
    }
  };

  const removeFriend = async (friendId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/friends/${friendId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Remove friend from local state
        setFriends(prev => prev.filter(friend => friend.id !== friendId));
        setSuccess('Friend removed successfully');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to remove friend');
      }
    } catch (error) {
      setError('Failed to remove friend');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden bg-black/30 border-white/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center space-x-3">
            <UserPlus className="w-6 h-6 text-purple-400" />
            <CardTitle className="text-xl text-white">Friends</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-white/10 rounded-full"
          >
            <X className="w-6 h-6" />
          </Button>
        </CardHeader>
        
        {/* Tab Navigation */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-3 px-4 text-center transition-colors ${
              activeTab === 'friends'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            My Friends ({friends.length})
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-3 px-4 text-center transition-colors ${
              activeTab === 'search'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-4 h-4 inline mr-2" />
            Add Friends
          </button>
        </div>
        
        <CardContent className="space-y-4 p-6">
          {/* Error/Success Messages */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}

          {/* Friends Tab */}
          {activeTab === 'friends' && (
            <div className="space-y-3">
              {isLoadingFriends ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 text-gray-400 mx-auto mb-3 animate-spin" />
                  <p className="text-gray-400">Loading friends...</p>
                </div>
              ) : friends.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-400">No friends yet</p>
                  <p className="text-sm text-gray-500">Use the "Add Friends" tab to find and add friends</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center space-x-3 p-3 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
                      onClick={() => navigate(`/profile/${friend.id}`)}
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        {friend.avatarUrl ? (
                          <img
                            src={friend.avatarUrl}
                            alt="Avatar"
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-white font-medium text-lg">
                            {friend.username.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium truncate">
                          {friend.fullName || friend.username}
                        </h4>
                        <p className="text-gray-400 text-sm truncate">
                          @{friend.username}
                        </p>
                        <p className="text-gray-500 text-xs capitalize">
                          {friend.role ? friend.role.replace('_', ' ') : 'user'}
                        </p>
                      </div>
                      <Button
                        onClick={(e) => { e.stopPropagation(); removeFriend(friend.id); }}
                        variant="outline"
                        size="sm"
                        className="text-red-400 border-red-400/20 hover:bg-red-500/10 hover:text-red-300"
                      >
                        <UserMinus className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Search Tab */}
          {activeTab === 'search' && (
            <div className="space-y-4">
              {/* Search Section */}
              <div className="space-y-3">
                <div className="flex space-x-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by username or full name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <Button
                    onClick={handleSearch}
                    disabled={isSearching || !searchQuery.trim()}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      'Search'
                    )}
                  </Button>
                </div>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-white">Search Results</h3>
                  <div className="max-h-96 overflow-y-auto space-y-3">
                    {searchResults.map((user) => {
                      const isCreator = user.role === 'content_creator';
                      return (
                        <div
                          key={user.id}
                          className="flex items-center space-x-3 p-3 bg-white/5 border border-white/10 rounded-lg"
                        >
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                            {user.avatarUrl ? (
                              <img
                                src={user.avatarUrl}
                                alt="Avatar"
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-white font-medium text-lg">
                                {user.username.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-white font-medium truncate">
                              {user.fullName || user.username}
                            </h4>
                            <p className="text-gray-400 text-sm truncate">
                              @{user.username}
                            </p>
                            <p className="text-gray-500 text-xs capitalize">
                              {user.role ? user.role.replace('_', ' ') : 'user'}
                            </p>
                          </div>
                          <Button
                            onClick={() => sendFriendRequest(user.username)}
                            disabled={isSending || isCreator}
                            title={isCreator ? 'Cannot send friend requests to content creators' : undefined}
                            className={`px-4 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                              isCreator
                                ? 'bg-gray-600 text-gray-300'
                                : 'bg-blue-500 hover:bg-blue-600 text-white'
                            }`}
                          >
                            {isSending ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              <>
                                <UserPlus className="w-4 h-4 mr-2" />
                                Add Friend
                              </>
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* No Results Message */}
              {searchQuery && searchResults.length === 0 && !isSearching && (
                <div className="text-center py-8">
                  <UserPlus className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-400">No users found</p>
                  <p className="text-sm text-gray-500">Try searching with a different username</p>
                </div>
              )}

              {/* Instructions */}
              {!searchQuery && searchResults.length === 0 && (
                <div className="text-center py-8">
                  <UserPlus className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-400">Search for users to add as friends</p>
                  <p className="text-sm text-gray-500">Enter a username or full name to get started</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
