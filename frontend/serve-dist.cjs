const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, 'dist');
const port = Number(process.env.PORT || 4173);
const host = '127.0.0.1';

const types = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

http
  .createServer((req, res) => {
    const requestPath = decodeURIComponent(req.url.split('?')[0]);
    let filePath = path.join(root, requestPath === '/' ? 'index.html' : requestPath);

    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        filePath = path.join(root, 'index.html');
        data = fs.readFileSync(filePath);
      }

      res.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
      res.end(data);
    });
  })
  .listen(port, host, () => {
    console.log(`Preview running at http://${host}:${port}`);
  });
