import type { PostMeta, SiteConfig } from "../../shared/types";

export function MetaForm({ slug, meta, site, onChange }: { slug: string; meta: PostMeta; site: SiteConfig | null; onChange: (m: PostMeta) => void }) {
  const set = <K extends keyof PostMeta>(k: K, v: PostMeta[K]) => onChange({ ...meta, [k]: v });
  return (
    <div className="form">
      <section>
        <h3>Post</h3>
        <label>
          Title
          <input value={meta.title} onChange={(e) => set("title", e.target.value)} />
        </label>
        <label>
          Subtitle
          <textarea rows={3} value={meta.subtitle ?? ""} onChange={(e) => set("subtitle", e.target.value)} placeholder="Shown under the title and used as the meta description" />
        </label>
        <div className="grid2">
          <label>
            Date
            <input type="date" value={meta.date ?? ""} onChange={(e) => set("date", e.target.value)} />
          </label>
          <label>
            Tags
            <input
              defaultValue={(meta.tags ?? []).join(", ")}
              key={slug}
              onChange={(e) => set("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))}
              placeholder="Kafka, System Design"
            />
          </label>
        </div>
        <div className="checks">
          <label className="check">
            <input type="checkbox" checked={meta.toc !== false} onChange={(e) => set("toc", e.target.checked ? undefined : false)} />
            Show "On this page" sidebar
          </label>
          <label className="check">
            <input type="checkbox" checked={!!meta.draft} onChange={(e) => set("draft", e.target.checked || undefined)} />
            Draft (hidden from the blog index)
          </label>
        </div>
      </section>

      <section>
        <h3>Simulation block</h3>
        <label>
          Heading
          <input value={meta.simTitle ?? ""} onChange={(e) => set("simTitle", e.target.value)} placeholder="Try it yourself" />
        </label>
        <label>
          Hint
          <textarea rows={2} value={meta.simHint ?? ""} onChange={(e) => set("simHint", e.target.value)} placeholder="One line telling readers what they can do" />
        </label>
        <p className="help">
          Put a line containing only <code>::simulation</code> in the article where the lab should appear. Without it, the lab goes before the first <code>##</code> heading. Leave the
          simulation files empty for a plain article.
        </p>
      </section>

      <section>
        <h3>Output</h3>
        <dl className="kv">
          <dt>Slug</dt>
          <dd>{slug}</dd>
          <dt>Exports to</dt>
          <dd>{site ? `${site.outputDir.replace(/^\.\.\//, "")}/${slug}.html` : "…"}</dd>
        </dl>
        <p className="help">
          Author, links and blog title live in <code>blog-studio/site.config.json</code>.
        </p>
      </section>
    </div>
  );
}
