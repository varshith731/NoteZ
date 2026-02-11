const request = require('supertest');
const express = require('express');

// Use the real router but replace supabase client with mock
jest.mock('../../config/supabase', () => require('../../tests/mock-supabase'));
const playlistsRouter = require('../playlists');

const app = express();
app.use(express.json());
app.use('/api/playlists', playlistsRouter);

describe('Playlists routes', () => {
  test('GET /api/playlists/:id/songs returns 404 when playlist not found', async () => {
    const res = await request(app).get('/api/playlists/does-not-exist/songs');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  test('POST /api/playlists/:id/songs without token returns 401', async () => {
    const res = await request(app)
      .post('/api/playlists/some-id/songs')
      .send({ songId: 's1' });
    expect(res.status).toBe(401);
  });
});
