const http = require('http');
const fs = require('fs');
const path = require('path');
const { buildTestRelease } = require('./lib/share');

const root = path.join(__dirname, '..');
const port = 4312;
const version = '0.2.0';
const bundlePath = buildTestRelease(version);

http.createServer((req, res) => {
  if (req.url === '/manifest.json') {
    const bundleUrl = `http://127.0.0.1:${port}/bundle.tar.gz`;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ version, bundleUrl, manifestUrl: `http://127.0.0.1:${port}/manifest.json` }));
    return;
  }
  if (req.url === '/bundle.tar.gz') {
    res.setHeader('Content-Type', 'application/gzip');
    fs.createReadStream(bundlePath).pipe(res);
    return;
  }
  res.statusCode = 404;
  res.end('not found');
}).listen(port, () => {
  console.log(`update-test-server listening on http://127.0.0.1:${port}`);
});
