import http from 'node:http';

const events = [];
const routes = new Map([
  ['/', ['GET']],
  ['/api/status', ['GET']],
  ['/api/events', ['GET', 'POST']],
]);

function reply(res, status, data, headers = {}) {
  const plain = typeof data === 'string';
  const body = plain ? data : JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': (plain ? 'text/plain' : 'application/json') + '; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

async function addEvent(req, res) {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return reply(res, 415, { error: 'Требуется application/json' });
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 16384) return reply(res, 413, { error: 'Лимит тела — 16 КиБ' });
    chunks.push(chunk);
  }
  let data;
  try {
    data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return reply(res, 400, { error: 'Ошибка синтаксиса JSON' });
  }
  if (typeof data?.station !== 'string' || !data.station.trim() ||
      typeof data.message !== 'string' || !data.message.trim()) {
    return reply(res, 400, { error: 'Нужны непустые строки station и message' });
  }
  const event = { id: events.length + 1, station: data.station.trim(), message: data.message.trim() };
  events.push(event);
  reply(res, 201, event);
}

const server = http.createServer(async (req, res) => {
  console.log(req.method, req.url);
  const path = req.url.split('?')[0];
  const methods = routes.get(path);
  if (!methods) return reply(res, 404, { error: 'Ресурс не найден' });
  if (!methods.includes(req.method)) {
    return reply(res, 405, { error: 'Метод недоступен' }, { Allow: methods.join(', ') });
  }
  if (path === '/') return reply(res, 200, 'Привет от NetLab!');
  if (path === '/api/status') return reply(res, 200, { status: 'online', service: 'NetLab' });
  if (req.method === 'GET') return reply(res, 200, events);
  try {
    await addEvent(req, res);
  } catch (err) {
    console.error(err.message);
    if (!res.destroyed && !res.headersSent) reply(res, 500, { error: 'Ошибка сервера' });
  }
});

server.listen(3040, '127.0.0.1', () => console.log('http://127.0.0.1:3040'));
