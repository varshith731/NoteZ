import { Button } from "@/components/ui/button";
import { Music, Disc3, ListMusic, Play, X, Filter } from "lucide-react";
import { useEffect, useState } from "react";
import "@/components/ui/select.css";

interface TrendingModalProps {
  open: boolean;
  onClose: () => void;
}

interface TrendingItem {
  rank: number;
  id: string;
  title?: string;
  name?: string;
  artist?: string;
  audioUrl?: string;
  coverUrl?: string;
  songCount?: number;
  totalPlays?: number;
  language?: string;
  category?: string;
  creator?: string;
}

interface FilterOptions {
  languages: string[];
  categories: { id: string; name: string; color: string }[];
}

type TabType = 'songs' | 'albums' | 'playlists';

export function TrendingModal({ open, onClose }: TrendingModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('songs');
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ languages: [], categories: [] });
  
  // Filters
  const [scope, setScope] = useState<'global' | 'national'>('global');
  const [language, setLanguage] = useState<string>('all');
  const [category, setCategory] = useState<string>('all');
  const [period, setPeriod] = useState<string>('7');

  useEffect(() => {
    if (open) {
      fetchFilterOptions();
      fetchTrending();
    }
  }, [open, activeTab, scope, language, category, period]);

  const fetchFilterOptions = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/trending/filters');
      if (response.ok) {
        const data = await response.json();
        setFilterOptions(data);
      }
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  };

  const fetchTrending = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '20',
        period,
        scope,
        ...(language !== 'all' && { language }),
        ...(category !== 'all' && { category })
      });

      const response = await fetch(`http://localhost:3001/api/trending/${activeTab}?${params}`);

      if (response.ok) {
        const data = await response.json();
        setItems(data.trending || []);
      }
    } catch (error) {
      console.error(`Failed to fetch trending ${activeTab}:`, error);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = (item: TrendingItem) => {
    if (activeTab === 'songs') {
      window.dispatchEvent(new CustomEvent('playSongFromAI', { 
        detail: { 
          id: item.id, 
          name: item.title,
          title: item.title,
          artist: item.artist,
          audioUrl: item.audioUrl,
          coverUrl: item.coverUrl
        } 
      }));
    } else if (activeTab === 'playlists') {
      window.dispatchEvent(new CustomEvent('playlistSelected', { 
        detail: { 
          id: item.id, 
          name: item.name,
          songCount: item.songCount,
          coverUrl: item.coverUrl
        } 
      }));
    }
    onClose();
  };

  if (!open) return null;

  const tabs = [
    { id: 'songs' as TabType, label: 'Songs', icon: Music },
    { id: 'albums' as TabType, label: 'Albums', icon: Disc3 },
    { id: 'playlists' as TabType, label: 'Playlists', icon: ListMusic }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-accent">🔥</span>
              Trending
            </h2>
            <div className="flex gap-2">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <Button
                    key={tab.id}
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab(tab.id)}
                    className={activeTab === tab.id 
                      ? "bg-purple-600 text-white border-purple-600 hover:bg-purple-700" 
                      : "bg-white/5 text-gray-300 border-white/20 hover:bg-white/10 hover:text-white"}
                  >
                    <Icon className="w-4 h-4 mr-1" />
                    {tab.label}
                  </Button>
                );
              })}
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-white/10 bg-black/20">
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="w-5 h-5 text-purple-400" />
            
            {/* Period Filter */}
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="1" className="bg-gray-900">Last 24 hours</option>
              <option value="7" className="bg-gray-900">Last 7 days</option>
              <option value="30" className="bg-gray-900">Last 30 days</option>
              <option value="90" className="bg-gray-900">Last 90 days</option>
            </select>

            {/* Scope Filter */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setScope('global')}
                className={scope === 'global' 
                  ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700' 
                  : 'bg-white/5 text-gray-300 border-white/20 hover:bg-white/10'}
              >
                Global
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setScope('national')}
                className={scope === 'national' 
                  ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700' 
                  : 'bg-white/5 text-gray-300 border-white/20 hover:bg-white/10'}
              >
                National
              </Button>
            </div>

            {/* Language Filter */}
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all" className="bg-gray-900">All Languages</option>
              {filterOptions.languages.map(lang => (
                <option key={lang} value={lang} className="bg-gray-900">{lang}</option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all" className="bg-gray-900">All Categories</option>
              {filterOptions.categories.map(cat => (
                <option key={cat.id} value={cat.name} className="bg-gray-900">{cat.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
            </div>
          ) : items.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group relative aspect-square bg-secondary/30 rounded-lg overflow-hidden hover:bg-secondary/50 transition-all cursor-pointer"
                  onClick={() => handleItemClick(item)}
                >
                  {/* Rank Badge */}
                  <div className="absolute top-2 left-2 z-10 bg-accent text-white text-xs font-bold rounded-full w-7 h-7 flex items-center justify-center shadow-lg">
                    #{item.rank}
                  </div>
                  
                  <img
                    src={item.coverUrl || '/assets/album-placeholder.jpg'}
                    alt={item.title || item.name}
                    className="w-full h-full object-cover"
                  />
                  
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    {activeTab === 'songs' && <Play className="w-12 h-12 text-white" />}
                    {activeTab === 'albums' && <Disc3 className="w-12 h-12 text-white" />}
                    {activeTab === 'playlists' && <ListMusic className="w-12 h-12 text-white" />}
                  </div>
                  
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
                    <p className="text-xs font-medium text-white truncate">
                      {item.title || item.name}
                    </p>
                    <p className="text-xs text-gray-300 truncate">
                      {activeTab === 'songs' && item.artist}
                      {activeTab === 'albums' && `${item.songCount} songs`}
                      {activeTab === 'playlists' && `${item.songCount} songs`}
                    </p>
                    {activeTab === 'songs' && item.totalPlays && (
                      <p className="text-xs text-accent truncate">{item.totalPlays.toLocaleString()} plays</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg">No trending {activeTab} found with current filters.</p>
              <p className="text-sm mt-2">Try adjusting your filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

