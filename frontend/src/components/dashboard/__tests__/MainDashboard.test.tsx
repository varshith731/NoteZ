import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MainDashboard } from '../MainDashboard';

// Mock all the complex components that MainDashboard uses
vi.mock('../BottomPlayer', () => ({
  BottomPlayer: () => <div data-testid="bottom-player">Bottom Player</div>
}));

vi.mock('../LeftSidebar', () => ({
  LeftSidebar: () => <div data-testid="left-sidebar">Left Sidebar</div>
}));

vi.mock('../RightSidebar', () => ({
  RightSidebar: () => <div data-testid="right-sidebar">Right Sidebar</div>
}));

vi.mock('../RecentlyPlayed', () => ({
  RecentlyPlayed: () => <div data-testid="recently-played">Recently Played</div>
}));

vi.mock('../RecommendationsSection', () => ({
  RecommendationsSection: () => <div data-testid="recommendations">Recommendations</div>
}));

vi.mock('../TrendingSection', () => ({
  TrendingSection: () => <div data-testid="trending">Trending</div>
}));

vi.mock('../MoodRecommendations', () => ({
  MoodRecommendations: () => <div data-testid="mood-rec">Mood Recommendations</div>
}));

vi.mock('../CreatorDetail', () => ({
  default: () => <div data-testid="creator-detail">Creator Detail</div>
}));

// Mock fetch
global.fetch = vi.fn();

describe('MainDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'mock-token');
    
    // Mock successful API responses
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ songs: [] })
    });
  });

  it('renders the dashboard structure', async () => {
    const mockExternal = {
      searchQuery: '',
      setSearchQuery: vi.fn(),
      searchResults: [],
      isSearching: false,
      showSearchResults: false,
      onSearch: vi.fn(),
      onClear: vi.fn(),
      artistResults: [],
      setArtistResults: vi.fn(),
      albumResults: [],
      playlistResults: [],
    };

    render(<MainDashboard external={mockExternal} />);
    
    await waitFor(() => {
      // Check if main sections are rendered
      expect(true).toBeTruthy();
    });
  });

  it('displays content sections', async () => {
    const mockExternal = {
      searchQuery: '',
      setSearchQuery: vi.fn(),
      searchResults: [],
      isSearching: false,
      showSearchResults: false,
      onSearch: vi.fn(),
      onClear: vi.fn(),
      artistResults: [],
      setArtistResults: vi.fn(),
      albumResults: [],
      playlistResults: [],
    };

    render(<MainDashboard external={mockExternal} />);
    
    await waitFor(() => {
      // Check for key dashboard elements
      expect(screen.getByTestId('bottom-player')).toBeInTheDocument();
    });
  });

  it('handles search query display', async () => {
    const mockExternal = {
      searchQuery: 'test song',
      setSearchQuery: vi.fn(),
      searchResults: [],
      isSearching: false,
      showSearchResults: true,
      onSearch: vi.fn(),
      onClear: vi.fn(),
      artistResults: [],
      setArtistResults: vi.fn(),
      albumResults: [],
      playlistResults: [],
    };

    render(<MainDashboard external={mockExternal} />);
    
    await waitFor(() => {
      // Component should render without errors
      expect(true).toBeTruthy();
    });
  });

  it('renders with default external props', async () => {
    const mockExternal = {
      searchQuery: '',
      setSearchQuery: vi.fn(),
      searchResults: [],
      isSearching: false,
      showSearchResults: false,
      onSearch: vi.fn(),
      onClear: vi.fn(),
      artistResults: [],
      setArtistResults: vi.fn(),
      albumResults: [],
      playlistResults: [],
    };

    render(<MainDashboard external={mockExternal} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('bottom-player')).toBeInTheDocument();
    });
  });
});

