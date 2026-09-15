/**
 * Smoke tests for the SEO module.
 *
 *   node --test seo/
 */

const test = require('node:test');
const assert = require('node:assert');

const { renderMeta, validateMetaProps, metaPropsForRoute } = require('./meta');
const sd = require('./structured-data');
const { generateRobots, resolveEnvironment } = require('./robots');
const { generateSitemap, crawlRoutes } = require('./sitemap');
const { audit, parsePage, checkCannibalisation } = require('./audit');
const { routes } = require('./config');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

test('renderMeta emits every mandatory tag', () => {
  const html = renderMeta({
    title: 'A perfectly reasonable title for a page about things',
    description: 'A description.',
    canonical: '/example.html',
  });

  for (const needle of [
    '<title>',
    'name="description"',
    'rel="canonical"',
    'property="og:title"',
    'property="og:image"',
    'name="twitter:card"',
    'name="twitter:image"',
  ]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
  assert.ok(html.includes('https://web-technics.services/example.html'));
});

test('renderMeta escapes attribute values', () => {
  const html = renderMeta({
    title: 'Tom & Jerry "quoted"',
    description: '<script>alert(1)</script>',
    canonical: '/x.html',
  });
  assert.ok(html.includes('Tom &amp; Jerry &quot;quoted&quot;'));
  assert.ok(!html.includes('<script>alert(1)</script>'));
});

test('renderMeta rejects invalid props', () => {
  assert.throws(() => renderMeta({ title: 'x' }), TypeError);
  assert.deepStrictEqual(validateMetaProps({ title: 'a', description: 'b', canonical: 'c' }), []);
});

test('noindex routes get a noindex robots directive', () => {
  const route = routes.find((entry) => entry.noindex);
  const html = renderMeta(metaPropsForRoute(route));
  assert.ok(html.includes('content="noindex, nofollow"'));
});

test('structured data generators produce valid schema.org nodes', () => {
  const article = sd.article({
    headline: 'How we rebuilt a storefront',
    description: 'A short summary.',
    url: '/blog/storefront.html',
    datePublished: '2026-01-15',
  });
  assert.strictEqual(article['@type'], 'Article');
  assert.strictEqual(article.dateModified, '2026-01-15');
  assert.strictEqual(article.url, 'https://web-technics.services/blog/storefront.html');

  const product = sd.product({
    name: 'Starter website',
    description: 'A launch-ready site.',
    url: '/services.html',
    offer: { price: 1200, currency: 'USD' },
  });
  assert.strictEqual(product.offers.priceCurrency, 'USD');
  assert.strictEqual(product.offers.availability, 'https://schema.org/InStock');

  const faq = sd.faq([{ question: 'Q?', answer: 'A.' }]);
  assert.strictEqual(faq.mainEntity[0].acceptedAnswer.text, 'A.');

  const crumbs = sd.breadcrumbList([{ name: 'Home', url: '/' }, { name: 'Now' }]);
  assert.strictEqual(crumbs.itemListElement[1].position, 2);
  // The current page carries no `item`.
  assert.strictEqual(crumbs.itemListElement[1].item, undefined);

  assert.strictEqual(sd.organization()['@type'], 'Organization');
});

test('structured data generators reject incomplete input', () => {
  assert.throws(() => sd.article({ headline: 'x' }), TypeError);
  assert.throws(() => sd.product({ name: 'x' }), TypeError);
  assert.throws(() => sd.faq([]), TypeError);
  assert.throws(() => sd.breadcrumbList([]), TypeError);
});

test('renderJsonLd escapes a closing script tag', () => {
  const html = sd.renderJsonLd({ '@type': 'Thing', name: '</script><img src=x>' });
  assert.ok(!html.includes('</script><img'));
  assert.ok(html.includes('\\u003c/script'));
});

test('robots.txt blocks crawling outside production', () => {
  assert.ok(generateRobots({ environment: 'development' }).includes('Disallow: /'));
  assert.ok(generateRobots({ environment: 'staging' }).includes('Disallow: /'));

  const production = generateRobots({ environment: 'production' });
  assert.ok(production.includes('Allow: /'));
  assert.ok(production.includes('Sitemap: https://web-technics.services/sitemap.xml'));
  assert.ok(production.includes('Disallow: /server-status.html'));
});

test('environment resolution maps common deployment values', () => {
  assert.strictEqual(resolveEnvironment({ SEO_ENV: 'prod' }), 'production');
  assert.strictEqual(resolveEnvironment({ VERCEL_ENV: 'preview' }), 'staging');
  assert.strictEqual(resolveEnvironment({}), 'development');
});

test('the sitemap crawls routes and excludes noindex pages', () => {
  const crawled = crawlRoutes(rootDir);
  assert.ok(crawled.some((route) => route.path === '/'));

  const { xml, entries } = generateSitemap(rootDir);
  assert.ok(xml.startsWith('<?xml'));
  assert.ok(!xml.includes('server-status'));
  assert.ok(entries.every((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry.lastmod)));
  assert.ok(entries.every((entry) => entry.priority >= 0 && entry.priority <= 1));
});

test('parsePage flags a render-blocking head script', () => {
  const page = parsePage(
    '<html lang="en"><head><script src="a.js"></script><script src="b.js" defer></script></head><body></body></html>'
  );
  assert.strictEqual(page.renderBlocking.length, 1);
});

test('the audit detects a broken internal link and a bad heading order', () => {
  const page = parsePage(
    '<html lang="en"><head></head><body><h1>A</h1><h4>B</h4><a href="nope.html">x</a></body></html>'
  );
  assert.deepStrictEqual(
    page.headings.map((heading) => heading.level),
    [1, 4]
  );
  assert.ok(page.links.includes('nope.html'));
});

test('cannibalisation is detected across routes', () => {
  const findings = checkCannibalisation({}, [], rootDir);
  assert.deepStrictEqual(findings, [], 'the live config must be cannibalisation-free');
});

test('the site passes its own audit', () => {
  const result = audit({ rootDir });
  const errors = result.findings.filter((finding) => finding.level === 'error');
  assert.deepStrictEqual(
    errors.map((finding) => `${finding.file}: ${finding.message}`),
    []
  );
});

test('moved routes become permanent redirects, never 302s or 404s', () => {
  const { generateNginx, generateApache } = require('./redirects');
  const { movedRoutes } = require('./config');
  const nginx = generateNginx();

  for (const [from, to] of Object.entries(movedRoutes)) {
    assert.match(nginx, new RegExp(`location = ${from.replace(/[.]/g, '\\.')} \\{`));
    assert.ok(nginx.includes(`return 301 ${to};`), `${from} must 301 to ${to}`);
  }

  assert.ok(!/return 302/.test(nginx), 'a temporary redirect would not transfer ranking signals');
  assert.match(generateApache(), /^Redirect 301 /m);
});

test('no page still links to a route that moved to the sibling site', () => {
  const { movedRoutes } = require('./config');
  const result = audit({ rootDir });
  const stale = result.findings.filter((finding) => finding.rule === 'moved-route');
  assert.deepStrictEqual(stale.map((finding) => finding.message), []);
  assert.ok(Object.keys(movedRoutes).length > 0);
});