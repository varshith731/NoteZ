import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, X, UserPlus, Music, Heart, Users, Check, XCircle, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

interface Notification {
  id: string;
  type: 'friend_request' | 'friend_request_response' | 'new_song' | 'follow' | 'like' | 'playlist_share';
  title: string;
  message: string;
  relatedId: string;
  isRead: boolean;
  createdAt: string;
}

interface FriendRequest {
  id: string;
  sender: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  fromNotification?: boolean;
  isRead?: boolean;
}

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onFriendRequestAction?: () => void;
}

export function NotificationsPanel({ isOpen, onClose, onFriendRequestAction }: NotificationsPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'notifications' | 'requests'>('notifications');
  const fetchingRef = useRef(false);

  // Mark notifications as read when panel opens
  const markNotificationsAsRead = async () => {
    try {
      await apiClient.post('/api/users/notifications/mark-read');
      // Refresh notifications to get updated read status
      fetchNotifications();
      // Dispatch event to update unread count in dashboard
      window.dispatchEvent(new CustomEvent('notificationsRead'));
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
    }
  };

  // Only fetch when panel opens AND hasn't loaded before, or needs refresh
  useEffect(() => {
    if (isOpen && !fetchingRef.current) {
      fetchingRef.current = true;
      Promise.all([
        fetchNotifications(),
        fetchFriendRequests()
      ]).finally(() => {
        fetchingRef.current = false;
      });
      // Mark notifications as read when panel opens
      markNotificationsAsRead();
    }
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      console.log('🔍 Fetching notifications...');
      
      const data = await apiClient.get('/api/users/notifications');
      console.log('📨 Raw notifications data:', data);
      
      // Filter out friend_request notifications - they should only appear in Friend Requests tab
  const allNotifications: Notification[] = data.notifications || [];
      console.log('📨 All notifications received:', allNotifications.length, allNotifications);
      
  const friendRequestNotifs = allNotifications.filter((n: Notification) => n.type === 'friend_request');
  const friendRequestResponseNotifs = allNotifications.filter((n: Notification) => n.type === 'friend_request_response');
  const regularNotifications = allNotifications.filter((n: Notification) => n.type !== 'friend_request');
      
      console.log('📨 Friend request notifications:', friendRequestNotifs.length, friendRequestNotifs);
      console.log('📨 Friend request response notifications:', friendRequestResponseNotifs.length, friendRequestResponseNotifs);
      console.log('📨 Regular notifications (after filtering):', regularNotifications.length, regularNotifications);
      
      // Log notification types
  const types = [...new Set(allNotifications.map((n: Notification) => n.type))];
      console.log('📨 All notification types found:', types);
      
      setNotifications(regularNotifications);
    } catch (error) {
      console.error('❌ Error fetching notifications:', error);
    }
  };

  const fetchFriendRequests = async () => {
    try {
      console.log('🔍 Fetching all friend requests...');
      
      const data = await apiClient.get('/api/friends/requests/all');
      const requests = data.requests || [];
      console.log('👥 All friend requests received:', requests);
      
      // Map to expected format
      const formattedRequests = requests.map((req: any) => ({
        id: req.id,
        sender: {
          id: req.sender.id,
          username: req.sender.username,
          fullName: req.sender.fullName,
          avatarUrl: req.sender.avatarUrl
        },
        status: req.status, // This will include pending, accepted, rejected
        createdAt: req.createdAt,
        updatedAt: req.updatedAt,
        fromNotification: false
      }));
      
      console.log('👥 Formatted friend requests:', formattedRequests);
      setFriendRequests(formattedRequests);
    } catch (error) {
      console.error('❌ Error fetching friend requests:', error);
    }
  };

  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  
  // Handle friend request action from notification (need to find the request first)
  const handleFriendRequestFromNotification = async (relatedId: string, action: 'accept' | 'reject') => {
    setProcessingRequest(relatedId);
    console.log(`Attempting to ${action} friend request from notification. Related ID:`, relatedId);
    
    try {
      // Find the friend request to get sender info (for logging)
      const friendRequest = friendRequests.find(req => req.id === relatedId);
      console.log('Related friend request found:', friendRequest);
      
      // Use API client for the request
      const data = await apiClient.put(`/api/friends/requests/${relatedId}`, { action });
      console.log(`${action} response:`, data);
      
      // Refresh data to show updated status
      await fetchNotifications();
      await fetchFriendRequests();
      
      // Show success message
      console.log(`✅ Friend request ${action}ed successfully from notification`);
      
      // Refresh notification counts in parent component
      if (onFriendRequestAction) {
        onFriendRequestAction();
      }
      
      if (action === 'accept') {
        console.log('Friend request accepted from notification - users are now friends!');
      }
    } catch (error) {
      console.error(`Error ${action}ing friend request from notification:`, error);
      alert(`Error ${action}ing friend request`);
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleFriendRequest = async (requestId: string, action: 'accept' | 'reject') => {
    setProcessingRequest(requestId);
    console.log(`Attempting to ${action} friend request:`, requestId);
    
    try {
      // Find the friend request to get sender info (for logging)
      const friendRequest = friendRequests.find(req => req.id === requestId);
      console.log('Processing friend request:', friendRequest);
      
      const data = await apiClient.put(`/api/friends/requests/${requestId}`, { action });
      console.log(`${action} response:`, data);
      
      // Refresh data to get updated status from server
      await fetchFriendRequests();
      await fetchNotifications();
      
      // Show success message
      console.log(`✅ Friend request ${action}ed successfully`);
      
      // Refresh notification counts in parent component
      if (onFriendRequestAction) {
        onFriendRequestAction();
      }
      
      if (action === 'accept') {
        console.log('Friend request accepted - users are now friends!');
      }
    } catch (error) {
      console.error(`Error ${action}ing friend request:`, error);
      alert(`Error ${action}ing friend request`);
    } finally {
      setProcessingRequest(null);
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      await apiClient.put(`/api/users/notifications/${notificationId}/read`);

      // Update local state
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, isRead: true }
            : notif
        )
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'friend_request':
        return <UserPlus className="w-5 h-5 text-blue-400" />;
      case 'friend_request_response':
        return <Users className="w-5 h-5 text-green-400" />;
      case 'new_song':
        return <Music className="w-5 h-5 text-green-400" />;
      case 'follow':
        return <Users className="w-5 h-5 text-purple-400" />;
      case 'like':
        return <Heart className="w-5 h-5 text-red-400" />;
      default:
        return <Bell className="w-5 h-5 text-gray-400" />;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.isRead && n.type !== 'friend_request').length;
  const pendingRequestsCount = friendRequests.filter(req => req.status === 'pending').length;
  
  // Log current counts for debugging
  console.log('🔢 Current counts:', { 
    unreadCount, 
    pendingRequestsCount, 
    totalNotifications: notifications.length,
    totalFriendRequests: friendRequests.length 
  });

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden bg-black/30 border-white/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <Bell className="w-6 h-6 text-purple-400" />
            <CardTitle className="text-xl text-white">Notifications</CardTitle>
            {unreadCount > 0 && (
              <span className="px-2 py-1 text-xs bg-red-500 text-white rounded-full">
                {unreadCount}
              </span>
            )}
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
        
        <CardContent className="p-0">
          {/* Tab Navigation */}
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'notifications'
                  ? 'text-purple-400 border-b-2 border-purple-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 px-2 py-1 text-xs bg-red-500 text-white rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'requests'
                  ? 'text-purple-400 border-b-2 border-purple-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Friend Requests
              {pendingRequestsCount > 0 && (
                <span className="ml-2 px-2 py-1 text-xs bg-blue-500 text-white rounded-full">
                  {pendingRequestsCount}
                </span>
              )}
            </button>
          </div>

            {/* Debug Info - Remove this after fixing */}
            {(notifications.length > 0 || friendRequests.length > 0) && (
              <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20 text-xs">
                <div className="text-yellow-400">
                  DEBUG: Notifications: {notifications.length}, Friend Requests: {friendRequests.length}, Unread: {unreadCount}
                </div>
              </div>
            )}
            
            {/* Content */}
            <div className="max-h-[60vh] overflow-y-auto">
              {activeTab === 'notifications' ? (
              <div className="p-4 space-y-3">
                {(() => {
                  // Filter out friend_request notifications (they go in Friend Requests tab)
                  const generalNotifications = notifications.filter(n => n.type !== 'friend_request');
                  
                  if (generalNotifications.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-400">No notifications yet</p>
                      </div>
                    );
                  }
                  
                  return generalNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 rounded-lg border transition-colors ${
                        notification.isRead
                          ? 'bg-white/5 border-white/10'
                          : 'bg-purple-500/10 border-purple-500/20'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        {getNotificationIcon(notification.type)}
                        <div className="flex-1 min-w-0">
                          <h4 className={`text-sm font-medium ${
                            notification.isRead ? 'text-gray-300' : 'text-white'
                          }`}>
                            {notification.title}
                          </h4>
                          <p className="text-sm text-gray-400 mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-500 mt-2">
                            {formatTimeAgo(notification.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {!notification.isRead && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markNotificationAsRead(notification.id)}
                              className="text-gray-400 hover:text-white"
                            >
                              Mark as read
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {friendRequests.length === 0 ? (
                  <div className="text-center py-8">
                    <UserPlus className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-400">No friend requests</p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto space-y-3">
                    {friendRequests.map((request) => (
                      <div
                        key={request.id}
                        className={`p-4 rounded-lg border transition-colors ${
                          request.status === 'accepted'
                            ? 'bg-green-500/10 border-green-500/20'
                            : request.status === 'rejected'
                            ? 'bg-red-500/10 border-red-500/20'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                            {request.sender.avatarUrl ? (
                              <img
                                src={request.sender.avatarUrl}
                                alt="Avatar"
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-white font-medium text-lg">
                                {request.sender.username.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center space-x-2 mb-1">
                                  <UserPlus className="w-4 h-4 text-blue-400" />
                                  <h4 className="text-sm font-medium text-white">
                                    Friend Request
                                  </h4>
                                  {request.status !== 'pending' && (
                                    <span className={`px-2 py-1 text-xs rounded-full ${
                                      request.status === 'accepted'
                                        ? 'bg-green-500/20 text-green-400'
                                        : 'bg-red-500/20 text-red-400'
                                    }`}>
                                      {request.status === 'accepted' ? 'Accepted' : 'Rejected'}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-300 mb-1">
                                  <span className="font-medium">{request.sender.fullName || request.sender.username}</span>
                                  {' '}sent you a friend request
                                </p>
                                <p className="text-xs text-gray-500">
                                  @{request.sender.username} • {formatTimeAgo(request.createdAt)}
                                </p>
                              </div>
                              
                              {/* Accept/Reject Buttons - Beside content */}
                              {request.status === 'pending' && (
                                <div className="flex space-x-2 ml-4">
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      if (request.fromNotification) {
                                        handleFriendRequestFromNotification(request.id, 'accept');
                                      } else {
                                        handleFriendRequest(request.id, 'accept');
                                      }
                                    }}
                                    disabled={processingRequest === request.id}
                                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {processingRequest === request.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Check className="w-3 h-3" />
                                    )}
                                    <span>Accept</span>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      if (request.fromNotification) {
                                        handleFriendRequestFromNotification(request.id, 'reject');
                                      } else {
                                        handleFriendRequest(request.id, 'reject');
                                      }
                                    }}
                                    disabled={processingRequest === request.id}
                                    className="border-red-500 text-red-400 hover:bg-red-500 hover:text-white px-3 py-1 flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {processingRequest === request.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <XCircle className="w-3 h-3" />
                                    )}
                                    <span>Reject</span>
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

