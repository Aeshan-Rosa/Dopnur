import { useState, useRef, useEffect } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  FileCode2,
  Loader2,
  MessageSquare,
  Plus,
  Settings2,
  Square,
  Terminal,
  Wand2,
  X,
  SquareFunction,
  ShieldCheck,
} from "lucide-react";
import { diffLines } from "diff";
import { AgentMark, IconButton, Modal } from "./Primitives";
import type { ChatMessage, Proposal, Settings } from "../types";

export function AgentPanel({
  settings,
  messages,
  proposal,
  running,
  output,
  onSend,
  onCancel,
  onClose,
  onSettings,
  onReview,
  onReset,
  activeFile,
  selection,
}: {
  settings: Settings;
  messages: ChatMessage[];
  proposal: Proposal | null;
  running: boolean;
  output: string;
  onSend: (prompt: string) => void;
  onCancel: () => void;
  onClose: () => void;
  onSettings: () => void;
  onReview: () => void;
  onReset: () => void;
  activeFile: string;
  selection: string;
}) {
  const [prompt, setPrompt] = useState("");
  const [consoleOpen, setConsoleOpen] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, proposal, running]);
  const send = () => {
    if (prompt.trim() && !running) {
      onSend(prompt.trim());
      setPrompt("");
    }
  };
  return (
    <aside className="agent-panel">
      <header className="panel-header">
        <AgentMark size={20} />
        <strong>Dopnur Agent</strong>
        <span className="beta-label">BETA</span>
        <div className="spacer" />
        <IconButton
          label="New agent conversation"
          onClick={onReset}
          disabled={running}
        >
          <Plus size={16} />
        </IconButton>
        <IconButton label="Close agent" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </header>
      <div
        className="agent-connection"
        onClick={onSettings}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSettings();
        }}
      >
        <span className="status-dot" />
        <span>
          {settings.provider === "codex"
            ? "Codex CLI"
            : settings.provider === "claude"
              ? "Claude CLI"
              : settings.model || "API connection"}
        </span>
        <span className="connection-tag">
          {settings.provider === "api" ? "YOUR ENDPOINT" : "YOUR ACCOUNT"}
        </span>
        <ChevronDown size={13} />
      </div>
      <div className="agent-conversation">
        {!messages.length ? (
          <div className="agent-welcome">
            <div className="agent-avatar">
              <AgentMark size={36} />
            </div>
            <div className="eyebrow">A LITTLE HELP, A LOT OF POSSIBILITY</div>
            <h2>
              A second pair
              <br />
              of thoughtful eyes.
            </h2>
            <p>
              Untangle an equation, find the right words, or give your paper a
              little polish.
            </p>
            <div className="agent-suggestions">
              {[
                {
                  icon: Wand2,
                  title: "Polish my writing",
                  text:
                    "Improve the clarity of " +
                    (selection ? "the selected passage" : "the abstract") +
                    ", preserving my voice and all factual claims.",
                },
                {
                  icon: SquareFunction,
                  title: "Make sense of an equation",
                  text: "Explain the equations in this document, with a clear, intuitive description. Do not edit any files.",
                },
                {
                  icon: BookOpen,
                  title: "Check my references",
                  text: "Check my citation keys against the bibliography and identify missing entries. Do not invent references.",
                },
              ].map((item) => (
                <button key={item.title} onClick={() => setPrompt(item.text)}>
                  <item.icon size={17} />
                  <span>{item.title}</span>
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
            <div className="agent-reassurance">
              <ShieldCheck size={14} /> Your words. Your final say.
            </div>
          </div>
        ) : (
          <div className="chat-messages">
            {messages.map((message, i) => (
              <div className={`chat-message ${message.role}`} key={i}>
                {message.role === "assistant" && (
                  <span className="chat-author">
                    <AgentMark size={15} /> Dopnur
                  </span>
                )}
                <p>{message.text}</p>
              </div>
            ))}
            {proposal && proposal.edits.length > 0 && (
              <button className="proposal-card" onClick={onReview}>
                <div className="proposal-icon">
                  <FileCode2 size={20} />
                </div>
                <div>
                  <strong>
                    {proposal.edits.length}{" "}
                    {proposal.edits.length === 1 ? "file" : "files"} ready for
                    review
                  </strong>
                  <span>Nothing changes until you say so.</span>
                </div>
                <ArrowUpRight size={16} />
                <span className="proposal-review">
                  Review changes <ArrowUpRight size={14} />
                </span>
              </button>
            )}
            {running && (
              <div className="agent-thinking">
                <Loader2 size={15} className="spin" /> Giving it a little
                thought…
              </div>
            )}
            <div ref={end} />
          </div>
        )}
      </div>
      {consoleOpen && (
        <div className="agent-console">
          <header>
            <Terminal size={13} /> Run console
            <button
              className="icon-button"
              aria-label="Close run console"
              onClick={() => setConsoleOpen(false)}
            >
              <X size={13} />
            </button>
          </header>
          <pre>{output || "Your agent’s process output will appear here."}</pre>
        </div>
      )}
      <div className="agent-composer">
        <div className="context-chip">
          <FileCode2 size={12} />
          {activeFile}
          {selection && <span>+ selection</span>}
        </div>
        <textarea
          aria-label="Ask Dopnur Agent"
          placeholder="A question, an idea, a little help…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="composer-tools">
          <IconButton label="Agent connection settings" onClick={onSettings}>
            <Settings2 size={15} />
          </IconButton>
          <IconButton
            label="Show run console"
            active={consoleOpen}
            onClick={() => setConsoleOpen(!consoleOpen)}
          >
            <Terminal size={15} />
          </IconButton>
          <span>↵ to send</span>
          {running ? (
            <button
              className="send-button"
              aria-label="Stop agent"
              onClick={onCancel}
            >
              <Square size={13} fill="currentColor" />
            </button>
          ) : (
            <button
              className="send-button"
              aria-label="Send to Dopnur Agent"
              disabled={!prompt.trim()}
              onClick={send}
            >
              <ArrowUp size={18} />
            </button>
          )}
        </div>
      </div>
      <div className="agent-footer">
        {settings.provider === "api"
          ? "Uses your chosen API or local model."
          : "Uses your existing CLI login and account limits."}
      </div>
    </aside>
  );
}
export function ReviewDialog({
  proposal,
  onApply,
  onClose,
  busy,
}: {
  proposal: Proposal;
  onApply: (paths: string[]) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const [selected, setSelected] = useState(
    proposal.edits.map((edit) => edit.path),
  );
  const [active, setActive] = useState(proposal.edits[0]?.path);
  const edit = proposal.edits.find((item) => item.path === active);
  return (
    <Modal
      title="A little polish. Your final say."
      subtitle="Review the proposed changes before they enter your document."
      onClose={onClose}
      wide
      className="review-modal"
    >
      <div className="review-layout">
        <nav>
          {proposal.edits.map((item) => (
            <div
              key={item.path}
              className={item.path === active ? "selected" : ""}
            >
              <input
                type="checkbox"
                aria-label={`Apply changes to ${item.path}`}
                checked={selected.includes(item.path)}
                onChange={() =>
                  setSelected((current) =>
                    current.includes(item.path)
                      ? current.filter((path) => path !== item.path)
                      : [...current, item.path],
                  )
                }
              />
              <button onClick={() => setActive(item.path)}>
                <FileCode2 size={16} />
                {item.path}
              </button>
            </div>
          ))}
        </nav>
        <div className="review-content">
          {edit && (
            <>
              <div className="diff-description">
                <MessageSquare size={15} />
                {edit.explanation}
              </div>
              <div className="diff-code">
                {diffLines(edit.original || "", edit.content).map((part, i) => (
                  <pre
                    className={
                      part.added ? "added" : part.removed ? "removed" : ""
                    }
                    key={i}
                  >
                    {part.value.split("\n").map((line, j) => (
                      <span key={j}>
                        <b>{part.added ? "+" : part.removed ? "−" : " "}</b>
                        {line}
                        {"\n"}
                      </span>
                    ))}
                  </pre>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <footer className="modal-footer">
        <span className="subtle">
          <ShieldCheck size={14} /> A revision is saved before applying.
        </span>
        <button className="button" onClick={onClose}>
          Keep reviewing later
        </button>
        <button
          className="button primary"
          disabled={!selected.length || busy}
          onClick={() => onApply(selected)}
        >
          <Check size={15} />
          {busy
            ? "Applying…"
            : `Apply ${selected.length} ${selected.length === 1 ? "change" : "changes"}`}
        </button>
      </footer>
    </Modal>
  );
}
