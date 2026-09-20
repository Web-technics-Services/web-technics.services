/**
 * Central SEO configuration — the single source of truth for every route.
 *
 * Keeping titles, descriptions and keyword ownership in one file is what makes
 * cannibalisation detectable: `audit.js` cross-checks every `primaryKeyword`
 * and `secondaryKeywords` entry and fails the build when two routes compete for
 * the same term.
 */

/**
 * @typedef {"development" | "staging" | "production"} Environment
 */

/**
 * @typedef {object} RouteSeo
 * @property {string} path            Route path relative to the site root, e.g. "/about.html".
 * @property {string} file            Source file on disk, relative to the repo root.
 * @property {string} title           Document title. Audited for the 50-60 character window.
 * @property {string} description     Meta description. Audited for the 150-160 character window.
 * @property {string} primaryKeyword  The one term this route is allowed to rank for.
 * @property {string[]} [secondaryKeywords] Supporting terms. Must not be another route's primary.
 * @property {string} [ogTitle]       Overrides `title` for Open Graph / Twitter.
 * @property {string} [ogDescription] Overrides `description` for Open Graph / Twitter.
 * @property {"website" | "article" | "profile"} [ogType]
 * @property {string} [image]         Absolute or root-relative social image URL.
 * @property {string} [imageAlt]
 * @property {"always"|"hourly"|"daily"|"weekly"|"monthly"|"yearly"|"never"} [changefreq]
 * @property {number} [priority]      Sitemap priority, 0.0-1.0.
 * @property {boolean} [noindex]      Excluded from the sitemap and marked noindex.
 * @property {Array<{name: string, url?: string}>} [breadcrumbs]
 * @property {Array<{question: string, answer: string}>} [faq]
 */

const site = {
  name: 'Web Technics',
  url: 'https://web-technics.services',
  locale: 'en',
  legalName: 'Web Technics',
  logo: '/assets/branding/web-technics-logo-horizontal-light.svg',
  defaultImage: '/assets/branding/web-technics-social-card.svg',
  defaultImageAlt:
    'Web Technics social preview card for web design, development, and SEO services',
  telephone: '+855969245074',
  email: 'info@web-technics.services',
  areaServed: ['Cambodia', 'Belgium', 'United Kingdom', 'Worldwide'],
  sameAs: [
    'https://github.com/web-technics',
    'https://t.me/web_technics_services',
    'https://wa.me/855965345954',
  ],
};

/**
 * Sibling properties that are NOT mirrors. Each owns a distinct market and
 * keyword set, so they self-canonicalise and must never duplicate our copy.
 */
const siblingSites = [
  {
    origin: 'https://web-technics.com',
    owns: 'Cambodia local market pages (web design, e-commerce, SEO, and NGO services).',
  },
];

/**
 * Routes this site no longer serves. The edge 301s them to the new owner so
 * the accumulated ranking signals transfer instead of being dropped.
 * The audit fails if any page still links to a moved path on this origin.
 */
const movedRoutes = {
  '/kampot-landing-page.html': 'https://web-technics.services/local-landing-page.html',
  '/web-design-cambodia.html': 'https://web-technics.com/web-design-cambodia.html',
  '/ecommerce-development-cambodia.html':
    'https://web-technics.com/ecommerce-development-cambodia.html',
  '/seo-services-cambodia.html': 'https://web-technics.com/seo-services-cambodia.html',
  '/ngo-web-design-cambodia.html': 'https://web-technics.com/ngo-web-design-cambodia.html',
};

/** @type {RouteSeo[]} */
const routes = [
  {
    path: '/',
    file: 'index.html',
    title: 'Web Technics | An Independent Web Studio in Cambodia',
    description:
      'Web Technics is an independent web studio building fast, credible websites and digital products for businesses and organizations in Cambodia and Belgium.',
    primaryKeyword: 'web technics',
    secondaryKeywords: ['independent web studio', 'digital products cambodia'],
    ogTitle: 'Web Technics | Thoughtful websites, built to move business forward',
    ogDescription:
      'Strategy, design, development, and optimization for ambitious teams in Cambodia, Belgium, and internationally.',
    changefreq: 'weekly',
    priority: 1.0,
  },
  {
    path: '/services.html',
    file: 'services.html',
    title: 'Our Capabilities | Web Studio Services | Web Technics',
    description:
      'Explore Web Technics capabilities: strategy, design, development, custom systems, local visibility and ongoing care for teams that want one studio partner.',
    primaryKeyword: 'web studio services',
    secondaryKeywords: ['website maintenance', 'custom web systems', 'digital support'],
    ogTitle: 'Web Design, Development & Local Marketing | Web Technics',
    ogDescription:
      'Complete websites, local visibility tools, custom development, and ongoing digital support from Kampot.',
    changefreq: 'monthly',
    priority: 0.9,
    breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Capabilities' }],
  },
  {
    path: '/local-landing-page.html',
    file: 'local-landing-page.html',
    title: 'Local Landing Page for Business Promotions | Web Technics',
    description:
      'A conversion-focused local landing page for an event, tour, property, promotion, or service, with location-based search targeting and tracked contact actions.',
    primaryKeyword: 'local landing page',
    secondaryKeywords: ['local promotion website', 'local campaign landing page'],
    ogTitle: 'Local Landing Page for Business Promotions | Web Technics',
    ogDescription:
      'One focused page, one conversion goal, local search targeting, and trackable customer actions.',
    changefreq: 'monthly',
    priority: 0.8,
    breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Local Landing Page' }],
  },
  {
    path: '/portfolio.html',
    file: 'portfolio.html',
    title: 'Selected Work | Client Projects | Web Technics Studio',
    description:
      'Explore public projects in the Web Technics portfolio across Cambodia, Belgium, France and the UK, with the context and constraints behind every build.',
    primaryKeyword: 'web technics portfolio',
    secondaryKeywords: ['selected work', 'case studies'],
    ogTitle: 'Selected Work | Web Technics',
    ogDescription:
      'A varied portfolio of company, hospitality, commerce, media, community, and personal websites.',
    changefreq: 'monthly',
    priority: 0.9,
    breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Work' }],
  },
  {
    path: '/about.html',
    file: 'about.html',
    title: 'Studio | About Web Technics and How Our Team Works',
    description:
      'Meet Web Technics, an independent web studio operating from Cambodia and collaborating with clients in Belgium, the UK and beyond on durable digital work.',
    primaryKeyword: 'about web technics',
    secondaryKeywords: ['web studio cambodia', 'our team'],
    ogTitle: 'Studio | About Web Technics',
    ogDescription:
      'A small, hands-on web studio combining strategy, design, and engineering.',
    changefreq: 'monthly',
    priority: 0.8,
    breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Studio' }],
  },
  {
    path: '/contact.html',
    file: 'contact.html',
    title: 'Start a Project | Contact the Web Technics Team Today',
    description:
      'Contact Web Technics about a website, web application, e-commerce or SEO project. Tell us what should work better for your customers and we will reply.',
    primaryKeyword: 'contact web technics',
    secondaryKeywords: ['start a project', 'request a quote'],
    ogTitle: 'Start a Project | Web Technics',
    ogDescription: 'Share your challenge, context, and timeline with Web Technics.',
    changefreq: 'monthly',
    priority: 0.8,
    breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Contact' }],
  },
  {
    path: '/privacy.html',
    file: 'privacy.html',
    title: 'Privacy Policy | How Web Technics Handles Your Data',
    description:
      'How Web Technics handles personal information, website analytics, cookies, data retention and international processing, plus the privacy rights you have.',
    primaryKeyword: 'web technics privacy policy',
    changefreq: 'yearly',
    priority: 0.3,
    breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Privacy' }],
  },
  {
    path: '/server-status.html',
    file: 'server-status.html',
    title: 'System Status | Web Technics',
    description:
      'Web Technics system status information. Operational details for active incidents are shared directly with affected clients through their usual support channel.',
    primaryKeyword: 'web technics system status',
    noindex: true,
    priority: 0.1,
  },
];

/** Paths that must never be crawled, in any environment. */
const disallow = ['/server-status.html', '/server-status.php'];

module.exports = { site, routes, disallow, siblingSites, movedRoutes };
