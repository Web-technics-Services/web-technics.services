/**
 * Reusable meta tag component.
 *
 * `renderMeta()` returns a string of `<head>` tags, so it works identically in a
 * static build step and inside any server-side render. Nothing it emits is
 * render-blocking: it produces metadata only, and the resource hints it adds are
 * `preconnect`/`preload` rather than synchronous scripts.
 */

const { site } = require('./config');

/**
 * @typedef {object} MetaProps
 * @property {string} title           Document title, 50-60 characters.
 * @property {string} description     Meta description, 150-160 characters.
 * @property {string} canonical       Absolute canonical URL, or a root-relative path.
 * @property {"website"|"article"|"profile"} [ogType="website"]
 * @property {string} [ogTitle]       Defaults to `title`.
 * @property {string} [ogDescription] Defaults to `description`.
 * @property {string} [image]         Social image. Defaults to the site card.
 * @property {string} [imageAlt]
 * @property {boolean} [noindex=false]
 * @property {string} [locale="en"]
 * @property {string} [siteName]
 * @property {Array<{rel: string, href: string, as?: string, type?: string, crossorigin?: boolean}>} [preload]
 * @property {Record<string, string>} [additional] Extra `name` -> `content` meta pairs.
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape a value for safe use inside an HTML attribute. */
function escapeAttr(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

/** Resolve a possibly root-relative URL against the configured site origin. */
function absoluteUrl(value, base = site.url) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `${base.replace(/\/$/, '')}/${String(value).replace(/^\//, '')}`;
}

/**
 * Render the full set of SEO `<head>` tags for one page.
 *
 * @param {MetaProps} props
 * @returns {string} HTML ready to be injected into `<head>`.
 */
function renderMeta(props) {
  const errors = validateMetaProps(props);
  if (errors.length) {
    throw new TypeError(`renderMeta received invalid props:\n - ${errors.join('\n - ')}`);
  }

  const {
    title,
    description,
    canonical,
    ogType = 'website',
    ogTitle = title,
    ogDescription = description,
    image = site.defaultImage,
    imageAlt = site.defaultImageAlt,
    noindex = false,
    locale = site.locale,
    siteName = site.name,
    preload = [],
    additional = {},
  } = props;

  const canonicalUrl = absoluteUrl(canonical);
  const imageUrl = absoluteUrl(image);
  const robots = noindex
    ? 'noindex, nofollow'
    : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

  const tags = [
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `<title>${escapeAttr(title)}</title>`,
    `<meta name="description" content="${escapeAttr(description)}">`,
    `<meta name="robots" content="${robots}">`,
    `<link rel="canonical" href="${escapeAttr(canonicalUrl)}">`,
    `<meta property="og:type" content="${escapeAttr(ogType)}">`,
    `<meta property="og:site_name" content="${escapeAttr(siteName)}">`,
    `<meta property="og:locale" content="${escapeAttr(locale)}">`,
    `<meta property="og:title" content="${escapeAttr(ogTitle)}">`,
    `<meta property="og:description" content="${escapeAttr(ogDescription)}">`,
    `<meta property="og:url" content="${escapeAttr(canonicalUrl)}">`,
    `<meta property="og:image" content="${escapeAttr(imageUrl)}">`,
    `<meta property="og:image:alt" content="${escapeAttr(imageAlt)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeAttr(ogTitle)}">`,
    `<meta name="twitter:description" content="${escapeAttr(ogDescription)}">`,
    `<meta name="twitter:image" content="${escapeAttr(imageUrl)}">`,
    `<meta name="twitter:image:alt" content="${escapeAttr(imageAlt)}">`,
  ];

  for (const [name, content] of Object.entries(additional)) {
    tags.push(`<meta name="${escapeAttr(name)}" content="${escapeAttr(content)}">`);
  }

  for (const hint of preload) {
    const attrs = [`rel="${escapeAttr(hint.rel)}"`, `href="${escapeAttr(hint.href)}"`];
    if (hint.as) attrs.push(`as="${escapeAttr(hint.as)}"`);
    if (hint.type) attrs.push(`type="${escapeAttr(hint.type)}"`);
    if (hint.crossorigin) attrs.push('crossorigin');
    tags.push(`<link ${attrs.join(' ')}>`);
  }

  return tags.join('\n  ');
}

/**
 * Validate meta props without throwing. Used by the audit so it can report every
 * problem at once instead of failing on the first one.
 *
 * @param {Partial<MetaProps>} props
 * @returns {string[]} Human-readable problems; empty when valid.
 */
function validateMetaProps(props) {
  const errors = [];
  if (!props || typeof props !== 'object') return ['props must be an object'];
  if (typeof props.title !== 'string' || !props.title.trim()) errors.push('title is required');
  if (typeof props.description !== 'string' || !props.description.trim()) {
    errors.push('description is required');
  }
  if (typeof props.canonical !== 'string' || !props.canonical.trim()) {
    errors.push('canonical is required');
  }
  if (props.ogType && !['website', 'article', 'profile'].includes(props.ogType)) {
    errors.push(`ogType "${props.ogType}" is not one of website|article|profile`);
  }
  return errors;
}

/**
 * Build `renderMeta` props from a `RouteSeo` entry in `config.js`.
 *
 * @param {import('./config').RouteSeo} route
 * @returns {MetaProps}
 */
function metaPropsForRoute(route) {
  return {
    title: route.title,
    description: route.description,
    canonical: absoluteUrl(route.path),
    ogType: route.ogType || 'website',
    ogTitle: route.ogTitle || route.title,
    ogDescription: route.ogDescription || route.description,
    image: route.image || site.defaultImage,
    imageAlt: route.imageAlt || site.defaultImageAlt,
    noindex: Boolean(route.noindex),
  };
}

module.exports = { renderMeta, validateMetaProps, metaPropsForRoute, absoluteUrl, escapeAttr };
