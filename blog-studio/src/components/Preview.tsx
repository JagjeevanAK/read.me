import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Laptop, Monitor, Moon, RotateCw, Smartphone, Sun, Tablet, Trash2 } from "lucide-react";

export type Device = "desktop" | "laptop" | "tablet" | "mobile";
export type LogLine = { level: "log" | "info" | "warn" | "error"; text: string; n: number };

const WIDTHS: Record<Device, number | null> = { desktop: null, laptop: 1280, tablet: 820, mobile: 390 };
const DEVICE_ICONS = { desktop: Monitor, laptop: Laptop, tablet: Tablet, mobile: Smartphone };

export function Preview(props: {
  html: string;
  device: Device;
  theme: "light" | "dark";
  onDevice: (d: Device) => void;
  onTheme: (t: "light" | "dark") => void;
  onRefresh: () => void;
  onOpen: () => void;
  onScroll: (y: number) => void;
  version: number;
}) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const counter = useRef(0);

  useEffect(() => { setLogs([]); }, [props.version]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || !e.data?.__studio) return;
      if (e.data.type === "scroll") props.onScroll(e.data.y);
      if (e.data.type === "console") {
        const line: LogLine = { level: e.data.level, text: e.data.text, n: ++counter.current };
        setLogs((l) => [...l.slice(-199), line]);
        if (line.level === "error") setConsoleOpen(true);
      }
    };
    addEventListener("message", onMsg);
    return () => removeEventListener("message", onMsg);
  }, [props.onScroll]);

  const errors = logs.filter((l) => l.level === "error").length;
  const width = WIDTHS[props.device];

  return (
    <div className="preview">
      <div className="pv-bar">
        <div className="seg" role="group" aria-label="Preview width">
          {(Object.keys(WIDTHS) as Device[]).map((d) => {
            const Icon = DEVICE_ICONS[d];
            return (
              <button key={d} className={props.device === d ? "on" : ""} onClick={() => props.onDevice(d)} title={`${d}${WIDTHS[d] ? ` (${WIDTHS[d]}px)` : ""}`}>
                <Icon size={15} />
              </button>
            );
          })}
        </div>
        <div className="seg" role="group" aria-label="Preview theme">
          <button className={props.theme === "light" ? "on" : ""} onClick={() => props.onTheme("light")} title="Light"><Sun size={15} /></button>
          <button className={props.theme === "dark" ? "on" : ""} onClick={() => props.onTheme("dark")} title="Dark"><Moon size={15} /></button>
        </div>
        <span className="grow" />
        <button className="ibtn" onClick={props.onRefresh} title="Rebuild and reload preview"><RotateCw size={15} /></button>
        <button className="ibtn" onClick={props.onOpen} title="Open the exported page in a new tab"><ExternalLink size={15} /></button>
      </div>

      <div className={`pv-stage ${width ? "framed" : ""}`}>
        <iframe
          key={props.version}
          ref={frame}
          title="Post preview"
          srcDoc={props.html}
          sandbox="allow-scripts allow-popups"
          allow="fullscreen; clipboard-write"
          allowFullScreen
          style={width ? { width } : undefined}
        />
      </div>

      <div className={`console ${consoleOpen ? "open" : ""}`}>
        <button className="console-head" onClick={() => setConsoleOpen((o) => !o)}>
          <span>Console</span>
          {errors > 0 && <span className="badge err">{errors} error{errors > 1 ? "s" : ""}</span>}
          {logs.length > 0 && errors === 0 && <span className="badge">{logs.length}</span>}
          <span className="grow" />
          {logs.length > 0 && (
            <span role="button" tabIndex={0} className="ibtn sm" title="Clear" onClick={(e) => { e.stopPropagation(); setLogs([]); }}>
              <Trash2 size={13} />
            </span>
          )}
          {consoleOpen ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
        {consoleOpen && (
          <ol className="console-body">
            {logs.length === 0 && <li className="empty">Output from the preview (console.log, errors) shows up here.</li>}
            {logs.map((l) => (
              <li key={l.n} className={l.level}><pre>{l.text}</pre></li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
