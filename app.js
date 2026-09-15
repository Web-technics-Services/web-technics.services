const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");

if (menuToggle && navLinks) {
  const closeMenu = () => {
    navLinks.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  };

  menuToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
}

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const revealElements = document.querySelectorAll(".reveal");

if (prefersReducedMotion || !("IntersectionObserver" in window)) {
  revealElements.forEach((element) => element.classList.add("show"));
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("show");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  revealElements.forEach((element) => observer.observe(element));
}

document.querySelectorAll("[data-year]").forEach((label) => {
  label.textContent = new Date().getFullYear();
});

const contactEmail = String.fromCharCode(
  105, 110, 102, 111, 64, 119, 101, 98, 45, 116, 101, 99, 104, 110, 105, 99, 115, 46, 115, 101, 114, 118, 105, 99, 101, 115
);

document.querySelectorAll("[data-email-link]").forEach((link) => {
  link.href = `mailto:${contactEmail}`;
  link.textContent = contactEmail;
});

const progressBar = document.createElement("div");
progressBar.id = "scroll-progress";
progressBar.setAttribute("aria-hidden", "true");
document.body.appendChild(progressBar);

const toTopButton = document.createElement("button");
toTopButton.className = "to-top";
toTopButton.type = "button";
toTopButton.setAttribute("aria-label", "Back to top");
toTopButton.textContent = "↑";
document.body.appendChild(toTopButton);

const updateScrollUI = () => {
  const scrollTop = window.scrollY;
  const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
  progressBar.style.width = `${scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0}%`;
  toTopButton.classList.toggle("show", scrollTop > 500);
};

window.addEventListener("scroll", updateScrollUI, { passive: true });
updateScrollUI();
toTopButton.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
});

const filterButtons = document.querySelectorAll(".filter-chip[data-filter-group]");
const portfolioCards = document.querySelectorAll("[data-portfolio-item]");
const portfolioSearch = document.querySelector(".portfolio-search");
const portfolioEmpty = document.querySelector(".portfolio-empty");
const portfolioCount = document.querySelector("[data-result-count]");
const portfolioReset = document.querySelector("[data-filter-reset]");

if (portfolioCards.length) {
  const activeFilters = { category: "all", technology: "all", region: "all" };

  const applyPortfolioFilters = () => {
    const searchTerm = (portfolioSearch?.value || "").trim().toLowerCase();
    let visibleCount = 0;

    portfolioCards.forEach((card) => {
      const categoryMatch = activeFilters.category === "all" || card.dataset.category === activeFilters.category;
      const technologyMatch = activeFilters.technology === "all" || (card.dataset.technology || "").split(" ").includes(activeFilters.technology);
      const regionMatch = activeFilters.region === "all" || card.dataset.region === activeFilters.region;
      const searchMatch = (card.dataset.search || "").toLowerCase().includes(searchTerm);
      const isVisible = categoryMatch && technologyMatch && regionMatch && searchMatch;
      card.classList.toggle("is-hidden", !isVisible);
      if (isVisible) visibleCount += 1;
    });

    portfolioEmpty?.classList.toggle("show", visibleCount === 0);
    if (portfolioCount) {
      portfolioCount.textContent = `${visibleCount} ${visibleCount === 1 ? "project" : "projects"}`;
    }
  };

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const group = button.dataset.filterGroup;
      filterButtons.forEach((chip) => {
        if (chip.dataset.filterGroup !== group) return;
        chip.classList.remove("active");
        chip.setAttribute("aria-pressed", "false");
      });
      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");
      activeFilters[group] = button.dataset.filter || "all";
      applyPortfolioFilters();
    });
  });

  portfolioSearch?.addEventListener("input", applyPortfolioFilters);
  portfolioReset?.addEventListener("click", () => {
    Object.keys(activeFilters).forEach((group) => {
      activeFilters[group] = "all";
      const buttons = document.querySelectorAll(`[data-filter-group="${group}"]`);
      buttons.forEach((button) => {
        const isAll = button.dataset.filter === "all";
        button.classList.toggle("active", isAll);
        button.setAttribute("aria-pressed", String(isAll));
      });
    });
    if (portfolioSearch) portfolioSearch.value = "";
    applyPortfolioFilters();
  });
  applyPortfolioFilters();
}

const contactForm = document.querySelector("[data-contact-form]");
if (contactForm) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(contactForm);
    const subject = encodeURIComponent(`Project enquiry from ${data.get("name") || "website visitor"}`);
    const body = encodeURIComponent(
      `Name: ${data.get("name") || ""}\nEmail: ${data.get("email") || ""}\nCompany: ${data.get("company") || ""}\nProject type: ${data.get("project") || ""}\nTimeline: ${data.get("timeline") || ""}\n\nProject brief:\n${data.get("message") || ""}`
    );
    window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`;
  });
}
