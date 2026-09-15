/**
 * GA4 event tracking.
 *
 * consent.js owns whether Google Analytics loads at all. This module only
 * describes *what* to measure, and queues events until consent is granted, so
 * nothing is lost between page load and the visitor accepting analytics.
 *
 * The measurement ID is read from consent.js rather than hardcoded, so this
 * file is identical across web-technics.services and web-technics.com even
 * though they report into different GA4 properties.
 *
 * Events are attached with delegation on a single passive listener, so adding
 * tracking costs no measurable work on the main thread.
 */
(() => {
  const QUEUE_LIMIT = 50;
  /** @type {Array<[string, Record<string, unknown>]>} */
  const queue = [];

  const measurementId = () =>
    window.webTechnicsMeasurementId ||
    ((document.querySelector('script[data-google-analytics]') || {}).dataset || {})
      .googleAnalytics ||
    null;

  // Resolved on every call: consent.js may set the ID after this script runs,
  // and a later rejection must be observed rather than cached away.
  const disabled = () => {
    const id = measurementId();
    return Boolean(id && window[`ga-disable-${id}`] === true);
  };

  const analyticsReady = () => typeof window.gtag === 'function' && !disabled();

  /**
   * Send a GA4 event, or hold it until analytics consent arrives.
   *
   * @param {string} name
   * @param {Record<string, unknown>} [params]
   */
  const track = (name, params = {}) => {
    const payload = { page_path: location.pathname, ...params };
    if (analyticsReady()) {
      window.gtag('event', name, payload);
      return;
    }
    if (queue.length < QUEUE_LIMIT) queue.push([name, payload]);
  };

  const flush = () => {
    if (!analyticsReady()) return;
    while (queue.length) {
      const [name, params] = queue.shift();
      window.gtag('event', name, params);
    }
  };

  // consent.js loads gtag asynchronously; poll briefly rather than racing it.
  const flushTimer = setInterval(() => {
    if (!analyticsReady()) return;
    flush();
    clearInterval(flushTimer);
  }, 500);
  setTimeout(() => clearInterval(flushTimer), 30000);

  const label = (element) =>
    (element.getAttribute('aria-label') || element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100);

  document.addEventListener(
    'click',
    (event) => {
      const link = event.target.closest('a[href]');
      if (link) {
        const href = link.getAttribute('href') || '';

        if (href.startsWith('mailto:')) {
          track('generate_lead', { method: 'email', link_text: label(link) });
        } else if (href.startsWith('tel:')) {
          track('generate_lead', { method: 'phone', link_text: label(link) });
        } else if (/^https?:/i.test(href) && !href.includes(location.hostname)) {
          track('click', {
            link_domain: (href.split('/')[2] || '').toLowerCase(),
            link_url: href,
            link_text: label(link),
            outbound: true,
          });
        } else if (link.classList.contains('btn') || link.classList.contains('nav-cta')) {
          track('cta_click', { link_text: label(link), link_url: href });
        }
        return;
      }

      const button = event.target.closest('button');
      if (!button) return;

      if (button.classList.contains('cookie-choice')) {
        track('consent_choice', { choice: label(button) });
      } else if (button.classList.contains('filter-chip')) {
        track('portfolio_filter', {
          filter_group: button.dataset.filterGroup,
          filter_value: button.dataset.filter,
        });
      }
    },
    { passive: true, capture: true }
  );

  const contactForm = document.querySelector('[data-contact-form]');
  if (contactForm) {
    let started = false;
    contactForm.addEventListener(
      'input',
      () => {
        if (started) return;
        started = true;
        track('form_start', { form_id: 'contact' });
      },
      { passive: true, once: false }
    );

    contactForm.addEventListener('submit', () => {
      const data = new FormData(contactForm);
      track('generate_lead', {
        method: 'contact_form',
        form_id: 'contact',
        project_type: data.get('project') || 'unspecified',
        timeline: data.get('timeline') || 'unspecified',
      });
    });
  }

  const search = document.querySelector('.portfolio-search');
  if (search) {
    let timer;
    search.addEventListener(
      'input',
      () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const term = search.value.trim();
          if (term.length > 2) track('search', { search_term: term });
        }, 900);
      },
      { passive: true }
    );
  }

  // Scroll depth, reported once per threshold per page view.
  const thresholds = [25, 50, 75, 90];
  const reached = new Set();
  const onScroll = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return;
    const percent = Math.round((window.scrollY / scrollable) * 100);
    for (const threshold of thresholds) {
      if (percent >= threshold && !reached.has(threshold)) {
        reached.add(threshold);
        track('scroll', { percent_scrolled: threshold });
      }
    }
    if (reached.size === thresholds.length) {
      window.removeEventListener('scroll', onScroll);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  window.webTechnicsTrack = track;
})();
