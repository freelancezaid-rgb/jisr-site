#!/usr/bin/env node
/**
 * Auto-fix invalid `date:` front matter values in articles.
 *
 * Decap CMS's date picker occasionally saves a broken value (e.g. "yyyy-08-Mo"
 * instead of a real date). Eleventy refuses to build when it finds a date it
 * can't parse, which takes down the ENTIRE site, not just the one article.
 *
 * This script runs automatically before every build (see "build" in
 * package.json). It scans all article files, and if a date isn't in the
 * expected YYYY-MM-DD format, it replaces it with today's date so the build
 * always succeeds. It never touches valid dates.
 */
const fs = require("fs");
const path = require("path");

const ARTICLE_DIRS = ["src/articles", "src/en/articles", "src/ar/articles"];

const VALID_DATE_RE = /^\d{4}-\d{2}-\d{2}(T[0-9:.Z+-]+)?$/;

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

let fixedCount = 0;

for (const dir of ARTICLE_DIRS) {
  const fullDir = path.join(__dirname, "..", dir);
  if (!fs.existsSync(fullDir)) continue;

  for (const file of fs.readdirSync(fullDir)) {
    if (!file.endsWith(".md")) continue;
    const filePath = path.join(fullDir, file);
    const content = fs.readFileSync(filePath, "utf8");

    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontMatterMatch) continue;
    const frontMatter = frontMatterMatch[1];

    const dateLineMatch = frontMatter.match(/^date:\s*(.+)\s*$/m);
    if (!dateLineMatch) continue;

    const rawValue = dateLineMatch[1].trim().replace(/^["']|["']$/g, "");

    if (!VALID_DATE_RE.test(rawValue)) {
      const today = todayISO();
      const fixedLine = dateLineMatch[0].replace(dateLineMatch[1], today);
      const newContent = content.replace(dateLineMatch[0], fixedLine);
      fs.writeFileSync(filePath, newContent, "utf8");
      fixedCount++;
      console.log(
        `[fix-invalid-dates] "${rawValue}" was not a valid date in ${dir}/${file} -> replaced with ${today}`
      );
    }
  }
}

if (fixedCount === 0) {
  console.log("[fix-invalid-dates] All article dates are valid, nothing to fix.");
} else {
  console.log(`[fix-invalid-dates] Fixed ${fixedCount} file(s).`);
}
