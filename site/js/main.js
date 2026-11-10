/* ==========================================================================
   Сайт-портфолио — поведение
   --------------------------------------------------------------------------
   Без зависимостей, без сборки, без аналитики. Каждая возможность деградирует
   корректно: если этот файл не загрузится, страница всё равно читается.

   Возможности:
     1. Переключение темы (auto -> light -> dark), выбор сохраняется в localStorage
     2. Переключатель мобильного меню
     3. Анимация появления при прокрутке (уважает prefers-reduced-motion)
     4. Кнопка «Скопировать почту»
     5. Текущий год в подвале
   ========================================================================== */

(function () {
  'use strict';

  var root = document.documentElement;

  /* ------------------------------------------------------------------
     1. Тема
     ------------------------------------------------------------------
     Сохранённый выбор важнее. «auto» означает: следовать системе.
     Начальное значение применяет встроенный скрипт в <head> до первой
     отрисовки, поэтому вспышки неверной темы не бывает.
     ------------------------------------------------------------------ */

  var THEME_KEY = 'theme';
  var ORDER = ['auto', 'light', 'dark'];
  var LABEL = {
    auto: 'Тема: как в системе (нажмите для светлой)',
    light: 'Тема: светлая (нажмите для тёмной)',
    dark: 'Тема: тёмная (нажмите для системной)'
  };

  function readTheme() {
    try {
      var saved = localStorage.getItem(THEME_KEY);
      return ORDER.indexOf(saved) !== -1 ? saved : 'auto';
    } catch (e) {
      return 'auto';
    }
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    var button = document.getElementById('theme-toggle');
    if (button) {
      button.setAttribute('aria-label', LABEL[theme]);
      button.setAttribute('title', LABEL[theme]);
    }
  }

  applyTheme(readTheme());

  var themeButton = document.getElementById('theme-toggle');
  if (themeButton) {
    themeButton.addEventListener('click', function () {
      var next = ORDER[(ORDER.indexOf(root.getAttribute('data-theme')) + 1) % ORDER.length];
      applyTheme(next);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch (e) { /* хранилище недоступно: тема просто не сохранится */ }
    });
  }

  /* ------------------------------------------------------------------
     2. Мобильная навигация
     ------------------------------------------------------------------ */

  var navToggle = document.getElementById('nav-toggle');
  var nav = document.getElementById('site-nav');

  if (navToggle && nav) {
    // Изначально скрыто только на маленьких экранах; на широких меню видно всегда.
    var wide = window.matchMedia('(min-width: 821px)');

    function syncNav() {
      if (wide.matches) {
        nav.hidden = false;
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'Открыть меню');
      } else {
        nav.hidden = true;
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'Открыть меню');
      }
    }

    // Сообщаем стилям, что переключатель уже подключён, чтобы на узких
    // экранах навигация могла стать раскрывающейся панелью.
    root.classList.add('nav-ready');
    syncNav();

    if (typeof wide.addEventListener === 'function') {
      wide.addEventListener('change', syncNav);
    } else if (typeof wide.addListener === 'function') {
      wide.addListener(syncNav);
    }

    navToggle.addEventListener('click', function () {
      var open = navToggle.getAttribute('aria-expanded') === 'true';
      nav.hidden = open;
      navToggle.setAttribute('aria-expanded', String(!open));
      navToggle.setAttribute('aria-label', open ? 'Открыть меню' : 'Закрыть меню');
    });

    // Закрываем меню после выбора раздела (иначе оно закрывает цель перехода).
    nav.addEventListener('click', function (event) {
      if (event.target.tagName === 'A' && !wide.matches) {
        nav.hidden = true;
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'Открыть меню');
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !nav.hidden) {
        nav.hidden = true;
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'Открыть меню');
        navToggle.focus();
      }
    });
  }

  /* ------------------------------------------------------------------
     3. Появление при прокрутке
     ------------------------------------------------------------------
     Элементы один раз проявляются, попадая в область видимости. Элементы,
     уже видимые при загрузке, показываются сразу, чтобы ничего не осталось
     невидимым.
     ------------------------------------------------------------------ */

  var revealables = document.querySelectorAll('.reveal');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function showAll() {
    for (var i = 0; i < revealables.length; i++) {
      revealables[i].classList.add('is-visible');
    }
  }

  if (reduceMotion.matches || !('IntersectionObserver' in window)) {
    showAll();
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    for (var j = 0; j < revealables.length; j++) {
      observer.observe(revealables[j]);
    }

    // Страховка: если что-то пойдёт не так, показываем всё через 3 секунды.
    window.setTimeout(showAll, 3000);
  }

  /* ------------------------------------------------------------------
     4. Копирование почты
     ------------------------------------------------------------------ */

  var copyButton = document.getElementById('copy-email');
  var copyNote = document.getElementById('copy-note');

  if (copyButton && copyNote) {
    copyButton.addEventListener('click', function () {
      var email = copyButton.getAttribute('data-email');

      function done(message) {
        copyNote.textContent = message;
        window.setTimeout(function () { copyNote.textContent = ''; }, 2500);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(function () {
          done('Адрес ' + email + ' скопирован в буфер обмена.');
        }).catch(function () {
          done('Не удалось скопировать автоматически — адрес: ' + email);
        });
      } else {
        done('Буфер обмена недоступен — адрес: ' + email);
      }
    });
  }

  /* ------------------------------------------------------------------
     5. Год в подвале
     ------------------------------------------------------------------ */

  var year = document.getElementById('year');
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }
})();
