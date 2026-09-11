import { useState } from "react";
import {
  Settings2,
  Type,
  Terminal,
  Cpu,
  RefreshCw,
  Check,
  ExternalLink,
  FolderOpen,
  KeyRound,
  ShieldCheck,
  Laptop,
  Moon,
  Sun,
  ArrowUpRight,
} from "lucide-react";
import { Modal, Toggle, AgentMark, errorText } from "./Primitives";
import type { Settings as SettingsType, Connections } from "../types";

export function SettingsDialog({
  settings,
  connections,
  onSave,
  onClose,
  initialTab = "agent",
}: {
  settings: SettingsType;
  connections: Connections;
  onSave: (settings: SettingsType) => void;
  onClose: () => void;
  initialTab?: string;
}) {
  const [tab, setTab] = useState(initialTab);
  const [draft, setDraft] = useState(settings);
  const [key, setKey] = useState("");
  const [clearKey, setClearKey] = useState(false);
  const [found, setFound] = useState(connections);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = <K extends keyof SettingsType>(
    field: K,
    value: SettingsType[K],
  ) => setDraft((current) => ({ ...current, [field]: value }));
  async function save() {
    setBusy(true);
    setError("");
    try {
      onSave(
        await window.dopnur.saveSettings({
          ...draft,
          apiKey: key || undefined,
          clearApiKey: clearKey,
        }),
      );
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    setBusy(true);
    try {
      setFound(await window.dopnur.connections());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function select(field: "codexPath" | "claudePath" | "compilerPath") {
    try {
      const executable = await window.dopnur.selectExecutable();
      if (executable) update(field, executable);
    } catch (e) {
      setError(errorText(e));
    }
  }
  const row = (
    title: string,
    description: string,
    control: React.ReactNode,
  ) => (
    <div className="setting-row">
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      {control}
    </div>
  );
  return (
    <Modal
      title="Make yourself at home"
      subtitle="A workspace that works the way you do."
      onClose={onClose}
      wide
      className="settings-modal"
    >
      <div className="settings-layout">
        <nav className="settings-nav">
          {[
            { id: "general", label: "General", icon: Settings2 },
            { id: "editor", label: "Editor", icon: Type },
            { id: "agent", label: "Dopnur Agent", icon: Terminal },
            { id: "compiler", label: "LaTeX compiler", icon: Cpu },
          ].map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "selected" : ""}
              onClick={() => setTab(item.id)}
            >
              <item.icon size={17} />
              {item.label}
            </button>
          ))}
          <div className="settings-local">
            <ShieldCheck size={20} />
            <p>
              At home on your device.
              <br />
              No Dopnur account needed.
            </p>
          </div>
        </nav>
        <div className="settings-content">
          {tab === "general" && (
            <>
              <h3>Your kind of calm</h3>
              <p className="section-description">
                Choose the little things that make this space yours.
              </p>
              <label className="field-label">Appearance</label>
              <div className="theme-options">
                {["light", "dark"].map((theme) => (
                  <button
                    key={theme}
                    className={`theme-option ${draft.theme === theme ? "chosen" : ""}`}
                    onClick={() => update("theme", theme as "light" | "dark")}
                  >
                    <div className={`theme-swatch ${theme}`}>
                      <span />
                      <span />
                      <span />
                    </div>
                    <span>
                      {theme === "light" ? (
                        <Sun size={15} />
                      ) : (
                        <Moon size={15} />
                      )}{" "}
                      {theme === "light" ? "Morning light" : "After hours"}{" "}
                      {draft.theme === theme && <Check size={14} />}
                    </span>
                  </button>
                ))}
              </div>
              {row(
                "Word-count goal",
                "A gentle document-length target, with no pressure.",
                <input
                  aria-label="Word-count goal"
                  type="number"
                  min={100}
                  max={20000}
                  step={100}
                  value={draft.dailyGoal}
                  onChange={(e) => update("dailyGoal", Number(e.target.value))}
                  className="short-input"
                />,
              )}
              <div className="soft-note">
                <Laptop size={20} />
                <p>
                  Projects and revisions live in Dopnur’s application data
                  folder. Export a source ZIP whenever you want a portable
                  backup.
                </p>
              </div>
            </>
          )}
          {tab === "editor" && (
            <>
              <h3>Find your writing rhythm</h3>
              <p className="section-description">
                Just enough structure. Plenty of breathing room.
              </p>
              {row(
                "Editor font size",
                "JetBrains Mono, with a little room between lines.",
                <select
                  aria-label="Editor font size"
                  value={draft.fontSize}
                  onChange={(e) => update("fontSize", Number(e.target.value))}
                >
                  {[11, 12, 13, 14, 15, 16, 18, 20, 22].map((size) => (
                    <option key={size} value={size}>
                      {size} px
                    </option>
                  ))}
                </select>,
              )}
              {row(
                "Wrap long lines",
                "Keep your source inside the editor pane.",
                <Toggle
                  label="Wrap long lines"
                  checked={draft.wordWrap}
                  onChange={(value) => update("wordWrap", value)}
                />,
              )}
              {row(
                "Automatic compilation",
                "Recompile 2 seconds after you stop typing.",
                <Toggle
                  label="Automatic compilation"
                  checked={draft.autoCompile}
                  onChange={(value) => update("autoCompile", value)}
                />,
              )}
              <div className="shortcut-card">
                <span>
                  Compile document <kbd>⌘ / Ctrl ↵</kbd>
                </span>
                <span>
                  Find and replace <kbd>⌘ / Ctrl F</kbd>
                </span>
                <span>
                  Command palette <kbd>⌘ / Ctrl K</kbd>
                </span>
                <span>
                  Toggle agent <kbd>⌘ / Ctrl J</kbd>
                </span>
              </div>
            </>
          )}
          {tab === "agent" && (
            <>
              <div className="section-heading">
                <div className="agent-avatar small">
                  <AgentMark size={23} />
                </div>
                <div>
                  <h3>Your agent, your choice</h3>
                  <p className="section-description">
                    Bring the connection you already love.
                  </p>
                </div>
              </div>
              <div className="provider-options">
                {[
                  { id: "codex", name: "Codex CLI", desc: "Your CLI account" },
                  {
                    id: "claude",
                    name: "Claude CLI",
                    desc: "Your CLI account",
                  },
                  {
                    id: "api",
                    name: "API / local model",
                    desc: "Your own endpoint",
                  },
                ].map((provider) => (
                  <button
                    key={provider.id}
                    className={draft.provider === provider.id ? "chosen" : ""}
                    onClick={() =>
                      update(
                        "provider",
                        provider.id as SettingsType["provider"],
                      )
                    }
                  >
                    {provider.id === "api" ? (
                      <KeyRound size={20} />
                    ) : (
                      <Terminal size={20} />
                    )}
                    <strong>{provider.name}</strong>
                    <span>{provider.desc}</span>
                    {draft.provider === provider.id && (
                      <Check size={13} className="provider-check" />
                    )}
                  </button>
                ))}
              </div>
              {draft.provider !== "api" ? (
                <>
                  <div className="connection-status">
                    <span
                      className={`status-dot ${found.agents.find((a) => a.name === draft.provider)?.path ? "" : "amber"}`}
                    />
                    <div>
                      <strong>
                        {found.agents.find((a) => a.name === draft.provider)
                          ?.path
                          ? "CLI installation found"
                          : "CLI not found yet"}
                      </strong>
                      <p>
                        {found.agents.find((a) => a.name === draft.provider)
                          ?.path ||
                          "Install the CLI and sign in from your terminal."}
                      </p>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Refresh connections"
                      onClick={refresh}
                    >
                      <RefreshCw size={15} className={busy ? "spin" : ""} />
                    </button>
                  </div>
                  <label className="field-label">
                    Custom executable <span>optional</span>
                  </label>
                  <div className="input-with-button">
                    <input
                      value={
                        draft[
                          draft.provider === "codex"
                            ? "codexPath"
                            : "claudePath"
                        ]
                      }
                      onChange={(e) =>
                        update(
                          draft.provider === "codex"
                            ? "codexPath"
                            : "claudePath",
                          e.target.value,
                        )
                      }
                      placeholder="Automatically find on this device"
                    />
                    <button
                      className="icon-button"
                      title="Choose executable"
                      aria-label="Choose executable"
                      onClick={() =>
                        select(
                          draft.provider === "codex"
                            ? "codexPath"
                            : "claudePath",
                        )
                      }
                    >
                      <FolderOpen size={17} />
                    </button>
                  </div>
                  <div className="soft-note">
                    <Terminal size={20} />
                    <div>
                      <strong>Use your existing sign-in</strong>
                      <p>
                        Dopnur runs the installed CLI in a background process
                        and shows its progress in the run console. Sign in first
                        using{" "}
                        <code>
                          {draft.provider}{" "}
                          {draft.provider === "codex" ? "login" : "auth login"}
                        </code>
                        . Your account’s access and usage limits apply. No API
                        key is passed by Dopnur in this mode.
                      </p>
                    </div>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => window.dopnur.openHelp(draft.provider)}
                  >
                    Install or sign in to{" "}
                    {draft.provider === "codex" ? "Codex" : "Claude"}{" "}
                    <ExternalLink size={13} />
                  </button>
                </>
              ) : (
                <div className="api-fields">
                  <label className="field-label">API format</label>
                  <select
                    value={draft.apiFormat}
                    onChange={(e) =>
                      update(
                        "apiFormat",
                        e.target.value as "responses" | "chat",
                      )
                    }
                  >
                    <option value="responses">OpenAI Responses</option>
                    <option value="chat">
                      OpenAI-compatible Chat Completions
                    </option>
                  </select>
                  <label className="field-label">Base URL</label>
                  <input
                    value={draft.apiBase}
                    onChange={(e) => update("apiBase", e.target.value)}
                    placeholder="https://api.openai.com/v1"
                  />
                  <label className="field-label">Model name</label>
                  <input
                    value={draft.model}
                    onChange={(e) => update("model", e.target.value)}
                    placeholder="Enter a model supported by your provider"
                  />
                  <label className="field-label">
                    API key{" "}
                    <span>
                      {settings.hasApiKey && !clearKey
                        ? "saved securely"
                        : "optional for local models"}
                    </span>
                  </label>
                  <input
                    type="password"
                    autoComplete="off"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder={
                      settings.hasApiKey
                        ? "Leave empty to keep your saved key"
                        : "Your provider API key"
                    }
                  />
                  {settings.hasApiKey && (
                    <button
                      className="text-button"
                      onClick={() => setClearKey(!clearKey)}
                    >
                      {clearKey ? "Keep saved key" : "Remove saved key"}
                    </button>
                  )}
                  <p className="field-help">
                    Keys are encrypted by your operating system. For a local
                    model, use a localhost endpoint with Chat Completions.
                    Remote API requests use your provider’s billing.
                  </p>
                </div>
              )}
              <div className="privacy-line">
                <ShieldCheck size={15} />
                <span>
                  Sending a request shares your project’s text with the selected
                  provider. Edits always wait for your review.
                </span>
              </div>
            </>
          )}
          {tab === "compiler" && (
            <>
              <h3>From source to something lovely</h3>
              <p className="section-description">
                Compile on your computer, with your own LaTeX engine.
              </p>
              <label className="field-label">Preferred compiler</label>
              <select
                value={draft.engine}
                onChange={(e) =>
                  update("engine", e.target.value as SettingsType["engine"])
                }
              >
                <option value="auto">
                  Automatic · prefer bundled Tectonic
                </option>
                <option value="tectonic">Tectonic</option>
                <option value="latexmk">latexmk / TeX Live</option>
                <option value="pdflatex">pdfLaTeX</option>
              </select>
              <div className="compiler-list">
                {found.compilers.map((engine) => (
                  <div key={engine.name}>
                    <Cpu size={17} />
                    <strong>{engine.name}</strong>
                    <span className={engine.path ? "found" : ""}>
                      {engine.path ? "Available" : "Not installed"}
                    </span>
                  </div>
                ))}
              </div>
              <label className="field-label">
                Custom Tectonic executable <span>optional</span>
              </label>
              <div className="input-with-button">
                <input
                  value={draft.compilerPath}
                  onChange={(e) => update("compilerPath", e.target.value)}
                  placeholder="Use bundled or installed Tectonic"
                />
                <button
                  className="icon-button"
                  aria-label="Choose Tectonic executable"
                  onClick={() => select("compilerPath")}
                >
                  <FolderOpen size={17} />
                </button>
              </div>
              <div className="soft-note">
                <Cpu size={21} />
                <p>
                  Tectonic downloads missing packages on the first compile.
                  After caching, those packages work offline. Shell escape is
                  disabled. For BibTeX automation, use Tectonic or latexmk.
                </p>
              </div>
              <button
                className="text-button"
                onClick={() => window.dopnur.openHelp("tectonic")}
              >
                About Tectonic <ArrowUpRight size={14} />
              </button>
            </>
          )}
        </div>
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <footer className="modal-footer">
        <span className="subtle">Made for a little more focus.</span>
        <button className="button" onClick={onClose}>
          Cancel
        </button>
        <button className="button primary" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save preferences"}
        </button>
      </footer>
    </Modal>
  );
}
