const express = require('express');
const supabase = require('../config/supabase');

const router = express.Router();

// Middleware to verify Supabase access token and attach user id
const authenticateToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  if (token.split('.').length !== 3) {
    return res.status(400).json({ error: 'Malformed token' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error) throw error;
    if (!user) return res.status(403).json({ error: 'Invalid token' });

    req.user = { id: user.id, email: user.email };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Send friend request to a specific userId
router.post('/:userId/request', authenticateToken, async (req, res) => {
  try {
    const { userId: receiverId } = req.params;
    console.log('\n🚀 Friend request initiated');
    console.log('Sender ID:', req.user.id);
    console.log('Receiver ID:', receiverId);

    if (!receiverId) {
      return res.status(400).json({ error: 'Receiver ID is required' });
    }

    if (receiverId === req.user.id) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    // Get sender and receiver user info for notification
    const { data: senderUser, error: senderError } = await supabase
      .from('users')
      .select('id, username, full_name')
      .eq('id', req.user.id)
      .single();

    if (senderError || !senderUser) {
      return res.status(404).json({ error: 'Sender user not found' });
    }

    const { data: receiverUser, error: receiverError } = await supabase
      .from('users')
      .select('id, username, full_name')
      .eq('id', receiverId)
      .single();

    if (receiverError || !receiverUser) {
      return res.status(404).json({ error: 'Receiver user not found' });
    }

    // Check existing request in either direction
    const { data: existingRequest } = await supabase
      .from('friend_requests')
      .select('id, status, sender_id, receiver_id')
      .or(`and(sender_id.eq.${req.user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${req.user.id})`)
      .maybeSingle();

    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return res.status(400).json({ error: 'Friend request already pending' });
      }
      if (existingRequest.status === 'accepted') {
        return res.status(400).json({ error: 'Already friends' });
      }
      // If previously rejected, delete the old request so we can create a fresh one
      if (existingRequest.status === 'rejected') {
        console.log('Deleting old rejected request:', existingRequest.id);
        const { error: deleteError } = await supabase
          .from('friend_requests')
          .delete()
          .eq('id', existingRequest.id);

        if (deleteError) {
          console.error('Failed to delete old request:', deleteError);
          return res.status(500).json({ error: 'Failed to send friend request' });
        }
        console.log('✅ Old rejected request deleted, will create new one');
        // Continue to create a new request below
      }
    }

    const { data: friendRequest, error: insertError } = await supabase
      .from('friend_requests')
      .insert({ sender_id: req.user.id, receiver_id: receiverId, status: 'pending' })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return res.status(400).json({ error: 'Duplicate friend request' });
      }
      return res.status(500).json({ error: 'Failed to send friend request' });
    }

    // Create notification for receiver
    console.log('Creating notification for receiver:', receiverId);
    console.log('Sender info:', { id: senderUser.id, username: senderUser.username, fullName: senderUser.full_name });
    
    const notificationData = {
      user_id: receiverId,
      type: 'friend_request',
      title: 'New Friend Request',
      message: `${senderUser.full_name || senderUser.username} sent you a friend request`,
      related_id: friendRequest.id,
      is_read: false
    };
    
    console.log('Notification data:', notificationData);
    
    const { data: notificationResult, error: notificationError } = await supabase
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    if (notificationError) {
      console.error('❌ Failed to create notification:', notificationError);
      console.error('Notification error details:', JSON.stringify(notificationError, null, 2));
    } else {
      console.log('✅ Notification created successfully:', notificationResult);
    }

    res.json({
      message: 'Friend request sent',
      friendRequest: {
        id: friendRequest.id,
        senderId: friendRequest.sender_id,
        receiverId: friendRequest.receiver_id,
        status: friendRequest.status,
        createdAt: friendRequest.created_at
      }
    });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Accept or reject a friend request (must be receiver)
router.put('/requests/:requestId', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action } = req.body; // 'accept' | 'reject'

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const { data: friendRequest, error: fetchError } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('id', requestId)
      .eq('receiver_id', req.user.id)
      .eq('status', 'pending')
      .single();

    if (fetchError || !friendRequest) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    // Get receiver user info for notification
    const { data: receiverUser, error: receiverError } = await supabase
      .from('users')
      .select('id, username, full_name')
      .eq('id', req.user.id)
      .single();

    if (receiverError || !receiverUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newStatus = action === 'accept' ? 'accepted' : 'rejected';

    const { data: updated, error: updateError } = await supabase
      .from('friend_requests')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update request' });
    }

    // If accepted, create friendship records
    if (action === 'accept') {
      console.log('\u2705 Creating friendship records...');
      
      // For now, friendship is determined by accepted friend_requests
      // In the future, you might want to create dedicated friendship records
      // in a separate 'friendships' or 'user_friends' table for better performance
      
      console.log('✅ Friendship created between users:', friendRequest.sender_id, 'and', req.user.id);
    }

    // Create notification for sender
    console.log('Creating notification for sender:', friendRequest.sender_id);
    const notificationData = {
      user_id: friendRequest.sender_id,
      type: 'friend_request_response',
      title: `Friend Request ${action === 'accept' ? 'Accepted' : 'Rejected'}`,
      message: `${receiverUser.full_name || receiverUser.username} ${action === 'accept' ? 'accepted' : 'rejected'} your friend request`,
      related_id: requestId,
      is_read: false
    };
    
    console.log('Notification data for sender:', notificationData);
    
    const { data: notificationResult, error: notificationError } = await supabase
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    if (notificationError) {
      console.error('❌ Failed to create sender notification:', notificationError);
      // Don't fail the request if notification creation fails
    } else {
      console.log('✅ Sender notification created successfully:', notificationResult);
    }

    res.json({
      message: `Request ${action}ed`,
      friendRequest: { id: updated.id, status: updated.status, updatedAt: updated.updated_at }
    });
  } catch (error) {
    console.error('Update friend request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel a pending request (must be sender). Alternatively, we can delete the row.
router.delete('/requests/:requestId', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;

    const { data: reqRow, error: getError } = await supabase
      .from('friend_requests')
      .select('id, sender_id, status')
      .eq('id', requestId)
      .single();

    if (getError || !reqRow) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (reqRow.sender_id !== req.user.id) {
      return res.status(403).json({ error: 'Only sender can cancel request' });
    }

    if (reqRow.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending requests can be cancelled' });
    }

    const { error: delError } = await supabase
      .from('friend_requests')
      .delete()
      .eq('id', requestId);

    if (delError) {
      return res.status(500).json({ error: 'Failed to cancel request' });
    }

    res.json({ message: 'Request cancelled' });
  } catch (error) {
    console.error('Cancel request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get friendship status with a specific user
router.get('/status/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    if (userId === currentUserId) {
      return res.json({ status: 'self' });
    }

    // Check if there's a friend request between the users
    const { data: request, error } = await supabase
      .from('friend_requests')
      .select('*')
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUserId})`)
      .order('created_at', { ascending: false })
      .maybeSingle();

    if (error) {
      console.error('Error checking friendship status:', error);
      return res.status(500).json({ error: 'Failed to check friendship status' });
    }

    if (!request) {
      return res.json({ status: 'none' });
    }

    // Determine status based on request
    if (request.status === 'accepted') {
      return res.json({ status: 'friends' });
    } else if (request.status === 'pending') {
      if (request.sender_id === currentUserId) {
        return res.json({ status: 'pending_sent' });
      } else {
        return res.json({ status: 'pending_received' });
      }
    } else {
      return res.json({ status: 'none' });
    }
  } catch (error) {
    console.error('Get friendship status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user's friends (derived from accepted requests)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('\n👥 Fetching friends for user:', userId);

    const { data: accepted, error } = await supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, created_at')
      .eq('status', 'accepted')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

    if (error) {
      console.error('❌ Error fetching accepted friend requests:', error);
      return res.status(500).json({ error: 'Failed to fetch friends' });
    }

    console.log('✅ Found accepted friend requests:', accepted?.length || 0);
    const friendIds = accepted.map(r => (r.sender_id === userId ? r.receiver_id : r.sender_id));
    console.log('Friend IDs:', friendIds);

    if (friendIds.length === 0) {
      console.log('No friends found, returning empty array');
      return res.json({ friends: [] });
    }

    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, username, full_name, avatar_url, bio, role')
      .in('id', friendIds);

    if (usersError) {
      console.error('❌ Error fetching friend user data:', usersError);
      return res.status(500).json({ error: 'Failed to load friend profiles' });
    }

    console.log('✅ Friend user data fetched:', usersData?.length || 0);
    
    // Format the response to match expected structure
    const friends = usersData.map(user => ({
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      role: user.role
    }));

    res.json({ friends });
  } catch (error) {
    console.error('❌ Get friends error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all requests received by current user (pending, accepted, rejected)
router.get('/requests/all', authenticateToken, async (req, res) => {
  try {
    console.log('\n💬 Fetching all friend requests for user:', req.user.id);
    
    // First, get friend requests without joins
    const { data: requests, error: requestsError } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('receiver_id', req.user.id)
      .order('created_at', { ascending: false });

    if (requestsError) {
      console.error('❌ Error fetching friend requests:', requestsError);
      return res.status(500).json({ error: 'Failed to fetch requests', details: requestsError.message });
    }
    
    console.log('👥 Found friend requests:', requests?.length || 0);
    
    // Get sender user data separately
    const senderIds = requests.map(r => r.sender_id);
    let sendersData = [];
    
    if (senderIds.length > 0) {
      const { data: senders, error: sendersError } = await supabase
        .from('users')
        .select('id, username, full_name, avatar_url')
        .in('id', senderIds);
        
      if (sendersError) {
        console.error('❌ Error fetching sender data:', sendersError);
        return res.status(500).json({ error: 'Failed to fetch sender data', details: sendersError.message });
      }
      
      sendersData = senders || [];
    }
    
    console.log('👥 Found sender data:', sendersData.length);
    
    // Combine data
    const data = requests.map(request => {
      const sender = sendersData.find(s => s.id === request.sender_id) || {
        id: request.sender_id,
        username: 'Unknown',
        full_name: 'Unknown User',
        avatar_url: null
      };
      
      return {
        ...request,
        sender
      };
    });
    
    const error = null; // Reset error since we handled it above

    if (error) {
      console.error('❌ Error fetching all friend requests:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return res.status(500).json({ error: 'Failed to fetch requests', details: error.message });
    }
    
    console.log('👥 Found friend requests:', data?.length || 0);
    if (data && data.length > 0) {
      console.log('Sample request:', JSON.stringify(data[0], null, 2));
    }

    res.json({
      requests: data.map(r => ({
        id: r.id,
        sender: {
          id: r.sender.id,
          username: r.sender.username,
          fullName: r.sender.full_name,
          avatarUrl: r.sender.avatar_url
        },
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }))
    });
  } catch (error) {
    console.error('Get all requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pending requests received by current user
router.get('/requests/pending', authenticateToken, async (req, res) => {
  try {
    console.log('\ud83d\udcf1 Fetching pending friend requests for user:', req.user.id);
    
    // First, get friend requests without joins to avoid foreign key issues
    const { data: requests, error: requestsError } = await supabase
      .from('friend_requests')
      .select('id, sender_id, created_at, status')
      .eq('receiver_id', req.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (requestsError) {
      console.error('\u274c Error fetching pending requests:', requestsError);
      return res.status(500).json({ error: 'Failed to fetch requests' });
    }
    
    console.log('\ud83d\udc65 Found pending requests:', requests?.length || 0);
    
    // Get sender user data separately
    const senderIds = requests?.map(r => r.sender_id) || [];
    let sendersData = [];
    
    if (senderIds.length > 0) {
      const { data: senders, error: sendersError } = await supabase
        .from('users')
        .select('id, username, full_name, avatar_url')
        .in('id', senderIds);
        
      if (sendersError) {
        console.error('\u274c Error fetching sender data:', sendersError);
        return res.status(500).json({ error: 'Failed to fetch sender data' });
      }
      
      sendersData = senders || [];
    }
    
    // Combine data
    const data = requests?.map(request => {
      const sender = sendersData.find(s => s.id === request.sender_id) || {
        id: request.sender_id,
        username: 'Unknown',
        full_name: 'Unknown User',
        avatar_url: null
      };
      
      return {
        id: request.id,
        sender: {
          id: sender.id,
          username: sender.username,
          fullName: sender.full_name,
          avatarUrl: sender.avatar_url
        },
        status: request.status,
        createdAt: request.created_at
      };
    }) || [];

    res.json({
      requests: data
    });
  } catch (error) {
    console.error('Get pending requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unfriend: set any accepted request between the pair to rejected
router.delete('/:friendId', authenticateToken, async (req, res) => {
  try {
    const { friendId } = req.params;
    const userId = req.user.id;

    const { data: reqRow, error: findError } = await supabase
      .from('friend_requests')
      .select('id, status, sender_id, receiver_id')
      .eq('status', 'accepted')
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`)
      .maybeSingle();

    if (findError || !reqRow) {
      return res.status(404).json({ error: 'Friendship not found' });
    }

    const { error: updError } = await supabase
      .from('friend_requests')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', reqRow.id);

    if (updError) {
      return res.status(500).json({ error: 'Failed to remove friend' });
    }

    res.json({ message: 'Friend removed' });
  } catch (error) {
    console.error('Unfriend error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


