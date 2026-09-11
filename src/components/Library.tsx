import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  FolderOpen,
  Plus,
  Search,
  Star,
  Upload,
  MoreHorizontal,
  Clock3,
  Sprout,
} from "lucide-react";
import { useState } from "react";
import { IconButton, timeAgo } from "./Primitives";
import type { ProjectSummary, Template } from "../types";
export function Library({
  projects,
  templates,
  onOpen,
  onNew,
  onImport,
  onStar,
  onArchive,
}: {
  projects: ProjectSummary[];
  templates: Template[];
  onOpen: (id: string) => void;
  onNew: (template?: string) => void;
  onImport: () => void;
  onStar: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [menu, setMenu] = useState<string | null>(null);
  const filtered = projects.filter(
    (project) =>
      project.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter !== "starred" || project.starred),
  );
  return (
    <main className="library">
      <div className="library-content">
        <div className="library-greeting">
          <div>
            <div className="eyebrow">
              <span className="small-line" /> YOUR OWN LITTLE CORNER
            </div>
            <h1>
              Good things start
              <br />
              with a little <em>space.</em>
            </h1>
            <p>
              A home for your ideas, from the first thought to the final page.
            </p>
          </div>
          <div className="library-illustration" aria-hidden="true">
            <div className="floating-note note-back">
              <div />
              <div />
              <div />
            </div>
            <div className="floating-note note-front">
              <span>
                the next
                <br />
                <em>big idea.</em>
              </span>
              <div />
              <div />
              <div />
              <Sprout size={34} />
            </div>
            <span className="illustration-star">✳</span>
            <span className="illustration-dot" />
          </div>
        </div>
        <div className="library-section-header">
          <h2>
            Your projects <span>{projects.length}</span>
          </h2>
          <div className="spacer" />
          <button className="button" onClick={onImport}>
            <Upload size={15} />
            Import project
          </button>
          <button className="button primary" onClick={() => onNew()}>
            <Plus size={16} />
            New project
          </button>
        </div>
        <div className="library-filters">
          <div className="text-tabs">
            <button
              className={filter === "all" ? "selected" : ""}
              onClick={() => setFilter("all")}
            >
              <FolderOpen size={15} />
              All projects
            </button>
            <button
              className={filter === "starred" ? "selected" : ""}
              onClick={() => setFilter("starred")}
            >
              <Star size={14} />
              Starred
            </button>
          </div>
          <div className="search-input">
            <Search size={15} />
            <input
              aria-label="Search projects"
              placeholder="Find a little something…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="project-grid">
          {filtered.map((project) => (
            <article className="project-card" key={project.id}>
              <button
                className={`project-thumbnail ${project.color}`}
                onClick={() => onOpen(project.id)}
              >
                <div className="mini-paper">
                  <span className="mini-paper-kicker">DOPNUR DOCUMENT</span>
                  <h3>{project.name}</h3>
                  <span className="mini-author">A work in progress</span>
                  <div className="mini-lines">
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                  <strong>1 &nbsp; Introduction</strong>
                  <div className="mini-lines">
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
                <span className="open-project">
                  Open project <ArrowUpRight size={15} />
                </span>
              </button>
              <div className="project-card-info">
                <div>
                  <button
                    className="project-name"
                    onClick={() => onOpen(project.id)}
                  >
                    {project.name}
                  </button>
                  <span>
                    <Clock3 size={12} />
                    {timeAgo(project.updatedAt)}
                    <b>·</b>
                    {project.fileCount} files
                  </span>
                </div>
                <IconButton
                  label={project.starred ? "Unstar project" : "Star project"}
                  active={project.starred}
                  onClick={() => onStar(project.id)}
                >
                  <Star
                    size={16}
                    fill={project.starred ? "currentColor" : "none"}
                  />
                </IconButton>
                <div className="menu-anchor">
                  <IconButton
                    label={`More options for ${project.name}`}
                    onClick={() =>
                      setMenu(menu === project.id ? null : project.id)
                    }
                  >
                    <MoreHorizontal size={16} />
                  </IconButton>
                  {menu === project.id && (
                    <div className="dropdown">
                      <button
                        onClick={() => {
                          onArchive(project.id);
                          setMenu(null);
                        }}
                      >
                        Archive project
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
          <button className="new-project-card" onClick={() => onNew("blank")}>
            <span>
              <Plus size={24} strokeWidth={1.4} />
            </span>
            <strong>Make room for an idea</strong>
            <p>Start something new.</p>
          </button>
        </div>
        <div className="template-section">
          <div className="library-section-header">
            <div>
              <div className="eyebrow">SKIP THE BLANK PAGE</div>
              <h2>A little head start.</h2>
            </div>
            <span className="subtle">
              Thoughtfully put together. Ready to make your own.
            </span>
          </div>
          <div className="template-grid">
            {templates.map((template) => (
              <button
                key={template.id}
                className="template-card"
                onClick={() => onNew(template.id)}
              >
                <div className={`template-icon ${template.color}`}>
                  <FileText size={23} strokeWidth={1.3} />
                </div>
                <span className="eyebrow">{template.label}</span>
                <strong>{template.name}</strong>
                <p>{template.description}</p>
                <ArrowRight size={17} />
              </button>
            ))}
          </div>
        </div>
        <div className="library-bottom">
          <Sprout size={18} />
          <span>Local by nature. Yours by design.</span>
          <span>No subscriptions. No Dopnur account. Just your work.</span>
        </div>
      </div>
    </main>
  );
}
