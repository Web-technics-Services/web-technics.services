/**
 * Dynamic sitemap generation.
 *
 * Routes are discovered by crawling the project for HTML entry points rather
 * than being hand-maintained, then enriched with metadata from `config.js`.
 * Anything found on disk but missing from the config is still emitted with safe
 * defaults and reported, so a new page can never silently drop out of the index.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { site, routes, disallow } = require('./config');
const { absoluteUrl, escapeAttr } = require('./meta');

const IGNORED_DIRS = new Set(['node_modules', '.git', 'assets', 'seo', 'dist', 'build']);

/**
 * Walk the project directory and return every HTML route it contains.
 *
 * @param {string} rootDir
 * @returns {Array<{path: string, file: string}>}
 */
function crawlRoutes(rootDir) {
  const discovered = [];

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || IGNORED_DIRS.has(entry.name)) continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      if (!entry.name.endsWith('.html')) continue;

      const relative = path.relative(rootDir, absolute).split(path.sep).join('/');
      discovered.push({
        path: relative === 'index.html' ? '/' : `/${relative}`,
        file: relative,
      });
    }
  };

  walk(rootDir);
  return discovered.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Last modification date for a file, preferring the last git commit that touched
 * it so that a fresh checkout does not reset every `lastmod` to today.
 *
 * @param {string} rootDir
 * @param {string} file
 * @returns {string} ISO `YYYY-MM-DD`.
 */
function lastModified(rootDir, file) {
  const absolute = path.join(rootDir, file);
  try {
    const stdout = execFileSync('git', ['log', '-1', '--format=%cs', '--', file], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(stdout)) return stdout;
  } catch {
    // Not a git checkout, or the file is untracked; fall through to mtime.
  }
  try {
    return fs.statSync(absolute).mtime.toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Merge crawled routes with configured metadata.
 *
 * @param {string} rootDir
 * @returns {{entries: Array<object>, unconfigured: string[], missingFiles: string[]}}
 */
function collectEntries(rootDir) {
  const crawled = crawlRoutes(rootDir);
  const byPath = new Map(routes.map((route) => [route.path, route]));
  const crawledPaths = new Set(crawled.map((route) => route.path));

  const unconfigured = [];
  const entries = [];

  for (const found of crawled) {
    const configured = byPath.get(found.path);
    if (!configured) unconfigured.push(found.path);

    const noindex = configured ? Boolean(configured.noindex) : false;
    const blocked = disallow.includes(found.path);
    if (noindex || blocked) continue;

    entries.push({
      loc: absoluteUrl(found.path),
      lastmod: lastModified(rootDir, found.file),
      changefreq: (configured && configured.changefreq) || 'monthly',
      priority: (configured && configured.priority) != null ? configured.priority : 0.5,
    });
  }

  const missingFiles = routes
    .filter((route) => !crawledPaths.has(route.path))
    .map((route) => route.path);

  entries.sort((a, b) => b.priority - a.priority || a.loc.localeCompare(b.loc));
  return { entries, unconfigured, missingFiles };
}

/**
 * Generate the sitemap XML document.
 *
 * @param {string} [rootDir]
 * @returns {{xml: string, entries: Array<object>, unconfigured: string[], missingFiles: string[]}}
 */
function generateSitemap(rootDir = path.resolve(__dirname, '..')) {
  const { entries, unconfigured, missingFiles } = collectEntries(rootDir);

  const body = entries
    .map(
      (entry) =>
        '  <url>\n' +
        `    <loc>${escapeAttr(entry.loc)}</loc>\n` +
        `    <lastmod>${entry.lastmod}</lastmod>\n` +
        `    <changefreq>${entry.changefreq}</changefreq>\n` +
        `    <priority>${entry.priority.toFixed(1)}</priority>\n` +
        '  </url>'
    )
    .join('\n');

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `${body}\n` +
    '</urlset>\n';

  return { xml, entries, unconfigured, missingFiles };
}

/**
 * Write sitemap.xml to disk.
 *
 * @param {string} [rootDir]
 */
function writeSitemap(rootDir = path.resolve(__dirname, '..')) {
  const result = generateSitemap(rootDir);
  fs.writeFileSync(path.join(rootDir, 'sitemap.xml'), result.xml, 'utf8');
  return result;
}

module.exports = { crawlRoutes, generateSitemap, writeSitemap, lastModified, site };
