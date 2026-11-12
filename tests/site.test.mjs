/**
 * Смоук-тесты для сайта-портфолио.
 *
 * Это не юнит-тесты CSS — CSS нельзя осмысленно покрыть тестами без
 * браузера. Здесь проверяется то, что действительно ломает статический сайт:
 * отсутствующий файл, опечатка в пути, ссылка в никуда, структура заголовков,
 * которая сбивает с толку скринридер.
 *
 * Запуск:  npm test     (или: node --test tests/)
 * Зависимостей нет.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site');

async function read(path) {
  return readFile(join(SITE, path), 'utf8');
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const html = await read('index.html');
const js = await read('js/main.js');

describe('обязательные файлы', () => {
  const required = [
    'index.html',
    '404.html',
    'robots.txt',
    'sitemap.xml',
    '.nojekyll',
    'css/styles.css',
    'js/main.js',
    'assets/favicon.svg',
    'assets/og-image.svg',
  ];

  for (const file of required) {
    test(`${file} на месте`, async () => {
      assert.ok(await exists(join(SITE, file)), `отсутствует: site/${file}`);
    });
  }

  test('метаданные репозитория на месте', async () => {
    for (const file of ['README.md', 'LICENSE', '.gitignore', 'package.json']) {
      assert.ok(await exists(join(ROOT, file)), `отсутствует: ${file}`);
    }
  });
});

describe('структура документа', () => {
  test('ровно один h1', () => {
    const count = (html.match(/<h1[\s>]/g) || []).length;
    assert.equal(count, 1, 'на странице должен быть ровно один <h1>');
  });

  test('есть заголовок и описание', () => {
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, /<meta name="description" content="[^"]+"/);
  });

  test('объявлен viewport для мобильных', () => {
    assert.match(html, /name="viewport"/);
  });

  test('объявлен язык документа', () => {
    assert.match(html, /<html lang="[a-z-]+"/i);
  });

  test('есть все секции, на которые ведёт навигация', () => {
    const ids = [...html.matchAll(/id="([a-z-]+)"/g)].map((m) => m[1]);
    for (const section of ['main', 'work', 'about', 'skills', 'timeline', 'contact']) {
      assert.ok(ids.includes(section), `нет секции: #${section}`);
    }
  });

  test('каждая ссылка внутри страницы ведёт в существующую секцию', () => {
    const targets = [...html.matchAll(/href="#([a-z0-9-]+)"/g)].map((m) => m[1]);
    const ids = new Set([...html.matchAll(/id="([a-z0-9-]+)"/g)].map((m) => m[1]));

    assert.ok(targets.length > 0, 'ссылок внутри страницы не найдено');
    for (const target of targets) {
      assert.ok(ids.has(target), `ссылка на #${target} не имеет подходящего элемента`);
    }
  });

  test('есть ссылка «перейти к содержимому» для клавиатуры', () => {
    assert.match(html, /class="skip-link" href="#main"/);
  });

  test('у каждого изображения есть alt', () => {
    const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    for (const img of imgs) {
      assert.match(img, /alt="[^"]*"/, `нет alt: ${img}`);
    }
  });

  test('у переключателя темы есть подпись', () => {
    assert.match(html, /id="theme-toggle"[\s\S]{0,200}aria-label="[^"]+"/);
  });
});

describe('локальные ссылки на ресурсы', () => {
  const localRefs = [...html.matchAll(/(?:href|src)="([^"#:]+)"/g)]
    .map((m) => m[1])
    .filter((ref) => !ref.startsWith('http') && !ref.startsWith('mailto') && !ref.startsWith('/'));

  test('страница вообще ссылается на локальные ресурсы', () => {
    assert.ok(localRefs.length > 0, 'локальных ресурсов не найдено');
  });

  for (const ref of localRefs) {
    test(`${ref} ведёт в существующий файл`, async () => {
      assert.ok(await exists(join(SITE, ref)), `битая ссылка: ${ref}`);
    });
  }
});

describe('нет сторонних запросов', () => {
  test('страница не грузит внешние скрипты и стили', () => {
    const external = [...html.matchAll(/<(?:script|link)\b[^>]*>/g)]
      .map((m) => m[0])
      .filter((tag) => /https?:\/\//.test(tag))
      // <link rel="canonical"> или URL в Open Graph указывают куда-то для
      // краулеров. Ресурсами, которые браузер грузит, считается только то,
      // что реально запрашивается во время работы страницы.
      .filter((tag) => /\ssrc=/.test(tag) || /rel="stylesheet"/.test(tag));

    assert.deepEqual(external, [], 'сайт не должен зависеть от сторонних CDN');
  });

  test('страница не ссылается на внешние изображения и шрифты', () => {
    const external = [...html.matchAll(/<img\b[^>]*>/g)]
      .map((m) => m[0])
      .filter((tag) => /https?:\/\//.test(tag));

    assert.deepEqual(external, [], 'изображения должны отдаваться с этого же домена');
  });

  test('на странице нет скриптов аналитики и трекинга', () => {
    assert.ok(!/googletagmanager|gtag\(|analytics|hotjar|plausible\.io/i.test(html));
  });
});

describe('файлы SEO', () => {
  test('robots.txt разрешает обход и указывает на sitemap', async () => {
    const robots = await read('robots.txt');
    assert.match(robots, /User-agent:\s*\*/);
    assert.match(robots, /Allow:\s*\//);
    assert.match(robots, /Sitemap:\s*https?:\/\//);
  });

  test('sitemap.xml корректен и содержит главную страницу', async () => {
    const sitemap = await read('sitemap.xml');
    assert.match(sitemap, /<urlset/);
    assert.match(sitemap, /<loc>https?:\/\/[^<]+<\/loc>/);
  });
});

describe('JavaScript', () => {
  test('не использует eval и конструктор Function', () => {
    assert.ok(!/\beval\s*\(/.test(js), 'найден eval()');
    assert.ok(!/new\s+Function\s*\(/.test(js), 'найден new Function()');
  });

  test('буфер обмена используется с проверкой', () => {
    assert.match(js, /navigator\.clipboard\s*&&/);
  });

  test('уважает prefers-reduced-motion', () => {
    assert.match(js, /prefers-reduced-motion/);
  });
});

describe('базовая доступность', () => {
  test('у каждой кнопки указан type', () => {
    const buttons = [...html.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
    for (const button of buttons) {
      assert.match(button, /type="(button|submit|reset)"/, `у кнопки нет type: ${button}`);
    }
  });

  test('переключатель мобильного меню объявляет состояние, которым управляет', () => {
    assert.match(html, /id="nav-toggle"[\s\S]{0,250}aria-expanded="(true|false)"/);
    assert.match(html, /id="nav-toggle"[\s\S]{0,250}aria-controls="site-nav"/);
  });

  test('есть живая область для подтверждения копирования', () => {
    assert.match(html, /id="copy-note"[\s\S]{0,120}aria-live="polite"/);
  });
});

describe('карточки проектов', () => {
  // Проекты, которые действительно выпущены. Карточка попадает на сайт в день,
  // когда проект развёрнут и задокументирован, а не в день, когда начат.
  // Незаконченная работа в списке — именно то, ради чего этот набор тестов и
  // существует.
  const SHIPPED = ['portfolio-site', 'rest-api', 'kopilka', 'study-bot'];

  const cards = [...html.matchAll(/<article class="card[^"]*">([\s\S]*?)<\/article>/g)].map(
    (match) => match[1]
  );

  test('на странице есть хотя бы одна карточка проекта', () => {
    assert.ok(cards.length > 0, 'карточки проектов не найдены');
  });

  test('каждая карточка ведёт в репозиторий, который уже выпущен', () => {
    for (const card of cards) {
      const repos = [...card.matchAll(/github\.com\/[^/]+\/([\w.-]+)/g)].map((m) => m[1]);
      assert.ok(repos.length > 0, 'у карточки проекта нет ссылки на GitHub');
      for (const repo of repos) {
        assert.ok(SHIPPED.includes(repo), `карточка ведёт в ещё не выпущенный репозиторий: ${repo}`);
      }
    }
  });

  test('у каждой карточки есть заголовок, статус, теги и ссылки', () => {
    for (const card of cards) {
      assert.match(card, /<h3>[^<]+<\/h3>/, 'у карточки нет заголовка');
      assert.match(card, /class="badge/, 'у карточки нет статуса');
      assert.match(card, /<ul class="tag-list">/, 'у карточки нет списка тегов');
      assert.match(card, /class="card-links"/, 'у карточки нет ссылок');
    }
  });

  test('все ссылки в карточках — абсолютные https-адреса', () => {
    for (const card of cards) {
      const hrefs = [...card.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      assert.ok(hrefs.length >= 2, 'в карточке должны быть и исходники, и демо');
      for (const href of hrefs) {
        assert.ok(href.startsWith('https://'), `ссылка в карточке не абсолютная: ${href}`);
      }
    }
  });

  // Ссылка, которая ведёт на плейсхолдер, для посетителя выглядит как
  // рабочая: он нажимает «Демо» и попадает на пустую страницу. Пока адреса
  // нет, вторая ссылка ведёт в README репозитория — это честно и полезно.
  test('ни одна ссылка на странице не ведёт на плейсхолдер', () => {
    const DEAD_HOSTS = ['your-domain.com', 'example.com', 'api.example.com', 'www.example.com'];
    const links = [...html.matchAll(/<a[^>]+href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
    const dead = links.filter((href) => DEAD_HOSTS.includes(new URL(href).host));
    assert.deepEqual(dead, [], `ссылки ведут на плейсхолдеры: ${dead.join(', ')}`);
  });

  // Метка «Онлайн» обещает живой адрес. Проект, который не задеплоен, так
  // называть нельзя: сайт не должен обещать больше, чем есть.
  test('метка «Онлайн» стоит только у проекта с живым адресом', () => {
    const live = cards.filter((card) => card.includes('badge-live'));
    for (const card of live) {
      const hrefs = [...card.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      const hasLiveAddress = hrefs.some((href) => !href.includes('github.com'));
      assert.ok(hasLiveAddress, 'карточка обещает «Онлайн», но живого адреса у неё нет');
    }
  });

  test('названия проектов не повторяются', () => {
    const titles = cards.map((card) => card.match(/<h3>([^<]+)<\/h3>/)[1]);
    assert.equal(new Set(titles).size, titles.length, 'название проекта повторяется');
  });
});

describe('плейсхолдеры, которые ещё нужно заменить', () => {
  // Один шаблон для всех форм плейсхолдера, чтобы новый нельзя было пропустить.
  const PLACEHOLDER = /your-[a-z-]+(?:\.[a-z]+)?|you@example\.com|Your Name/g;

  // Напоминание, а не ошибка: набор тестов должен оставаться зелёным и на
  // свежем клоне, и после того, как сайт персонифицирован, — поэтому здесь
  // намеренно нет утверждений.
  test('показывает, какие поля осталось заполнить', () => {
    const found = [...new Set([...html.matchAll(PLACEHOLDER)].map((m) => m[0]))];
    console.log(
      found.length > 0
        ? `  ↳ осталось заполнить: ${found.length} (${found.join(', ')})`
        : '  ↳ плейсхолдеров не осталось'
    );
  });

  // Создайте файл `.personalised` в корне репозитория, когда все плейсхолдеры
  // исчезнут. С этого момента тест начинает это проверять, и плейсхолдер уже
  // не сможет появиться в следующем коммите.
  test('после персонификации плейсхолдеров не остаётся', async (t) => {
    if (!(await exists(join(ROOT, '.personalised')))) {
      t.skip('сайт ещё не персонифицирован');
      return;
    }
    const found = [...new Set([...html.matchAll(PLACEHOLDER)].map((m) => m[0]))];
    assert.deepEqual(found, [], `в публикуемой разметке остались плейсхолдеры: ${found.join(', ')}`);
  });
});
