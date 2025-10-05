const express = require('express');
const app = express();
const PORT = 3005;

app.get('/health', (req, res) => {
  res.json({ service: 'notification-service', status: 'ok', version: '1.0' });
});

app.get('/notify', (req, res) => {
  res.json({ message: "Mock notification sent!", to: req.query.user || "anonymous" });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Notification Service running on port ${PORT}`);
});