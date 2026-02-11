import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Map mood labels to database categories
const moods = [
  { emoji: "🎧", label: "Chill", color: "from-blue-500 to-cyan-400", category: "chill" },
  { emoji: "😊", label: "Happy", color: "from-yellow-400 to-orange-400", category: "happy" },
  { emoji: "💪", label: "Workout", color: "from-red-500 to-pink-500", category: "workout" },
  { emoji: "😢", label: "Sad", color: "from-gray-500 to-blue-500", category: "sad" },
  { emoji: "🌙", label: "Sleep", color: "from-purple-600 to-indigo-600", category: "sleep" },
  { emoji: "🎉", label: "Party", color: "from-pink-500 to-rose-400", category: "party" },
];

export function MoodRecommendations() {
  const handleMoodClick = (mood: typeof moods[0]) => {
    // Dispatch custom event with mood data
    window.dispatchEvent(new CustomEvent('moodSelected', {
      detail: {
        label: mood.label,
        category: mood.category,
        emoji: mood.emoji,
        color: mood.color
      }
    }));
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <span className="text-accent">🎭</span>
          Mood Vibes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {moods.map((mood, index) => (
            <Button 
              key={index} 
              variant="outline" 
              onClick={() => handleMoodClick(mood)}
              className={`min-w-[100px] h-16 bg-gradient-to-r ${mood.color} hover:scale-105 transition-all duration-300 border-0 text-white font-medium hover:shadow-accent cursor-pointer flex-shrink-0`}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl">{mood.emoji}</span>
                <span className="text-sm">{mood.label}</span>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}


