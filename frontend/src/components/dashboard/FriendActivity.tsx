import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

type Friend = {
  id: string;
  name: string;
  avatarUrl?: string;
  listeningTo?: string;
};

export function FriendActivity({ friends }: { friends: Friend[] }) {
  const navigate = useNavigate();
  return (
    <Card className="bg-black/30 border-white/10">
      <CardHeader>
        <CardTitle className="text-white/90">Friend Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {friends.map((f) => (
          <button
            key={f.id}
            onClick={() => navigate(`/profile/${encodeURIComponent(f.id)}`)}
            className="w-full flex items-center gap-3 text-left hover:bg-white/5 rounded-lg p-2"
          >
            <img
              src={f.avatarUrl || `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(f.name)}`}
              alt={f.name}
              className="w-9 h-9 rounded-full bg-white/10"
            />
            <div className="min-w-0">
              <p className="text-sm text-white truncate">{f.name}</p>
              <p className="text-xs text-gray-400 truncate">{f.listeningTo || 'Listening now'}</p>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}


