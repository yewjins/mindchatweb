const http = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

const assets = new Map([
  ['/', ['index.html', 'text/html']],
  ['/index.html', ['index.html', 'text/html']],
  ['/styles.css', ['styles.css', 'text/css']],
  ['/app.js', ['app.js', 'text/javascript']]
]);
const host = '127.0.0.1';
const port = 4173;

http.createServer(async (request, response) => {
  const asset = assets.get(request.url.split('?')[0]);
  if (!asset) {
    response.writeHead(404).end();
    return;
  }
  const [file, type] = asset;
  try {
    const body = await readFile(path.join(__dirname, file));
    response.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` }).end(body);
  } catch {
    response.writeHead(500).end();
  }
}).listen(port, host, () => console.log(`MindChat: http://${host}:${port}`));
