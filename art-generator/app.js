const express = require('express');
const app = express();

app.get('/generate', (req, res) => {
  res.json({ 
    image_url: "placeholder://art-generation-ready",
    style: "ready",
    status: "service_available",
    message: "Art generation service is ready. Connect to AI service for art generation."
  });
});

app.get('/health', (req, res) => {
  res.json({ service: 'art-generator', status: 'ok' });
});

app.listen(5003, '0.0.0.0', () => {
  console.log('✅ Art Generator running on port 5003');
});
