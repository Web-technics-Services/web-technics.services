/**
 * Environment-aware robots.txt generation.
 *
 * Development and staging must never be indexed. Only production emits a
 * crawlable policy, so an accidental deploy of a preview host cannot compete
 * with the live site in search results.
 */

const fs = require('fs');
const path = require('path');
const { site, disallow } = require('./config');

/**
 * Resolve the current environment from the usual deployment variables.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {import('./config').Environment}
 */
function resolveEnvironment(env = process.env) {
  const raw = String(
    env.SEO_ENV || env.DEPLOY_ENV || env.VERCEL_ENV || env.NODE_ENV || 'development'
  ).toLowerCase();

  if (['production', 'prod', 'live'].includes(raw)) return 'production';
  if (['staging', 'stage', 'preview', 'test', 'uat'].includes(raw)) return 'staging';
  return 'development';
}

/** Crawlers that add load without sending meaningful traffic. */
const BLOCKED_BOTS = ['AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot', 'PetalBot'];

/**
 * Build the robots.txt body for an environment.
 *
 * @param {{environment?: import('./config').Environment, host?: string, sitemapUrl?: string}} [options]
 * @returns {string}
 */
function generateRobots(options = {}) {
  const environment = options.environment || resolveEnvironment();
  const host = (options.host || site.url).replace(/\/$/, '');
  const sitemapUrl = options.sitemapUrl || `${host}/sitemap.xml`;

  if (environment !== 'production') {
    return [
      `# ${environment} environment — indexing is disabled on purpose.`,
      'User-agent: *',
      'Disallow: /',
      '',
    ].join('\n');
  }

  const lines = ['# production', 'User-agent: *', 'Allow: /'];
  for (const rule of disallow) lines.push(`Disallow: ${rule}`);

  lines.push('', '# Crawl-heavy bots with no referral value.');
  for (const bot of BLOCKED_BOTS) {
    lines.push(`User-agent: ${bot}`, 'Disallow: /', '');
  }

  lines.push(`Sitemap: ${sitemapUrl}`, '');
  return lines.join('\n');
}

/**
 * Write robots.txt to disk.
 *
 * @param {string} [rootDir]
 * @param {{environment?: import('./config').Environment}} [options]
 */
function writeRobots(rootDir = path.resolve(__dirname, '..'), options = {}) {
  const environment = options.environment || resolveEnvironment();
  const content = generateRobots({ ...options, environment });
  fs.writeFileSync(path.join(rootDir, 'robots.txt'), content, 'utf8');
  return { environment, content };
}

module.exports = { generateRobots, writeRobots, resolveEnvironment };
