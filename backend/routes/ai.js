const express = require('express');
const router = express.Router();
// Reuse configured Supabase client so tests can mock it via config/supabase
const supabase = require('../config/supabase');

// Emotion to song category mapping based on database schema
// Maps detected emotions to song categories from your database
const EMOTION_TO_CATEGORIES = {
  // Primary emotions from j-hartmann/emotion-english-distilroberta-base
  joy: ['happy', 'party', 'energetic'],
  happy: ['happy', 'party', 'energetic'],
  neutral: ['chill', 'calm', 'study'],
  sadness: ['sad', 'motivational', 'nostalgic'],
  anger: ['angry', 'workout', 'calm'],
  disgust: ['calm', 'inspirational', 'chill'],
  fear: ['calm', 'sleep', 'chill'],
  surprise: ['energetic', 'party', 'happy'],
  // Extended emotions (if detected by model)
  optimism: ['motivational', 'inspirational', 'happy'],
  admiration: ['happy', 'inspirational', 'energetic'],
  love: ['romantic', 'happy', 'calm'],
  annoyance: ['chill', 'calm', 'sleep'],
  disappointment: ['sad', 'motivational', 'inspirational'],
  nervousness: ['calm', 'sleep', 'study'],
  excitement: ['energetic', 'party', 'workout'],
  relaxed: ['chill', 'calm', 'sleep'],
  nostalgic: ['nostalgic', 'sad', 'calm'],
  bored: ['energetic', 'party', 'travel'],
  stressed: ['calm', 'sleep', 'motivational'],
  lonely: ['sad', 'romantic', 'nostalgic'],
  confident: ['motivational', 'workout', 'party'],
  tired: ['calm', 'sleep', 'chill'],
  focused: ['study', 'calm', 'chill'],
  // Default fallback
  default: ['chill', 'calm', 'study']
};

async function callHuggingFace(model, inputs, { timeoutMs = 5000, retries = 2 } = {}) {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) throw new Error('Missing HUGGINGFACE_API_KEY');
  // Try the new Router endpoint first (recommended). Fallback to api-inference if necessary.
  const endpoints = [
    `https://router.huggingface.co/models/${model}`,
    `https://api-inference.huggingface.co/models/${model}`
  ];

  let lastErr;
  for (const endpoint of endpoints) {
    let attempt = 0;
    while (attempt <= retries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ inputs }),
          signal: controller.signal
        });
        clearTimeout(timer);
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`HF error ${res.status}: ${text}`);
        }
        return res.json();
      } catch (err) {
        clearTimeout(timer);
        lastErr = err;
        const isAbort = err?.name === 'AbortError';
        const isRetryable = isAbort || /\b5\d\d\b/.test(String(err)) || /fetch|network/i.test(String(err));
        if (attempt < retries && isRetryable) {
          const backoff = Math.min(2000 * (attempt + 1), 5000);
          await new Promise(r => setTimeout(r, backoff));
          attempt++;
          continue;
        }
        // If this endpoint is explicitly deprecated (410) try next endpoint
        if (String(err).includes('410') || /no longer supported|router.huggingface.co/i.test(String(err))) {
          console.warn(`Hugging Face endpoint ${endpoint} reported deprecation, trying next endpoint: ${err}`);
          break; // move to next endpoint
        }
        // otherwise rethrow to bubble up
        throw err;
      }
    }
  }
  throw lastErr;
}

function pickTopLabel(hfResponse) {
  // HF can return either array of arrays for classification pipeline
  const groups = Array.isArray(hfResponse) ? hfResponse : [];
  const first = Array.isArray(groups[0]) ? groups[0] : groups;
  if (!Array.isArray(first)) return null;
  const sorted = [...first].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return sorted[0]?.label?.toLowerCase() || null;
}

router.post('/mood', async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }

    // Try emotion first (model name can be overridden via env var)
    const EMOTION_MODEL = process.env.HUGGINGFACE_MODEL_EMOTION || 'j-hartmann/emotion-english-distilroberta-base';
    const SENTIMENT_MODEL = process.env.HUGGINGFACE_MODEL_SENTIMENT || 'distilbert-base-uncased-finetuned-sst-2-english';

    let label;
    let detectionSource = 'keyword'; // default if HF not available
    try {
      const emotion = await callHuggingFace(EMOTION_MODEL, text);
      label = pickTopLabel(emotion);
      if (label) detectionSource = 'huggingface-emotion';
    } catch (e) {
      // Friendly, non-verbose logging for HF availability issues
      console.warn(`Hugging Face emotion model unavailable (${EMOTION_MODEL}): ${e?.message || e}`);
    }

    // Fallback to sentiment
    if (!label) {
      try {
        const sentiment = await callHuggingFace(SENTIMENT_MODEL, text);
        label = pickTopLabel(sentiment);
        if (label) detectionSource = 'huggingface-sentiment';
      } catch (e) {
        console.warn(`Hugging Face sentiment model unavailable (${SENTIMENT_MODEL}): ${e?.message || e}`);
      }
    }

    // If model didn't return a label, attempt a simple keyword-based fallback
    if (!label) {
      const lower = text.toLowerCase();
      const keywordMap = {
        sad: 'sadness',
        unhappy: 'sadness',
        depressed: 'sadness',
        lonely: 'lonely',
        happy: 'happy',
        joy: 'joy',
        excited: 'excited',
        stressed: 'stressed',
        tired: 'tired',
        bored: 'bored',
        calm: 'relaxed',
        relaxed: 'relaxed',
        focused: 'focused',
        angry: 'anger',
      };
      for (const k of Object.keys(keywordMap)) {
        if (lower.includes(k)) {
          label = keywordMap[k];
          break;
        }
      }
    }

    // Default to neutral mapping if still empty
    if (!label) label = 'neutral';

    // Get categories for this emotion
    const categories = EMOTION_TO_CATEGORIES[label] || EMOTION_TO_CATEGORIES.default;
    
    // Fetch songs from database based on categories (best-effort)
    let suggestions = [];
    try {
      const { data: songs, error: dbError } = await supabase
        .from('songs')
        .select(`
          id,
          title,
          artist,
          movie,
          audio_url,
          cover_url,
          song_categories!inner(name)
        `)
        .in && typeof supabase.from === 'function'
        ? await supabase
            .from('songs')
            .select(`
              id,
              title,
              artist,
              movie,
              audio_url,
              cover_url,
              song_categories!inner(name)
            `)
            .in('song_categories.name', categories)
            .eq('is_public', true)
            .limit(5)
        : { data: [], error: null };

      if (dbError) {
        console.error('Database error:', dbError);
      } else {
        suggestions = (songs || []).map(song => ({
          id: song.id,
          title: song.title,
          artist: song.artist,
          movie: song.movie,
          audioUrl: song.audio_url,
          coverUrl: song.cover_url,
          category: song.song_categories?.name
        }));
      }
    } catch (dbErr) {
      console.error('Database fetch error (AI suggestions):', dbErr);
      // continue with empty suggestions
      suggestions = [];
    }

    res.json({
      input: text,
      emotion: label,
      categories: categories,
      suggestions: suggestions,
      detectionSource
    });
  } catch (error) {
    console.error('AI /mood error:', error);
    res.status(500).json({ error: 'Failed to analyze mood' });
  }
});

module.exports = router;
