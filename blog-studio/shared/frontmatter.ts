import { parse, stringify } from "yaml";
import type { PostMeta } from "./types.ts";

const FM = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontmatter(text: string): { meta: PostMeta; body: string } {
  const m = FM.exec(text);
  if (!m) return { meta: { title: "Untitled" }, body: text };
  let data: unknown = {};
  try {
    data = parse(m[1]) ?? {};
  } catch {
    data = {};
  }
  const meta = normalizeMeta(data as Record<string, unknown>);
  return { meta, body: text.slice(m[0].length).replace(/^\r?\n/, "") };
}

export function serializeFrontmatter(meta: PostMeta, body: string): string {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) continue;
    clean[k] = v;
  }
  return `---\n${stringify(clean, { lineWidth: 0 }).trimEnd()}\n---\n\n${body.replace(/^\s+/, "")}`;
}

function normalizeMeta(d: Record<string, unknown>): PostMeta {
  const str = (v: unknown) => (v == null ? undefined : String(v));
  const date = d.date instanceof Date ? d.date.toISOString().slice(0, 10) : str(d.date);
  const tags = Array.isArray(d.tags) ? d.tags.map(String) : typeof d.tags === "string" ? d.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined;
  return {
    title: str(d.title) || "Untitled",
    subtitle: str(d.subtitle),
    date,
    tags,
    simTitle: str(d.simTitle),
    simHint: str(d.simHint),
    toc: d.toc === undefined ? undefined : Boolean(d.toc),
    draft: d.draft === undefined ? undefined : Boolean(d.draft),
  };
}
