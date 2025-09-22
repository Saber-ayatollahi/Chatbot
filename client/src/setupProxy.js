const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy API requests to backend server
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5000',
      changeOrigin: true,
      secure: false,
      timeout: 10000,
      proxyTimeout: 10000,
      logLevel: 'debug',
      onError: (err, req, res) => {
        console.log('Proxy Error:', err.message);
        console.log('Request URL:', req.url);
        console.log('Target:', 'http://localhost:5000');
      },
      onProxyReq: (proxyReq, req, res) => {
        console.log('Proxying request:', req.method, req.url, '-> http://localhost:5000' + req.url);
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log('Proxy response:', proxyRes.statusCode, req.url);
      },
      // Retry configuration
      retry: {
        retries: 3,
        retryDelay: 1000
      }
    })
  );

  // Proxy WebSocket connections to backend server
  app.use('/ws', createProxyMiddleware({
    target: 'http://localhost:5000', // Use http for the target, ws upgrade will be handled automatically
    changeOrigin: true,
    ws: true, // Enable WebSocket proxying
    secure: false,
    logLevel: 'debug',
    onError: (err, req, res) => {
      console.log('WebSocket Proxy Error:', err.message);
      console.log('WebSocket Request URL:', req.url);
      console.log('WebSocket Target:', 'http://localhost:5000');
    },
    onProxyReqWs: (proxyReq, req, socket, options, head) => {
      console.log('Proxying WebSocket:', req.url, '-> ws://localhost:5000' + req.url);
    }
  }));
};
