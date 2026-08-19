const { DateTime } = require("luxon");

module.exports = function (eleventyConfig) {
  // Static passthrough
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("src/_redirects");

  // Watch CSS for rebuilds
  eleventyConfig.addWatchTarget("src/assets/css/");

  // Current year shortcode for footer copyright
  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

  // Date filters
  eleventyConfig.addFilter("dateFr", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).setLocale("fr").toFormat("d LLLL yyyy");
  });
  eleventyConfig.addFilter("dateEn", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).setLocale("en").toFormat("LLLL d, yyyy");
  });
  eleventyConfig.addFilter("dateAr", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).setLocale("ar").toFormat("d LLLL yyyy");
  });

  // Collections per language, sorted newest first
  const langGlobs = {
    fr: "src/articles/*.md",
    en: "src/en/articles/*.md",
    ar: "src/ar/articles/*.md",
  };
  Object.keys(langGlobs).forEach((lang) => {
    eleventyConfig.addCollection(`articles_${lang}`, (collectionApi) => {
      return collectionApi.getFilteredByGlob(langGlobs[lang]).sort((a, b) => {
        return (b.data.date || 0) - (a.data.date || 0);
      });
    });
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      output: "_site",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
