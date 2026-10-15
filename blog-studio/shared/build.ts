import { createRenderer, escapeHtml as esc, icon, readingMinutes, splitAtSimulation, SIM_MARKER } from "./markdown.ts";
import type { Assets, BuildOptions, PostMeta, PostSource, PostSummary, SiteConfig, TocItem } from "./types.ts";

const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">';

/* Runs before first paint so there is no light/dark flash. Same "theme" key as the portfolio. */
const THEME_INIT =
  "(function(){var r=document.documentElement;if(r.hasAttribute('data-force-theme'))return;var t=null;try{t=localStorage.getItem('theme')}catch(e){}" +
  "if(t!=='light'&&t!=='dark')t=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';r.setAttribute('data-theme',t)})();";

const FAVICON =
  "data:image/svg+xml," +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#6d28d9"/></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#g)"/><circle cx="16" cy="16" r="5" fill="#fff"/></svg>');

const I = {
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 1.5v2M12 20.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1.5 12h2M20.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  shrink: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
  arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
};

/** "</script" inside inlined code would end the script tag early. */
const safeScript = (js: string) => js.replace(/<\/(script)/gi, "<\\/$1");
const safeStyle = (css: string) => css.replace(/<\/(style)/gi, "<\\/$1");

export function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (isNaN(+d)) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

export const hasSimulation = (p: Pick<PostSource, "simHtml" | "simJs">) => !!(p.simHtml.trim() || p.simJs.trim());

function head(title: string, description: string, site: SiteConfig, css: string, extra: { url?: string; date?: string; type: string }) {
  const url = extra.url ? `<link rel="canonical" href="${esc(extra.url)}"><meta property="og:url" content="${esc(extra.url)}">` : "";
  const pub = extra.date ? `<meta property="article:published_time" content="${esc(extra.date)}">` : "";
  return `<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="author" content="${esc(site.author)}">
<meta property="og:type" content="${extra.type}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">${url}${pub}
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#fdfbf7" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#0f1420" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${FAVICON}">
<script>${THEME_INIT}</script>
${FONTS}
<style>
${safeStyle(css)}
</style>
</head>`;
}

function topbar(site: SiteConfig, indexHref: string | null) {
  const crumb = indexHref ? `<span class="crumb">/ <a href="${indexHref}">${esc(site.blogTitle)}</a></span>` : "";
  return `<header class="topbar">
  <a class="brand" href="${esc(site.homeUrl)}"><span class="dot"></span>${esc(site.homeLabel || site.author)}</a>${crumb}
  <span class="spacer"></span>
  <button class="icon-btn theme-toggle" type="button" data-theme-toggle aria-label="Toggle dark mode">${icon(I.moon, "moon")}${icon(I.sun, "sun")}</button>
  <div class="progress" aria-hidden="true"></div>
</header>`;
}

/** Preview-only helper: forwards console output and errors to the studio, keeps scroll between rebuilds. */
function previewBridge(scrollY: number) {
  return `<script>(function(){
var post=function(m){try{parent.postMessage(Object.assign({__studio:1},m),"*")}catch(e){}};
var fmt=function(a){try{if(a instanceof Error)return a.stack||a.message;if(typeof a==="object")return JSON.stringify(a);return String(a)}catch(e){return String(a)}};
["log","info","warn","error"].forEach(function(l){var o=console[l];console[l]=function(){post({type:"console",level:l,text:[].map.call(arguments,fmt).join(" ")});o.apply(console,arguments)}});
addEventListener("error",function(e){post({type:"console",level:"error",text:(e.error&&e.error.stack)||e.message})});
addEventListener("unhandledrejection",function(e){post({type:"console",level:"error",text:"Unhandled promise rejection: "+fmt(e.reason)})});
var y=${Math.max(0, Math.round(scrollY))};if(y){var go=function(){scrollTo(0,y)};addEventListener("DOMContentLoaded",go);addEventListener("load",go)}
var t=0;addEventListener("scroll",function(){clearTimeout(t);t=setTimeout(function(){post({type:"scroll",y:scrollY})},80)},{passive:true});
document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[href]");if(a&&a.getAttribute("href").charAt(0)!=="#"){e.preventDefault();post({type:"console",level:"info",text:"Link clicks are disabled in preview: "+a.getAttribute("href")})}},true);
})();</script>`;
}

function tocHtml(items: TocItem[]) {
  if (items.length < 2) return "";
  return `<aside class="toc" aria-label="On this page"><nav><h2>On this page</h2><ol>${items
    .map((t) => `<li><a href="#${t.id}"${t.depth > 2 ? ' class="sub"' : ""}>${esc(t.text)}</a></li>`)
    .join("")}</ol></nav></aside>`;
}

function labHtml(src: PostSource) {
  const title = src.meta.simTitle || "Try it yourself";
  const hint = src.meta.simHint ? `<p class="lab-hint">${esc(src.meta.simHint)}</p>` : "";
  return `<section class="lab-wrap" id="simulation" aria-label="Interactive simulation">
<div class="lab">
  <div class="lab-head">
    <div class="grow"><span class="lab-badge">Interactive</span><h2 class="lab-title">${esc(title)}</h2>${hint}</div>
    <div class="lab-actions"><button class="icon-btn" type="button" data-fullscreen aria-label="Toggle full screen">${icon(I.expand, "fs-enter")}${icon(I.shrink, "fs-exit")}</button></div>
  </div>
  <div class="lab-body">
${src.simHtml}
  </div>
</div>
</section>`;
}

export interface BuiltPost {
  html: string;
  toc: TocItem[];
  minutes: number;
  warnings: string[];
}

export function buildPostHtml(src: PostSource, site: SiteConfig, assets: Assets, opts: BuildOptions = {}): BuiltPost {
  const { meta } = src;
  const warnings: string[] = [];
  const sim = hasSimulation(src);
  const r = createRenderer();

  let article: string;
  const toc: TocItem[] = [];
  if (sim) {
    const [before, after] = splitAtSimulation(src.body);
    if (!SIM_MARKER.test(src.body)) warnings.push("No `::simulation` line in the article, so the simulation is placed before the first `##` heading.");
    const a = r.render(before);
    toc.push(...r.toc.splice(0));
    const b = after.trim() ? r.render(after) : "";
    article = (a.trim() ? `<div class="prose">\n${a}</div>\n` : "") + labHtml(src) + (b ? `\n<div class="prose">\n${b}</div>` : "");
    toc.push({ id: "simulation", text: meta.simTitle || "Simulation", depth: 2 }, ...r.toc);
  } else {
    if (SIM_MARKER.test(src.body)) warnings.push("The article has a `::simulation` line but the post has no simulation code.");
    article = `<div class="prose">\n${r.render(src.body.replace(SIM_MARKER, ""))}</div>`;
    toc.push(...r.toc);
  }

  const minutes = readingMinutes(src.body);
  const description = meta.subtitle || `${meta.title}, by ${site.author}`;
  const url = site.siteUrl ? `${site.siteUrl.replace(/\/$/, "")}/${site.blogPath ?? "blogs/"}${src.slug}.html` : undefined;
  const css = [assets.pageCss, assets.hljsCss, sim ? assets.kitCss : "", src.simCss].filter(Boolean).join("\n");
  const showToc = meta.toc !== false;

  const tags = (meta.tags ?? []).map((t) => `<li class="tag">${esc(t)}</li>`).join("");
  const liveTag = sim ? `<li class="tag live">Interactive</li>` : "";
  const date = meta.date ? `<span class="sep"></span><time datetime="${esc(meta.date)}">${formatDate(meta.date)}</time>` : "";

  const htmlAttrs = opts.forceTheme ? ` data-theme="${opts.forceTheme}" data-force-theme` : "";
  const html = `<!doctype html>
<html lang="en"${htmlAttrs}>
${head(`${meta.title} | ${site.author}`, description, site, css, { url, date: meta.date, type: "article" })}
<body>
${opts.preview ? previewBridge(opts.scrollY ?? 0) : ""}
${topbar(site, "./")}
<div class="layout">
<header class="hero">
  ${tags || liveTag ? `<ul class="tags">${liveTag}${tags}</ul>` : ""}
  <h1>${esc(meta.title)}</h1>
  ${meta.subtitle ? `<p class="lede">${esc(meta.subtitle)}</p>` : ""}
  <div class="meta"><span class="author"><span class="avatar" aria-hidden="true">${esc(initials(site.author))}</span>${esc(site.author)}</span>${date}<span class="sep"></span><span>${minutes} min read</span></div>
  <hr class="hero-rule">
</header>
${showToc ? tocHtml(toc) : ""}
<article class="article">
${article}
</article>
</div>
<footer class="post-foot">
  <div class="author-card"><span class="avatar" aria-hidden="true">${esc(initials(site.author))}</span><p><strong>${esc(site.author)}</strong>${esc(site.authorBio || site.authorRole || "")}</p></div>
  <nav class="foot-links"><a href="./">${icon(I.arrowLeft)}All posts</a><a href="${esc(site.homeUrl)}">${esc(site.homeLabel || site.author)}</a><a href="#top" onclick="scrollTo({top:0,behavior:'smooth'});return false">Back to top ${icon(I.arrowUp)}</a></nav>
</footer>
<script>
${safeScript(assets.pageJs)}
</script>
${sim && src.simJs.trim() ? `<script>
/* simulation: ${esc(src.slug)} */
try {
(function (root, Kit) {
"use strict";
${safeScript(src.simJs)}
})(window.Kit.root, window.Kit);
} catch (err) { window.Kit.fail(err); }
</script>` : ""}
</body>
</html>
`;
  return { html, toc, minutes, warnings };
}

export function buildIndexHtml(posts: PostSummary[], site: SiteConfig, assets: Assets): string {
  const list = posts
    .filter((p) => !p.meta.draft && p.exported)
    .sort((a, b) => (b.meta.date || "").localeCompare(a.meta.date || ""));
  const items = list
    .map((p) => {
      const tags = [p.hasSim ? `<li class="tag live">Interactive</li>` : "", ...(p.meta.tags ?? []).map((t) => `<li class="tag">${esc(t)}</li>`)].join("");
      return `<li><a class="post-card" href="./${esc(p.slug)}.html">
  <h2>${esc(p.meta.title)}</h2>
  ${p.meta.subtitle ? `<p>${esc(p.meta.subtitle)}</p>` : ""}
  <div class="meta">${p.meta.date ? `<time datetime="${esc(p.meta.date)}">${formatDate(p.meta.date)}</time>` : ""}${tags ? `<ul class="tags">${tags}</ul>` : ""}</div>
</a></li>`;
    })
    .join("\n");
  const url = site.siteUrl ? `${site.siteUrl.replace(/\/$/, "")}/${site.blogPath ?? "blogs/"}` : undefined;
  const desc = site.blogDescription || `Writing by ${site.author}`;
  return `<!doctype html>
<html lang="en">
${head(`${site.blogTitle} | ${site.author}`, desc, site, assets.pageCss, { url, type: "website" })}
<body>
${topbar(site, null)}
<main class="layout">
<header class="hero">
  <h1>${esc(site.blogTitle)}</h1>
  <p class="lede">${esc(desc)}</p>
  <hr class="hero-rule">
</header>
<div class="article">
  <ul class="index-list">
${items || `<li><p style="color:var(--muted)">Nothing published yet.</p></li>`}
  </ul>
</div>
</main>
<script>
${safeScript(assets.pageJs)}
</script>
</body>
</html>
`;
}

export type { PostMeta };
