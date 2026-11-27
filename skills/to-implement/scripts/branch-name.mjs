#!/usr/bin/env node
// Branch name for an epic, story or bug:  node branch-name.mjs <epic|story|bug> <KEY> "<summary>"
//   epic  → epic/BREW-100-favorite-brews
//   story → feature/BREW-101-mark-a-brew-as-favorite
//   bug   → bug/BREW-110-star-resets-after-changing-sort
// Slug: accents stripped, lowercase, non-alphanumerics → "-", at most 50 characters, cut at a word boundary.
// See ~/.claude/references/branches.md.

const [type, key, ...words] = process.argv.slice(2);
const prefix = { epic: "epic", story: "feature", bug: "bug" }[String(type).toLowerCase()];
if (!prefix || !/^[A-Z][A-Z0-9]+-\d+$/.test(key || "") || !words.length) {
  console.error('usage: branch-name.mjs <epic|story|bug> <KEY> "<summary>"');
  process.exit(1);
}

let slug = words.join(" ")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

if (slug.length > 50) {
  slug = slug.slice(0, 51);
  slug = slug.includes("-") ? slug.slice(0, slug.lastIndexOf("-")) : slug.slice(0, 50);
}

console.log(`${prefix}/${key}-${slug || "change"}`);
