import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Pause, Play, RotateCcw, ListMusic, Volume2, VolumeX, SkipBack, SkipForward, Heart, ListPlus, FileText } from 'lucide-react';
import type { SongItem } from '@/lib/songs';

export function BottomPlayer({
  song,
  isPlaying,
  progressPct,
  duration,
  volumePct,
  onTogglePlay,
  onSeekPct,
  onVolumePct,
  onToggleFavorite,
  isFavorite,
  onReplay,
  onToggleQueue,
  onAddToPlaylist,
  onShowLyrics,
  onChangeRepeatMode,
  onPrev,
  onNext,
  queueLength,
}: {
  song?: SongItem;
  isPlaying: boolean;
  progressPct: number;
  duration: number;
  volumePct: number;
  onTogglePlay: () => void;
  onSeekPct: (pct: number) => void;
  onVolumePct: (pct: number) => void;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  onReplay?: () => void;
  onToggleQueue?: () => void;
  onAddToPlaylist?: () => void;
  onShowLyrics?: () => void;
  onChangeRepeatMode?: (mode: 'off' | 'one' | 'all') => void;
  onPrev?: () => void;
  onNext?: () => void;
  queueLength?: number;
}) {
  useEffect(() => {
    // Log incoming song prop for debugging missing title issue
    if (song) {
      console.log('[BottomPlayer] Received song prop:', { name: song.name, id: song.id, audioUrl: song.audioUrl });
    } else {
      console.log('[BottomPlayer] No song prop received');
    }
  }, [song]);
  const [isMuted, setIsMuted] = useState(false);
  
  const [repeatMode, setRepeatMode] = useState<'off' | 'one' | 'all'>('off');

  const toggleMute = () => {
    if (isMuted) {
      onVolumePct(volumePct);
      setIsMuted(false);
    } else {
      onVolumePct(0);
      setIsMuted(true);
    }
  };

  const handleReplayToggle = () => {
    // Cycle repeat modes: off -> one -> all -> off
    const next = repeatMode === 'off' ? 'one' : repeatMode === 'one' ? 'all' : 'off';
    setRepeatMode(next);
    if (onChangeRepeatMode) onChangeRepeatMode(next);
    // keep compatibility: call onReplay when entering 'one'
    if (onReplay && next === 'one') onReplay();
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-gradient-to-r from-black/90 via-black/80 to-black/90 backdrop-blur-xl border-t border-white/20 shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 py-3">
        {/* Navigation Controls Row (moved to top) */}
        <div className="flex items-center justify-center gap-2.5 mb-2">
          <Button 
            size="icon" 
            variant="ghost" 
            className="w-9 h-9 text-gray-300 hover:text-white hover:bg-white/10 rounded-full transition-all hover:scale-105"
            onClick={() => { if (onPrev) onPrev(); }}
            aria-label="Previous"
          >
            <SkipBack className="w-4.5 h-4.5" />
          </Button>
          
          <Button 
            size="icon" 
            className="w-9 h-9 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-full shadow-lg transition-all transform hover:scale-105" 
            onClick={onTogglePlay}
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          </Button>
          
          <Button 
            size="icon" 
            variant="ghost" 
            className="w-9 h-9 text-gray-300 hover:text-white hover:bg-white/10 rounded-full transition-all hover:scale-105"
            onClick={() => { if (onNext) onNext(); }}
            aria-label="Next"
          >
            <SkipForward className="w-4.5 h-4.5" />
          </Button>
        </div>

        {/* Main Player Controls */}
        <div className="flex items-center gap-3">
          {/* Song Cover & Info - fixed width */}
          <div className="flex items-center gap-2 w-[180px] shrink-0">
            <div className="relative group flex-shrink-0">
              <img 
                src={song?.coverUrl || '/assets/album-placeholder.jpg'} 
                alt="cover" 
                className="w-10 h-10 rounded-lg object-cover shadow-lg transition-transform group-hover:scale-105" 
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{song?.name || (song as any)?.title || 'Select a song'}</p>
              <p className="text-xs text-gray-300 truncate">{song?.movie || (song as any)?.artist || 'Unknown Artist'}</p>
            </div>
          </div>

          {/* Progress Bar - takes remaining space */}
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className="text-xs text-gray-400 w-10 text-right shrink-0">
              {Math.floor((progressPct / 100) * (duration || 0) / 60).toString().padStart(1, '0') + ':' + Math.floor((progressPct / 100) * (duration || 0) % 60).toString().padStart(2, '0')}
            </span>
            <div className="flex-1 min-w-0">
              <Slider 
                value={[progressPct]} 
                onValueChange={(v) => onSeekPct(v[0] ?? 0)} 
                max={100} 
                step={1} 
                className="w-full"
              />
            </div>
            <span className="text-xs text-gray-400 w-10 shrink-0">
              {duration ? Math.floor(duration / 60).toString().padStart(1, '0') + ':' + Math.floor(duration % 60).toString().padStart(2, '0') : '0:00'}
            </span>
          </div>

          {/* Control Buttons - fixed width */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Loop */}
            <Button
              size="icon"
              variant="ghost"
              className={`w-9 h-9 rounded-full transition-all ${repeatMode !== 'off' ? 'text-purple-400 bg-purple-600/10 hover:bg-purple-600/20' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
              onClick={handleReplayToggle}
              aria-label={repeatMode === 'off' ? 'Turn on repeat (one)' : repeatMode === 'one' ? 'Switch to repeat all' : 'Turn off repeat'}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>

            {/* Queue */}
            <Button
              size="icon"
              variant="ghost"
              className={`w-9 h-9 rounded-full transition-all ${queueLength && queueLength > 0 ? 'text-purple-300 bg-purple-700/10 hover:bg-purple-700/20' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
              onClick={() => onToggleQueue && onToggleQueue()}
              aria-label="Show queue"
            >
              <ListMusic className="w-4 h-4" />
            </Button>

            {/* Like */}
            <Button
              size="icon"
              variant="ghost"
              className={`w-9 h-9 rounded-full transition-all ${isFavorite ? 'text-pink-400 bg-pink-600/10 hover:bg-pink-600/20' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
              disabled={!song?.id}
              onClick={() => onToggleFavorite?.()}
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart className={`w-4 h-4 ${ isFavorite ? 'fill-pink-500' : '' }`} />
            </Button>

            {/* Add to Playlist */}
            <button
              aria-label="Add to playlist"
              className="w-9 h-9 flex items-center justify-center rounded-md bg-white/10 hover:bg-white/15 text-white transition"
              onClick={() => onAddToPlaylist && onAddToPlaylist()}
              disabled={!song?.id}
            >
              <ListPlus className="w-4 h-4" />
            </button>

            {/* Lyrics */}
            <Button
              size="icon"
              variant="ghost"
              className={`w-9 h-9 rounded-full transition-all ${song?.lyrics ? 'text-cyan-300 bg-cyan-700/10 hover:bg-cyan-700/20' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
              onClick={() => onShowLyrics && onShowLyrics()}
              aria-label={song?.lyrics ? 'Show lyrics' : 'Lyrics not available'}
            >
              <FileText className="w-4 h-4" />
            </Button>
          </div>

          {/* Volume Control - fixed width */}
          <div className="flex items-center gap-2 w-24 shrink-0">
            <Button 
              size="icon" 
              variant="ghost" 
              className="w-7 h-7 text-gray-300 hover:text-white hover:bg-white/10 rounded-full transition-all"
              onClick={toggleMute}
            >
              {isMuted || volumePct === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
            <Slider 
              value={[isMuted ? 0 : volumePct]} 
              onValueChange={(v) => {
                const newVolume = v[0] ?? 0;
                onVolumePct(newVolume);
                if (newVolume > 0) setIsMuted(false);
              }} 
              max={100} 
              step={1} 
              className="w-full"
            />
          </div>
        </div>

        

        {/* Lyrics handled in main dashboard */}
      </div>
    </div>
  );
}


