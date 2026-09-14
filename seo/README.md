# SEO module

A dependency-free SEO toolkit for this static site. Every module is plain
CommonJS with no build step, so it runs the same in a local shell, in CI, and
inside any server-side render.

## Files

| File | Purpose |
| --- | --- |
| `config.js` | Single source of truth: per-route title, description, keyword ownership, breadcrumbs, sitemap hints. |
| `meta.js` | Reusable meta tag component (`renderMeta`) with typed props. |
| `structured-data.js` | JSON-LD generators for Article, Product, FAQPage, BreadcrumbList, Organization, WebSite and Service. |
| `sitemap.js` | Crawls the project for routes and emits `sitemap.xml` with `lastmod`, `changefreq`, `priority`. |
| `robots.js` | Environment-aware `robots.txt` (dev and staging are fully disallowed). |
| `audit.js` | Programmatic audit: mandatory tags, lengths, heading hierarchy, image alt, broken internal links, cannibalisation. |
| `apply.js` | Idempotent codemod that writes the config into the static HTML pages. |
| `build.js` | CLI entry point. |

## Commands

```bash
npm run seo:audit                  # report problems, exit 1 on error
npm run seo:apply                  # write config into the HTML pages
npm run seo:check                  # dry run of the codemod
SEO_ENV=production npm run build   # sitemap + robots + audit
```

`SEO_ENV` (or `DEPLOY_ENV` / `VERCEL_ENV` / `NODE_ENV`) selects the environment.
Anything other than `production` produces a `Disallow: /` robots policy, so a
preview deploy can never compete with the live site in search results.

## Workflow

`config.js` is the only file you edit by hand. After changing it run
`npm run seo:apply` to regenerate the managed part of every `<head>`, then
`npm run seo:audit` to confirm. The codemod is idempotent: running it twice
produces no diff.

The codemod rewrites titles, descriptions, canonicals, Open Graph and Twitter
tags, and regenerates BreadcrumbList and FAQPage JSON-LD. FAQ entries are read
straight from the page's own `<h3>`/`<p>` markup, so the structured data can
never drift from the visible copy. Any hand-written JSON-LD the module does not
generate (such as `Service`) is preserved.

## Using the components directly

```js
const { renderMeta } = require('./seo/meta');
const sd = require('./seo/structured-data');

const head = renderMeta({
  title: 'Web Design Cambodia | Business Websites | Web Technics',
  description: '…150-160 characters…',
  canonical: '/web-design-cambodia.html',
});

const jsonLd = sd.renderJsonLd([
  sd.organization(),
  sd.breadcrumbList([{ name: 'Home', url: '/' }, { name: 'Web Design Cambodia' }]),
  sd.faq([{ question: 'Do you work outside Cambodia?', answer: 'Yes.' }]),
]);
```

`renderMeta` throws on invalid props; `validateMetaProps` returns the same
problems as an array when you want to collect them instead.

## Performance rules the module enforces

- No script in `<head>` without `defer`. `consent.js`, `analytics.js` and
  `app.js` are all deferred.
- Google Fonts is preloaded and applied via a `media="print"` swap with a
  `<noscript>` fallback, so it never blocks first render.
- The first image on a page is eager with `fetchpriority="high"`; every other
  image gets `loading="lazy"`.
- All known images carry intrinsic `width`/`height` to prevent layout shift.
- JSON-LD is inert `application/ld+json` and never blocks parsing.

## Anti-cannibalisation

Each route declares exactly one `primaryKeyword`. The audit fails the build if
two routes claim the same primary keyword, if one route lists another route's
primary keyword as a secondary term, or if two indexable pages ship identical
titles.
