import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { WebSocketServer } from 'ws';

const host = '127.0.0.1';
const port = 3061;
const origin = `http://${host}:${port}`;
const page = await readFile(new URL('./index.html', import.meta.url));
const server = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(page);
    return;
  }
  response.writeHead(404).end();
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });
server.on('upgrade', (request, socket, head) => {
  if (request.url !== '/ws' || request.headers.origin !== origin) {
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    return;
  }
  wss.handleUpgrade(request, socket, head, client => wss.emit('connection', client));
});

wss.on('connection', socket => {
  console.log('Клиент подключился');
  socket.on('message', (data, isBinary) => {
    if (isBinary) {
      socket.send('ERROR: ожидается текст');
      return;
    }
    const message = data.toString('utf8');
    socket.send(message.trim() ? 'ECHO: ' + message : 'ERROR: пустое сообщение');
  });
  socket.on('close', code => console.log('Клиент отключился, код', code));
  socket.on('error', error => console.error('Ошибка соединения:', error.message));
});

server.on('error', error => {
  console.error('Не удалось запустить сервер:', error.message);
  process.exitCode = 1;
});
server.listen(port, host, () => console.log('Откройте', origin));
