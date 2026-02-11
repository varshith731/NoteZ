const request = require('supertest');
const express = require('express');

jest.mock('../../config/supabase', () => require('../../tests/mock-supabase'));
const aiRouter = require('../ai');

const app = express();
app.use(express.json());
app.use('/api/ai', aiRouter);

describe('AI mood route', () => {
  test('POST /api/ai/mood returns detected emotion and categories', async () => {
    const res = await request(app).post('/api/ai/mood').send({ text: "I'm feeling sad today" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('emotion');
    expect(res.body).toHaveProperty('categories');
    expect(Array.isArray(res.body.categories)).toBe(true);
  });

  test('POST /api/ai/mood with empty text returns 400', async () => {
    const res = await request(app).post('/api/ai/mood').send({ text: "" });
    expect(res.status).toBe(400);
  });
});
