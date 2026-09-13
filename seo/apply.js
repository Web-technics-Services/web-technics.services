#!/usr/bin/env node
/**
 * Apply the SEO module to the static HTML pages.
 *
 * This is a codemod: it rewrites the managed part of every `<head>` from
 * `seo/config.js`, injects structured data, and normalises image and script
 * loading for Core Web Vitals. Running it twice produces the same output.
 *
 *   node seo/apply.js          Write changes.
 *   node seo/apply.js --check  Report what would change, write nothing.
 */

const fs = require('fs');
const path = require('path');
const { routes } = require('./config');
const { renderMeta, metaPropsForRoute } = require('./meta');
const structuredData = require('./structured-data');

const rootDir = path.resolve(__dirname, '..');
const checkOnly = process.argv.includes('--check');

/** Known intrinsic sizes so images can reserve layout space and avoid CLS. */
const IMAGE_DIMENSIONS = {
  'assets/branding/web-technics-logo-horizontal.svg': { width: 196, height: 52 },
  'assets/branding/web-technics-logo-horizontal-light.svg': { width: 196, height: 52 },
  'assets/branding/web-technics-icon-favicon.svg': { width: 32, height: 32 },
};

/** Fonts are preloaded and swapped in asynchronously instead of blocking render. */
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@500;600;700;800&display=swap';

const FONT_BLOCK = [
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  `<link rel="preload" as="style" href="${FONT_HREF}">`,
  `<link rel="stylesheet" href="${FONT_HREF}" media="print" onload="this.media='all'">`,
  `<noscript><link rel="stylesheet" href="${FONT_HREF}"></noscript>`,
].join('\n  ');

/** Pull question/answer pairs out of an existing FAQ section. */
function extractFaq(html) {
  const section = html.match(
    /<section\b[^>]*>(?:(?!<\/section>)[\s\S])*?<h2[^>]*>[^<]*(?:questions|FAQ)[^<]*<\/h2>[\s\S]*?<\/section>/i
  );
  if (!section) return [];

  return [...section[0].matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/gi)].map(
    (match) => ({
      question: clean(match[1]),
      answer: clean(match[2]),
    })
  );
}

function clean(value) {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Existing JSON-LD blocks that the config does not generate are preserved. */
function preservedJsonLd(head) {
  const generatedTypes = new Set(['Organization', 'WebSite', 'BreadcrumbList', 'FAQPage']);
  const blocks = [...head.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];

  return blocks
    .map((match) => {
      try {
        return JSON.parse(match[1]);
      } catch {
        return null;
      }
    })
    .filter((data) => data && !generatedTypes.has(data['@type']));
}

function transformImages(html) {
  let index = 0;
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = (tag.match(/\ssrc\s*=\s*"([^"]*)"/i) || [])[1] || '';
    // Only the first image in document order is assumed above the fold.
    const isAboveFold = index === 0;
    index += 1;
    let result = tag;

    const append = (attribute) => {
      result = result.replace(/\s*\/?>$/, ` ${attribute}>`);
    };

    const dimensions = IMAGE_DIMENSIONS[src];
    if (dimensions && !/\swidth=/i.test(result)) {
      append(`width="${dimensions.width}" height="${dimensions.height}"`);
    }
    if (!/\sdecoding=/i.test(result)) append('decoding="async"');

    if (isAboveFold) {
      if (!/\sfetchpriority=/i.test(result)) append('fetchpriority="high"');
    } else if (!/\sloading=/i.test(result)) {
      append('loading="lazy"');
    }
    return result;
  });
}

function transformScripts(html) {
  return html
    .replace(/<script\s+src="(consent\.js[^"]*)"\s*>/gi, '<script src="$1" defer>')
    .replace(/<script\s+src="(app\.js[^"]*)"\s*>/gi, '<script src="$1" defer>')
    .replace(/<script\s+src="(analytics\.js[^"]*)"\s*>/gi, '<script src="$1" defer>');
}

/** Ensure analytics.js is loaded once, right after consent.js. */
function ensureAnalyticsScript(html) {
  if (/src="analytics\.js/.test(html)) return html;
  return html.replace(
    /(<script\s+src="consent\.js[^"]*"[^>]*><\/script>)/i,
    '$1\n  <script src="analytics.js?v=20260914-1" defer></script>'
  );
}

function buildHead(route, originalHead, faq) {
  const metaProps = metaPropsForRoute(route);
  if (route.path === '/') {
    metaProps.preload = [
      { rel: 'preload', href: '/styles.css', as: 'style' },
    ];
  }

  const nodes = structuredData.forRoute({ ...route, faq });
  nodes.push(...preservedJsonLd(originalHead));

  const parts = [
    renderMeta(metaProps),
    FONT_BLOCK,
    '<link rel="stylesheet" href="styles.css">',
    '<link rel="icon" type="image/svg+xml" href="assets/branding/web-technics-icon-favicon.svg">',
  ];
  if (nodes.length) parts.push(structuredData.renderJsonLd(nodes));

  return parts.join('\n  ');
}

const changed = [];

for (const route of routes) {
  const file = path.join(rootDir, route.file);
  if (!fs.existsSync(file)) {
    console.warn(`skip: ${route.file} does not exist.`);
    continue;
  }

  const original = fs.readFileSync(file, 'utf8');
  const headMatch = original.match(/<head>([\s\S]*?)<\/head>/i);
  if (!headMatch) {
    console.warn(`skip: ${route.file} has no <head>.`);
    continue;
  }

  const originalHead = headMatch[1];
  const faq = extractFaq(original);

  // Scripts declared in the original head are kept and re-emitted with defer.
  const headScripts = (originalHead.match(/<script\b[^>]*src="[^"]*"[^>]*><\/script>/gi) || []).join(
    '\n  '
  );

  let head = `\n  ${[headScripts, buildHead(route, originalHead, faq)]
    .filter(Boolean)
    .join('\n  ')}\n`;
  head = head.replace(/\n\s*\n/g, '\n');

  let updated = original.replace(/<head>[\s\S]*?<\/head>/i, `<head>${head}</head>`);
  updated = transformImages(updated);
  updated = ensureAnalyticsScript(updated);
  updated = transformScripts(updated);

  if (updated !== original) {
    changed.push(route.file);
    if (!checkOnly) fs.writeFileSync(file, updated, 'utf8');
  }
}

if (checkOnly) {
  console.log(
    changed.length
      ? `${changed.length} file(s) are out of sync with seo/config.js:\n  ${changed.join('\n  ')}\n\nRun: node seo/apply.js`
      : 'All pages match seo/config.js.'
  );
  process.exit(changed.length ? 1 : 0);
}

console.log(
  changed.length
    ? `${changed.length} file(s) updated:\n  ${changed.join('\n  ')}`
    : 'No changes; all pages already match seo/config.js.'
);
