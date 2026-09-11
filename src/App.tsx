import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  AlignLeft,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Code2,
  Command,
  Download,
  FileCode2,
  FileText,
  Files,
  Focus,
  Folder,
  FolderOpen,
  History,
  Image,
  Italic,
  LayoutGrid,
  Leaf,
  List,
  Loader2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Square,
  SquareFunction,
  Trash2,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
  Bold,
  AlertCircle,
} from "lucide-react";
import { Editor } from "./components/Editor";
import type { EditorHandle } from "./components/Editor";
import { PdfViewer } from "./components/PdfViewer";
import { AgentPanel, ReviewDialog } from "./components/AgentPanel";
import { SettingsDialog } from "./components/Settings";
import { Library } from "./components/Library";
import {
  AgentMark,
  IconButton,
  Logo,
  Modal,
  errorText,
} from "./components/Primitives";
import { wordCount, outline, parseBib } from "./document";
import type {
  Bootstrap,
  Project,
  ProjectFile,
  ProjectSummary,
  Snapshot,
  CompileResult,
  Proposal,
  ChatMessage,
} from "./types";

type Dialog =
  | "new"
  | "import"
  | "file"
  | "rename"
  | "history"
  | "references"
  | "palette"
  | "settings"
  | "review"
  | "delete"
  | null;
const api = window.dopnur;

export default function App() {
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [fatal, setFatal] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const current = useRef<Project | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [view, setView] = useState<"workspace" | "library">("workspace");
  const [activeId, setActiveId] = useState("");
  const [tabs, setTabs] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const saved = useRef("");
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const [dialog, setDialog] = useState<Dialog>(null);
  const [settingsTab, setSettingsTab] = useState("agent");
  const [name, setName] = useState("");
  const [template, setTemplate] = useState("article");
  const [modalBusy, setModalBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [sidebar, setSidebar] = useState(true);
  const [sidebarMode, setSidebarMode] = useState<"files" | "search">("files");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [focus, setFocus] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [pdf, setPdf] = useState<string | null>(null);
  const [sample, setSample] = useState(false);
  const [pdfDirty, setPdfDirty] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [compiling, setCompiling] = useState(false);
  const compilingRef = useRef(false);
  const lastAttempt = useRef("");
  const [compileResult, setCompileResult] = useState<CompileResult | null>(
    null,
  );
  const [compileOutput, setCompileOutput] = useState("");
  const [logOpen, setLogOpen] = useState(false);
  const [logMode, setLogMode] = useState<"issues" | "log">("issues");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [bibSearch, setBibSearch] = useState("");
  const [bibInput, setBibInput] = useState("");
  const [paletteSearch, setPaletteSearch] = useState("");
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentOutput, setAgentOutput] = useState("");
  const [selection, setSelection] = useState("");
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [split, setSplit] = useState(48);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const editorRef = useRef<EditorHandle>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const commandRef = useRef<(command: string) => void>(() => {});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeFile =
    project?.files.find((file) => file.id === activeId) || project?.files[0];
  const settings = boot?.settings;
  const count = project ? wordCount(project.files) : 0;
  const headings = project ? outline(project.files) : [];
  const notify = useCallback((text: string, error = false) => {
    setToast({ text, error });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), error ? 8000 : 3800);
  }, []);
  const attempt = useCallback(
    async (fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (e) {
        notify(errorText(e), true);
      }
    },
    [notify],
  );
  const commit = useCallback((next: Project, isSaved = false) => {
    current.current = next;
    setProject(next);
    const serialized = JSON.stringify(next);
    if (isSaved) saved.current = serialized;
    dirtyRef.current = serialized !== saved.current;
    setDirty(dirtyRef.current);
  }, []);
  const persist = useCallback(async () => {
    const snapshot = current.current;
    if (!snapshot || !dirtyRef.current) {
      await saveChain.current;
      return;
    }
    const serialized = JSON.stringify(snapshot);
    setSaving(true);
    const work = saveChain.current
      .catch(() => {})
      .then(() => api.saveProject(snapshot));
    saveChain.current = work;
    try {
      await work;
      if (
        current.current?.id === snapshot.id &&
        JSON.stringify(current.current) === serialized
      ) {
        saved.current = serialized;
        dirtyRef.current = false;
        setDirty(false);
      }
    } finally {
      setSaving(false);
    }
  }, []);
  const loadProject = useCallback(
    async (next: Project) => {
      if (agentRunning)
        throw new Error(
          "Stop the current agent run before switching projects.",
        );
      commit(next, true);
      setActiveId(
        next.files.find((file) => file.name === next.mainFile)?.id ||
          next.files[0].id,
      );
      setTabs(
        next.files
          .filter((file) =>
            [next.mainFile, "references.bib"].includes(file.name),
          )
          .map((file) => file.id),
      );
      setView("workspace");
      setMessages([]);
      setProposal(null);
      setAgentOutput("");
      setCompileResult(null);
      setPdf(null);
      setPdfDirty(false);
      setSample(false);
      setPages(0);
      setPage(1);
      setLogOpen(false);
      setCollapsed([]);
      const result = await api.getPdf(next.id);
      if (current.current?.id === next.id) {
        setPdf(result?.pdf || null);
        setSample(result?.sample || false);
        setPdfDirty(result?.stale || false);
      }
    },
    [agentRunning, commit],
  );
  useEffect(() => {
    if (!api) {
      setFatal(
        "Dopnur is a desktop app. Start it with “npm run dev” or open the installed Dopnur application.",
      );
      return;
    }
    void api
      .bootstrap()
      .then(async (result) => {
        setBoot(result);
        setProjects(result.projects);
        if (result.projects.length)
          await loadProject(await api.getProject(result.projects[0].id));
        else setView("library");
      })
      .catch((e) => setFatal(errorText(e)));
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => {
      void persist().catch((e) =>
        notify("Could not save: " + errorText(e), true),
      );
    }, 400);
    return () => clearTimeout(timer);
  }, [project, dirty, persist, notify]);
  useEffect(() => {
    document.documentElement.dataset.theme = settings?.theme || "light";
  }, [settings?.theme]);
  useEffect(() => {
    if (!focus) return;
    const timer = setInterval(
      () => setSessionSeconds((value) => value + 1),
      1000,
    );
    return () => clearInterval(timer);
  }, [focus]);
  useEffect(() => {
    if (
      !settings?.autoCompile ||
      !pdfDirty ||
      compiling ||
      view !== "workspace" ||
      JSON.stringify(project?.files) === lastAttempt.current
    )
      return;
    const timer = setTimeout(() => commandRef.current("compile"), 2000);
    return () => clearTimeout(timer);
  }, [project, settings?.autoCompile, pdfDirty, compiling, view]);
  useEffect(() => {
    if (!api) return;
    return api.onEvent((event) => {
      if (event.type === "command" && event.action)
        commandRef.current(event.action);
      if (
        event.type === "compile-output" &&
        event.projectId === current.current?.id
      )
        setCompileOutput((text) => (text + event.text).slice(-100000));
      if (
        event.type === "agent-output" &&
        event.projectId === current.current?.id
      )
        setAgentOutput((text) => (text + event.text).slice(-70000));
      if (event.type === "close-request")
        void persist()
          .then(() => api.windowAction("close-confirmed"))
          .catch((e) =>
            notify(
              "Your latest changes could not be saved. " + errorText(e),
              true,
            ),
          );
    });
  }, [persist, notify]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        ["k", "j"].includes(event.key.toLowerCase())
      ) {
        event.preventDefault();
        commandRef.current(
          event.key.toLowerCase() === "k" ? "palette" : "agent",
        );
      }
      if (event.key === "Escape" && focus && !dialog) setFocus(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [focus, dialog]);
  const closeDialog = useCallback(() => {
    setDialog(null);
    setFormError("");
    setModalBusy(false);
  }, []);
  const openDialog = (value: Dialog) => {
    setFormError("");
    setModalBusy(false);
    setDialog(value);
  };
  const openSettings = (tab = "agent") => {
    setSettingsTab(tab);
    openDialog("settings");
  };
  const openNew = (id = "article") => {
    setTemplate(id);
    setName("");
    openDialog("new");
  };
  const openFile = (file: ProjectFile, line?: number) => {
    setActiveId(file.id);
    setTabs((current) =>
      current.includes(file.id) ? current : [...current, file.id],
    );
    setReading(false);
    if (line) setTimeout(() => editorRef.current?.goto(line), 30);
  };
  async function openProject(id: string) {
    if (compilingRef.current)
      throw new Error("Wait for compilation before switching projects.");
    await persist();
    await loadProject(await api.getProject(id));
  }
  async function showLibrary() {
    if (compilingRef.current || agentRunning)
      throw new Error(
        "Finish or stop the active run before opening your library.",
      );
    await persist();
    setProjects((await api.bootstrap()).projects);
    setView("library");
    setFocus(false);
  }
  async function compile() {
    if (!current.current || compilingRef.current) return;
    compilingRef.current = true;
    setCompiling(true);
    setCompileOutput("");
    const snapshot = current.current;
    lastAttempt.current = JSON.stringify(snapshot.files);
    try {
      await persist();
      const result = await api.compile(snapshot);
      if (current.current?.id !== snapshot.id) return;
      setCompileResult(result);
      if (result.ok && result.pdf) {
        setPdf(result.pdf);
        setSample(false);
        setPdfDirty(
          JSON.stringify(current.current.files) !==
            JSON.stringify(snapshot.files),
        );
        notify(
          `Beautifully compiled in ${(result.duration / 1000).toFixed(1)}s.`,
        );
      } else {
        setLogOpen(true);
        setLogMode("issues");
        if (result.missingEngine) openSettings("compiler");
        else
          notify(
            "The compiler needs a little attention. Check the log below.",
            true,
          );
      }
    } catch (e) {
      notify(errorText(e), true);
    } finally {
      compilingRef.current = false;
      setCompiling(false);
    }
  }
  async function saveSnapshot() {
    if (!current.current) return;
    await persist();
    await api.snapshot({
      project: current.current,
      label: `Revision · ${new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`,
    });
    notify("A little milestone, safely saved.");
  }
  async function showHistory() {
    if (!current.current) return;
    await persist();
    setSnapshots(await api.snapshots(current.current.id));
    openDialog("history");
  }
  function updateFile(content: string) {
    const snapshot = current.current;
    if (!snapshot) return;
    const file = snapshot.files.find((file) => file.id === activeId);
    if (!file || file.content === content) return;
    commit({
      ...snapshot,
      files: snapshot.files.map((item) =>
        item.id === file.id ? { ...item, content } : item,
      ),
    });
    setPdfDirty(true);
  }
  function insert(text: string, wrap?: string) {
    if (!activeFile || activeFile.encoding) return;
    setReading(false);
    setTimeout(() => editorRef.current?.insert(text, wrap), 0);
  }
  async function importFiles() {
    if (!current.current) return;
    const files = await api.importFiles();
    if (!files.length) return;
    const existing = current.current.files.map((file) =>
      file.name.toLowerCase(),
    );
    if (files.some((file) => existing.includes(file.name.toLowerCase())))
      throw new Error(
        "A file with that name already exists. Rename it before importing.",
      );
    commit({ ...current.current, files: [...current.current.files, ...files] });
    setPdfDirty(true);
    openFile(files[0]);
    notify(
      `${files.length} ${files.length === 1 ? "file" : "files"} added to your project.`,
    );
  }
  async function submitName() {
    if (!name.trim()) {
      setFormError("Give it a name to get started.");
      return;
    }
    setModalBusy(true);
    setFormError("");
    try {
      if (dialog === "new") {
        await persist();
        await loadProject(
          await api.createProject({ template, name: name.trim() }),
        );
      } else if (dialog === "rename" && current.current)
        commit({ ...current.current, name: name.trim() });
      else if (dialog === "file" && current.current) {
        let filename = name.trim();
        if (!filename.split("/").at(-1)?.includes(".")) filename += ".tex";
        if (
          /(^\/|\\|[<>:"|?*\x00-\x1f])/.test(filename) ||
          filename
            .split("/")
            .some((p) => !p || p.startsWith(".") || /[. ]$/.test(p))
        )
          throw new Error(
            "Use a relative file name, like chapters/introduction.tex.",
          );
        if (
          current.current.files.some(
            (file) => file.name.toLowerCase() === filename.toLowerCase(),
          )
        )
          throw new Error("That file already exists.");
        const file = {
          id: crypto.randomUUID(),
          name: filename,
          content: filename.endsWith(".tex") ? "% A fresh start.\n\n" : "",
        };
        const next = {
          ...current.current,
          files: [...current.current.files, file],
        };
        await api.saveProject(next);
        commit(next, true);
        openFile(file);
      }
      closeDialog();
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setModalBusy(false);
    }
  }
  async function importProject(type: "zip" | "folder") {
    setModalBusy(true);
    setFormError("");
    try {
      await persist();
      const next = await api.importProject(type);
      if (next) {
        await loadProject(next);
        closeDialog();
        notify("Your project has a new home.");
      }
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setModalBusy(false);
    }
  }
  async function restore(snapshot: Snapshot) {
    if (!current.current) return;
    setModalBusy(true);
    try {
      await persist();
      const restored = await api.restoreSnapshot({
        project: current.current,
        snapshotId: snapshot.id,
      });
      await loadProject(restored);
      setPdfDirty(true);
      closeDialog();
      notify("Revision restored. Your previous work is in history.");
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setModalBusy(false);
    }
  }
  async function runAgent(prompt: string) {
    if (!current.current || agentRunning) return;
    await persist();
    setAgentRunning(true);
    setProposal(null);
    setAgentOutput("");
    const snapshot = current.current;
    const selected = editorRef.current?.selection() || selection;
    const history = messages;
    setMessages((old) => [...old, { role: "user", text: prompt }]);
    try {
      const response = await api.runAgent({
        project: snapshot,
        prompt,
        activeFile: activeFile?.name || snapshot.mainFile,
        selection: selected,
        diagnostics: compileResult?.log || "",
        history,
      });
      if (current.current?.id !== snapshot.id) return;
      setProposal(response);
      setMessages((old) => [
        ...old,
        { role: "assistant", text: response.message },
      ]);
    } catch (e) {
      setMessages((old) => [...old, { role: "assistant", text: errorText(e) }]);
    } finally {
      setAgentRunning(false);
    }
  }
  async function applyProposal(paths: string[]) {
    if (!current.current || !proposal) return;
    setModalBusy(true);
    try {
      await persist();
      const next = await api.applyEdits({
        project: current.current,
        proposalId: proposal.id,
        paths,
      });
      commit(next, true);
      setPdfDirty(true);
      setProposal(null);
      setMessages((old) => [
        ...old,
        {
          role: "assistant",
          text: `Applied ${paths.length} ${paths.length === 1 ? "change" : "changes"}. Your previous version is saved in history.`,
        },
      ]);
      closeDialog();
      notify("Changes applied. Ready for a fresh compile.");
    } catch (e) {
      setFormError(errorText(e));
      notify(errorText(e), true);
    } finally {
      setModalBusy(false);
    }
  }
  commandRef.current = (command) => {
    if (command === "settings") openSettings("general");
    else if (command === "new") openNew();
    else if (command === "import") openDialog("import");
    else if (command === "palette") {
      setPaletteSearch("");
      openDialog("palette");
    } else if (command === "save")
      void attempt(async () => {
        await persist();
        notify("All your changes are saved.");
      });
    else if (command === "compile") void compile();
    else if (command === "find") {
      setReading(false);
      editorRef.current?.find();
    } else if (command === "agent") {
      setSelection(editorRef.current?.selection() || "");
      setAgentOpen((value) => !value);
    } else if (command === "focus") setFocus((value) => !value);
    else if (command === "snapshot") void attempt(saveSnapshot);
    else if (command === "export" && current.current)
      void attempt(async () => {
        if (await api.exportProject(current.current!))
          notify("Source ZIP exported.");
      });
    else if (command === "export-pdf" && current.current)
      void attempt(async () => {
        if (await api.exportPdf(current.current!.id))
          notify("Your PDF is ready to share.");
      });
  };
  function dragSplit(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const move = (e: PointerEvent) => {
      const bounds = splitRef.current?.getBoundingClientRect();
      if (bounds)
        setSplit(
          Math.max(
            28,
            Math.min(70, (100 * (e.clientX - bounds.left)) / bounds.width),
          ),
        );
    };
    const stop = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", stop);
      document.body.classList.remove("resizing");
    };
    document.body.classList.add("resizing");
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", stop);
  }
  function renderTree() {
    if (!project) return null;
    const folders = [
      ...new Set(
        project.files
          .filter((file) => file.name.includes("/"))
          .map((file) => file.name.slice(0, file.name.lastIndexOf("/"))),
      ),
    ];
    const fileRow = (file: ProjectFile, nested = false) => (
      <button
        key={file.id}
        className={`file-row ${activeId === file.id ? "selected" : ""} ${nested ? "nested" : ""}`}
        onClick={() => openFile(file)}
        title={file.name}
      >
        {file.name.endsWith(".bib") ? (
          <BookOpen size={15} />
        ) : file.encoding ? (
          <Image size={15} />
        ) : file.name.endsWith(".tex") ? (
          <span className="tex-icon">
            T<span>e</span>X
          </span>
        ) : (
          <FileText size={15} />
        )}
        <span>{file.name.split("/").at(-1)}</span>
        {file.name === project.mainFile && (
          <span className="main-file-dot" title="Main document" />
        )}
      </button>
    );
    return (
      <>
        {project.files
          .filter((file) => !file.name.includes("/"))
          .map((file) => fileRow(file))}
        {folders.map((folder) => (
          <div key={folder}>
            <button
              className="folder-row"
              onClick={() =>
                setCollapsed((current) =>
                  current.includes(folder)
                    ? current.filter((item) => item !== folder)
                    : [...current, folder],
                )
              }
            >
              {collapsed.includes(folder) ? (
                <ChevronRight size={13} />
              ) : (
                <ChevronDown size={13} />
              )}
              <Folder size={15} />
              <span>{folder}</span>
              <span className="file-count">
                {
                  project.files.filter(
                    (file) =>
                      file.name.slice(0, file.name.lastIndexOf("/")) === folder,
                  ).length
                }
              </span>
            </button>
            {!collapsed.includes(folder) &&
              project.files
                .filter(
                  (file) =>
                    file.name.slice(0, file.name.lastIndexOf("/")) === folder,
                )
                .map((file) => fileRow(file, true))}
          </div>
        ))}
      </>
    );
  }
  const paletteCommands = [
    {
      title: "Recompile document",
      detail: "Bring your words to life",
      icon: Play,
      action: () => compile(),
      shortcut: "⌘ ↵",
    },
    {
      title: "Open project library",
      detail: "A home for all your ideas",
      icon: LayoutGrid,
      action: () => attempt(showLibrary),
      shortcut: "",
    },
    {
      title: "New project",
      detail: "Make room for something new",
      icon: Plus,
      action: () => openNew(),
      shortcut: "⌘ ⇧ N",
    },
    {
      title: "Find in document",
      detail: "Search and replace source text",
      icon: Search,
      action: () => editorRef.current?.find(),
      shortcut: "⌘ F",
    },
    {
      title: "Dopnur Agent",
      detail: "A second pair of thoughtful eyes",
      icon: AgentMark,
      action: () => setAgentOpen((value) => !value),
      shortcut: "⌘ J",
    },
    {
      title: "Focus mode",
      detail: "A little less distraction",
      icon: Focus,
      action: () => setFocus((value) => !value),
      shortcut: "⌘ ⇧ F",
    },
    {
      title: "Save a revision",
      detail: "Keep a little milestone",
      icon: History,
      action: () => attempt(saveSnapshot),
      shortcut: "",
    },
    {
      title: "Manage references",
      detail: "A home for your bibliography",
      icon: BookOpen,
      action: () => openDialog("references"),
      shortcut: "",
    },
    {
      title: "Export PDF",
      detail: "Share your finished page",
      icon: Download,
      action: () => commandRef.current("export-pdf"),
      shortcut: "",
    },
    {
      title: "Preferences",
      detail: "Make yourself at home",
      icon: Settings2,
      action: () => openSettings("general"),
      shortcut: "⌘ ,",
    },
  ];
  if (fatal)
    return (
      <div className="launch-state">
        <Logo size={58} />
        <h1>A little more space to think.</h1>
        <p>{fatal}</p>
      </div>
    );
  if (!boot || !settings)
    return (
      <div className="launch-state">
        <Logo size={52} />
        <p>Making a little room for you…</p>
        <Loader2 size={18} className="spin" />
      </div>
    );
  return (
    <div
      className={`app ${focus ? "focus-mode" : ""} ${agentOpen ? "with-agent" : ""}`}
    >
      <div className="titlebar">
        <div className="traffic-space" />
        {boot.platform !== "darwin" && (
          <span className="titlebar-brand">
            <Logo size={18} /> Dopnur
          </span>
        )}
        <span className="titlebar-caption">a little more space to think.</span>
        <button
          className="command-search"
          onClick={() => commandRef.current("palette")}
        >
          <Search size={13} />
          <span>Search anything…</span>
          <kbd>{boot.platform === "darwin" ? "⌘" : "Ctrl"} K</kbd>
        </button>
        {boot.platform !== "darwin" && (
          <div className="window-controls">
            <IconButton
              label="Minimize window"
              onClick={() => api.windowAction("minimize")}
            >
              <Minimize2 size={13} />
            </IconButton>
            <IconButton
              label="Maximize window"
              onClick={() => api.windowAction("maximize")}
            >
              <Square size={12} />
            </IconButton>
            <IconButton
              label="Close window"
              onClick={() => api.windowAction("close")}
            >
              <X size={15} />
            </IconButton>
          </div>
        )}
      </div>
      <header className="app-header">
        <button className="brand" onClick={() => void attempt(showLibrary)}>
          <Logo size={35} />
          <span>
            dopnur<span className="brand-period">.</span>
          </span>
        </button>
        <span className="header-divider" />
        <div className="breadcrumb">
          <button onClick={() => void attempt(showLibrary)}>
            My workspace
          </button>
          {view === "workspace" && project && (
            <>
              <ChevronRight size={13} />
              <button
                className="project-title"
                onClick={() => {
                  setName(project.name);
                  openDialog("rename");
                }}
              >
                {project.name}
                <ChevronDown size={13} />
              </button>
            </>
          )}
        </div>
        <div className="spacer" />
        {view === "workspace" && (
          <>
            <span className="save-state">
              {saving ? (
                <Loader2 size={13} className="spin" />
              ) : dirty ? (
                <span className="status-dot amber" />
              ) : (
                <CheckCheck size={15} />
              )}
              <span>
                {saving
                  ? "Saving…"
                  : dirty
                    ? "Unsaved changes"
                    : "All changes saved"}
              </span>
            </span>
            <button
              className="header-action"
              onClick={() => void attempt(showHistory)}
            >
              <History size={16} />
              <span>History</span>
            </button>
            <button
              className="header-action"
              onClick={() => commandRef.current("export")}
            >
              <Upload size={16} />
              <span>Export</span>
            </button>
            <button
              className={`agent-toggle ${agentOpen ? "selected" : ""}`}
              onClick={() => commandRef.current("agent")}
            >
              <AgentMark size={18} />
              <span>Dopnur Agent</span>
              <kbd>{boot.platform === "darwin" ? "⌘" : "Ctrl"} J</kbd>
            </button>
          </>
        )}
        <button
          className="profile-button"
          aria-label="Open preferences"
          onClick={() => openSettings("general")}
        >
          a<span />
        </button>
      </header>
      <div className="app-body">
        <nav className="activity-bar">
          <IconButton
            label="Project library"
            active={view === "library"}
            onClick={() => void attempt(showLibrary)}
          >
            <LayoutGrid size={20} strokeWidth={1.65} />
          </IconButton>
          <span className="activity-divider" />
          <IconButton
            label="Project files"
            active={view === "workspace" && sidebar && sidebarMode === "files"}
            onClick={() => {
              setView("workspace");
              setSidebar(true);
              setSidebarMode("files");
            }}
          >
            <Files size={20} strokeWidth={1.6} />
          </IconButton>
          <IconButton
            label="Search project"
            active={sidebarMode === "search" && sidebar && view === "workspace"}
            onClick={() => {
              setView("workspace");
              setSidebar(true);
              setSidebarMode("search");
            }}
          >
            <Search size={20} strokeWidth={1.6} />
          </IconButton>
          <IconButton
            label="References"
            onClick={() => openDialog("references")}
          >
            <BookOpen size={20} strokeWidth={1.6} />
          </IconButton>
          <IconButton
            label="Revision history"
            onClick={() => void attempt(showHistory)}
          >
            <History size={20} strokeWidth={1.6} />
          </IconButton>
          <div className="spacer" />
          <IconButton
            label="Focus mode"
            active={focus}
            onClick={() => setFocus(!focus)}
          >
            <Focus size={20} strokeWidth={1.6} />
          </IconButton>
          <IconButton label="Learn LaTeX" onClick={() => api.openHelp("latex")}>
            <CircleHelp size={20} strokeWidth={1.6} />
          </IconButton>
          <IconButton
            label="Preferences"
            onClick={() => openSettings("general")}
          >
            <Settings2 size={20} strokeWidth={1.6} />
          </IconButton>
        </nav>
        {view === "library" ? (
          <Library
            projects={projects}
            templates={boot.templates}
            onOpen={(id) => void attempt(() => openProject(id))}
            onNew={openNew}
            onImport={() => openDialog("import")}
            onStar={(id) =>
              void attempt(async () => {
                const p = await api.getProject(id);
                await api.saveProject({ ...p, starred: !p.starred });
                setProjects((await api.bootstrap()).projects);
                if (current.current?.id === id)
                  commit({ ...current.current, starred: !p.starred }, true);
              })
            }
            onArchive={(id) =>
              void attempt(async () => {
                await api.archiveProject(id);
                if (current.current?.id === id) {
                  current.current = null;
                  setProject(null);
                  dirtyRef.current = false;
                  setDirty(false);
                }
                setProjects((await api.bootstrap()).projects);
                notify("Project archived locally.");
              })
            }
          />
        ) : project && activeFile ? (
          <div className="workspace-shell">
            {sidebar && (
              <aside className="file-sidebar">
                <header className="sidebar-header">
                  <span>
                    {sidebarMode === "files"
                      ? "PROJECT FILES"
                      : "FIND IN PROJECT"}
                  </span>
                  <div className="spacer" />
                  {sidebarMode === "files" && (
                    <>
                      <IconButton
                        label="New file"
                        onClick={() => {
                          setName("");
                          openDialog("file");
                        }}
                      >
                        <Plus size={16} />
                      </IconButton>
                      <IconButton
                        label="Import files"
                        onClick={() => void attempt(importFiles)}
                      >
                        <Upload size={15} />
                      </IconButton>
                    </>
                  )}
                  <IconButton
                    label="Hide file sidebar"
                    onClick={() => setSidebar(false)}
                  >
                    <PanelLeftClose size={15} />
                  </IconButton>
                </header>
                {sidebarMode === "files" ? (
                  <>
                    <div className="project-file-root">
                      <ChevronDown size={13} />
                      <FolderOpen size={15} />
                      <strong>{project.name}</strong>
                    </div>
                    <div className="file-tree">{renderTree()}</div>
                    <div className="sidebar-separator" />
                    <div className="outline-heading">
                      <span>DOCUMENT OUTLINE</span>
                      <List size={14} />
                    </div>
                    <div className="document-outline">
                      {headings.length ? (
                        headings.map((heading, i) => (
                          <button
                            key={heading.fileId + "-" + heading.line}
                            className={`level-${heading.level} ${cursor.line === heading.line && activeId === heading.fileId ? "current" : ""}`}
                            onClick={() => {
                              const file = project.files.find(
                                (file) => file.id === heading.fileId,
                              );
                              if (file) openFile(file, heading.line);
                            }}
                          >
                            <span>
                              {heading.level
                                ? ""
                                : headings
                                    .slice(0, i + 1)
                                    .filter((item) => !item.level).length}
                            </span>
                            {heading.label}
                          </button>
                        ))
                      ) : (
                        <p className="sidebar-empty">
                          Your sections will appear here as your story takes
                          shape.
                        </p>
                      )}
                    </div>
                    <div className="writing-goal">
                      <div className="goal-icon">
                        <Leaf size={16} />
                      </div>
                      <strong>One word at a time.</strong>
                      <p>A little progress is still progress.</p>
                      <div className="goal-progress">
                        <i
                          style={{
                            width: `${Math.min(100, (count / settings.dailyGoal) * 100)}%`,
                          }}
                        />
                      </div>
                      <div className="goal-count">
                        <span>{count.toLocaleString()} words</span>
                        <span>{settings.dailyGoal.toLocaleString()} goal</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="workspace-search">
                    <div className="search-input">
                      <Search size={15} />
                      <input
                        aria-label="Search all project files"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Find a word or idea…"
                        autoFocus
                      />
                    </div>
                    {search ? (
                      project.files
                        .filter((file) => !file.encoding)
                        .flatMap((file) =>
                          file.content
                            .split("\n")
                            .flatMap((line, index) =>
                              line.toLowerCase().includes(search.toLowerCase())
                                ? [{ file, line, index }]
                                : [],
                            ),
                        )
                        .slice(0, 100)
                        .map((item, i) => (
                          <button
                            className="search-result"
                            key={i}
                            onClick={() => openFile(item.file, item.index + 1)}
                          >
                            <strong>
                              {item.file.name}
                              <span>{item.index + 1}</span>
                            </strong>
                            <p>{item.line.trim()}</p>
                          </button>
                        ))
                    ) : (
                      <p className="sidebar-empty">
                        Search across every text file in this project.
                      </p>
                    )}
                  </div>
                )}
                <button
                  className="sidebar-bottom"
                  onClick={() => void attempt(showLibrary)}
                >
                  <ArrowLeft size={14} /> Back to my projects
                </button>
              </aside>
            )}
            <div
              className="editor-preview"
              ref={splitRef}
              style={{ "--editor-width": `${split}%` } as CSSProperties}
            >
              <section className="editor-pane">
                <div className="editor-tabs">
                  {!sidebar && (
                    <IconButton
                      label="Show file sidebar"
                      onClick={() => setSidebar(true)}
                    >
                      <PanelLeftOpen size={16} />
                    </IconButton>
                  )}
                  {tabs.map((id) => {
                    const file = project.files.find((file) => file.id === id);
                    return file ? (
                      <div
                        className={`file-tab ${activeId === id ? "active" : ""}`}
                        key={id}
                      >
                        <button onClick={() => openFile(file)}>
                          {file.name.endsWith(".bib") ? (
                            <BookOpen size={13} />
                          ) : (
                            <FileCode2 size={14} />
                          )}
                          <span>{file.name.split("/").at(-1)}</span>
                          {activeId === id && dirty && <i />}
                        </button>
                        <button
                          className="tab-close"
                          aria-label={`Close ${file.name}`}
                          onClick={() => {
                            if (tabs.length < 2) return;
                            setTabs(tabs.filter((tab) => tab !== id));
                            if (activeId === id)
                              setActiveId(tabs.find((tab) => tab !== id)!);
                          }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : null;
                  })}
                  <div className="spacer" />
                  <IconButton
                    label="Add a file"
                    onClick={() => {
                      setName("");
                      openDialog("file");
                    }}
                  >
                    <Plus size={15} />
                  </IconButton>
                </div>
                <div className="editor-toolbar">
                  <div className="editor-mode">
                    <button
                      className={!reading ? "selected" : ""}
                      onClick={() => setReading(false)}
                    >
                      <Code2 size={13} />
                      Source
                    </button>
                    <button
                      className={reading ? "selected" : ""}
                      onClick={() => setReading(true)}
                    >
                      <AlignLeft size={13} />
                      Read
                    </button>
                  </div>
                  <span className="toolbar-divider" />
                  <IconButton
                    label="Bold text"
                    onClick={() => insert("\\textbf{", "}")}
                  >
                    <Bold size={14} />
                  </IconButton>
                  <IconButton
                    label="Italic text"
                    onClick={() => insert("\\textit{", "}")}
                  >
                    <Italic size={14} />
                  </IconButton>
                  <IconButton
                    label="Insert equation"
                    onClick={() =>
                      insert(
                        "\n\\begin{equation}\n  E = mc^2\n\\end{equation}\n",
                      )
                    }
                  >
                    <SquareFunction size={15} />
                  </IconButton>
                  <IconButton
                    label="Insert citation"
                    onClick={() => openDialog("references")}
                  >
                    <span className="quote-icon">”</span>
                  </IconButton>
                  <div className="spacer" />
                  <IconButton
                    label="Find and replace"
                    onClick={() => editorRef.current?.find()}
                  >
                    <Search size={14} />
                  </IconButton>
                  <IconButton
                    label="File options"
                    onClick={() => {
                      setName(activeFile.name);
                      openDialog("delete");
                    }}
                  >
                    <MoreHorizontal size={16} />
                  </IconButton>
                </div>
                {activeFile.encoding ? (
                  <div className="asset-preview">
                    {/\.(png|jpe?g|svg|webp)$/i.test(activeFile.name) ? (
                      <img
                        src={`data:image/${activeFile.name.endsWith(".svg") ? "svg+xml" : activeFile.name.split(".").at(-1)};base64,${activeFile.content}`}
                        alt={activeFile.name}
                      />
                    ) : (
                      <FileText size={55} strokeWidth={1} />
                    )}
                    <strong>{activeFile.name}</strong>
                    <p>
                      Project asset ·{" "}
                      {Math.round((activeFile.content.length * 0.75) / 1024)} KB
                    </p>
                    <button
                      className="button"
                      onClick={() => {
                        const main = project.files.find(
                          (file) => file.name === project.mainFile,
                        );
                        if (main) {
                          openFile(main);
                          setTimeout(
                            () =>
                              editorRef.current?.insert(
                                `\n\\includegraphics[width=\\linewidth]{${activeFile.name}}\n`,
                              ),
                            60,
                          );
                        }
                      }}
                    >
                      Insert in main document <ArrowUpRight size={14} />
                    </button>
                  </div>
                ) : reading ? (
                  <div className="reading-pane">
                    <span className="eyebrow">
                      A QUIETER VIEW OF YOUR SOURCE
                    </span>
                    {activeFile.content
                      .split("\n")
                      .filter((line) => !line.trim().startsWith("%"))
                      .map((line, i) => {
                        const heading = line.match(
                          /\\(?:sub)*section\*?\{([^}]+)\}/,
                        );
                        return heading ? (
                          <h2 key={i}>{heading[1]}</h2>
                        ) : (
                          <p key={i}>
                            {line.replace(
                              /\\(?:textbf|textit|emph)\{([^}]+)\}/g,
                              "$1",
                            )}
                          </p>
                        );
                      })}
                  </div>
                ) : (
                  <Editor
                    ref={editorRef}
                    file={activeFile}
                    settings={settings}
                    onChange={updateFile}
                    onCursor={(line, column) => {
                      setCursor({ line, column });
                      if (agentOpen)
                        setSelection(editorRef.current?.selection() || "");
                    }}
                    onCompile={() => void compile()}
                  />
                )}
                {!agentOpen && (
                  <button
                    className="editor-agent-invite"
                    onClick={() => commandRef.current("agent")}
                  >
                    <span className="invite-star">
                      <AgentMark size={19} />
                    </span>
                    <span>A little help, when you need it.</span>
                    <strong>
                      Ask Dopnur <ArrowUpRight size={13} />
                    </strong>
                  </button>
                )}
                <footer className="editor-footer">
                  <span>
                    <span className="status-dot" />
                    LaTeX
                  </span>
                  <span>
                    Ln {cursor.line}, Col {cursor.column}
                  </span>
                  <div className="spacer" />
                  <span>UTF-8</span>
                  <IconButton
                    label="Undo last edit"
                    onClick={() => editorRef.current?.undo()}
                  >
                    <Undo2 size={13} />
                  </IconButton>
                </footer>
              </section>
              <div
                className="pane-resizer"
                role="separator"
                aria-label="Resize editor and PDF"
                aria-orientation="vertical"
                aria-valuenow={Math.round(split)}
                aria-valuemin={28}
                aria-valuemax={70}
                tabIndex={0}
                onPointerDown={dragSplit}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft")
                    setSplit((s) => Math.max(28, s - 2));
                  if (e.key === "ArrowRight")
                    setSplit((s) => Math.min(70, s + 2));
                }}
              >
                <span />
                <span />
              </div>
              <section className="preview-pane">
                <header className="preview-toolbar">
                  <div className="compile-control">
                    <button
                      className="compile-button"
                      onClick={() =>
                        compiling ? api.cancelCompile() : compile()
                      }
                    >
                      {compiling ? (
                        <Loader2 size={14} className="spin" />
                      ) : (
                        <Play size={13} fill="currentColor" />
                      )}
                      <span>{compiling ? "Compiling…" : "Recompile"}</span>
                    </button>
                    <button
                      className="compile-options"
                      aria-label="Compiler preferences"
                      onClick={() => openSettings("compiler")}
                    >
                      <ChevronDown size={12} />
                    </button>
                  </div>
                  <IconButton
                    label="Compilation log"
                    active={logOpen}
                    onClick={() => setLogOpen(!logOpen)}
                  >
                    <FileText size={16} />
                    {!!compileResult?.diagnostics.length && (
                      <i className="notification-dot" />
                    )}
                  </IconButton>
                  <div className="spacer" />
                  <span className="pdf-label">PDF PREVIEW</span>
                  <IconButton
                    label="Export PDF"
                    onClick={() => commandRef.current("export-pdf")}
                  >
                    <ArrowDownToLine size={16} />
                  </IconButton>
                  <IconButton
                    label={focus ? "Exit focus mode" : "Enter focus mode"}
                    onClick={() => setFocus(!focus)}
                  >
                    {focus ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                  </IconButton>
                </header>
                <div className="pdf-navigation">
                  <div className="page-controls">
                    <IconButton
                      label="Previous PDF page"
                      disabled={page <= 1}
                      onClick={() =>
                        document
                          .getElementById(`pdf-page-${page - 1}`)
                          ?.scrollIntoView({ behavior: "smooth" })
                      }
                    >
                      <ChevronRight size={13} className="rotate-180" />
                    </IconButton>
                    <span>
                      {pages ? page : "—"} <span>/ {pages || "—"}</span>
                    </span>
                    <IconButton
                      label="Next PDF page"
                      disabled={page >= pages}
                      onClick={() =>
                        document
                          .getElementById(`pdf-page-${page + 1}`)
                          ?.scrollIntoView({ behavior: "smooth" })
                      }
                    >
                      <ChevronRight size={13} />
                    </IconButton>
                  </div>
                  <span className="preview-document">
                    {project.mainFile.replace(/\.tex$/, ".pdf")}
                    {pdfDirty && (
                      <span
                        className="outdated-dot"
                        title="Source changed; recompile to update PDF"
                      />
                    )}
                  </span>
                  <div className="zoom-controls">
                    <IconButton
                      label="Zoom out"
                      disabled={zoom <= 50}
                      onClick={() => setZoom((z) => Math.max(50, z - 10))}
                    >
                      <ZoomOut size={14} />
                    </IconButton>
                    <button onClick={() => setZoom(100)} title="Fit to width">
                      {zoom}%
                    </button>
                    <IconButton
                      label="Zoom in"
                      disabled={zoom >= 200}
                      onClick={() => setZoom((z) => Math.min(200, z + 10))}
                    >
                      <ZoomIn size={14} />
                    </IconButton>
                  </div>
                </div>
                <PdfViewer
                  pdf={pdf}
                  zoom={zoom}
                  onPages={setPages}
                  onPage={setPage}
                  emptyAction={() => void compile()}
                  sample={sample}
                />
                {pdfDirty && !sample && (
                  <button className="pdf-stale" onClick={() => void compile()}>
                    <RefreshCw size={12} /> Your source has changed. Recompile
                    to update.
                  </button>
                )}
                {logOpen && (
                  <div className="compile-log">
                    <header>
                      <div className="text-tabs">
                        <button
                          className={logMode === "issues" ? "selected" : ""}
                          onClick={() => setLogMode("issues")}
                        >
                          Issues{" "}
                          <span>{compileResult?.diagnostics.length || 0}</span>
                        </button>
                        <button
                          className={logMode === "log" ? "selected" : ""}
                          onClick={() => setLogMode("log")}
                        >
                          Full log
                        </button>
                      </div>
                      <div className="spacer" />
                      <IconButton
                        label="Close compilation log"
                        onClick={() => setLogOpen(false)}
                      >
                        <X size={14} />
                      </IconButton>
                    </header>
                    {logMode === "log" ? (
                      <pre>
                        {compileOutput ||
                          compileResult?.log ||
                          "Compile your project to see output here."}
                      </pre>
                    ) : (
                      <div className="diagnostic-list">
                        {compileResult?.diagnostics.length ? (
                          compileResult.diagnostics.map((item, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                if (item.line) {
                                  const main = project.files.find(
                                    (file) => file.name === project.mainFile,
                                  );
                                  if (main) openFile(main, item.line);
                                }
                              }}
                            >
                              <AlertCircle
                                size={14}
                                className={item.severity}
                              />
                              <span>{item.message}</span>
                              {item.line && <b>line {item.line}</b>}
                            </button>
                          ))
                        ) : (
                          <p>
                            <Check size={16} />
                            {compiling
                              ? "Compiler is running…"
                              : compileResult?.ok
                                ? "Your document compiled without reported issues."
                                : compileResult?.log ||
                                  "Nothing to report. You’re ready to write."}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <footer className="preview-footer">
                  <span>
                    {compiling ? (
                      <>
                        <Loader2 size={12} className="spin" />
                        Putting it all together…
                      </>
                    ) : compileResult?.ok ? (
                      <>
                        <Check size={12} />
                        Compiled in {(compileResult.duration / 1000).toFixed(1)}
                        s
                      </>
                    ) : sample ? (
                      <>
                        <Leaf size={12} />A little inspiration to start with
                      </>
                    ) : (
                      <>
                        <Leaf size={12} />
                        Your page, made locally
                      </>
                    )}
                  </span>
                  <span>
                    {compileResult?.engine || "Tectonic"}
                    <span className="status-dot" />
                  </span>
                </footer>
              </section>
            </div>
            {agentOpen && (
              <AgentPanel
                settings={settings}
                messages={messages}
                proposal={proposal}
                running={agentRunning}
                output={agentOutput}
                activeFile={activeFile.name}
                selection={selection}
                onSend={(prompt) => void attempt(() => runAgent(prompt))}
                onCancel={() => void api.cancelAgent()}
                onClose={() => setAgentOpen(false)}
                onSettings={() => openSettings("agent")}
                onReview={() => openDialog("review")}
                onReset={() => {
                  setMessages([]);
                  setProposal(null);
                  setAgentOutput("");
                }}
              />
            )}
          </div>
        ) : (
          <div className="launch-state">
            <h2>Your next idea belongs here.</h2>
            <button className="button primary" onClick={() => openNew()}>
              Create a project
            </button>
          </div>
        )}
      </div>
      <footer className="app-status">
        <span>
          <span className="status-dot" />
          All yours. All local.
        </span>
        <span className="status-separator" />
        {view === "workspace" && (
          <>
            <span>{count.toLocaleString()} words</span>
            <span>~{Math.max(1, Math.ceil(count / 220))} min read</span>
          </>
        )}
        <div className="spacer" />
        {focus ? (
          <button onClick={() => setFocus(false)}>
            <Clock3 size={13} />
            Focus · {String(Math.floor(sessionSeconds / 60)).padStart(2, "0")}:
            {String(sessionSeconds % 60).padStart(2, "0")}
            <span>Exit focus</span>
          </button>
        ) : (
          <span className="status-motto">
            <Leaf size={12} /> Room for your next big idea.
          </span>
        )}
        <span className="status-separator" />
        <button onClick={() => commandRef.current("palette")}>
          <Command size={12} />
          Shortcuts
        </button>
      </footer>
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <AlertCircle size={17} /> : <Check size={17} />}
          <span>{toast.text}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {dialog === "settings" && (
        <SettingsDialog
          settings={settings}
          connections={boot.connections}
          initialTab={settingsTab}
          onSave={(next) => {
            setBoot({ ...boot, settings: next });
            notify("A little more you. Preferences saved.");
          }}
          onClose={closeDialog}
        />
      )}
      {["new", "file", "rename"].includes(dialog || "") && (
        <Modal
          title={
            dialog === "new"
              ? "Make room for an idea."
              : dialog === "file"
                ? "A new little chapter."
                : "Give your project a name."
          }
          subtitle={
            dialog === "new"
              ? "A fresh start, with a little help from a template."
              : dialog === "file"
                ? "Add a file, or use a path to create a folder."
                : "Something that feels like your work."
          }
          onClose={closeDialog}
          wide={dialog === "new"}
        >
          <div className="name-form">
            {dialog === "new" && (
              <div className="new-template-grid">
                {boot.templates.map((item) => (
                  <button
                    className={`${item.color} ${template === item.id ? "chosen" : ""}`}
                    key={item.id}
                    onClick={() => setTemplate(item.id)}
                  >
                    <FileText size={27} strokeWidth={1.3} />
                    <strong>{item.name}</strong>
                    <span>{item.label}</span>
                    {template === item.id && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
            <label className="field-label" htmlFor="name-field">
              {dialog === "file" ? "File name" : "Project name"}
            </label>
            <input
              id="name-field"
              maxLength={dialog === "file" ? 220 : 160}
              placeholder={
                dialog === "file"
                  ? "chapters/a-new-idea.tex"
                  : "The beginning of something good"
              }
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitName();
              }}
            />
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
          </div>
          <footer className="modal-footer">
            <span className="subtle">
              <Leaf size={14} />
              Saved on your device.
            </span>
            <button className="button" onClick={closeDialog}>
              Cancel
            </button>
            <button
              className="button primary"
              disabled={modalBusy}
              onClick={() => void submitName()}
            >
              {modalBusy
                ? "Getting ready…"
                : dialog === "new"
                  ? "Create project"
                  : dialog === "file"
                    ? "Create file"
                    : "Save name"}
              <ArrowRight size={15} />
            </button>
          </footer>
        </Modal>
      )}
      {dialog === "import" && (
        <Modal
          title="Bring your work home."
          subtitle="Pick up right where you left off, with all your files together."
          onClose={closeDialog}
        >
          <div className="import-options">
            <button
              disabled={modalBusy}
              onClick={() => void importProject("zip")}
            >
              <span className="import-icon">
                <Upload size={25} />
              </span>
              <strong>Import a ZIP project</strong>
              <p>Export the source from Overleaf, then bring it here.</p>
              <ArrowUpRight size={17} />
            </button>
            <button
              disabled={modalBusy}
              onClick={() => void importProject("folder")}
            >
              <span className="import-icon peach">
                <FolderOpen size={25} />
              </span>
              <strong>Open a local folder</strong>
              <p>Copy an existing LaTeX project into your library.</p>
              <ArrowUpRight size={17} />
            </button>
            <span className="subtle">
              Projects are copied into Dopnur. Your original files stay where
              they are.
            </span>
            {formError && <p className="form-error">{formError}</p>}
          </div>
        </Modal>
      )}
      {dialog === "history" && project && (
        <Modal
          title="Every step of the story."
          subtitle="Your local revisions. Little milestones you can come back to."
          onClose={closeDialog}
        >
          <div className="history-list">
            <button
              className="history-current"
              onClick={() =>
                void attempt(async () => {
                  await saveSnapshot();
                  setSnapshots(await api.snapshots(project.id));
                })
              }
            >
              <span>
                <Plus size={19} />
              </span>
              <div>
                <strong>Keep this moment</strong>
                <p>Save a named revision of your current work.</p>
              </div>
              <ArrowUpRight size={16} />
            </button>
            {snapshots.map((snapshot, i) => (
              <div className="history-item" key={snapshot.id}>
                <div className="history-dot">
                  <span />
                </div>
                <div>
                  <strong>{snapshot.label}</strong>
                  <p>
                    {new Date(snapshot.createdAt).toLocaleString()} ·{" "}
                    {wordCount(snapshot.project.files)} words
                  </p>
                  {i === 0 && (
                    <span className="revision-label">MOST RECENT</span>
                  )}
                </div>
                <button
                  className="button small"
                  disabled={modalBusy}
                  onClick={() => void restore(snapshot)}
                >
                  Restore
                </button>
              </div>
            ))}
            {formError && <p className="form-error">{formError}</p>}
          </div>
          <div className="history-note">
            Restoring a revision first saves your current work. Dopnur keeps
            your 30 most recent revisions.
          </div>
        </Modal>
      )}
      {dialog === "references" && project && (
        <Modal
          title="Good ideas have good company."
          subtitle="Your bibliography, all in one thoughtful little place."
          onClose={closeDialog}
          wide
          className="references-modal"
        >
          <div className="reference-search search-input">
            <Search size={16} />
            <input
              aria-label="Search bibliography"
              placeholder="Find a title, author, or citation key…"
              value={bibSearch}
              onChange={(e) => setBibSearch(e.target.value)}
            />
            <span>
              {
                parseBib(
                  project.files
                    .filter((file) => file.name.endsWith(".bib"))
                    .map((file) => file.content)
                    .join("\n"),
                ).length
              }{" "}
              references
            </span>
          </div>
          <div className="reference-list">
            {parseBib(
              project.files
                .filter((file) => file.name.endsWith(".bib"))
                .map((file) => file.content)
                .join("\n"),
            )
              .filter((entry) =>
                (entry.title + entry.author + entry.key)
                  .toLowerCase()
                  .includes(bibSearch.toLowerCase()),
              )
              .map((entry) => (
                <div className="reference-item" key={entry.key}>
                  <div className="reference-icon">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <span className="reference-type">
                      {entry.type} · {entry.year || "Year not set"}
                    </span>
                    <h3>{entry.title}</h3>
                    <p>{entry.author || "Author not set"}</p>
                    <code>{entry.key}</code>
                  </div>
                  <button
                    className="button small"
                    onClick={() => {
                      closeDialog();
                      const target = activeFile?.name.endsWith(".tex")
                        ? activeFile
                        : project.files.find(
                            (file) => file.name === project.mainFile,
                          );
                      if (target) openFile(target);
                      setTimeout(
                        () => editorRef.current?.insert(`\\cite{${entry.key}}`),
                        80,
                      );
                      notify("Citation added to your document.");
                    }}
                  >
                    Cite <Plus size={13} />
                  </button>
                </div>
              ))}
          </div>
          <div className="bib-add">
            <label className="field-label" htmlFor="bib-entry">
              Add a reference <span>paste a BibTeX entry</span>
            </label>
            <textarea
              id="bib-entry"
              value={bibInput}
              onChange={(e) => setBibInput(e.target.value)}
              placeholder={
                "@article{your_key,\n  title = {An idea worth citing},\n  author = {Author},\n  year = {2026}\n}"
              }
            />
            <div>
              {formError && <span className="form-error">{formError}</span>}
              <button
                className="button"
                disabled={!bibInput.trim()}
                onClick={() => {
                  const entries = parseBib(bibInput);
                  if (!entries.length) {
                    setFormError(
                      "Paste a complete BibTeX entry beginning with @article, @book, or another entry type.",
                    );
                    return;
                  }
                  const existing = parseBib(
                    project.files
                      .filter((file) => file.name.endsWith(".bib"))
                      .map((file) => file.content)
                      .join("\n"),
                  );
                  if (
                    entries.some((entry) =>
                      existing.some((old) => old.key === entry.key),
                    )
                  ) {
                    setFormError("One of those citation keys already exists.");
                    return;
                  }
                  const file = project.files.find((file) =>
                    file.name.endsWith(".bib"),
                  );
                  commit({
                    ...project,
                    files: file
                      ? project.files.map((item) =>
                          item.id === file.id
                            ? {
                                ...item,
                                content:
                                  item.content + "\n" + bibInput.trim() + "\n",
                              }
                            : item,
                        )
                      : [
                          ...project.files,
                          {
                            id: crypto.randomUUID(),
                            name: "references.bib",
                            content: bibInput.trim() + "\n",
                          },
                        ],
                  });
                  setPdfDirty(true);
                  setBibInput("");
                  setFormError("");
                  notify("Reference added.");
                }}
              >
                <Plus size={14} />
                Add to bibliography
              </button>
            </div>
          </div>
        </Modal>
      )}
      {dialog === "palette" && (
        <Modal
          title="Where would you like to go?"
          onClose={closeDialog}
          className="command-modal"
        >
          <div className="palette-search">
            <Search size={20} />
            <input
              aria-label="Search commands"
              placeholder="A command, a file, a little shortcut…"
              value={paletteSearch}
              onChange={(e) => setPaletteSearch(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const match = paletteCommands.find((item) =>
                    item.title
                      .toLowerCase()
                      .includes(paletteSearch.toLowerCase()),
                  );
                  if (match) {
                    closeDialog();
                    setTimeout(() => match.action(), 0);
                  }
                }
              }}
            />
            <kbd>esc</kbd>
          </div>
          <div className="palette-results">
            {paletteCommands
              .filter((item) =>
                item.title.toLowerCase().includes(paletteSearch.toLowerCase()),
              )
              .map((item) => (
                <button
                  key={item.title}
                  onClick={() => {
                    closeDialog();
                    setTimeout(() => item.action(), 0);
                  }}
                >
                  <item.icon size={18} />
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                  </div>
                  {item.shortcut && <kbd>{item.shortcut}</kbd>}
                </button>
              ))}
            {project?.files
              .filter(
                (file) =>
                  paletteSearch &&
                  file.name.toLowerCase().includes(paletteSearch.toLowerCase()),
              )
              .map((file) => (
                <button
                  key={file.id}
                  onClick={() => {
                    openFile(file);
                    closeDialog();
                  }}
                >
                  <FileText size={18} />
                  <strong>{file.name}</strong>
                </button>
              ))}
          </div>
        </Modal>
      )}
      {dialog === "review" && proposal && (
        <ReviewDialog
          proposal={proposal}
          busy={modalBusy}
          onApply={(paths) => void applyProposal(paths)}
          onClose={closeDialog}
        />
      )}
      {dialog === "delete" && project && activeFile && (
        <Modal
          title={activeFile.name}
          subtitle="A few little details about this file."
          onClose={closeDialog}
        >
          <div className="file-details">
            <p>
              {activeFile.name === project.mainFile
                ? "This is your main LaTeX document."
                : `${activeFile.encoding ? "Asset" : "Text file"} in ${project.name}.`}
            </p>
            {activeFile.name.endsWith(".tex") &&
              activeFile.name !== project.mainFile && (
                <button
                  className="button"
                  onClick={() => {
                    commit({ ...project, mainFile: activeFile.name });
                    setPdfDirty(true);
                    closeDialog();
                    notify("Main document updated.");
                  }}
                >
                  <FileCode2 size={15} />
                  Set as main document
                </button>
              )}
            <button
              className="button danger"
              disabled={activeFile.name === project.mainFile}
              onClick={() =>
                void attempt(async () => {
                  await api.snapshot({
                    project,
                    label: `Before removing ${activeFile.name}`,
                  });
                  const next = {
                    ...project,
                    files: project.files.filter(
                      (file) => file.id !== activeFile.id,
                    ),
                  };
                  commit(next);
                  setTabs(tabs.filter((id) => id !== activeFile.id));
                  setActiveId(next.files[0].id);
                  setPdfDirty(true);
                  closeDialog();
                  notify("File removed. A copy is saved in revision history.");
                })
              }
            >
              <Trash2 size={15} />
              Remove file
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
