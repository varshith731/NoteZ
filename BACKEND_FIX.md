# Backend Supabase Connection Issue - Quick Fix

## Problem
The backend cannot connect to Supabase, causing the content creator dashboard to fail loading.

## Immediate Solutions

### Option 1: Check Your Internet Connection
The errors show `ConnectTimeoutError` - your backend can't reach Supabase servers.

### Option 2: Verify Environment Variables

Create or update `backend/.env` file:

```env
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
FRONTEND_URL=http://localhost:5173
```

**To get your Supabase credentials:**
1. Go to https://app.supabase.com
2. Select your project
3. Go to Settings > API
4. Copy:
   - `URL` → SUPABASE_URL
   - `service_role` key → SUPABASE_SERVICE_ROLE_KEY

### Option 3: Restart Backend
```bash
cd backend
npm start
```

### Option 4: Check Firewall
- Make sure your firewall isn't blocking connections to `supabase.co`
- Try using a VPN if network is restricted

### Option 5: Use Local Supabase (If Available)
If you have Supabase running locally:
```env
SUPABASE_URL=http://localhost:54321
```

## Quick Test
Test if Supabase is reachable:
```bash
curl https://app.supabase.com
```

If this fails, it's a network connectivity issue.

