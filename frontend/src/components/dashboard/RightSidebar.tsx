import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useState } from 'react';
import { Play, Music } from 'lucide-react';

interface SongSuggestion {
  id: string;
  title: string;
  artist: string;
  movie?: string;
  audioUrl: string;
  coverUrl?: string;
  category?: string;
}

interface MoodResult {
  emotion: string;
  categories: string[];
  suggestions: SongSuggestion[];
}

export function RightSidebar() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MoodResult | null>(null);
  const [error, setError] = useState('');

  const analyzeMood = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('http://localhost:3001/api/ai/mood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: prompt })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to analyze');
      setResult({
        emotion: data.emotion,
        categories: data.categories,
        suggestions: data.suggestions
      });
    } catch (e: any) {
      setError(e.message || 'Failed to analyze');
    } finally {
      setLoading(false);
    }
  };

  const handleSongPlay = (song: SongSuggestion) => {
    // Dispatch event to play song in main dashboard
    window.dispatchEvent(new CustomEvent('playSongFromAI', {
      detail: {
        id: song.id,
        name: song.title,
        movie: song.artist,
        audioUrl: song.audioUrl,
        coverUrl: song.coverUrl,
        path: song.id
      }
    }));
  };

  return (
    <div className="hidden lg:flex flex-col gap-4">
      <Card className="bg-black/30 border-white/10 flex-1">
        <CardHeader>
          <CardTitle className="text-white/90">AI DJ Assistant</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-white/5 text-sm text-gray-300">
            Tell me how you're feeling, and I'll suggest songs for your mood.
          </div>

          <div className="space-y-2">
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && analyzeMood()}
              placeholder="e.g., I'm stressed and need to focus"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={analyzeMood}
              disabled={loading || !prompt.trim()}
              className="w-full rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm px-3 py-2 transition disabled:opacity-50"
            >
              {loading ? 'Analyzing…' : 'Get Suggestions'}
            </button>
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{error}</div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30">
                <p className="text-sm text-white">
                  Emotion: <span className="text-purple-300 font-semibold capitalize">{result.emotion}</span>
                </p>
                <p className="text-xs text-gray-300 mt-1">
                  Suggested categories: {result.categories.join(', ')}
                </p>
              </div>

              {result.suggestions && result.suggestions.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-white">Recommended Songs:</h4>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {result.suggestions.map((song) => (
                      <div
                        key={song.id}
                        className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer group"
                        onClick={() => handleSongPlay(song)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                            {song.coverUrl ? (
                              <img
                                src={song.coverUrl}
                                alt={song.title}
                                className="w-full h-full rounded-lg object-cover"
                              />
                            ) : (
                              <Music className="w-5 h-5 text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate group-hover:text-purple-300 transition-colors">
                              {song.title}
                            </p>
                            <p className="text-xs text-gray-400 truncate">{song.artist}</p>
                            {song.movie && (
                              <p className="text-xs text-gray-500 truncate">{song.movie}</p>
                            )}
                          </div>
                          <Play className="w-5 h-5 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-sm text-gray-400 text-center">No songs found for this mood. Try adding more songs to the database!</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


