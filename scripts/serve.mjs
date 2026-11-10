/**
 * Минимальный статический сервер для локальной разработки.
 *
 * Без зависимостей — `node scripts/serve.mjs`, и сайт уже на
 * http://localhost:3000. `npm install` не нужен, поэтому в репозитории не
 * появляется каталог node_modules и лишняя поверхность атаки через
 * зависимости.
 *
 * Запуск:
 *   node scripts/serve.mjs [порт]
 *   PORT=8080 node scripts/serve.mjs
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../site', import.meta.url)));
const PORT = Number(process.argv[2] || process.env.PORT || 3000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

/**
 * Превращает путь запроса в файл внутри ROOT.
 * Возвращает null, если путь выходит за пределы ROOT (попытка обхода).
 */
function resolveSafe(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const relative = normalize(decoded).replace(/^([/\\])+/, '');
  const target = resolve(join(ROOT, relative));

  if (target !== ROOT && !target.startsWith(ROOT + sep)) {
    return null; // попытка выйти за пределы каталога
  }
  return target;
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Метод не поддерживается');
  }

  const target = resolveSafe(req.url || '/');
  if (!target) {
    return send(res, 403, 'Доступ запрещён');
  }

  let filePath = target;

  try {
    const info = await stat(filePath);
    if (info.isDirectory()) {
      filePath = join(filePath, 'index.html');
      await stat(filePath); // бросает исключение, если index.html нет
    }
  } catch {
    // Отдаём страницу 404 — так же, как это делает настоящий статический хостинг.
    try {
      const notFound = await readFile(join(ROOT, '404.html'));
      return send(res, 404, notFound, MIME['.html']);
    } catch {
      return send(res, 404, 'Страница не найдена');
    }
  }

  try {
    const body = await readFile(filePath);
    const type = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    send(res, 500, 'Внутренняя ошибка сервера');
  }
});

server.listen(PORT, () => {
  console.log(`Отдаём ${ROOT}`);
  console.log(`  -> http://localhost:${PORT}`);
  console.log('Нажмите Ctrl+C, чтобы остановить.');
});
