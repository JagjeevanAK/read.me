import { useEffect, useRef, useState } from "react";
import { FileText, FlaskConical } from "lucide-react";

const toSlug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export function NewPostDialog({ onCreate, onClose, taken }: { onCreate: (slug: string, title: string, starter: "simulation" | "article") => Promise<void>; onClose: () => void; taken: string[] }) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [starter, setStarter] = useState<"simulation" | "article">("simulation");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => { ref.current?.showModal(); }, []);
  useEffect(() => { if (!slugTouched) setSlug(toSlug(title)); }, [title, slugTouched]);

  const clash = taken.includes(slug);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || clash) return;
    setBusy(true); setError("");
    try { await onCreate(slug, title.trim() || "Untitled post", starter); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); setBusy(false); }
  };

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onCancel={onClose}>
      <form onSubmit={submit}>
        <h2>New post</h2>
        <label>
          Title
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="How we built …" />
        </label>
        <label>
          Slug <span className="muted">(file name)</span>
          <input value={slug} onChange={(e) => { setSlugTouched(true); setSlug(toSlug(e.target.value)); }} placeholder="how-we-built" />
          {clash && <span className="err">A post with this slug already exists</span>}
        </label>
        <div className="starters" role="radiogroup" aria-label="Start from">
          <button type="button" role="radio" aria-checked={starter === "simulation"} className={starter === "simulation" ? "on" : ""} onClick={() => setStarter("simulation")}>
            <FlaskConical size={18} />
            <b>Article + simulation</b>
            <span>Starts with a working queue simulation you can rewrite</span>
          </button>
          <button type="button" role="radio" aria-checked={starter === "article"} className={starter === "article" ? "on" : ""} onClick={() => setStarter("article")}>
            <FileText size={18} />
            <b>Article only</b>
            <span>Plain post, add a simulation later if you want</span>
          </button>
        </div>
        {error && <p className="err">{error}</p>}
        <div className="actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!slug || clash || busy}>{busy ? "Creating…" : "Create post"}</button>
        </div>
      </form>
    </dialog>
  );
}
