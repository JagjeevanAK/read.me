/*
 * Export posts to the portfolio's blogs/ folder without opening the studio.
 *   npm run export -- <slug> [<slug> ...]
 *   npm run export -- --all        every post that isn't a draft
 *   npm run export -- --index      just rebuild blogs/index.html
 */
import path from "node:path";
import { exportPost, listPosts, STUDIO_DIR, writeIndex } from "../server/posts.ts";

const args = process.argv.slice(2);
const rel = (f: string) => path.relative(path.resolve(STUDIO_DIR, ".."), f).replace(/\\/g, "/");

if (!args.length) {
  console.log("Usage: npm run export -- <slug> | --all | --index\n\nPosts:");
  for (const p of listPosts()) console.log(`  ${p.slug.padEnd(32)} ${p.meta.draft ? "(draft) " : ""}${p.meta.title}`);
  process.exit(0);
}

if (args.includes("--index")) {
  console.log(`index  -> ${rel(writeIndex())}`);
  process.exit(0);
}

const slugs = args.includes("--all") ? listPosts().filter((p) => !p.meta.draft).map((p) => p.slug) : args;
let failed = 0;
for (const slug of slugs) {
  try {
    const r = exportPost(slug);
    console.log(`${slug}  -> ${rel(r.file)}  (${(r.bytes / 1024).toFixed(1)} KB)`);
    r.warnings.forEach((w) => console.log(`  warning: ${w}`));
  } catch (e) {
    failed++;
    console.error(`${slug}  failed: ${e instanceof Error ? e.message : e}`);
  }
}
process.exit(failed ? 1 : 0);
