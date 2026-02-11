import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type User = { id: string; username: string; fullName: string; role: string; };

export default function AdminDashboard() {
  const [tab, setTab] = useState<'users' | 'content' | 'analytics'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (tab === 'users') loadUsers();
  }, [tab]);

  const loadUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/api/users/search?q=' + encodeURIComponent(search || 'a'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setUsers(data.users || []);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-4">
        <Card className="bg-black/30 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-3">
              Admin Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Button variant={tab==='users'?'default':'outline'} onClick={() => setTab('users')}>Users</Button>
              <Button variant={tab==='content'?'default':'outline'} onClick={() => setTab('content')}>Content</Button>
              <Button variant={tab==='analytics'?'default':'outline'} onClick={() => setTab('analytics')}>Analytics</Button>
            </div>

            {tab === 'users' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-white" placeholder="Search users" value={search} onChange={e=>setSearch(e.target.value)} />
                  <Button onClick={loadUsers}>Search</Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {users.map(u => (
                    <Card key={u.id} className="bg-white/5 border-white/10">
                      <CardContent className="p-3">
                        <div className="text-white font-medium">{u.fullName || u.username}</div>
                        <div className="text-xs text-gray-400">@{u.username} · {u.role}</div>
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" variant="outline">Suspend</Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {tab === 'content' && (
              <div className="text-gray-300">Flagged playlists and reported songs will appear here.</div>
            )}

            {tab === 'analytics' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="bg-white/5 border-white/10"><CardContent className="p-4 text-white">Total users</CardContent></Card>
                <Card className="bg-white/5 border-white/10"><CardContent className="p-4 text-white">Total songs</CardContent></Card>
                <Card className="bg-white/5 border-white/10"><CardContent className="p-4 text-white">Total plays</CardContent></Card>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


