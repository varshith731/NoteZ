import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ProfileEditPage() {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [showActivity, setShowActivity] = useState(true);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('http://localhost:3001/api/users/me', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(({ user }) => {
        setUsername(user.username || '');
        setFullName(user.fullName || '');
        setBio(user.bio || '');
        setShowActivity(user.showActivity ?? true);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('http://localhost:3001/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ username, fullName, bio })
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to save profile');
      }
      setSuccess('Profile saved');
    } catch (e: any) {
      setError(e.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async () => {
    if (!avatarFile) return;
    setSaving(true);
    setError('');
    setSuccess('');
    const token = localStorage.getItem('token');
    const form = new FormData();
    form.append('avatar', avatarFile);
    try {
      const res = await fetch('http://localhost:3001/api/users/me/avatar', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: form
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to upload avatar');
      }
      setSuccess('Avatar updated');
    } catch (e: any) {
      setError(e.message || 'Failed to upload avatar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="p-6">
      <Card className="bg-black/30 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Edit Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <div className="p-3 text-red-400 bg-red-500/10 rounded-lg">{error}</div>}
          {success && <div className="p-3 text-green-400 bg-green-500/10 rounded-lg">{success}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-white">Username</label>
              <input className="w-full mt-1 p-2 bg-white/5 border border-white/20 rounded-lg text-white" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-white">Full name</label>
              <input className="w-full mt-1 p-2 bg-white/5 border border-white/20 rounded-lg text-white" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-sm text-white">Bio</label>
            <textarea className="w-full mt-1 p-2 bg-white/5 border border-white/20 rounded-lg text-white" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>

          <div>
            <label className="text-sm text-white">Avatar</label>
            <input type="file" accept="image/*" className="w-full mt-1 p-2 bg-white/5 border border-white/20 rounded-lg text-white" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
            <Button className="mt-2 bg-purple-500 hover:bg-purple-600" onClick={uploadAvatar} disabled={saving || !avatarFile}>Upload Avatar</Button>
          </div>

          <div className="flex items-center space-x-2">
            <input type="checkbox" id="showActivity" checked={showActivity} onChange={(e) => setShowActivity(e.target.checked)} />
            <label htmlFor="showActivity" className="text-sm text-white">Show my activity</label>
          </div>

          <div className="flex space-x-3">
            <Button onClick={saveProfile} disabled={saving} className="bg-purple-500 hover:bg-purple-600">Save</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


