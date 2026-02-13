const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Dynamic import for node-fetch v3
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors());

// Proxy endpoints for Google Places API
app.get('/api/places/nearbysearch', async (req, res) => {
  try {
    const { location, radius, type, keyword } = req.query;

    const params = new URLSearchParams();
    if (location) params.append('location', location);
    if (radius) params.append('radius', radius);
    if (type) params.append('type', type);
    if (keyword) params.append('keyword', keyword);
    params.append('key', process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY);

    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`;

    console.log('Proxying nearbysearch to:', url.replace(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, '[API_KEY]'));

    const response = await fetch(url);
    const data = await response.json();

    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy error' });
  }
});

app.get('/api/places/textsearch', async (req, res) => {
  try {
    const { query, location, radius } = req.query;

    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (location) params.append('location', location);
    if (radius) params.append('radius', radius);
    params.append('key', process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY);

    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params.toString()}`;

    console.log('Proxying textsearch to:', url.replace(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, '[API_KEY]'));

    const response = await fetch(url);
    const data = await response.json();

    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy error' });
  }
});

app.get('/api/places/details', async (req, res) => {
  try {
    const { place_id } = req.query;

    const params = new URLSearchParams();
    if (place_id) params.append('place_id', place_id);
    params.append('fields', 'name,formatted_address,formatted_phone_number,website,opening_hours,rating,reviews,photos,types');
    params.append('key', process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY);

    const url = `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`;

    console.log('Proxying details to:', url.replace(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, '[API_KEY]'));

    const response = await fetch(url);
    const data = await response.json();

    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy error' });
  }
});

app.get('/api/places/photo', async (req, res) => {
  try {
    const { photoreference, maxwidth } = req.query;

    const params = new URLSearchParams();
    if (maxwidth) params.append('maxwidth', maxwidth);
    if (photoreference) params.append('photoreference', photoreference);
    params.append('key', process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY);

    const url = `https://maps.googleapis.com/maps/api/place/photo?${params.toString()}`;

    console.log('Proxying photo to:', url.replace(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, '[API_KEY]'));

    const response = await fetch(url);

    if (response.ok) {
      // For photos, we want to return the redirect URL
      res.redirect(response.url);
    } else {
      res.status(response.status).json({ error: 'Photo fetch failed' });
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy error' });
  }
});

app.listen(PORT, () => {
  console.log(`CORS proxy server running on http://localhost:${PORT}`);
});