// api-gateway/app.js
const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const http = require('http');

const app = express();
const PORT = 8000;

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// Enable JSON parsing
app.use(express.json());

// Helper function for custom HTTP proxy to reduce code duplication
const createCustomProxy = (targetHost, targetPort) => {
  return async (req, res, targetPath) => {
    const postData = req.method !== 'GET' ? JSON.stringify(req.body) : null;
    
    const options = {
      hostname: targetHost,
      port: targetPort,
      path: targetPath,
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData ? Buffer.byteLength(postData) : 0
      }
    };

    console.log(`Proxying ${req.method} ${req.path} to ${options.hostname}:${options.port}${targetPath}`);
    
    const proxyReq = http.request(options, (proxyRes) => {
      let data = '';
      
      proxyRes.on('data', (chunk) => {
        data += chunk;
      });
      
      proxyRes.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          res.status(proxyRes.statusCode).json(jsonData);
          console.log(`✅ API responded with ${proxyRes.statusCode}`);
        } catch (parseError) {
          console.error('Error parsing response:', parseError);
          res.status(500).json({ error: 'Invalid response from service' });
        }
      });
    });
    
    proxyReq.on('error', (err) => {
      console.error('Proxy request error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Service unavailable',
          message: 'Failed to connect to service'
        });
      }
    });
    
    proxyReq.setTimeout(10000, () => {
      console.error('Proxy timeout');
      if (!res.headersSent) {
        res.status(504).json({ error: 'Service timeout' });
      }
      proxyReq.destroy();
    });
    
    if (postData) {
      proxyReq.write(postData);
    }
    
    proxyReq.end();
  };
};

const dreamsProxy = createCustomProxy('dream-ingestor', 5001);

// Dreams API routes
app.all('/api/dreams', async (req, res) => {
  await dreamsProxy(req, res, '/dreams');
});

app.all('/api/dreams/:id', async (req, res) => {
  await dreamsProxy(req, res, `/dreams/${req.params.id}`);
});

app.use('/api/stories', createProxyMiddleware({
  target: 'http://story-weaver:5002',
  pathRewrite: { '^/api/stories': '/generate' },
  changeOrigin: true
}));

app.use('/api/art', createProxyMiddleware({
  target: 'http://art-generator:5003',
  pathRewrite: { '^/api/art': '/generate' },
  changeOrigin: true
}));

app.use('/api/gallery', createProxyMiddleware({
  target: 'http://gallery-service:5004',
  pathRewrite: { '^/api/gallery': '/all' },
  changeOrigin: true
}));

app.use('/api/notify', createProxyMiddleware({
  target: 'http://notification-service:3005',
  pathRewrite: { '^/api/notify': '/notify' },
  changeOrigin: true
}));

app.use('/api/trending', createProxyMiddleware({
  target: 'http://trending-service:5007',
  pathRewrite: { '^/api/trending': '/trending' },
  changeOrigin: true
}));

app.use('/api/vote', createProxyMiddleware({
  target: 'http://voting-service:5005',
  pathRewrite: { '^/api/vote': '/like' },
  changeOrigin: true
}));

app.use('/api/remix', createProxyMiddleware({
  target: 'http://remix-engine:5006',
  pathRewrite: { '^/api/remix': '/remix' },
  changeOrigin: true
}));

app.use('/api/portfolio/:id', createProxyMiddleware({
  target: 'http://user-portfolio:5008',
  pathRewrite: (path, req) => {
    return `/user/${req.params.id}/dreams`;
  },
  changeOrigin: true
}));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API Gateway running on http://localhost:${PORT}`);
});
