import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Music } from "lucide-react";
import { useState, useEffect } from "react";

const lyrics = [
  { time: 0, text: "Midnight dreams are calling out to me" },
  { time: 3, text: "Through the silence of the city streets" },
  { time: 6, text: "Neon lights are dancing in the rain" },
  { time: 9, text: "Washing away all my pain" },
  { time: 12, text: "In this moment, everything feels right" },
  { time: 15, text: "Floating through the endless night" },
  { time: 18, text: "Lo-fi beats and gentle melodies" },
  { time: 21, text: "Set my weary soul free" },
  { time: 24, text: "Midnight dreams, take me away" },
  { time: 27, text: "To a place where I can stay" },
];

export function LyricsPanel() {
  const [currentLyricIndex, setCurrentLyricIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentLyricIndex((prev) => (prev + 1) % lyrics.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="w-5 h-5 text-accent" />
          Synced Lyrics
          <span className="ml-auto text-sm bg-accent/20 text-accent px-2 py-1 rounded-full animate-pulse">Karaoke Mode</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {lyrics.map((line, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg transition-all duration-500 ${
                index === currentLyricIndex
                  ? "bg-gradient-accent text-accent-foreground glow-accent transform scale-105"
                  : index === currentLyricIndex - 1 || (currentLyricIndex === 0 && index === lyrics.length - 1)
                  ? "bg-secondary/50 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
              }`}
            >
              <p className={`text-sm ${index === currentLyricIndex ? "font-medium" : ""}`}>{line.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-secondary/30 rounded-lg">
          <p className="text-xs text-muted-foreground mb-1">🎤 Karaoke Tips</p>
          <p className="text-xs text-muted-foreground">Follow the highlighted lyrics and sing along! Perfect timing with the beat.</p>
        </div>
      </CardContent>
    </Card>
  );
}


