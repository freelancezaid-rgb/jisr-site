const i18n = require("./i18n.js");

// Page keys that exist in every language (same key = same page, translated URL).
const PAGE_KEYS = ["home", "manifestoUrl", "articlesUrl", "joinUrl", "contactUrl", "privacyUrl"];

function resolvePageKey(data) {
  const url = data.page && data.page.url;
  const current = i18n[data.lang || "fr"];
  let key = PAGE_KEYS.find((k) => current[k] === url);
  let exact = Boolean(key);
  if (!key && url && url.startsWith(current.articlesUrl)) key = "articlesUrl"; // article detail
  return { key: key || "home", exact };
}

module.exports = {
  lang: (data) => data.lang || "fr",
  t: (data) => i18n[data.lang || "fr"],
  // Equivalent URL of the current page in each language (for the language switcher + hreflang)
  langLinks: (data) => {
    const { key } = resolvePageKey(data);
    return { fr: i18n.fr[key], en: i18n.en[key], ar: i18n.ar[key] };
  },
  // hreflang only makes sense when the page really has a translation (not article detail pages)
  hasTranslations: (data) => resolvePageKey(data).exact,
};
