const fs = require('fs');
const http = require('http');
const https = require('https');

function fetchText(url) {
  if (url.startsWith('file://')) {
    return Promise.resolve(fs.readFileSync(url.replace('file://', ''), 'utf8'));
  }
  const client = url.startsWith('https://') ? https : http;
  return new Promise((resolve, reject) => {
    client.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchText(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function downloadFile(url, outPath) {
  if (url.startsWith('file://')) {
    fs.copyFileSync(url.replace('file://', ''), outPath);
    return Promise.resolve(outPath);
  }
  const client = url.startsWith('https://') ? https : http;
  return new Promise((resolve, reject) => {
    client.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadFile(res.headers.location, outPath));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const stream = fs.createWriteStream(outPath);
      res.pipe(stream);
      stream.on('finish', () => stream.close(() => resolve(outPath)));
      stream.on('error', reject);
    }).on('error', reject);
  });
}

module.exports = { fetchText, downloadFile };
