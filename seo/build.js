#!/usr/bin/env node
/**
 * SEO module CLI.
 *
 *   node seo/build.js audit            Report SEO problems (exit 1 on error).
 *   node seo/build.js sitemap          Regenerate sitemap.xml.
 *   node seo/build.js robots           Regenerate robots.txt for SEO_ENV.
 *   node seo/build.js redirects        Regenerate nginx rules for moved routes.
 *   node seo/build.js build            Sitemap + robots + redirects, then audit.
 */

const path = require('path');
const { audit, formatReport } = require('./audit');
const { writeSitemap } = require('./sitemap');
const { writeRobots, resolveEnvironment } = require('./robots');
const { writeRedirects } = require('./redirects');

const rootDir = path.resolve(__dirname, '..');

const commands = {
  audit() {
    const result = audit({ rootDir });
    process.stdout.write(formatReport(result));
    return result.passed ? 0 : 1;
  },

  sitemap() {
    const result = writeSitemap(rootDir);
    console.log(`sitemap.xml written with ${result.entries.length} URL(s).`);
    for (const route of result.unconfigured) {
      console.warn(`  warning: ${route} is not described in seo/config.js (using defaults).`);
    }
    for (const route of result.missingFiles) {
      console.warn(`  warning: ${route} is configured but has no file on disk.`);
    }
    return 0;
  },

  robots() {
    const { environment } = writeRobots(rootDir);
    console.log(`robots.txt written for "${environment}".`);
    if (environment !== 'production') {
      console.log('  note: set SEO_ENV=production for a crawlable policy.');
    }
    return 0;
  },

  redirects() {
    const { count } = writeRedirects(rootDir);
    console.log(`nginx/moved-routes.conf written with ${count} redirect(s).`);
    return 0;
  },

  build() {
    commands.sitemap();
    commands.robots();
    commands.redirects();
    return commands.audit();
  },
};

const command = process.argv[2] || 'audit';
if (!commands[command]) {
  console.error(`Unknown command "${command}". Use: ${Object.keys(commands).join(', ')}`);
  process.exit(2);
}

console.log(`environment: ${resolveEnvironment()}`);
process.exit(commands[command]());
