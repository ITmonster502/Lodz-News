document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  updateAuthUI();
  initTheme();
  loadCategories();
  initWeatherAndClock();
  initLanguage();
  
  const urlParams = new URLSearchParams(window.location.search);
  const categoryId = urlParams.get('category');
  const searchQuery = urlParams.get('search');

  if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
    loadArticles(categoryId, searchQuery);
    loadTrending();
  }
  
  setupSearch();
}

function mediaHtml(imageUrl, alt, label, kind) {
  const safeAlt = (alt || '').replace(/"/g, '&quot;');
  const safeLabel = (label || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeKind = (kind || '').replace(/"/g, '&quot;');
  const displayLabel = safeLabel ? `${safeLabel} · Łódź News` : 'Łódź News';

  if (!imageUrl) {
    return `
      <div class="media is-fallback" data-kind="${safeKind}">
        <div class="img-fallback">
          <div class="img-fallback-label">${displayLabel}</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="media" data-kind="${safeKind}">
      <img src="${imageUrl}" alt="${safeAlt}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('is-fallback'); var p=this.closest('.featured-image-premium'); if(p) p.classList.add('featured-fallback'); this.style.display='none';">
      <div class="img-fallback">
        <div class="img-fallback-label">${displayLabel}</div>
      </div>
    </div>
  `;
}

function normalizeUrlForCompare(u) {
  try {
    const url = new URL(u);
    url.hash = '';
    url.search = '';
    return url.toString().toLowerCase();
  } catch {
    return String(u || '').trim().toLowerCase();
  }
}

async function loadTrending() {
  const trending = await getTrendingArticles();
  const list = document.getElementById('trending-list');
  const lang = localStorage.getItem('lang') || 'pl';
  
  if (list && trending) {
    await enrichCategoryNames(trending, lang);
    // Translation for trending
    const toTranslate = trending.map(art => shouldTranslateForUi(art.title, lang));
    if (toTranslate.some(Boolean) && trending.length > 0) {
      const translatedTitles = await Promise.all(trending.map((art, i) => toTranslate[i] ? translateText(art.title, lang) : art.title));
      trending.forEach((art, i) => art.translatedTitle = translatedTitles[i]);
    }

    list.innerHTML = trending.map((art, index) => `
      <div class="trending-item" style="display: flex; gap: 15px; margin-bottom: 20px; align-items: flex-start;">
        <span style="font-size: 1.5rem; font-weight: 700; color: var(--border); font-family: var(--font-serif);">${index + 1}</span>
        <div>
          <span class="card-category" style="font-size: 0.65rem; margin-bottom: 5px;">${art.category.displayName || art.category.name}</span>
          <h4 style="font-size: 1rem; line-height: 1.3; font-family: var(--font-serif);">
            <a href="article.html?id=${art._id}" style="text-decoration: none; color: var(--text);">${art.translatedTitle || art.title}</a>
          </h4>
        </div>
      </div>
    `).join('');
  }
}

// Language management
const translations = {
  pl: {
    latest_news: "Najnowsze Wiadomości",
    search_placeholder: "Szukaj...",
    no_articles: "Brak dodatkowych wiadomości",
    become_editor: "Zostań redaktorem i dodaj pierwszy post!",
    read_more: "Czytaj więcej",
    login: "Zaloguj",
    logout: "Wyloguj",
    admin_panel: "PANEL ADM",
    site_info_title: "O serwisie",
    site_info_kicker: "Łódź w jednym miejscu",
    site_info_content: "Łódź News to nowoczesny portal informacyjny, który zbiera najważniejsze wydarzenia z Łodzi i regionu. Codziennie publikujemy aktualności z życia miasta, sportu, kultury, biznesu oraz technologii. Dzięki czytelnemu podziałowi na kategorie szybko znajdziesz interesujące Cię tematy, a moduł wyszukiwania pomoże dotrzeć do konkretnych informacji.",
    site_info_features_title: "Co znajdziesz",
    site_info_features: [
      "Wiadomości lokalne i najważniejsze tematy dnia",
      "Sport, kultura, technologia, biznes, muzyka i filmy",
      "Najnowsze wpisy oraz sekcję trending",
      "Wygodny tryb jasny/ciemny i wybór języka",
      "Szybkie filtrowanie po kategoriach i wyszukiwanie"
    ]
  },
  en: {
    latest_news: "Latest News",
    search_placeholder: "Search...",
    no_articles: "No additional news",
    become_editor: "Become an editor and add the first post!",
    read_more: "Read more",
    login: "Login",
    logout: "Logout",
    admin_panel: "ADMIN PANEL",
    site_info_title: "About",
    site_info_kicker: "Łódź in one place",
    site_info_content: "Łódź News is a modern news portal that brings together the most important stories from Łódź and the region. We publish updates on local events, sports, culture, business and technology. With clear categories you can quickly find topics you care about, and search helps you reach specific information.",
    site_info_features_title: "What you’ll find",
    site_info_features: [
      "Local news and key stories of the day",
      "Sports, culture, tech, business, music and movies",
      "Latest posts and a trending section",
      "Light/dark mode and language switch",
      "Fast category filtering and search"
    ]
  },
  ru: {
    latest_news: "Последние Новости",
    search_placeholder: "Поиск...",
    no_articles: "Нет дополнительных новостей",
    become_editor: "Станьте редактором и добавьте первый пост!",
    read_more: "Читать далее",
    login: "Войти",
    logout: "Выйти",
    admin_panel: "АДМИН ПАНЕЛЬ",
    site_info_title: "О сайте",
    site_info_kicker: "Лодзь в одном месте",
    site_info_content: "Łódź News — это современный новостной портал, который собирает самые важные события Лодзи и региона. Мы публикуем обновления о жизни города, спорте, культуре, бизнесе и технологиях. Удобные категории помогают быстро находить нужные темы, а поиск — переходить к конкретной информации.",
    site_info_features_title: "Что здесь есть",
    site_info_features: [
      "Локальные новости и главные темы дня",
      "Спорт, культура, технологии, бизнес, музыка и фильмы",
      "Свежие публикации и блок trending",
      "Светлая/тёмная тема и выбор языка",
      "Фильтры по категориям и быстрый поиск"
    ]
  }
};

function initLanguage() {
  const switcher = document.getElementById('language-switcher');
  const savedLang = localStorage.getItem('lang') || 'pl';
  
  if (switcher) {
    switcher.value = savedLang;
    switcher.addEventListener('change', (e) => {
      localStorage.setItem('lang', e.target.value);
      location.reload();
    });
  }
  
  applyTranslations(savedLang);
}

async function translateText(text, targetLang) {
  if (!text) return text;
  try {
    const key = `tr:${targetLang}:${hashString(text)}`;
    try {
      const cached = localStorage.getItem(key);
      if (cached) return cached;
    } catch {}

    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`);
    const data = await res.json();
    const out = data[0].map(item => item[0]).join('');
    try { localStorage.setItem(key, out); } catch {}
    return out;
  } catch (err) {
    console.error('Translation error:', err);
    return text;
  }
}

function hashString(str) {
  const s = String(str || '');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

function stripHtml(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function textToParagraphsHtml(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  const paras = t.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const out = (paras.length ? paras : [t]).slice(0, 12);
  return out.map(p => `<p>${escapeHtml(p)}</p>`).join('');
}

function safeHostname(url) {
  try {
    if (!url) return '';
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

const CATEGORY_I18N = {
  'Новости': { pl: 'Wiadomości', en: 'News', ru: 'Новости' },
  'Спорт': { pl: 'Sport', en: 'Sport', ru: 'Спорт' },
  'Культура': { pl: 'Kultura', en: 'Culture', ru: 'Культура' },
  'Технологии': { pl: 'Technologie', en: 'Technology', ru: 'Технологии' },
  'Бизнес': { pl: 'Biznes', en: 'Business', ru: 'Бизнес' },
  'Музыка': { pl: 'Muzyka', en: 'Music', ru: 'Музыка' },
  'Фильмы': { pl: 'Filmy', en: 'Movies', ru: 'Фильмы' }
};

function isCyrillic(text) {
  return /[А-Яа-яЁё]/.test(String(text || ''));
}

function localizeKnownCategory(name, lang) {
  const key = String(name || '');
  const entry = CATEGORY_I18N[key];
  if (!entry) return null;
  return entry[lang] || entry.ru || key;
}

async function getCategoryDisplayName(name, lang) {
  const known = localizeKnownCategory(name, lang);
  if (known) return known;
  if (lang === 'ru') return name;
  if (isCyrillic(name)) return await translateText(name, lang);
  if (lang === 'pl' && looksLikeEnglish(name)) return await translateText(name, lang);
  return name;
}

async function enrichCategoryNames(items, lang) {
  if (!Array.isArray(items) || items.length === 0) return;
  const unique = [...new Set(items.map(a => a?.category?.name).filter(Boolean))];
  if (unique.length === 0) return;
  const pairs = await Promise.all(unique.map(async (n) => [n, await getCategoryDisplayName(n, lang)]));
  const map = new Map(pairs);
  items.forEach(a => {
    if (a && a.category && a.category.name) {
      a.category.displayName = map.get(a.category.name) || a.category.name;
    }
  });
}

function looksLikeEnglish(text) {
  const t = String(text || '').toLowerCase();
  if (t.length < 20) return false;
  if (/[ąćęłńóśźż]/i.test(t)) return false;
  if (!/^[\x00-\x7F\s\p{P}]+$/u.test(t)) return false;
  return /\b(the|and|of|to|in|for|on|with|as|from|by|at|an|a)\b/.test(t);
}

function shouldTranslateForUi(text, targetLang) {
  if (!text) return false;
  if (targetLang === 'pl') return looksLikeEnglish(text);
  return true;
}

function applyTranslations(lang) {
  const t = translations[lang];
  const latestNewsTitle = document.querySelector('.latest-news .section-title');
  if (latestNewsTitle) latestNewsTitle.textContent = t.latest_news;
  
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.placeholder = t.search_placeholder;

  const siteInfoTitle = document.getElementById('site-info-title');
  if (siteInfoTitle) siteInfoTitle.textContent = t.site_info_title;

  const siteInfoKicker = document.getElementById('site-info-kicker');
  if (siteInfoKicker) siteInfoKicker.textContent = t.site_info_kicker;

  const siteInfoContent = document.getElementById('site-info-content');
  if (siteInfoContent) siteInfoContent.textContent = t.site_info_content;

  const siteInfoFeaturesTitle = document.getElementById('site-info-features-title');
  if (siteInfoFeaturesTitle) siteInfoFeaturesTitle.textContent = t.site_info_features_title;

  const siteInfoFeatures = document.getElementById('site-info-features');
  if (siteInfoFeatures && Array.isArray(t.site_info_features)) {
    siteInfoFeatures.innerHTML = t.site_info_features.map(item => `<li>${item}</li>`).join('');
  }
}

// Weather and Clock
function initWeatherAndClock() {
  const timeEl = document.getElementById('lodz-time');
  const dateEl = document.getElementById('lodz-date');
  const weatherEl = document.getElementById('lodz-weather');

  if (!timeEl || !dateEl) return;

  function updateClock() {
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    dateEl.textContent = now.toLocaleDateString('pl-PL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  setInterval(updateClock, 1000);
  updateClock();

  async function fetchWeather() {
    try {
      const res = await fetch('https://wttr.in/Lodz?format=%C+%t');
      if (res.ok) {
        const text = await res.text();
        weatherEl.textContent = `Łódź: ${text}`;
      } else {
        weatherEl.textContent = 'Погода временно недоступна';
      }
    } catch (err) {
      weatherEl.textContent = 'Ошибка загрузки погоды';
    }
  }
  
  fetchWeather();
  setInterval(fetchWeather, 600000);
}

// Theme management
function initTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.body.setAttribute('data-theme', savedTheme);
  themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

  themeToggle.addEventListener('click', () => {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
  });
}

// Data loading
async function loadCategories() {
  const categories = await getCategories();
  const nav = document.getElementById('category-nav');
  const lang = localStorage.getItem('lang') || 'pl';
  if (nav && categories) {
    // Keep Home link
    nav.innerHTML = `<li><a href="index.html">${lang === 'en' ? 'Home' : (lang === 'ru' ? 'Главная' : 'Strona Główna')}</a></li>`;
    const translated = await Promise.all(categories.map(async (cat) => ({
      ...cat,
      displayName: await getCategoryDisplayName(cat.name, lang)
    })));
    translated.forEach(cat => {
      const li = document.createElement('li');
      li.innerHTML = `<a href="index.html?category=${cat._id}">${cat.displayName || cat.name}</a>`;
      nav.appendChild(li);
    });
  }
}

async function loadArticles(categoryId = null, search = '') {
  let query = '';
  if (categoryId) query += `?category=${categoryId}`;
  if (search) query += (query ? '&' : '?') + `search=${search}`;
  
  const articles = await getArticles(query);
  const grid = document.getElementById('articles-grid');
  const hero = document.getElementById('hero-section');
  const heroWrapper = document.querySelector('.hero');
  const latestNewsTitle = document.querySelector('.latest-news .section-title');
  const lang = localStorage.getItem('lang') || 'pl';
  const t = translations[lang];
  
  // Clear previous content
  if (grid) grid.innerHTML = '';
  if (hero) hero.innerHTML = '';

  if (!articles || articles.length === 0) {
    if (grid) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 100px 20px; background: var(--bg-soft); border-radius: var(--radius); border: 1px dashed var(--border);">
          <div style="font-size: 3rem; margin-bottom: 20px;">🔍</div>
          <h3 style="font-family: var(--font-serif); font-size: 1.8rem; margin-bottom: 10px;">
            ${lang === 'en' ? 'No results found' : (lang === 'ru' ? 'Ничего не найдено' : 'Nie znaleziono wyników')}
          </h3>
          <p style="color: var(--text-muted);">
            ${lang === 'en' ? 'Try adjusting your search or category filter' : (lang === 'ru' ? 'Попробуйте изменить поисковый запрос или фильтр категорий' : 'Spróbuj zmienić zapytanie lub filtr kategorii')}
          </p>
        </div>
      `;
    }
    // Hide hero section and latest news title when no results found
    if (heroWrapper && search) heroWrapper.style.display = 'none';
    if (latestNewsTitle && search) latestNewsTitle.style.display = 'none';
    return;
  }

  // Restore visibility if hidden previously
  if (heroWrapper) heroWrapper.style.display = 'grid';
  if (latestNewsTitle) latestNewsTitle.style.display = 'inline-block';

  await enrichCategoryNames(articles, lang);

  const isHome = !categoryId && !search;
  const shouldUseHero = hero && isHome && articles.length > 1;

  // Hero Section (only on homepage, only if we have more than 1 article)
  if (shouldUseHero) {
    const mainArt = articles[0];

    // Hero Translation
    let title = mainArt.title;
    let excerpt = mainArt.excerpt || stripHtml(mainArt.content).substring(0, 150);

    if (shouldTranslateForUi(title, lang)) {
      title = await translateText(title, lang);
    }
    if (shouldTranslateForUi(excerpt, lang)) {
      excerpt = await translateText(excerpt, lang);
    }

    hero.innerHTML = `
      <div class="hero-main">
        ${mediaHtml(mainArt.featured_image, mainArt.title, mainArt.category?.displayName || mainArt.category?.name, mainArt.category?.name)}
        <div class="hero-content">
          <span class="card-category">${mainArt.category.displayName || mainArt.category.name}</span>
          <h1><a href="article.html?id=${mainArt._id}" style="color:white; text-decoration:none;">${title}</a></h1>
          <p>${excerpt}...</p>
          <a href="article.html?id=${mainArt._id}" class="btn-primary" style="margin-top: 20px;">${t.read_more}</a>
        </div>
      </div>
    `;
    heroWrapper.style.display = 'grid';
  } else if (heroWrapper) {
    heroWrapper.style.display = 'none';
  }

  if (grid) {
    const displayArticles = shouldUseHero ? articles.slice(1) : articles;
    
    // Grid Translation (only titles for performance)
    if (displayArticles.length > 0) {
      const toTranslate = displayArticles.map(art => shouldTranslateForUi(art.title, lang));
      if (toTranslate.some(Boolean)) {
        const translatedTitles = await Promise.all(displayArticles.map((art, i) => toTranslate[i] ? translateText(art.title, lang) : art.title));
        displayArticles.forEach((art, i) => art.translatedTitle = translatedTitles[i]);
      }
    }

    if (displayArticles.length === 0 && !search) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 50px; background: var(--bg-soft); border-radius: var(--radius); border: 1px dashed var(--border);">
          <h3 style="font-family: var(--font-serif); margin-bottom: 10px;">${t.no_articles}</h3>
          <p style="color: var(--text-muted);">${t.become_editor}</p>
        </div>
      `;
    } else {
      grid.innerHTML = displayArticles.map(art => `
      <div class="card ${art.featured_image ? 'has-media' : 'card--no-media'}">
        ${art.featured_image ? mediaHtml(art.featured_image, art.title, art.category?.displayName || art.category?.name, art.category?.name) : ''}
        <div class="card-body">
          <span class="card-category">${art.category.displayName || art.category.name}</span>
          <h3 class="card-title"><a href="article.html?id=${art._id}" style="text-decoration:none; color:inherit;">${art.translatedTitle || art.title}</a></h3>
          <p>${stripHtml(art.excerpt || art.content).substring(0, 260)}...</p>
          ${safeHostname(art.source_link) ? `<div style="font-size:0.8rem; opacity:0.75; margin-top: 10px;">Źródło: ${safeHostname(art.source_link)}</div>` : ''}
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px;">
            <div style="font-size:0.8rem; opacity:0.7;">
              ${new Date(art.published_date).toLocaleDateString()} | ${art.author.username}
            </div>
            <a href="article.html?id=${art._id}" style="color: var(--primary); font-weight: 600; text-decoration: none; font-size: 0.9rem;">${t.read_more} →</a>
          </div>
        </div>
      </div>
    `).join('');
    }
  }
}

async function loadRelatedArticles(categoryId, currentId) {
  const articles = await getArticles(`?category=${categoryId}`);
  const grid = document.getElementById('related-grid');
  const lang = localStorage.getItem('lang') || 'pl';
  if (grid && articles) {
    await enrichCategoryNames(articles, lang);
    const related = articles.filter(a => a._id !== currentId).slice(0, 3);
    if (related.length === 0) {
      document.querySelector('.related-articles').style.display = 'none';
      return;
    }
    const toTranslate = related.map(a => shouldTranslateForUi(a.title, lang));
    if (toTranslate.some(Boolean)) {
      const translatedTitles = await Promise.all(related.map((a, i) => toTranslate[i] ? translateText(a.title, lang) : a.title));
      related.forEach((a, i) => a.translatedTitle = translatedTitles[i]);
    }
    grid.innerHTML = related.map(art => `
      <a href="article.html?id=${art._id}" class="related-card">
        ${mediaHtml(art.featured_image, art.title, art.category?.displayName || art.category?.name, art.category?.name)}
        <h4>${art.translatedTitle || art.title}</h4>
      </a>
    `).join('');
  }
}

async function loadArticle(id) {
  const article = await getArticle(id);
  const container = document.getElementById('article-content');
  const lang = localStorage.getItem('lang') || 'pl';
  
  if (container && article) {
    await enrichCategoryNames([article], lang);
    if (shouldTranslateForUi(article.title, lang)) {
      article.translatedTitle = await translateText(article.title, lang);
    }

    // Add Progress Bar to Body
    if (!document.getElementById('reading-progress')) {
      const pb = document.createElement('div');
      pb.id = 'reading-progress';
      document.body.prepend(pb);
    }

    // Scroll listener for progress
    window.onscroll = () => {
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (winScroll / height) * 100;
      const pb = document.getElementById('reading-progress');
      if (pb) pb.style.width = scrolled + "%";
    };

    // Calculate Read Time (avg 200 words per minute)
    const words = article.content.split(' ').length;
    const readTime = Math.max(1, Math.ceil(words / 200));

    // Premium Translation UI
    if (lang !== 'pl') {
      const translateBox = document.createElement('div');
      translateBox.className = 'translate-container';
      translateBox.style.cssText = `
        margin-bottom: 30px;
        padding: 20px;
        background: var(--bg-soft);
        border-radius: var(--radius);
        border: 1px solid var(--border);
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: var(--shadow);
      `;
      
      const text = lang === 'ru' ? 'Хотите прочитать эту статью на русском?' : 'Want to read this article in English?';
      const btnText = lang === 'ru' ? '✨ Перевести' : '✨ Translate';
      
      translateBox.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px;">
          <span style="font-size: 1.5rem;">🌍</span>
          <span style="font-weight: 500; color: var(--text-muted);">${text}</span>
        </div>
        <button id="auto-translate-btn" class="btn-primary" style="padding: 10px 25px; font-size: 0.9rem;">${btnText}</button>
      `;
      container.prepend(translateBox);
      
      document.getElementById('auto-translate-btn').onclick = async () => {
        const btn = document.getElementById('auto-translate-btn');
        btn.textContent = lang === 'ru' ? '⏳ Перевод...' : '⏳ Translating...';
        btn.disabled = true;
        
        try {
          const translatedTitle = await translateText(article.title, lang);
          const translatedContent = await translateText(article.content, lang);
          
          document.querySelector('.article-header-premium h1').textContent = translatedTitle;
          document.querySelector('.article-body-content').innerHTML = translatedContent;
          translateBox.style.display = 'none';
        } catch (err) {
          btn.textContent = '❌ Error';
          btn.disabled = false;
        }
      };
    }

    container.innerHTML += `
      <div class="article-container ${article.featured_image ? '' : 'no-featured'}">
        <header class="article-header-premium">
          <span class="card-category">${article.category.displayName || article.category.name}</span>
          <h1>${article.translatedTitle || article.title}</h1>
          <div class="article-meta-premium">
            <span>👤 ${article.author.username}</span>
            <span>📅 ${new Date(article.published_date).toLocaleDateString(lang === 'en' ? 'en-US' : (lang === 'ru' ? 'ru-RU' : 'pl-PL'), { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            <span>⏱️ ${readTime} min ${lang === 'en' ? 'read' : (lang === 'ru' ? 'чтения' : 'czytania')}</span>
            <span>👁️ ${article.views + 1} ${lang === 'en' ? 'views' : (lang === 'ru' ? 'просмотров' : 'wyświetleń')}</span>
          </div>
        </header>
        ${article.featured_image ? `
          <div class="featured-image-premium">
            ${mediaHtml(article.featured_image, article.title, article.category?.displayName || article.category?.name, article.category?.name)}
          </div>
        ` : ''}
        <div class="article-body-content">
          ${article.content}
        </div>
        
        <div class="related-articles">
          <h3 class="section-title" style="font-size: 1.5rem;">${lang === 'en' ? 'Related Stories' : (lang === 'ru' ? 'Похожие материалы' : 'Podobne historie')}</h3>
          <div id="related-grid" class="related-grid">
            <!-- Loaded dynamically -->
          </div>
        </div>

        <div class="share-buttons" style="margin-top: 50px; padding-top: 20px; border-top: 1px solid var(--border); display: flex; gap: 15px; align-items: center; justify-content: center;">
          <span style="font-weight: 600;">${lang === 'en' ? 'Share:' : (lang === 'ru' ? 'Поделиться:' : 'Udostępnij:')}</span>
          <button onclick="window.open('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(window.location.href))" style="background: #1877f2; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: 600;">Facebook</button>
          <button onclick="window.open('https://twitter.com/intent/tweet?url='+encodeURIComponent(window.location.href))" style="background: #1da1f2; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: 600;">Twitter</button>
          <button onclick="navigator.clipboard.writeText(window.location.href); alert('${lang === 'en' ? 'Link copied!' : (lang === 'ru' ? 'Ссылка скопирована!' : 'Link skopiowany!')}')" style="background: var(--secondary); color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: 600;">Copy Link</button>
        </div>
      </div>
    `;
    document.title = `${article.title} - Łódź News`;
    
    loadRelatedArticles(article.category._id, article._id);

    if (lang === 'pl' && shouldTranslateForUi(stripHtml(article.content), 'pl')) {
      const translateBox = document.createElement('div');
      translateBox.className = 'translate-container';
      translateBox.style.cssText = `
        margin-bottom: 30px;
        padding: 20px;
        background: var(--bg-soft);
        border-radius: var(--radius);
        border: 1px solid var(--border);
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: var(--shadow);
      `;
      translateBox.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px;">
          <span style="font-size: 1.5rem;">🌍</span>
          <span style="font-weight: 500; color: var(--text-muted);">Tłumaczymy ten artykuł na polski…</span>
        </div>
        <button id="auto-translate-btn-pl" class="btn-primary" style="padding: 10px 25px; font-size: 0.9rem;" disabled>⏳ Tłumaczenie…</button>
      `;
      container.prepend(translateBox);

      try {
        const translatedTitle = await translateText(article.title, 'pl');
        const titleEl = document.querySelector('.article-header-premium h1');
        if (titleEl) titleEl.textContent = translatedTitle;

        const bodyEl = document.querySelector('.article-body-content');
        if (bodyEl) {
          const sourceBox = bodyEl.querySelector('.article-source-box');
          const sourceClone = sourceBox ? sourceBox.cloneNode(true) : null;
          if (sourceBox) sourceBox.remove();

          const plain = stripHtml(bodyEl.innerHTML);
          const translatedBody = await translateText(plain, 'pl');
          bodyEl.innerHTML = textToParagraphsHtml(translatedBody);
          if (sourceClone) bodyEl.appendChild(sourceClone);
        }

        translateBox.style.display = 'none';
      } catch (err) {
        const btn = document.getElementById('auto-translate-btn-pl');
        if (btn) {
          btn.textContent = '✨ Tłumacz';
          btn.disabled = false;
          btn.onclick = () => location.reload();
        }
      }
    }

    try {
      const body = document.querySelector('.article-body-content');
      if (body && article.featured_image) {
        const target = normalizeUrlForCompare(article.featured_image);
        const imgs = Array.from(body.querySelectorAll('img'));
        let removed = 0;
        imgs.forEach(img => {
          if (normalizeUrlForCompare(img.src) === target) {
            img.remove();
            removed++;
          }
        });
        if (removed === 0 && imgs.length > 0) imgs[0].remove();
      }
    } catch {}
    
    // ... SEO and JSON-LD logic remains same ...

    
    // SEO Update
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', article.excerpt || article.content.substring(0, 160));
    
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', article.title);
    
    const ogImg = document.querySelector('meta[property="og:image"]');
    if (ogImg) ogImg.setAttribute('content', article.featured_image || (window.location.origin + '/assets/placeholder.svg'));

    // JSON-LD Structured Data
    let script = document.getElementById('article-json-ld');
    if (!script) {
      script = document.createElement('script');
      script.id = 'article-json-ld';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": article.title,
      "image": [article.featured_image || (window.location.origin + '/assets/placeholder.svg')],
      "datePublished": article.published_date,
      "author": [{
        "@type": "Person",
        "name": article.author.username
      }]
    };
    script.text = JSON.stringify(jsonLd);
  }
}

async function loadComments(articleId) {
  const comments = await getComments(articleId);
  const list = document.getElementById('comments-list');
  const formContainer = document.getElementById('comment-form-container');
  const user = getUser();

  if (list && comments) {
    list.innerHTML = comments.length ? comments.map(c => `
      <div class="comment" style="border-bottom:1px solid var(--border-color); padding:15px 0;">
        <strong>${c.user.username}</strong> <small style="opacity:0.6;">${new Date(c.created_at).toLocaleString()}</small>
        <p>${c.content}</p>
      </div>
    `).join('') : '<p>Brak komentarzy. Bądź pierwszy!</p>';
  }

  if (formContainer) {
    if (user) {
      formContainer.innerHTML = `
        <div class="form-group" style="margin-top:30px;">
          <textarea id="comment-text" class="form-control" style="width:100%; height:100px; padding:10px; border-radius:5px; border:1px solid var(--border-color); background:var(--card-bg); color:var(--text-color);" placeholder="Dodaj komentarz..."></textarea>
          <button id="submit-comment" class="btn-primary" style="margin-top:10px; width:auto;">Wyślij</button>
        </div>
      `;
      document.getElementById('submit-comment').onclick = async () => {
        const text = document.getElementById('comment-text').value;
        if (text) {
          const res = await postComment({ article: articleId, content: text }, user.token);
          if (res) {
            alert('Komentarz wysłany do moderacji!');
            document.getElementById('comment-text').value = '';
          }
        }
      };
    } else {
      formContainer.innerHTML = '<p style="margin-top:30px;"><a href="login.html">Zaloguj się</a>, aby dodać komentarz.</p>';
    }
  }
}

function setupSearch() {
  const input = document.getElementById('search-input');
  if (input) {
    let debounceTimer;
    input.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const query = e.target.value;
        if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
          const urlParams = new URLSearchParams(window.location.search);
          const categoryId = urlParams.get('category');
          loadArticles(categoryId, query);
        }
      }, 500);
    });

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const query = input.value;
        window.location.href = `index.html?search=${query}`;
      }
    });
  }
}
