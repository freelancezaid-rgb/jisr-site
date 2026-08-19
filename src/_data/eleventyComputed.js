const i18n = require("./i18n.js");

module.exports = {
  lang: (data) => data.lang || "fr",
  t: (data) => i18n[data.lang || "fr"],
};
