/**
 * JSON-LD structured data generators.
 *
 * Every generator returns a plain object so callers can compose, test and diff
 * them. `renderJsonLd()` serialises one or many objects into `<script>` tags;
 * `type="application/ld+json"` is inert and never blocks rendering or parsing.
 */

const { site } = require('./config');
const { absoluteUrl } = require('./meta');

/** Strip undefined/null/empty values so the emitted JSON-LD stays clean. */
function compact(object) {
  if (Array.isArray(object)) {
    const items = object.map(compact).filter((item) => item !== undefined);
    return items.length ? items : undefined;
  }
  if (object && typeof object === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(object)) {
      const cleaned = compact(value);
      if (cleaned !== undefined) result[key] = cleaned;
    }
    return Object.keys(result).length ? result : undefined;
  }
  if (object === null || object === '' || object === undefined) return undefined;
  return object;
}

const CONTEXT = 'https://schema.org';

/**
 * @typedef {object} OrganizationInput
 * @property {string} [name]
 * @property {string} [url]
 * @property {string} [logo]
 * @property {string} [description]
 * @property {string} [telephone]
 * @property {string} [email]
 * @property {string[]} [areaServed]
 * @property {string[]} [sameAs]
 */

/** @param {OrganizationInput} [input] */
function organization(input = {}) {
  return compact({
    '@context': CONTEXT,
    '@type': 'Organization',
    '@id': `${site.url}/#organization`,
    name: input.name || site.name,
    legalName: input.legalName || site.legalName,
    url: absoluteUrl(input.url || '/'),
    logo: absoluteUrl(input.logo || site.logo),
    description: input.description,
    telephone: input.telephone || site.telephone,
    email: input.email || site.email,
    areaServed: input.areaServed || site.areaServed,
    sameAs: input.sameAs || site.sameAs,
  });
}

/** The site-level WebSite node. Enables sitelinks and name disambiguation. */
function website(input = {}) {
  return compact({
    '@context': CONTEXT,
    '@type': 'WebSite',
    '@id': `${site.url}/#website`,
    name: input.name || site.name,
    url: absoluteUrl('/'),
    inLanguage: input.locale || site.locale,
    publisher: { '@id': `${site.url}/#organization` },
  });
}

/**
 * @typedef {object} ArticleInput
 * @property {string} headline
 * @property {string} description
 * @property {string} url
 * @property {string} datePublished  ISO 8601 date.
 * @property {string} [dateModified]
 * @property {string} [image]
 * @property {string} [authorName]
 * @property {string[]} [keywords]
 */

/** @param {ArticleInput} input */
function article(input) {
  requireFields('article', input, ['headline', 'description', 'url', 'datePublished']);
  return compact({
    '@context': CONTEXT,
    '@type': 'Article',
    headline: truncate(input.headline, 110),
    description: input.description,
    url: absoluteUrl(input.url),
    mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(input.url) },
    image: absoluteUrl(input.image || site.defaultImage),
    datePublished: input.datePublished,
    dateModified: input.dateModified || input.datePublished,
    keywords: input.keywords,
    author: { '@type': 'Organization', name: input.authorName || site.name },
    publisher: { '@id': `${site.url}/#organization` },
  });
}

/**
 * @typedef {object} ProductInput
 * @property {string} name
 * @property {string} description
 * @property {string} url
 * @property {string} [sku]
 * @property {string} [brand]
 * @property {string} [image]
 * @property {{price: number|string, currency: string, availability?: string, url?: string}} [offer]
 * @property {{ratingValue: number|string, reviewCount: number|string}} [aggregateRating]
 */

/** @param {ProductInput} input */
function product(input) {
  requireFields('product', input, ['name', 'description', 'url']);
  const offer = input.offer
    ? {
        '@type': 'Offer',
        price: String(input.offer.price),
        priceCurrency: input.offer.currency,
        availability: `https://schema.org/${input.offer.availability || 'InStock'}`,
        url: absoluteUrl(input.offer.url || input.url),
      }
    : undefined;

  return compact({
    '@context': CONTEXT,
    '@type': 'Product',
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.url),
    sku: input.sku,
    image: absoluteUrl(input.image || site.defaultImage),
    brand: { '@type': 'Brand', name: input.brand || site.name },
    offers: offer,
    aggregateRating: input.aggregateRating
      ? {
          '@type': 'AggregateRating',
          ratingValue: String(input.aggregateRating.ratingValue),
          reviewCount: String(input.aggregateRating.reviewCount),
        }
      : undefined,
  });
}

/**
 * @param {Array<{question: string, answer: string}>} items
 */
function faq(items) {
  if (!Array.isArray(items) || !items.length) {
    throw new TypeError('faq() requires a non-empty array of {question, answer}');
  }
  return compact({
    '@context': CONTEXT,
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  });
}

/**
 * @param {Array<{name: string, url?: string}>} items Ordered, root first.
 */
function breadcrumbList(items) {
  if (!Array.isArray(items) || !items.length) {
    throw new TypeError('breadcrumbList() requires a non-empty array of {name, url?}');
  }
  return compact({
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      // The final crumb is the current page and intentionally carries no `item`.
      item: item.url ? absoluteUrl(item.url) : undefined,
    })),
  });
}

/**
 * @typedef {object} ServiceInput
 * @property {string} name
 * @property {string} description
 * @property {string} url
 * @property {string} [serviceType]
 * @property {string[]} [areaServed]
 */

/** @param {ServiceInput} input */
function service(input) {
  requireFields('service', input, ['name', 'description', 'url']);
  return compact({
    '@context': CONTEXT,
    '@type': 'Service',
    name: input.name,
    serviceType: input.serviceType || input.name,
    description: input.description,
    url: absoluteUrl(input.url),
    areaServed: input.areaServed || site.areaServed,
    provider: { '@id': `${site.url}/#organization` },
  });
}

/**
 * Build every graph node a route deserves, driven purely by its config entry.
 *
 * @param {import('./config').RouteSeo} route
 * @returns {object[]}
 */
function forRoute(route) {
  const nodes = [];
  if (route.path === '/') {
    nodes.push(organization(), website());
  }
  if (Array.isArray(route.breadcrumbs) && route.breadcrumbs.length) {
    nodes.push(breadcrumbList(route.breadcrumbs));
  }
  if (Array.isArray(route.faq) && route.faq.length) {
    nodes.push(faq(route.faq));
  }
  return nodes;
}

/**
 * Serialise one or more JSON-LD objects into script tags.
 *
 * @param {object|object[]} data
 * @param {{pretty?: boolean, indent?: string}} [options]
 * @returns {string}
 */
function renderJsonLd(data, options = {}) {
  const { pretty = true, indent = '  ' } = options;
  const items = Array.isArray(data) ? data : [data];
  return items
    .filter(Boolean)
    .map((item) => {
      // `</script>` inside a JSON string would close the tag early.
      const json = JSON.stringify(item, null, pretty ? 2 : 0).replace(/</g, '\\u003c');
      const body = pretty
        ? json
            .split('\n')
            .map((line) => `${indent}${indent}${line}`)
            .join('\n')
        : json;
      return `<script type="application/ld+json">\n${body}\n${indent}</script>`;
    })
    .join('\n  ');
}

function requireFields(name, input, fields) {
  if (!input || typeof input !== 'object') {
    throw new TypeError(`${name}() requires an input object`);
  }
  const missing = fields.filter((field) => !input[field]);
  if (missing.length) {
    throw new TypeError(`${name}() is missing required field(s): ${missing.join(', ')}`);
  }
}

function truncate(value, max) {
  const text = String(value);
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

module.exports = {
  organization,
  website,
  article,
  product,
  faq,
  breadcrumbList,
  service,
  forRoute,
  renderJsonLd,
};
