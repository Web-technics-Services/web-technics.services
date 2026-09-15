(() => {
  const measurementId = "G-MMMGPHD62R";
  // Published so analytics.js can gate on the same property without hardcoding it.
  window.webTechnicsMeasurementId = measurementId;
  const storageKey = "webTechnicsAnalyticsConsent";
  const consentVersion = 1;
  const consentLifetime = 180 * 24 * 60 * 60 * 1000;

  const readConsent = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey));
      if (
        stored?.version === consentVersion &&
        ["accepted", "rejected"].includes(stored.choice) &&
        Date.now() - stored.createdAt < consentLifetime
      ) {
        return stored.choice;
      }
    } catch (error) {
      console.warn("Cookie preference could not be read.", error);
    }
    return null;
  };

  const saveConsent = (choice) => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ choice, createdAt: Date.now(), version: consentVersion })
      );
    } catch (error) {
      console.warn("Cookie preference could not be saved.", error);
    }
  };

  const loadAnalytics = () => {
    if (document.querySelector(`script[data-google-analytics="${measurementId}"]`)) return;

    window[`ga-disable-${measurementId}`] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    window.gtag("js", new Date());
    window.gtag("config", measurementId, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });

    const script = document.createElement("script");
    script.async = true;
    script.dataset.googleAnalytics = measurementId;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);
  };

  const removeAnalyticsCookies = () => {
    document.cookie.split(";").forEach((cookie) => {
      const name = cookie.split("=")[0].trim();
      if (name === "_ga" || name.startsWith("_ga_")) {
        document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
        document.cookie = `${name}=; Max-Age=0; path=/; domain=${location.hostname}; SameSite=Lax`;
      }
    });
  };

  const disableAnalytics = () => {
    window[`ga-disable-${measurementId}`] = true;
    if (window.gtag) {
      window.gtag("consent", "update", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
    }
    removeAnalyticsCookies();
  };

  const hideBanner = () => {
    document.querySelector("[data-cookie-banner]")?.remove();
  };

  const showBanner = () => {
    hideBanner();

    const banner = document.createElement("section");
    banner.className = "cookie-banner";
    banner.dataset.cookieBanner = "";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-modal", "false");
    banner.setAttribute("aria-labelledby", "cookie-banner-title");

    const content = document.createElement("div");
    content.className = "cookie-banner__content";

    const copy = document.createElement("div");
    const title = document.createElement("h2");
    title.id = "cookie-banner-title";
    title.textContent = "Your privacy choices";
    const text = document.createElement("p");
    text.append("We use optional Google Analytics cookies to understand website use. You can accept or reject analytics. Read our ");
    const privacyLink = document.createElement("a");
    privacyLink.href = "privacy.html";
    privacyLink.textContent = "privacy policy";
    text.append(privacyLink, ".");
    copy.append(title, text);

    const actions = document.createElement("div");
    actions.className = "cookie-banner__actions";
    const rejectButton = document.createElement("button");
    rejectButton.className = "cookie-choice";
    rejectButton.type = "button";
    rejectButton.textContent = "Reject analytics";
    const acceptButton = document.createElement("button");
    acceptButton.className = "cookie-choice";
    acceptButton.type = "button";
    acceptButton.textContent = "Accept analytics";

    rejectButton.addEventListener("click", () => {
      saveConsent("rejected");
      disableAnalytics();
      hideBanner();
    });
    acceptButton.addEventListener("click", () => {
      saveConsent("accepted");
      loadAnalytics();
      hideBanner();
    });

    actions.append(rejectButton, acceptButton);
    content.append(copy, actions);
    banner.append(content);
    document.body.appendChild(banner);
    rejectButton.focus();
  };

  const initializeConsent = () => {
    const consent = readConsent();
    if (consent === "accepted") {
      loadAnalytics();
    } else {
      disableAnalytics();
      if (consent !== "rejected") {
        showBanner();
      }
    }

    document.querySelectorAll("[data-cookie-settings]").forEach((button) => {
      button.addEventListener("click", showBanner);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeConsent);
  } else {
    initializeConsent();
  }
})();
