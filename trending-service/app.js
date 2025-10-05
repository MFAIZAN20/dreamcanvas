const express = require('express');
const app = express();

app.get('/trending', (req, res) => {
  res.json({
    message: "Trending service is ready. Connect to analytics engine for trending data.",
    status: "service_available",
    data: []
  });
});

app.get('/health', (req, res) => {
  res.json({ service: 'trending-service', status: 'ok' });
});

app.listen(5007, '0.0.0.0', () => {
  console.log('✅ Trending service running on port 5007');
});