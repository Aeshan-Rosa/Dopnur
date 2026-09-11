const { contextBridge, ipcRenderer } = require("electron");
const invoke =
  (channel) =>
  (...args) =>
    ipcRenderer.invoke("dopnur:" + channel, ...args);
contextBridge.exposeInMainWorld("dopnur", {
  bootstrap: invoke("bootstrap"),
  getProject: invoke("project:get"),
  saveProject: invoke("project:save"),
  createProject: invoke("project:create"),
  archiveProject: invoke("project:archive"),
  importProject: invoke("project:import"),
  exportProject: invoke("project:export"),
  importFiles: invoke("files:import"),
  snapshots: invoke("snapshots:list"),
  snapshot: invoke("snapshots:create"),
  restoreSnapshot: invoke("snapshots:restore"),
  compile: invoke("compile"),
  cancelCompile: invoke("compile:cancel"),
  getPdf: invoke("pdf:get"),
  exportPdf: invoke("pdf:export"),
  getSettings: invoke("settings:get"),
  saveSettings: invoke("settings:save"),
  connections: invoke("connections"),
  selectExecutable: invoke("executable:select"),
  runAgent: invoke("agent:run"),
  cancelAgent: invoke("agent:cancel"),
  applyEdits: invoke("agent:apply"),
  windowAction: invoke("window"),
  openHelp: invoke("help"),
  onEvent(callback) {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("dopnur:event", handler);
    return () => ipcRenderer.removeListener("dopnur:event", handler);
  },
});
