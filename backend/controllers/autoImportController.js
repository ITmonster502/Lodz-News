const Parser = require('rss-parser');
const axios = require('axios');
const iconv = require('iconv-lite');
const jschardet = require('jschardet');
const Article = require('../models/Article');
const Category = require('../models/Category');
const User = require('../models/User');
const parser = new Parser();

// Keywords for intelligent classification
const CATEGORY_KEYWORDS = {
  'Спорт': ['sport', 'sports', 'piłka', 'mecz', 'trener', 'liga', 'zawodnik', 'bramka', 'finał', 'tenis', 'skoki', 'stadion', 'olimpijskie', 'football', 'soccer', 'nba', 'nfl', 'f1', 'formula 1', 'grand prix'],
  'Бизнес': ['biznes', 'business', 'gospodarka', 'economy', 'pieniądze', 'giełda', 'inwestycje', 'firma', 'bank', 'podatki', 'rynek', 'euro', 'dolar', 'złoty', 'stock', 'market', 'startup', 'inflation'],
  'Технологии': ['technologie', 'technology', 'tech', 'smartfon', 'iphone', 'android', 'apple', 'google', 'microsoft', 'internet', 'aplikacja', 'ai', 'artificial intelligence', 'sztuczna inteligencja', 'komputer', 'cyber', 'security', 'software', 'hardware'],
  'Культура': ['kultura', 'culture', 'teatr', 'theatre', 'artysta', 'premiera', 'książka', 'wystawa', 'serial', 'festiwal', 'book', 'exhibition'],
  'Музыка': ['muzyka', 'music', 'koncert', 'concert', 'album', 'piosenka', 'song', 'artysta', 'zespół', 'festival', 'tour', 'spotify', 'billboard', 'single'],
  'Фильмы': ['film', 'movie', 'kino', 'cinema', 'serial', 'tv', 'actor', 'aktor', 'director', 'reżyser', 'premiera', 'netflix', 'hbo', 'disney', 'trailer', 'box office']
};

function classifyArticle(title, content) {
  const text = (title + ' ' + content).toLowerCase();
  let bestCategory = 'Новости'; // Default category
  let maxScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    keywords.forEach(keyword => {
      if (text.includes(keyword)) score++;
    });
    
    if (score > maxScore) {
      maxScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}

function normalizeSourceLink(link) {
  if (!link) return '';
  try {
    const u = new URL(link);
    u.hash = '';
    return u.toString();
  } catch {
    return String(link).trim();
  }
}

function extractXmlDeclaredEncoding(xmlStart) {
  if (!xmlStart) return '';
  const m = String(xmlStart).match(/encoding=["']([^"']+)["']/i);
  return m ? m[1] : '';
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function removeImagesAndMedia(html) {
  return String(html || '')
    .replace(/<figure[\s\S]*?<\/figure>/gi, ' ')
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/<video[\s\S]*?<\/video>/gi, ' ')
    .replace(/<audio[\s\S]*?<\/audio>/gi, ' ')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
}

function pickBulletsFromText(text, max) {
  const parts = String(text || '')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length >= 60 && s.length <= 180);
  const out = [];
  for (const s of parts) {
    out.push(s.replace(/^[-•\s]+/, ''));
    if (out.length >= max) break;
  }
  return out;
}

function buildRichContent({ summary, metaLine, bodyText, sourceUrl, sourceLabel }) {
  const safeMeta = metaLine ? `<p style="margin-bottom: 1.2rem; opacity: 0.8;">${metaLine}</p>` : '';
  const bullets = pickBulletsFromText(bodyText, 5);
  const bulletsHtml = bullets.length
    ? `<div style="margin: 1.5rem 0; padding: 18px; background: var(--bg-soft); border: 1px solid var(--border); border-radius: var(--radius);"><div style="font-weight: 800; margin-bottom: 10px;">Najważniejsze:</div><ul style="margin:0; padding-left: 18px; line-height: 1.7;">${bullets.map(b => `<li style="margin-bottom: 8px;">${b}</li>`).join('')}</ul></div>`
    : '';

  const paragraphs = String(bodyText || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const limited = paragraphs.length ? paragraphs : [bodyText];
  const bodyHtml = limited.slice(0, 6).map(p => `<p>${p}</p>`).join('');

  const safeSource = sourceUrl
    ? `<div class="article-source-box" style="margin-top: 40px; padding: 20px; background: var(--bg-soft); border-left: 4px solid var(--primary); border-radius: var(--radius);">
         <p style="margin-bottom: 10px; font-weight: 600; color: var(--text);">🔗 Źródło:</p>
         <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" class="source-link" style="color: var(--primary); text-decoration: none; font-weight: 600;">
           ${sourceLabel || 'Przeczytaj pełny artykuł w oryginalnym źródle'} &rarr;
         </a>
       </div>`
    : '';

  return `
    <p class="article-intro"><strong>Podsumowanie:</strong> ${summary}</p>
    ${safeMeta}
    ${bulletsHtml}
    <div class="article-main-text">
      ${bodyHtml}
    </div>
    ${safeSource}
  `;
}

async function fetchGdeltArticles(query, maxrecords) {
  const res = await axios.get('https://api.gdeltproject.org/api/v2/doc/doc', {
    params: {
      query,
      mode: 'ArtList',
      format: 'json',
      maxrecords,
      sort: 'datedesc'
    },
    timeout: 15000
  });
  return Array.isArray(res.data && res.data.articles) ? res.data.articles : [];
}

const FEED_MAPPING = [
  { url: 'https://tvn24.pl/najwazniejsze.xml' },
  { url: 'https://www.pap.pl/rss.xml' },
  { url: 'https://www.rmf24.pl/fakty/feed' },
  { url: 'https://www.rmf24.pl/ekonomia/feed' },
  { url: 'https://www.money.pl/rss/' },
  { url: 'https://next.gazeta.pl/pub/next/rssnext.htm' },
  { url: 'https://www.tvn24.pl/internet-hi-tech-media,40.xml' },
  { url: 'https://feeds.bbci.co.uk/news/rss.xml' },
  { url: 'https://feeds.bbci.co.uk/sport/rss.xml' },
  { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
  { url: 'https://techcrunch.com/feed/' },
  { url: 'https://www.theverge.com/rss/index.xml' },
  { url: 'https://variety.com/feed/' },
  { url: 'https://www.rollingstone.com/feed/' },
  { url: 'https://rss.gazeta.pl/pub/rss/wiadomosci.xml' },
  { url: 'https://rss.interia.pl/sport' },
  { url: 'https://biznes.interia.pl/feed' },
  { url: 'https://rss.gazeta.pl/pub/rss/kultura.xml' },
  { url: 'https://rss.interia.pl/technologie' },
  { url: 'https://media2.pl/rss/tech.xml' },
  { url: 'https://media2.pl/rss/ai.xml' },
  { url: 'https://media2.pl/rss/rozrywka.xml' },
  { url: 'https://media2.pl/rss/showbiz.xml' },
  { url: 'https://news.google.com/rss/search?q=sport&hl=pl&gl=PL&ceid=PL:pl' },
  { url: 'https://news.google.com/rss/search?q=technologie&hl=pl&gl=PL&ceid=PL:pl' },
  { url: 'https://news.google.com/rss/search?q=muzyka&hl=pl&gl=PL&ceid=PL:pl' },
  { url: 'https://news.google.com/rss/search?q=film%20kino&hl=pl&gl=PL&ceid=PL:pl' },
  { url: 'https://news.google.com/rss/search?q=%C5%81%C3%B3d%C5%BA&hl=pl&gl=PL&ceid=PL:pl' }
];

exports.runAutoImport = async (options = {}) => {
  console.log('--- Starting Intelligent Auto Import ---');
  try {
    const perFeedLimit = Math.min(50, Math.max(1, parseInt(options.limitPerFeed ?? '10', 10) || 10));
    const maxAgeHours = Math.min(168, Math.max(0, parseInt(options.maxAgeHours ?? '0', 10) || 0));
    const minDate = maxAgeHours > 0 ? new Date(Date.now() - maxAgeHours * 60 * 60 * 1000) : null;

    let systemUser = await User.findOne({ role: 'admin' });
    if (!systemUser) systemUser = await User.findOne();
    if (!systemUser) return { success: false, message: 'No admin user found' };

    let totalImported = 0;
    let totalSkipped = 0;
    let totalSkippedOld = 0;
    const feedStats = [];

    for (const feedConfig of FEED_MAPPING) {
      const stat = { url: feedConfig.url, imported: 0, skipped: 0, skippedOld: 0, error: null };
      try {
        const response = await axios.get(feedConfig.url, {
          responseType: 'arraybuffer',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7'
          },
          timeout: 15000
        });
        const buffer = Buffer.from(response.data);
        const utf8Text = iconv.decode(buffer, 'utf-8');
        const contentType = (response.headers && response.headers['content-type']) ? String(response.headers['content-type']) : '';
        if (/text\/html/i.test(contentType) || /^\s*<!doctype html/i.test(utf8Text) || /^\s*<html/i.test(utf8Text)) {
          throw new Error('HTML returned instead of RSS (blocked or requires consent)');
        }
        const declared = extractXmlDeclaredEncoding(utf8Text.slice(0, 200));
        const detected = jschardet.detect(buffer);
        const detectedEnc = (detected && detected.encoding && String(detected.encoding)) || '';

        const tryEncodings = [
          declared,
          'utf-8',
          detectedEnc,
          'windows-1250',
          'iso-8859-2'
        ].map(e => (e || '').trim()).filter(Boolean);

        let feed = null;
        let lastErr = null;
        for (const enc of [...new Set(tryEncodings)]) {
          try {
            const xml = iconv.decode(buffer, enc);
            feed = await parser.parseString(xml);
            lastErr = null;
            break;
          } catch (e) {
            lastErr = e;
          }
        }
        if (!feed) throw lastErr || new Error('Failed to parse feed');
        
        for (const item of feed.items.slice(0, perFeedLimit)) {
          const itemDate = item.isoDate ? new Date(item.isoDate) : (item.pubDate ? new Date(item.pubDate) : null);
          if (minDate && itemDate && itemDate < minDate) {
            totalSkippedOld++;
            stat.skippedOld++;
            continue;
          }

          const sourceLink = normalizeSourceLink(item.link || item.guid || '');
          if (sourceLink) {
            const exists = await Article.findOne({ source_link: sourceLink });
            if (exists) {
              totalSkipped++;
              stat.skipped++;
              continue;
            }
          }

          const title = (item.title || '').trim();
          const rawContent = item['content:encoded'] || item.content || item.contentSnippet || '';
          const publishedAt = item.isoDate || item.pubDate || '';
          
          // Intelligent Classification
          const categoryName = classifyArticle(title, rawContent);
          const category = await Category.findOne({ name: categoryName });
          if (!category) {
            console.warn(`Category ${categoryName} not found in DB, using first available.`);
          }

          const cleanHtml = removeImagesAndMedia(rawContent);
          const fullText = stripHtml(cleanHtml);
          const summaryText = stripHtml(item.contentSnippet || '').trim() || fullText.substring(0, 260) || title;
          const bodyText = fullText.length > 260 ? fullText : `${summaryText}\n\nSzczegóły są dostępne w źródle pod linkiem poniżej.`;

          const sourceHost = item.link ? (() => { try { return new URL(item.link).hostname; } catch { return ''; } })() : '';
          const metaLine = [sourceHost ? `Źródło: ${sourceHost}` : '', publishedAt ? `Data: ${new Date(publishedAt).toLocaleString('pl-PL')}` : ''].filter(Boolean).join(' • ');

          const richContent = buildRichContent({
            summary: summaryText,
            metaLine,
            bodyText,
            sourceUrl: item.link,
            sourceLabel: 'Przeczytaj pełny artykuł w oryginalnym źródle'
          });

          await Article.create({
            title,
            content: richContent,
            excerpt: summaryText.substring(0, 260) + '...',
            featured_image: item.enclosure?.url || (rawContent.match(/<img[^>]+src="([^">]+)"/)?.[1]) || undefined,
            category: category ? category._id : (await Category.findOne())._id,
            author: systemUser._id,
            status: 'published',
            published_date: item.isoDate || new Date(),
            source_link: sourceLink || undefined
          });
          totalImported++;
          stat.imported++;
        }
      } catch (err) {
        stat.error = err.message;
        console.error(`Error processing feed:`, err.message);
      } finally {
        feedStats.push(stat);
      }
    }

    const gdeltQuery = 'sourceCountry:Poland (sport OR technologie OR tech OR AI OR muzyka OR koncert OR album OR film OR kino OR serial OR Łódź OR Lodz)';
    const stat = { url: `GDELT:${gdeltQuery}`, imported: 0, skipped: 0, skippedOld: 0, error: null };
    try {
      const items = await fetchGdeltArticles(gdeltQuery, Math.min(50, perFeedLimit * 5));
        for (const item of items) {
          if (!item || !item.url) continue;
          if (item.language && String(item.language).toLowerCase() !== 'polish') continue;
          if (item.sourcecountry && String(item.sourcecountry).toLowerCase() !== 'poland') continue;

          const sourceLink = normalizeSourceLink(item.url);
          if (sourceLink) {
            const exists = await Article.findOne({ source_link: sourceLink });
            if (exists) {
              totalSkipped++;
              stat.skipped++;
              continue;
            }
          }

          const itemDate = item.seendate ? new Date(item.seendate) : null;
          if (minDate && itemDate && itemDate < minDate) {
            totalSkippedOld++;
            stat.skippedOld++;
            continue;
          }

          const title = (item.title || '').trim();
          const rawContent = '';
          const categoryName = classifyArticle(title, rawContent) || 'Новости';
          const category = await Category.findOne({ name: categoryName }) || await Category.findOne();

          const snippet = title.substring(0, 260);
          const img = item.socialimage || undefined;
          const seenLine = itemDate ? `Data: ${itemDate.toLocaleString('pl-PL')}` : '';
          const domainLine = item.domain ? `Źródło: ${item.domain}` : '';
          const metaLine = [domainLine, seenLine].filter(Boolean).join(' • ');

          const richContent = buildRichContent({
            summary: snippet,
            metaLine,
            bodyText: `${snippet}\n\nPełny tekst jest dostępny pod linkiem poniżej.`,
            sourceUrl: item.url,
            sourceLabel: 'Przeczytaj pełny artykuł w oryginalnym źródle'
          });

          await Article.create({
            title,
            content: richContent,
            excerpt: snippet + '...',
            featured_image: img,
            category: category._id,
            author: systemUser._id,
            status: 'published',
            published_date: itemDate || new Date(),
            source_link: sourceLink || undefined
          });

          totalImported++;
          stat.imported++;
        }
    } catch (err) {
      stat.error = err.message;
    } finally {
      feedStats.push(stat);
    }
    console.log(`--- Auto Import Summary: +${totalImported}, dup:${totalSkipped}, old:${totalSkippedOld} ---`);
    for (const f of feedStats) {
      console.log(`${f.url} => +${f.imported}, dup:${f.skipped}, old:${f.skippedOld}${f.error ? `, err:${f.error}` : ''}`);
    }
    return { success: true, count: totalImported, skipped: totalSkipped, skippedOld: totalSkippedOld, feeds: feedStats };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

exports.triggerManualImport = async (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '10', 10) || 10));
  const hours = Math.max(0, parseInt(req.query.hours || '0', 10) || 0);

  const result = await exports.runAutoImport({ limitPerFeed: limit, maxAgeHours: hours });
  if (result.success) {
    const msg = result.count === 0
      ? `Auto-Import: новых новостей нет (всё актуально). Дубликаты: ${result.skipped}. Старые: ${result.skippedOld}.`
      : `Auto-Import: добавлено ${result.count} новостей. Дубликаты: ${result.skipped}. Старые: ${result.skippedOld}.`;
    res.json({ message: msg, count: result.count, skipped: result.skipped, skippedOld: result.skippedOld, feeds: result.feeds });
  } else {
    res.status(500).json({ message: 'Auto Import failed', error: result.error });
  }
};
