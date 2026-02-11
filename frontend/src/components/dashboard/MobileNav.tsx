import { Home, Library, ListMusic, Heart, Compass, Bot } from 'lucide-react';

export function MobileNav() {
  const items = [
    { icon: Home, label: 'Home' },
    { icon: Library, label: 'Library' },
    { icon: ListMusic, label: 'Playlists' },
    { icon: Heart, label: 'Favs' },
    { icon: Compass, label: 'Explore' },
    { icon: Bot, label: 'DJ' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-black/60 backdrop-blur-xl border-t border-white/10">
      <ul className="grid grid-cols-6">
        {items.map(({ icon: Icon, label }) => (
          <li key={label} className="text-center">
            <button className="w-full py-3 flex flex-col items-center gap-1 text-xs text-gray-300 hover:text-white">
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}


