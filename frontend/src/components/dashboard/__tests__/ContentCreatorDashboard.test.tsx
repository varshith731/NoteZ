import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ContentCreatorDashboard } from '../ContentCreatorDashboard';

// Mock fetch
global.fetch = vi.fn();

const renderWithRouter = (component: React.ReactElement) => {
  return render(<MemoryRouter>{component}</MemoryRouter>);
};

describe('ContentCreatorDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock localStorage
    localStorage.setItem('token', 'mock-token');
    
    // Mock successful API responses
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ 
        user: { 
          id: '1', 
          username: 'testuser', 
          full_name: 'Test User',
          avatar_url: '',
          bio: 'Test bio',
          followersCount: 10
        } 
      }),
    });
    
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ songs: [] }),
    });
    
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ albums: [] }),
    });
    
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ playlists: [] }),
    });
    
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ categories: [] }),
    });
    
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ 
        overview: { 
          totalSongs: 5, 
          totalListens: 100, 
          totalFavorites: 20, 
          monthlyListeners: 10 
        } 
      }),
    });
  });

  it('renders the dashboard with profile section', async () => {
    renderWithRouter(<ContentCreatorDashboard />);
    
    await waitFor(() => {
      // The component renders profile with username "testuser"
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });
  });

  it('displays stats cards', async () => {
    renderWithRouter(<ContentCreatorDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Total Songs')).toBeInTheDocument();
      expect(screen.getByText('Total Listens')).toBeInTheDocument();
    });
  });

  it('shows tabs for Songs, Albums, and Playlists', async () => {
    renderWithRouter(<ContentCreatorDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Songs')).toBeInTheDocument();
      expect(screen.getByText('Albums')).toBeInTheDocument();
      expect(screen.getByText('Playlists')).toBeInTheDocument();
    });
  });

  it('renders Edit Profile button', async () => {
    renderWithRouter(<ContentCreatorDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Edit Profile')).toBeInTheDocument();
    });
  });
});

