export interface ProjectFile {
  id: string;
  name: string;
  content: string;
  encoding?: "base64";
}
export interface Project {
  id: string;
  name: string;
  mainFile: string;
  files: ProjectFile[];
  createdAt: number;
  updatedAt: number;
  starred: boolean;
  color: string;
  template: string;
}
export type ProjectSummary = Omit<Project, "files"> & { fileCount: number };
export interface Template {
  id: string;
  name: string;
  description: string;
  color: string;
  label: string;
}
export interface Settings {
  provider: "codex" | "claude" | "api";
  model: string;
  apiBase: string;
  apiFormat: "responses" | "chat";
  codexPath: string;
  claudePath: string;
  compilerPath: string;
  engine: "auto" | "tectonic" | "latexmk" | "pdflatex";
  fontSize: number;
  wordWrap: boolean;
  autoCompile: boolean;
  theme: "light" | "dark";
  dailyGoal: number;
  hasApiKey: boolean;
  keyStorageAvailable: boolean;
}
export interface Connections {
  agents: { name: string; path: string | null }[];
  compilers: { name: string; path: string | null }[];
}
export interface Diagnostic {
  severity: "error" | "warning";
  message: string;
  line?: number;
}
export interface CompileResult {
  ok: boolean;
  pdf?: string;
  missingEngine?: boolean;
  log: string;
  diagnostics: Diagnostic[];
  duration: number;
  engine?: string;
}
export interface Snapshot {
  id: string;
  label: string;
  createdAt: number;
  project: Project;
}
export interface ProposedEdit {
  path: string;
  content: string;
  explanation: string;
  original: string | null;
  baseHash: string | null;
}
export interface Proposal {
  id: string;
  projectId: string;
  message: string;
  edits: ProposedEdit[];
}
export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}
export interface AgentRequest {
  project: Project;
  prompt: string;
  activeFile: string;
  selection: string;
  diagnostics: string;
  history: ChatMessage[];
}
export interface AppEvent {
  type: string;
  text?: string;
  projectId?: string;
  action?: string;
}
export interface Bootstrap {
  projects: ProjectSummary[];
  templates: Template[];
  settings: Settings;
  platform: string;
  version: string;
  connections: Connections;
}
export interface DesktopBridge {
  bootstrap(): Promise<Bootstrap>;
  getProject(id: string): Promise<Project>;
  saveProject(project: Project): Promise<Project>;
  createProject(input: { template: string; name: string }): Promise<Project>;
  archiveProject(id: string): Promise<void>;
  importProject(type: "zip" | "folder"): Promise<Project | null>;
  exportProject(project: Project): Promise<boolean>;
  importFiles(): Promise<ProjectFile[]>;
  snapshots(id: string): Promise<Snapshot[]>;
  snapshot(input: { project: Project; label: string }): Promise<Snapshot>;
  restoreSnapshot(input: {
    project: Project;
    snapshotId: string;
  }): Promise<Project>;
  compile(project: Project): Promise<CompileResult>;
  cancelCompile(): Promise<void>;
  getPdf(
    id: string,
  ): Promise<{ pdf: string; sample: boolean; stale: boolean } | null>;
  exportPdf(id: string): Promise<boolean>;
  getSettings(): Promise<Settings>;
  saveSettings(
    input: Partial<Settings> & { apiKey?: string; clearApiKey?: boolean },
  ): Promise<Settings>;
  connections(): Promise<Connections>;
  selectExecutable(): Promise<string | null>;
  runAgent(input: AgentRequest): Promise<Proposal>;
  cancelAgent(): Promise<void>;
  applyEdits(input: {
    project: Project;
    proposalId: string;
    paths: string[];
  }): Promise<Project>;
  windowAction(action: string): Promise<void>;
  openHelp(topic: string): Promise<void>;
  onEvent(callback: (event: AppEvent) => void): () => void;
}
declare global {
  interface Window {
    dopnur: DesktopBridge;
  }
}
