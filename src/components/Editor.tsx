import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import {
  EditorView,
  lineNumbers,
  highlightActiveLineGutter,
  highlightActiveLine,
  keymap,
  drawSelection,
  rectangularSelection,
  crosshairCursor,
  highlightSpecialChars,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  undo,
  redo,
} from "@codemirror/commands";
import {
  searchKeymap,
  highlightSelectionMatches,
  openSearchPanel,
} from "@codemirror/search";
import {
  StreamLanguage,
  syntaxHighlighting,
  HighlightStyle,
  indentOnInput,
  bracketMatching,
  foldGutter,
} from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { tags } from "@lezer/highlight";
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
} from "@codemirror/autocomplete";
import type { CompletionContext } from "@codemirror/autocomplete";
import type { ProjectFile, Settings } from "../types";

export interface EditorHandle {
  insert(text: string, wrap?: string): void;
  find(): void;
  goto(line: number): void;
  selection(): string;
  undo(): void;
  redo(): void;
}
const latexCommands = [
  "begin",
  "end",
  "section",
  "subsection",
  "subsubsection",
  "chapter",
  "textbf",
  "textit",
  "emph",
  "cite",
  "ref",
  "label",
  "input",
  "includegraphics",
  "frac",
  "sqrt",
  "sum",
  "int",
  "alpha",
  "beta",
  "theta",
  "lambda",
  "infty",
  "usepackage",
  "documentclass",
  "bibliography",
  "caption",
  "centering",
  "item",
  "textwidth",
  "linewidth",
  "footnote",
];
const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--syntax-command)" },
  { tag: tags.atom, color: "var(--syntax-number)" },
  { tag: tags.comment, color: "var(--syntax-comment)", fontStyle: "italic" },
  { tag: tags.string, color: "var(--syntax-number)" },
  { tag: tags.number, color: "var(--syntax-number)" },
  { tag: tags.bracket, color: "var(--syntax-bracket)" },
  { tag: tags.meta, color: "var(--syntax-command)" },
  { tag: tags.tagName, color: "var(--syntax-command)" },
  { tag: tags.variableName, color: "var(--syntax-command)" },
  { tag: tags.heading, color: "var(--forest)", fontWeight: "600" },
  { tag: tags.operator, color: "var(--syntax-number)" },
]);
function complete(context: CompletionContext) {
  const word = context.matchBefore(/\\[a-zA-Z]*/);
  if (!word) return null;
  return {
    from: word.from,
    options: latexCommands.map((label) => ({
      label: "\\" + label,
      type: "keyword",
    })),
  };
}
export const Editor = forwardRef<
  EditorHandle,
  {
    file: ProjectFile;
    settings: Settings;
    onChange: (text: string) => void;
    onCursor: (line: number, column: number) => void;
    onCompile: () => void;
  }
>(function Editor({ file, settings, onChange, onCursor, onCompile }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const states = useRef(new Map<string, EditorState>());
  const active = useRef(file.id);
  const config = useRef(new Compartment());
  const callbacks = useRef({ onChange, onCursor, onCompile });
  callbacks.current = { onChange, onCursor, onCompile };
  const appearance = () => [
    EditorView.theme({
      "&": { fontSize: settings.fontSize + "px", height: "100%" },
      ".cm-content": {
        fontFamily: '"JetBrains Mono", monospace',
        padding: "20px 0 80px",
        caretColor: "var(--forest)",
      },
      ".cm-line": { padding: "0 24px 0 10px", lineHeight: "1.85" },
      ".cm-scroller": {
        overflow: "auto",
        fontFamily: '"JetBrains Mono", monospace',
      },
      ".cm-gutters": {
        background: "transparent",
        color: "var(--muted)",
        border: "none",
        minWidth: "45px",
      },
      ".cm-gutterElement": { padding: "0 9px 0 8px" },
      ".cm-activeLineGutter": {
        backgroundColor: "transparent",
        color: "var(--forest)",
      },
      ".cm-activeLine": { backgroundColor: "var(--editor-line)" },
      ".cm-cursor": { borderLeftColor: "var(--forest)" },
      "&.cm-focused": { outline: "none" },
      ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
        backgroundColor: "var(--selection) !important",
      },
      ".cm-foldGutter": { width: "10px" },
      ".cm-panels": { backgroundColor: "var(--panel)", color: "var(--text)" },
      ".cm-search": {
        padding: "10px",
        fontFamily: "DM Sans Variable, sans-serif",
      },
    }),
    ...(settings.wordWrap ? [EditorView.lineWrapping] : []),
  ];
  const createState = (content: string) =>
    EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        rectangularSelection(),
        crosshairCursor(),
        indentOnInput(),
        bracketMatching(),
        foldGutter(),
        closeBrackets(),
        highlightSelectionMatches(),
        StreamLanguage.define(stex),
        syntaxHighlighting(highlight),
        autocompletion({ override: [complete] }),
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              callbacks.current.onCompile();
              return true;
            },
          },
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          ...closeBracketsKeymap,
          indentWithTab,
        ]),
        config.current.of(appearance()),
        EditorView.updateListener.of((update) => {
          if (update.docChanged)
            callbacks.current.onChange(update.state.doc.toString());
          if (update.selectionSet || update.docChanged) {
            const position = update.state.selection.main.head;
            const line = update.state.doc.lineAt(position);
            callbacks.current.onCursor(line.number, position - line.from + 1);
          }
        }),
      ],
    });
  useEffect(() => {
    if (!host.current) return;
    view.current = new EditorView({
      state: createState(file.content),
      parent: host.current,
    });
    return () => {
      view.current?.destroy();
    };
  }, []);
  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    if (active.current !== file.id) {
      states.current.set(active.current, editor.state);
      active.current = file.id;
      const saved = states.current.get(file.id);
      editor.setState(
        saved?.doc.toString() === file.content
          ? saved
          : createState(file.content),
      );
      editor.dispatch({ effects: config.current.reconfigure(appearance()) });
    } else if (editor.state.doc.toString() !== file.content)
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: file.content },
      });
  }, [file.id, file.content]);
  useEffect(() => {
    view.current?.dispatch({
      effects: config.current.reconfigure(appearance()),
    });
  }, [settings.fontSize, settings.wordWrap, settings.theme]);
  useImperativeHandle(ref, () => ({
    insert(text, wrap) {
      const editor = view.current;
      if (!editor) return;
      const selection = editor.state.selection.main;
      const selected = editor.state.sliceDoc(selection.from, selection.to);
      const insert =
        wrap !== undefined ? text + (selected || "text") + wrap : text;
      editor.dispatch({
        changes: { from: selection.from, to: selection.to, insert },
        selection: { anchor: selection.from + insert.length },
      });
      editor.focus();
    },
    find() {
      if (view.current) openSearchPanel(view.current);
    },
    goto(line) {
      const editor = view.current;
      if (!editor) return;
      const target = editor.state.doc.line(
        Math.max(1, Math.min(line, editor.state.doc.lines)),
      );
      editor.dispatch({
        selection: { anchor: target.from },
        effects: EditorView.scrollIntoView(target.from, { y: "center" }),
      });
      editor.focus();
    },
    selection() {
      const editor = view.current;
      return editor
        ? editor.state.sliceDoc(
            editor.state.selection.main.from,
            editor.state.selection.main.to,
          )
        : "";
    },
    undo() {
      if (view.current) undo(view.current);
    },
    redo() {
      if (view.current) redo(view.current);
    },
  }));
  return (
    <div ref={host} className="source-editor" data-testid="source-editor" />
  );
});
