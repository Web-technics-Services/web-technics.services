const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");

if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("show");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.18 }
);

document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));

const yearLabel = document.querySelector("[data-year]");
if (yearLabel) {
  yearLabel.textContent = new Date().getFullYear();
}

const progressBar = document.createElement("div");
progressBar.id = "scroll-progress";
document.body.appendChild(progressBar);

const toTopButton = document.createElement("button");
toTopButton.className = "to-top";
toTopButton.setAttribute("aria-label", "Scroll to top");
toTopButton.textContent = "↑";
document.body.appendChild(toTopButton);

const updateScrollUI = () => {
  const scrollTop = window.scrollY;
  const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
  progressBar.style.width = `${progress}%`;
  toTopButton.classList.toggle("show", scrollTop > 420);
};

window.addEventListener("scroll", updateScrollUI, { passive: true });
updateScrollUI();

toTopButton.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

const countUp = (element) => {
  const target = Number(element.dataset.count || 0);
  const suffix = element.dataset.suffix || "";
  const duration = 1300;
  const start = performance.now();

  const frame = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.floor(target * eased);
    element.textContent = `${value}${suffix}`;
    if (progress < 1) {
      requestAnimationFrame(frame);
    }
  };

  requestAnimationFrame(frame);
};

const statObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        countUp(entry.target);
        statObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.6 }
);

document.querySelectorAll("[data-count]").forEach((counter) => statObserver.observe(counter));

const filterButtons = document.querySelectorAll(".filter-chip");
const portfolioCards = document.querySelectorAll("[data-portfolio-item]");
const portfolioSearch = document.querySelector(".portfolio-search");
const portfolioEmpty = document.querySelector(".portfolio-empty");

if (portfolioCards.length) {
  let activeCategory = "all";

  const applyPortfolioFilters = () => {
    const searchTerm = (portfolioSearch?.value || "").trim().toLowerCase();
    let visibleCount = 0;

    portfolioCards.forEach((card) => {
      const category = card.dataset.category || "other";
      const searchable = card.dataset.search || "";
      const categoryMatch = activeCategory === "all" || category === activeCategory;
      const searchMatch = searchable.includes(searchTerm);
      const show = categoryMatch && searchMatch;
      card.classList.toggle("is-hidden", !show);
      if (show) visibleCount += 1;
    });

    if (portfolioEmpty) {
      portfolioEmpty.classList.toggle("show", visibleCount === 0);
    }
  };

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      filterButtons.forEach((chip) => chip.classList.remove("active"));
      button.classList.add("active");
      activeCategory = button.dataset.filter || "all";
      applyPortfolioFilters();
    });
  });

  if (portfolioSearch) {
    portfolioSearch.addEventListener("input", applyPortfolioFilters);
  }

  applyPortfolioFilters();
}
