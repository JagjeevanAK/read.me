import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";

export type Lang = "markdown" | "javascript" | "html" | "css";

const studioTheme = EditorView.theme(
  {
    "&": { height: "100%", fontSize: "13.5px", backgroundColor: "var(--ed-bg)" },
    ".cm-scroller": { fontFamily: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace', lineHeight: "1.7" },
    ".cm-gutters": { backgroundColor: "var(--ed-bg)", borderRight: "1px solid var(--line)", color: "var(--faint)" },
    ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "rgba(167, 139, 250, 0.06)" },
    ".cm-content": { padding: "14px 0 40vh" },
    ".cm-line": { padding: "0 18px 0 10px" },
    "&.cm-focused": { outline: "none" },
    ".cm-cursor": { borderLeftColor: "#c4b5fd" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "rgba(167, 139, 250, 0.25) !important" },
  },
  { dark: true },
);

export function CodeEditor(props: {
  value: string;
  lang: Lang;
  onChange: (v: string) => void;
  onView?: (v: EditorView) => void;
  wrap?: boolean;
}) {
  const extensions = useMemo(() => {
    const l = { markdown: markdown(), javascript: javascript(), html: html(), css: css() }[props.lang];
    return [l, studioTheme, ...(props.wrap ? [EditorView.lineWrapping] : [])];
  }, [props.lang, props.wrap]);

  return (
    <CodeMirror
      className="editor"
      value={props.value}
      height="100%"
      theme="dark"
      extensions={extensions}
      onChange={props.onChange}
      onCreateEditor={(view) => props.onView?.(view)}
      basicSetup={{ foldGutter: true, highlightActiveLine: true, bracketMatching: true, autocompletion: true, tabSize: 2 }}
    />
  );
}
