import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ThumbsUp, ThumbsDown, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { type SongItem, normalizeSongItem } from '@/lib/songs';

export function CommunityPlaylists({ onPlay }: { onPlay?: (song: SongItem) => void }) {
  const [songs, setSongs] = useState<SongItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/songs?limit=6`);
        const data = await response.json();
        const mapped: SongItem[] = await Promise.all((data.songs || []).map(normalizeSongItem));
        if (mounted) setSongs(mapped);
      } catch (e) {
        if (!mounted) return;
        setSongs([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const items = useMemo(() => songs.map((s) => ({
    name: s.name,
    creator: s.movie,
    votes: { up: Math.floor(Math.random() * 1200) + 50, down: Math.floor(Math.random() * 80) },
    description: s.path,
    coverUrl: s.coverUrl,
  })), [songs]);

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Community Playlists
          <span className="ml-auto text-sm bg-accent/20 text-accent px-2 py-1 rounded-full">Live Voting</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && <div className="text-sm text-muted-foreground">Loading songs...</div>}
        {!loading && items.map((playlist, index) => {
          const totalVotes = playlist.votes.up + playlist.votes.down;
          const upPercentage = (playlist.votes.up / totalVotes) * 100;
          return (
            <div key={index} className="p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-2 gap-3">
                <div className="flex-1 flex gap-3 items-start min-w-0">
                  <img src={songs[index]?.coverUrl || "/assets/album-placeholder.jpg"} alt="cover" className="w-12 h-12 rounded object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium">{playlist.name}</h4>
                    <p className="text-sm text-muted-foreground">by {playlist.creator}</p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{songs[index]?.name}.mp3</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hover:scale-110 transition-transform"
                  onClick={() => songs[index] && onPlay?.(songs[index])}
                >
                  Play
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="flex items-center gap-2 flex-1 w-full">
                  <Button variant="ghost" size="sm" className="h-8 px-2 hover:bg-success/20 hover:text-success">
                    <ThumbsUp className="w-3 h-3 mr-1" />
                    {playlist.votes.up}
                  </Button>
                  <div className="flex-1">
                    <Progress value={upPercentage} className="h-2" />
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 px-2 hover:bg-destructive/20 hover:text-destructive">
                    <ThumbsDown className="w-3 h-3 mr-1" />
                    {playlist.votes.down}
                  </Button>
                </div>
                <span className="text-xs text-muted-foreground">{Math.round(upPercentage)}% liked</span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}


