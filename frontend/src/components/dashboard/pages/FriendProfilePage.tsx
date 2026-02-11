import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function FriendProfilePage() {
  const { friendId } = useParams();
  const name = String(friendId || '').replace(/\b\w/g, (c) => c.toUpperCase());

  const playlists = [
    { name: 'Chill Vibes' },
    { name: 'Coding Flow' },
    { name: 'Top 50' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-4">
        <Card className="bg-black/30 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">{name}'s Profile</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <img src={`https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(name)}`} className="w-16 h-16 rounded-full" />
            <div>
              <p className="text-gray-300">Public playlists and listening stats</p>
              <p className="text-sm text-gray-400">Total listening hours: 127h</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {playlists.map((p, i) => (
            <Card key={i} className="bg-black/30 border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base">{p.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <img src={'/assets/album-placeholder.jpg'} className="w-12 h-12 rounded" />
                <p className="text-sm text-gray-300">15 tracks</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}


