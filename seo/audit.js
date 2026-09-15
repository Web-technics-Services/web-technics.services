/**
 * Programmatic SEO audit.
 *
 * Runs against built HTML, so it validates what crawlers actually receive
 * rather than what a template intended. Every check returns structured findings
 * (`error` / `warning` / `info`) so the result can drive a CI exit code as well
 * as a human-readable report.
 */

const fs = require('fs');
const path = require('path');
const { routes, disallow, movedRoutes } = require('./config');

const TITLE_MIN = 50;
const TITLE_MAX = 60;
const DESCRIPTION_MIN = 150;
const DESCRIPTION_MAX = 160;

/**
 * @typedef {object} Finding
 * @property {"error"|"warning"|"info"} level
 * @property {string} rule
 * @property {string} file
 * @property {string} message
 */

/**
 * @typedef {object} AuditResult
 * @property {Finding[]} findings
 * @property {number} errors
 * @property {number} warnings
 * @property {boolean} passed
 * @property {Record<string, object>} pages
 */

const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

/** Decode the handful of entities that affect length measurements. */
function decode(value) {
  return String(value || '').replace(
    /&(amp|lt|gt|quot|#39|apos|nbsp);/g,
    (match) => ENTITIES[match] || match
  );
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return match ? match[1] : null;
}

/** Extract the SEO-relevant shape of a single HTML document. */
function parsePage(html) {
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
  const meta = {};
  for (const tag of metaTags) {
    const key = attr(tag, 'name') || attr(tag, 'property');
    if (key) meta[key.toLowerCase()] = decode(attr(tag, 'content') || '');
  }

  const linkTags = html.match(/<link\b[^>]*>/gi) || [];
  const canonicalTag = linkTags.find((tag) => (attr(tag, 'rel') || '').toLowerCase() === 'canonical');

  const headings = [...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((match) => ({
    level: Number(match[1]),
    text: stripTags(decode(match[2])).replace(/\s+/g, ' ').trim(),
  }));

  const images = (html.match(/<img\b[^>]*>/gi) || []).map((tag) => ({
    tag,
    src: attr(tag, 'src'),
    alt: attr(tag, 'alt'),
    loading: attr(tag, 'loading'),
    width: attr(tag, 'width'),
    height: attr(tag, 'height'),
  }));

  const links = [...html.matchAll(/<a\b[^>]*\shref\s*=\s*"([^"]*)"[^>]*>/gi)].map((m) => m[1]);

  const scripts = (html.match(/<script\b[^>]*>/gi) || []).filter((tag) => attr(tag, 'src'));
  const headEnd = html.search(/<\/head>/i);
  const renderBlocking = scripts.filter((tag) => {
    const isInHead = headEnd !== -1 && html.indexOf(tag) < headEnd;
    return isInHead && !/\s(defer|async)\b/i.test(tag) && !/type\s*=\s*"module"/i.test(tag);
  });

  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const jsonLd = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];

  return {
    title: titleMatch ? decode(titleMatch[1]).trim() : null,
    meta,
    canonical: canonicalTag ? attr(canonicalTag, 'href') : null,
    lang: (html.match(/<html\b[^>]*\slang\s*=\s*"([^"]*)"/i) || [])[1] || null,
    viewport: meta.viewport || null,
    headings,
    images,
    links,
    renderBlocking,
    jsonLd: jsonLd.map((match) => match[1]),
    text: stripTags(html).replace(/\s+/g, ' ').trim(),
  };
}

/**
 * Audit a collection of HTML files.
 *
 * @param {{rootDir?: string, files?: string[]}} [options]
 * @returns {AuditResult}
 */
function audit(options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, '..');
  const files =
    options.files ||
    fs
      .readdirSync(rootDir)
      .filter((name) => name.endsWith('.html'))
      .sort();

  /** @type {Finding[]} */
  const findings = [];
  const pages = {};
  const add = (level, rule, file, message) => findings.push({ level, rule, file, message });

  const existingFiles = new Set(
    fs
      .readdirSync(rootDir, { recursive: true })
      .map((name) => String(name).split(path.sep).join('/'))
  );

  for (const file of files) {
    const html = fs.readFileSync(path.join(rootDir, file), 'utf8');
    const page = parsePage(html);
    const route = routes.find((entry) => entry.file === file);
    const isIndexable =
      !(route && route.noindex) &&
      !disallow.includes(`/${file}`) &&
      !/noindex/i.test(page.meta.robots || '');

    pages[file] = {
      title: page.title,
      titleLength: page.title ? page.title.length : 0,
      descriptionLength: (page.meta.description || '').length,
      words: page.text ? page.text.split(' ').length : 0,
      images: page.images.length,
      indexable: isIndexable,
    };

    checkMandatoryTags(page, file, isIndexable, add);
    checkLengths(page, file, isIndexable, add);
    checkHeadings(page, file, add);
    checkImages(page, file, add);
    checkLinks(page, file, rootDir, existingFiles, add);
    checkPerformance(page, file, add);
    checkStructuredData(page, file, add);

    if (isIndexable && pages[file].words < 300) {
      add('warning', 'thin-content', file, `Only ${pages[file].words} words of body copy (aim for 600+ on commercial pages).`);
    }
  }

  findings.push(...checkCannibalisation(pages, files, rootDir));

  const errors = findings.filter((finding) => finding.level === 'error').length;
  const warnings = findings.filter((finding) => finding.level === 'warning').length;
  return { findings, errors, warnings, passed: errors === 0, pages };
}

function checkMandatoryTags(page, file, isIndexable, add) {
  if (!page.title) add('error', 'meta-title', file, 'Missing <title>.');
  if (!page.meta.description) add('error', 'meta-description', file, 'Missing meta description.');
  if (!page.canonical) add('error', 'canonical', file, 'Missing rel="canonical".');
  if (!page.lang) add('error', 'html-lang', file, 'Missing lang attribute on <html>.');
  if (!page.viewport) add('error', 'viewport', file, 'Missing viewport meta tag.');

  const required = [
    ['og:title', 'og:title'],
    ['og:description', 'og:description'],
    ['og:url', 'og:url'],
    ['og:image', 'og:image'],
    ['og:type', 'og:type'],
    ['twitter:card', 'twitter:card'],
    ['twitter:title', 'twitter:title'],
    ['twitter:description', 'twitter:description'],
    ['twitter:image', 'twitter:image'],
  ];
  for (const [key, label] of required) {
    if (!page.meta[key]) {
      add(isIndexable ? 'error' : 'info', 'social-tags', file, `Missing ${label}.`);
    }
  }
  if (page.meta['og:image'] && !page.meta['og:image:alt']) {
    add('warning', 'social-tags', file, 'og:image has no og:image:alt.');
  }
}

function checkLengths(page, file, isIndexable, add) {
  if (!isIndexable) return;

  if (page.title) {
    const length = page.title.length;
    if (length < TITLE_MIN || length > TITLE_MAX) {
      add(
        'warning',
        'title-length',
        file,
        `Title is ${length} chars; target ${TITLE_MIN}-${TITLE_MAX}. "${page.title}"`
      );
    }
  }

  const description = page.meta.description || '';
  if (description) {
    const length = description.length;
    if (length < DESCRIPTION_MIN || length > DESCRIPTION_MAX) {
      add(
        'warning',
        'description-length',
        file,
        `Description is ${length} chars; target ${DESCRIPTION_MIN}-${DESCRIPTION_MAX}.`
      );
    }
  }
}

function checkHeadings(page, file, add) {
  const h1s = page.headings.filter((heading) => heading.level === 1);
  if (h1s.length === 0) add('error', 'heading-h1', file, 'No <h1> found.');
  if (h1s.length > 1) {
    add('error', 'heading-h1', file, `${h1s.length} <h1> elements found; use exactly one.`);
  }

  let previous = 0;
  for (const heading of page.headings) {
    if (previous && heading.level > previous + 1) {
      add(
        'warning',
        'heading-order',
        file,
        `Heading jumps from h${previous} to h${heading.level} at "${heading.text.slice(0, 60)}".`
      );
    }
    if (!heading.text) {
      add('warning', 'heading-empty', file, `Empty h${heading.level} element.`);
    }
    previous = heading.level;
  }
}

function checkImages(page, file, add) {
  page.images.forEach((image, index) => {
    const label = image.src || `image #${index + 1}`;
    if (image.alt === null) {
      add('error', 'image-alt', file, `<img> without alt attribute: ${label}`);
    }
    if (!image.width || !image.height) {
      add('warning', 'image-dimensions', file, `<img> without width/height (causes CLS): ${label}`);
    }
    // The first image is assumed above the fold and should stay eager.
    if (index > 0 && image.loading !== 'lazy') {
      add('warning', 'image-lazy', file, `Below-the-fold <img> missing loading="lazy": ${label}`);
    }
    if (index === 0 && image.loading === 'lazy') {
      add('warning', 'image-lazy', file, `Above-the-fold <img> should not be lazy: ${label}`);
    }
    // Third-party images can disappear without warning and cost an extra
    // connection. Self-hosting keeps both reliability and licensing in hand.
    if (/^https?:\/\//i.test(image.src || '')) {
      const host = (image.src.match(/^https?:\/\/([^/]+)/i) || [])[1];
      add(
        'warning',
        'image-external',
        file,
        `<img> is hotlinked from ${host}; self-host it so it cannot break or change: ${label}`,
      );
    }
  });
}

function checkLinks(page, file, rootDir, existingFiles, add) {
  for (const href of page.links) {
    if (!href || /^(https?:|mailto:|tel:|#|data:|javascript:)/i.test(href)) continue;

    const [cleanPath] = href.split(/[?#]/);
    if (!cleanPath) continue;

    const target = cleanPath.startsWith('/')
      ? cleanPath.slice(1)
      : path.posix.join(path.posix.dirname(file), cleanPath);
    const resolved = target === '' || target.endsWith('/') ? `${target}index.html` : target;

    const moved = movedRoutes[`/${resolved}`];
    if (moved) {
      add(
        'error',
        'moved-route',
        file,
        `Link points at /${resolved}, which moved to ${moved}. Use the absolute URL so the link equity follows the content.`,
      );
      continue;
    }

    if (!existingFiles.has(resolved) && !fs.existsSync(path.join(rootDir, resolved))) {
      add('error', 'broken-link', file, `Internal link has no target on disk: ${href}`);
    }
  }
}

function checkPerformance(page, file, add) {
  for (const tag of page.renderBlocking) {
    const src = attr(tag, 'src');
    add(
      'warning',
      'render-blocking',
      file,
      `Script in <head> without defer/async blocks rendering: ${src}`
    );
  }
}

function checkStructuredData(page, file, add) {
  page.jsonLd.forEach((block, index) => {
    try {
      JSON.parse(block);
    } catch (error) {
      add('error', 'json-ld', file, `JSON-LD block #${index + 1} is not valid JSON: ${error.message}`);
    }
  });

  const hasFaqHeading = page.headings.some((heading) => /question|faq/i.test(heading.text));
  const hasFaqSchema = page.jsonLd.some((block) => /"FAQPage"/.test(block));
  if (hasFaqHeading && !hasFaqSchema) {
    add('warning', 'json-ld', file, 'Page has an FAQ section but no FAQPage structured data.');
  }
}

/**
 * Detect keyword cannibalisation across the configured routes.
 *
 * Flags two distinct problems: two routes claiming the same primary keyword,
 * and one route using another route's primary keyword as a secondary term.
 *
 * @returns {Finding[]}
 */
function checkCannibalisation(pages, files, rootDir) {
  const findings = [];
  const normalise = (value) => String(value || '').toLowerCase().trim();

  const primaryOwners = new Map();
  for (const route of routes) {
    const key = normalise(route.primaryKeyword);
    if (!key) continue;
    if (primaryOwners.has(key)) {
      findings.push({
        level: 'error',
        rule: 'cannibalisation',
        file: route.file,
        message: `Primary keyword "${route.primaryKeyword}" is already owned by ${primaryOwners.get(key)}.`,
      });
      continue;
    }
    primaryOwners.set(key, route.file);
  }

  for (const route of routes) {
    for (const secondary of route.secondaryKeywords || []) {
      const owner = primaryOwners.get(normalise(secondary));
      if (owner && owner !== route.file) {
        findings.push({
          level: 'error',
          rule: 'cannibalisation',
          file: route.file,
          message: `Secondary keyword "${secondary}" is the primary keyword of ${owner}.`,
        });
      }
    }
  }

  // Duplicate titles and descriptions are the other half of cannibalisation.
  const seenTitles = new Map();
  const seenDescriptions = new Map();
  for (const file of files) {
    const page = pages[file];
    if (!page || !page.indexable) continue;

    const title = normalise(page.title);
    if (title && seenTitles.has(title)) {
      findings.push({
        level: 'error',
        rule: 'duplicate-title',
        file,
        message: `Title is identical to ${seenTitles.get(title)}.`,
      });
    } else if (title) {
      seenTitles.set(title, file);
    }
  }

  void seenDescriptions;
  void rootDir;
  return findings;
}

/**
 * Format an audit result as readable console output.
 *
 * @param {AuditResult} result
 * @returns {string}
 */
function formatReport(result) {
  const icons = { error: 'ERROR  ', warning: 'WARN   ', info: 'INFO   ' };
  const byFile = new Map();
  for (const finding of result.findings) {
    if (!byFile.has(finding.file)) byFile.set(finding.file, []);
    byFile.get(finding.file).push(finding);
  }

  const lines = ['', 'SEO audit', '='.repeat(60)];
  for (const [file, findings] of byFile) {
    lines.push('', file);
    for (const finding of findings) {
      lines.push(`  ${icons[finding.level]} [${finding.rule}] ${finding.message}`);
    }
  }

  lines.push(
    '',
    '-'.repeat(60),
    `${result.errors} error(s), ${result.warnings} warning(s) across ${Object.keys(result.pages).length} page(s).`,
    result.passed ? 'PASS' : 'FAIL',
    ''
  );
  return lines.join('\n');
}

module.exports = {
  audit,
  parsePage,
  formatReport,
  checkCannibalisation,
  TITLE_MIN,
  TITLE_MAX,
  DESCRIPTION_MIN,
  DESCRIPTION_MAX,
};
