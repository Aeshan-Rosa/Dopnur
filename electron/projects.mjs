import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  readdir,
  stat,
  lstat,
} from "node:fs/promises";
import { zipSync, unzipSync } from "fflate";
import { templates } from "../shared/templates.mjs";

export const MAX_BYTES = 64 * 1024 * 1024;
export function safeName(name) {
  if (
    typeof name !== "string" ||
    !name ||
    name.length > 220 ||
    name.includes("\\") ||
    /[\x00-\x1f<>:"|?*]/.test(name) ||
    name.startsWith("/")
  )
    throw new Error("Use a relative file name without special characters.");
  if (
    name
      .split("/")
      .some(
        (part) =>
          !part ||
          part === "." ||
          part === ".." ||
          part.startsWith(".") ||
          /[. ]$/.test(part) ||
          /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
      )
  )
    throw new Error("That file path is not supported.");
  return name;
}
export function validateProject(input) {
  if (!input || !/^[a-zA-Z0-9-]{1,80}$/.test(input.id))
    throw new Error("Invalid project identifier.");
  if (
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.length > 160
  )
    throw new Error("Give your project a name of 1–160 characters.");
  if (
    !Array.isArray(input.files) ||
    !input.files.length ||
    input.files.length > 400
  )
    throw new Error("Projects need between 1 and 400 files.");
  let bytes = 0;
  const names = new Set();
  const ids = new Set();
  const files = input.files.map((file) => {
    safeName(file.name);
    if (
      typeof file.id !== "string" ||
      ids.has(file.id) ||
      names.has(file.name.toLowerCase())
    )
      throw new Error("File names and identifiers must be unique.");
    names.add(file.name.toLowerCase());
    ids.add(file.id);
    if (
      typeof file.content !== "string" ||
      file.content.length > 24 * 1024 * 1024
    )
      throw new Error("A file is too large (maximum 24 MB encoded).");
    if (file.encoding && file.encoding !== "base64")
      throw new Error("Unsupported file encoding.");
    bytes += Buffer.byteLength(file.content);
    if (bytes > MAX_BYTES)
      throw new Error("This project exceeds the 64 MB limit.");
    return {
      id: file.id,
      name: file.name,
      content: file.content,
      ...(file.encoding ? { encoding: "base64" } : {}),
    };
  });
  if (
    !files.some(
      (file) =>
        file.name === input.mainFile &&
        file.name.endsWith(".tex") &&
        !file.encoding,
    )
  )
    throw new Error("Choose an existing .tex file as the main document.");
  return {
    id: input.id,
    name: input.name.trim(),
    mainFile: input.mainFile,
    files,
    color: ["sage", "peach", "cream", "rose"].includes(input.color)
      ? input.color
      : "sage",
    createdAt: Number(input.createdAt) || Date.now(),
    updatedAt: Date.now(),
    starred: !!input.starred,
    template: String(input.template || "blank").slice(0, 40),
  };
}
export async function atomicJSON(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
  await rename(temporary, file);
}
export async function materialize(project, directory) {
  const valid = validateProject(project);
  for (const file of valid.files) {
    const destination = path.join(directory, file.name);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(
      destination,
      file.encoding ? Buffer.from(file.content, "base64") : file.content,
      { mode: 0o600 },
    );
  }
}
export function exportZip(project) {
  const valid = validateProject(project);
  return zipSync(
    Object.fromEntries(
      valid.files.map((file) => [
        file.name,
        file.encoding
          ? Buffer.from(file.content, "base64")
          : Buffer.from(file.content),
      ]),
    ),
  );
}
const textExtensions = new Set([
  ".tex",
  ".bib",
  ".sty",
  ".cls",
  ".bst",
  ".md",
  ".txt",
  ".csv",
  ".tsv",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".bbl",
]);
const assetExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".pdf",
  ".eps",
  ".svg",
  ".webp",
]);
export function fileFromBytes(name, bytes) {
  safeName(name);
  const isText = textExtensions.has(path.extname(name).toLowerCase());
  if (!isText && !assetExtensions.has(path.extname(name).toLowerCase()))
    return null;
  return {
    id: randomUUID(),
    name,
    content: Buffer.from(bytes).toString(isText ? "utf8" : "base64"),
    ...(!isText ? { encoding: "base64" } : {}),
  };
}
export function importZip(bytes) {
  if (bytes.length > MAX_BYTES) throw new Error("ZIP file exceeds 64 MB.");
  let total = 0;
  const entries = unzipSync(bytes, {
    filter: (info) => {
      if (
        info.name.endsWith("/") ||
        info.name.startsWith("__MACOSX/") ||
        info.name.split("/").some((p) => p.startsWith("."))
      )
        return false;
      safeName(info.name);
      if (
        info.originalSize > 24 * 1024 * 1024 ||
        (total += info.originalSize) > MAX_BYTES
      )
        throw new Error("Expanded ZIP exceeds project limits.");
      return true;
    },
  });
  let files = Object.entries(entries)
    .map(([name, data]) => fileFromBytes(name, data))
    .filter(Boolean);
  // Overleaf and other exporters sometimes wrap all files in one directory.
  while (
    files.length &&
    files.every(
      (file) =>
        file.name.includes("/") &&
        file.name.split("/")[0] === files[0].name.split("/")[0],
    )
  )
    files = files.map((file) => ({
      ...file,
      name: file.name.slice(file.name.indexOf("/") + 1),
    }));
  if (!files.some((file) => file.name.endsWith(".tex")))
    throw new Error("No LaTeX document found in this ZIP.");
  return files;
}
export async function readDirectory(directory) {
  const files = [];
  let total = 0;
  async function walk(current, prefix = "") {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (
        entry.name.startsWith(".") ||
        ["node_modules", "build", "dist"].includes(entry.name) ||
        entry.isSymbolicLink()
      )
        continue;
      const relative = prefix + entry.name;
      if (entry.isDirectory()) {
        await walk(path.join(current, entry.name), relative + "/");
        continue;
      }
      if (
        !textExtensions.has(path.extname(entry.name).toLowerCase()) &&
        !assetExtensions.has(path.extname(entry.name).toLowerCase())
      )
        continue;
      const source = path.join(current, entry.name);
      const info = await lstat(source);
      if (info.isSymbolicLink()) continue;
      if (
        (total += info.size) > MAX_BYTES ||
        files.length >= 400 ||
        info.size > 18 * 1024 * 1024
      )
        throw new Error("Folder exceeds the project import limits.");
      const file = fileFromBytes(relative, await readFile(source));
      if (file) files.push(file);
    }
  }
  await walk(directory);
  return files;
}
export class ProjectStore {
  constructor(root, assets) {
    this.root = root;
    this.assets = assets;
    this.queue = Promise.resolve();
  }
  projectPath(id) {
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(id))
      throw new Error("Invalid project identifier.");
    return path.join(this.root, "projects", id + ".json");
  }
  async init() {
    await mkdir(path.join(this.root, "projects"), { recursive: true });
    if (
      !(await readdir(path.join(this.root, "projects"))).some((name) =>
        name.endsWith(".json"),
      )
    )
      await this.create("article", "The quiet architecture of focus");
  }
  async list() {
    const entries = await readdir(path.join(this.root, "projects"));
    const projects = [];
    for (const entry of entries.filter((name) => name.endsWith(".json"))) {
      try {
        projects.push(
          JSON.parse(
            await readFile(path.join(this.root, "projects", entry), "utf8"),
          ),
        );
      } catch {
        /* A broken project must not hide the rest of the library. */
      }
    }
    return projects
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(({ files, ...project }) => ({
        ...project,
        fileCount: files.length,
      }));
  }
  async get(id) {
    return JSON.parse(await readFile(this.projectPath(id), "utf8"));
  }
  save(project) {
    const valid = validateProject(project);
    const work = this.queue
      .catch(() => {})
      .then(() => atomicJSON(this.projectPath(valid.id), valid));
    this.queue = work;
    return work.then(() => valid);
  }
  async create(templateId, name, files) {
    const template = templates.find((t) => t.id === templateId) || templates[1];
    const project = {
      id: randomUUID(),
      name: name || template.name,
      mainFile: "main.tex",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      template: template.id,
      color: template.color,
      starred: false,
      files:
        files || template.files.map((file) => ({ ...file, id: randomUUID() })),
    };
    if (!files && template.id === "article")
      project.files.push({
        id: randomUUID(),
        name: "figures/focus-study.png",
        encoding: "base64",
        content: (
          await readFile(path.join(this.assets, "focus-study.png"))
        ).toString("base64"),
      });
    project.mainFile =
      project.files.find((f) => f.name === "main.tex")?.name ||
      project.files.find((f) => f.name.endsWith(".tex"))?.name;
    await this.save(project);
    await this.snapshot(project, "A fresh start");
    return project;
  }
  async snapshots(id) {
    this.projectPath(id);
    try {
      return JSON.parse(
        await readFile(path.join(this.root, "history", id + ".json"), "utf8"),
      );
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }
  async snapshot(project, label) {
    const valid = validateProject(project);
    const work = this.queue
      .catch(() => {})
      .then(async () => {
        const history = await this.snapshots(valid.id);
        const item = {
          id: randomUUID(),
          label: String(label || "Saved revision").slice(0, 100),
          createdAt: Date.now(),
          project: valid,
        };
        await atomicJSON(
          path.join(this.root, "history", valid.id + ".json"),
          [item, ...history].slice(0, 30),
        );
        return item;
      });
    this.queue = work;
    return work;
  }
  async archive(id) {
    await this.queue.catch(() => {});
    const from = this.projectPath(id);
    await stat(from);
    await mkdir(path.join(this.root, "archive"), { recursive: true });
    await rename(
      from,
      path.join(this.root, "archive", `${id}-${Date.now()}.json`),
    );
  }
}
