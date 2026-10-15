import type { PostSource, PostSummary, SiteConfig } from "../shared/types";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`);
  return data as T;
}

export const api = {
  site: () => call<SiteConfig>("/api/site"),
  list: () => call<PostSummary[]>("/api/posts"),
  get: (slug: string) => call<PostSource>(`/api/posts/${slug}`),
  save: (p: PostSource) => call<{ ok: true }>(`/api/posts/${p.slug}`, { method: "PUT", body: JSON.stringify(p) }),
  create: (slug: string, title: string, starter: "simulation" | "article") =>
    call<PostSource>("/api/posts", { method: "POST", body: JSON.stringify({ slug, title, starter }) }),
  export: (slug: string) => call<{ file: string; bytes: number; warnings: string[] }>(`/api/posts/${slug}/export`, { method: "POST" }),
};
