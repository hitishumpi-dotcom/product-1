const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const port = 4312;

http.createServer((req, res) => {
  if (req.url === '/manifest.json') {
    const bundleUrl = `http://127.0.0.1:${port}/bundle.tar.gz`;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ version: '0.2.0', bundleUrl, manifestUrl: `http://127.0.0.1:${port}/manifest.json` }));
    return;
  }
  if (req.url === '/bundle.tar.gz') {
    const p = path.join(root, 'dist', 'product-1.tar.gz');
    res.setHeader('Content-Type', 'application/gzip');
    fs.createReadStream(p).pipe(res);
    return;
  }
  res.statusCode = 404;
  res.end('not found');
}).listen(port, () => {
  console.log(`update-test-server listening on http://127.0.0.1:${port}`);
});
