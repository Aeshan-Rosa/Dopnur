import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Menu,
  shell,
  safeStorage,
  protocol,
  net,
  session,
} from "electron";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFile, writeFile, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  ProjectStore,
  importZip,
  exportZip,
  readDirectory,
  fileFromBytes,
  validateProject,
  MAX_BYTES,
} from "./projects.mjs";
import { SettingsStore } from "./settings.mjs";
import { templates } from "../shared/templates.mjs";
import {
  findCompilers,
  compileProject,
  sourceFingerprint,
} from "./compiler.mjs";
import { locate } from "./processes.mjs";
import { runAgent, validateEdits } from "./agent.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (process.env.DOPNUR_USER_DATA)
  app.setPath("userData", process.env.DOPNUR_USER_DATA);
protocol.registerSchemesAsPrivileged([
  {
    scheme: "dopnur",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
let window,
  store,
  settings,
  compileController,
  agentController,
  allowClose = false,
  quitting = false;
const proposals = new Map();
const dataRoot = () => app.getPath("userData");
const binDirectory = () =>
  app.isPackaged
    ? path.join(process.resourcesPath, "bin")
    : path.join(root, "resources", "bin");
const emit = (type, data) => {
  if (window && !window.isDestroyed())
    window.webContents.send("dopnur:event", { type, ...data });
};
const handle = (channel, fn) =>
  ipcMain.handle("dopnur:" + channel, (event, ...args) => {
    const url = event.senderFrame?.url || "";
    const trusted = app.isPackaged
      ? url.startsWith("dopnur://app/")
      : url.startsWith("dopnur://app/") ||
        (process.env.DOPNUR_DEV_URL &&
          new URL(url).origin === process.env.DOPNUR_DEV_URL);
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      !trusted
    )
      throw new Error("Untrusted application request.");
    return fn(...args);
  });
async function connections() {
  const found = await Promise.all(
    ["codex", "claude"].map(async (name) => ({
      name,
      path: await locate(name, settings.data[name + "Path"] || undefined),
    })),
  );
  return {
    agents: found,
    compilers: await findCompilers(binDirectory(), settings.data.compilerPath),
  };
}
function registerHandlers() {
  handle("bootstrap", async () => ({
    projects: await store.list(),
    templates: templates.map(({ files, ...t }) => t),
    settings: settings.public(),
    platform: process.platform,
    version: app.getVersion(),
    connections: await connections(),
  }));
  handle("project:get", (id) => store.get(id));
  handle("project:save", (project) => store.save(project));
  handle("project:create", ({ template, name }) =>
    store.create(template, name),
  );
  handle("project:archive", (id) => store.archive(id));
  handle("project:import", async (type) => {
    if (!["zip", "folder"].includes(type))
      throw new Error("Choose a folder or ZIP file.");
    const result = await dialog.showOpenDialog(
      window,
      type === "zip"
        ? {
            title: "Import a LaTeX project",
            properties: ["openFile"],
            filters: [{ name: "LaTeX source archive", extensions: ["zip"] }],
          }
        : { title: "Import a project folder", properties: ["openDirectory"] },
    );
    if (result.canceled) return null;
    const selected = result.filePaths[0];
    if (type === "zip" && (await stat(selected)).size > MAX_BYTES)
      throw new Error("ZIP file exceeds 64 MB.");
    const files =
      type === "zip"
        ? importZip(await readFile(selected))
        : await readDirectory(selected);
    return store.create(
      "blank",
      path.basename(selected).replace(/\.zip$/i, ""),
      files,
    );
  });
  handle("project:export", async (project) => {
    const valid = validateProject(project);
    const result = await dialog.showSaveDialog(window, {
      title: "Export LaTeX source",
      defaultPath: valid.name.replace(/[^\w .-]/g, "") + ".zip",
      filters: [{ name: "ZIP archive", extensions: ["zip"] }],
    });
    if (result.canceled) return false;
    await writeFile(result.filePath, exportZip(valid));
    return true;
  });
  handle("files:import", async () => {
    const result = await dialog.showOpenDialog(window, {
      title: "Add files to your project",
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "LaTeX and assets",
          extensions: [
            "tex",
            "bib",
            "sty",
            "cls",
            "bst",
            "bbl",
            "txt",
            "md",
            "csv",
            "png",
            "jpg",
            "jpeg",
            "pdf",
            "eps",
            "svg",
            "webp",
          ],
        },
      ],
    });
    if (result.canceled) return [];
    const files = [];
    for (const selected of result.filePaths) {
      if ((await stat(selected)).size > 18 * 1024 * 1024)
        throw new Error("Files must be smaller than 18 MB.");
      const file = fileFromBytes(
        path.basename(selected),
        await readFile(selected),
      );
      if (file) files.push(file);
    }
    return files;
  });
  handle("snapshots:list", (id) => store.snapshots(id));
  handle("snapshots:create", ({ project, label }) =>
    store.snapshot(project, label),
  );
  handle("snapshots:restore", async ({ project, snapshotId }) => {
    const history = await store.snapshots(project.id);
    const snapshot = history.find((s) => s.id === snapshotId);
    if (!snapshot) throw new Error("Revision not found.");
    await store.snapshot(project, "Before restoring a revision");
    return store.save({ ...snapshot.project, updatedAt: Date.now() });
  });
  handle("compile", async (project) => {
    if (compileController) throw new Error("A compilation is already running.");
    compileController = new AbortController();
    try {
      return await compileProject(project, {
        binDirectory: binDirectory(),
        cacheDirectory: path.join(dataRoot(), "pdf"),
        engine: settings.data.engine,
        compilerPath: settings.data.compilerPath,
        signal: compileController.signal,
        onOutput: (text) =>
          emit("compile-output", { text, projectId: project.id }),
      });
    } finally {
      compileController = null;
    }
  });
  handle("compile:cancel", () => compileController?.abort());
  handle("pdf:get", async (id) => {
    const project = await store.get(id);
    try {
      const pdf = (
        await readFile(path.join(dataRoot(), "pdf", id + ".pdf"))
      ).toString("base64");
      let source;
      try {
        source = JSON.parse(
          await readFile(path.join(dataRoot(), "pdf", id + ".json"), "utf8"),
        ).source;
      } catch {}
      return {
        pdf,
        sample: false,
        stale: source !== sourceFingerprint(project),
      };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      if (project.template === "article")
        try {
          return {
            pdf: (
              await readFile(path.join(root, "shared", "assets", "sample.pdf"))
            ).toString("base64"),
            sample: true,
            stale: false,
          };
        } catch {}
      return null;
    }
  });
  handle("pdf:export", async (id) => {
    const project = await store.get(id);
    let data;
    try {
      data = await readFile(path.join(dataRoot(), "pdf", id + ".pdf"));
    } catch {
      throw new Error("Compile your project before exporting its PDF.");
    }
    const result = await dialog.showSaveDialog(window, {
      title: "Export PDF",
      defaultPath: project.name.replace(/[^\w .-]/g, "") + ".pdf",
      filters: [{ name: "PDF document", extensions: ["pdf"] }],
    });
    if (result.canceled) return false;
    await writeFile(result.filePath, data);
    return true;
  });
  handle("settings:get", () => settings.public());
  handle("settings:save", (input) => settings.save(input));
  handle("connections", connections);
  handle("executable:select", async () => {
    const result = await dialog.showOpenDialog(window, {
      title: "Choose the installed executable",
      properties: ["openFile", "showHiddenFiles"],
    });
    return result.canceled ? null : result.filePaths[0];
  });
  handle("agent:run", async (request) => {
    if (agentController) throw new Error("An agent run is already active.");
    agentController = new AbortController();
    try {
      const proposal = await runAgent(request, settings.data, {
        apiKey: settings.data.provider === "api" ? settings.key() : undefined,
        signal: agentController.signal,
        onOutput: (text) =>
          emit("agent-output", { text, projectId: request.project.id }),
      });
      const item = {
        ...proposal,
        id: randomUUID(),
        projectId: request.project.id,
      };
      proposals.clear();
      proposals.set(item.id, item);
      return item;
    } finally {
      agentController = null;
    }
  });
  handle("agent:cancel", () => agentController?.abort());
  handle("agent:apply", async ({ project, proposalId, paths }) => {
    const proposal = proposals.get(proposalId);
    if (!proposal || proposal.projectId !== project.id || !Array.isArray(paths))
      throw new Error("This proposal is no longer available.");
    const valid = validateProject(project);
    const edits = validateEdits(
      valid,
      proposal.edits.filter((edit) => paths.includes(edit.path)),
    );
    if (!edits.length) throw new Error("Select at least one change.");
    const files = [...valid.files];
    for (const edit of edits) {
      const index = files.findIndex((file) => file.name === edit.path);
      if (index < 0)
        files.push({
          id: randomUUID(),
          name: edit.path,
          content: edit.content,
        });
      else files[index] = { ...files[index], content: edit.content };
    }
    const next = validateProject({ ...valid, files });
    await store.snapshot(valid, "Before Dopnur Agent edits");
    const result = await store.save(next);
    proposals.delete(proposalId);
    return result;
  });
  handle("window", (action) => {
    if (action === "minimize") window.minimize();
    else if (action === "maximize")
      window.isMaximized() ? window.unmaximize() : window.maximize();
    else if (action === "close") window.close();
    else if (action === "close-confirmed") {
      allowClose = true;
      window.close();
      if (quitting) app.quit();
    }
  });
  handle("help", (topic) => {
    const urls = {
      latex: "https://www.learnlatex.org/",
      tectonic: "https://tectonic-typesetting.github.io/en-US/install.html",
      codex: "https://developers.openai.com/codex/cli/",
      claude: "https://code.claude.com/docs/en/overview",
    };
    if (urls[topic]) return shell.openExternal(urls[topic]);
  });
}
async function createWindow() {
  allowClose = false;
  window = new BrowserWindow({
    width: 1512,
    height: 982,
    minWidth: 1000,
    minHeight: 680,
    title: "Dopnur",
    backgroundColor: "#f3f2ec",
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 20, y: 18 },
    vibrancy: "under-window",
    visualEffectState: "active",
    icon: path.join(root, "resources", "icon.png"),
    show: false,
    webPreferences: {
      preload: path.join(root, "electron", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.on("close", (event) => {
    if (!allowClose) {
      event.preventDefault();
      emit("close-request", {});
    }
  });
  window.on("closed", () => {
    compileController?.abort();
    agentController?.abort();
    window = null;
  });
  window.once("ready-to-show", () => window.show());
  if (process.env.DOPNUR_DEV_URL && !app.isPackaged)
    await window.loadURL(process.env.DOPNUR_DEV_URL);
  else await window.loadURL("dopnur://app/index.html");
}
void app
  .whenReady()
  .then(async () => {
    protocol.handle("dopnur", (request) => {
      const url = new URL(request.url);
      if (url.host !== "app") return new Response("Not found", { status: 404 });
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      const file = path.resolve(root, "dist", relative || "index.html");
      if (!file.startsWith(path.resolve(root, "dist") + path.sep))
        return new Response("Forbidden", { status: 403 });
      return net.fetch(pathToFileURL(file).href);
    });
    session.defaultSession.setPermissionRequestHandler(
      (_webContents, _permission, callback) => callback(false),
    );
    session.defaultSession.setPermissionCheckHandler(() => false);
    store = new ProjectStore(dataRoot(), path.join(root, "shared", "assets"));
    await store.init();
    settings = new SettingsStore(dataRoot(), safeStorage);
    await settings.init();
    registerHandlers();
    const command = (action) => () => emit("command", { action });
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        ...(process.platform === "darwin"
          ? [
              {
                label: "Dopnur",
                submenu: [
                  { role: "about" },
                  { type: "separator" },
                  {
                    label: "Settings…",
                    accelerator: "CmdOrCtrl+,",
                    click: command("settings"),
                  },
                  { type: "separator" },
                  { role: "hide" },
                  { role: "hideOthers" },
                  { type: "separator" },
                  { role: "quit" },
                ],
              },
            ]
          : []),
        {
          label: "File",
          submenu: [
            {
              label: "New Project…",
              accelerator: "CmdOrCtrl+Shift+N",
              click: command("new"),
            },
            {
              label: "Import Project…",
              accelerator: "CmdOrCtrl+O",
              click: command("import"),
            },
            { type: "separator" },
            {
              label: "Save",
              accelerator: "CmdOrCtrl+S",
              click: command("save"),
            },
            { label: "Export Source…", click: command("export") },
            { label: "Export PDF…", click: command("export-pdf") },
            { type: "separator" },
            { role: "close" },
          ],
        },
        {
          label: "Edit",
          submenu: [
            { role: "undo" },
            { role: "redo" },
            { type: "separator" },
            { role: "cut" },
            { role: "copy" },
            { role: "paste" },
            { role: "selectAll" },
            { type: "separator" },
            {
              label: "Find",
              accelerator: "CmdOrCtrl+F",
              click: command("find"),
            },
          ],
        },
        {
          label: "View",
          submenu: [
            {
              label: "Command Palette",
              accelerator: "CmdOrCtrl+K",
              click: command("palette"),
            },
            {
              label: "Focus Mode",
              accelerator: "CmdOrCtrl+Shift+F",
              click: command("focus"),
            },
            { role: "togglefullscreen" },
            ...(!app.isPackaged ? [{ role: "toggleDevTools" }] : []),
          ],
        },
        {
          label: "Document",
          submenu: [
            {
              label: "Recompile",
              accelerator: "CmdOrCtrl+Enter",
              click: command("compile"),
            },
            { label: "Save Revision", click: command("snapshot") },
            {
              label: "Dopnur Agent",
              accelerator: "CmdOrCtrl+J",
              click: command("agent"),
            },
          ],
        },
      ]),
    );
    await createWindow();
  })
  .catch((error) => {
    console.error(error);
    dialog.showErrorBox("Dopnur could not start", error.message);
    app.exit(1);
  });
app.on("before-quit", () => {
  quitting = true;
});
app.on("activate", () => {
  if (!BrowserWindow.getAllWindows().length) createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
