import { readFile } from "node:fs/promises";
import path from "node:path";
import { atomicJSON } from "./projects.mjs";
import { apiEndpoint } from "./agent.mjs";
export const defaults = {
  provider: "codex",
  model: "",
  apiBase: "https://api.openai.com/v1",
  apiFormat: "responses",
  codexPath: "",
  claudePath: "",
  compilerPath: "",
  engine: "auto",
  fontSize: 13,
  wordWrap: true,
  autoCompile: false,
  theme: "light",
  dailyGoal: 1000,
};
export class SettingsStore {
  constructor(root, safeStorage) {
    this.file = path.join(root, "settings.json");
    this.safeStorage = safeStorage;
    this.data = { ...defaults };
  }
  async init() {
    try {
      this.data = {
        ...defaults,
        ...JSON.parse(await readFile(this.file, "utf8")),
      };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  public() {
    const { encryptedKey, ...settings } = this.data;
    return {
      ...settings,
      hasApiKey: !!encryptedKey,
      keyStorageAvailable: this.safeStorage.isEncryptionAvailable(),
    };
  }
  key() {
    return this.data.encryptedKey
      ? this.safeStorage.decryptString(
          Buffer.from(this.data.encryptedKey, "base64"),
        )
      : undefined;
  }
  async save(input) {
    const next = { ...this.data };
    for (const key of Object.keys(defaults))
      if (key in input) next[key] = input[key];
    if (
      !["codex", "claude", "api"].includes(next.provider) ||
      !["responses", "chat"].includes(next.apiFormat) ||
      !["auto", "tectonic", "latexmk", "pdflatex"].includes(next.engine) ||
      !["light", "dark"].includes(next.theme)
    )
      throw new Error("Invalid settings choice.");
    for (const key of [
      "model",
      "apiBase",
      "codexPath",
      "claudePath",
      "compilerPath",
    ])
      if (typeof next[key] !== "string" || next[key].length > 2000)
        throw new Error("Invalid settings value.");
    apiEndpoint(next.apiBase, next.apiFormat);
    next.fontSize = Math.max(11, Math.min(22, Number(next.fontSize) || 13));
    next.dailyGoal = Math.max(
      100,
      Math.min(20000, Number(next.dailyGoal) || 1000),
    );
    next.wordWrap = !!next.wordWrap;
    next.autoCompile = !!next.autoCompile;
    if (input.clearApiKey) delete next.encryptedKey;
    if (input.apiKey) {
      if (typeof input.apiKey !== "string" || input.apiKey.length > 2000)
        throw new Error("Invalid API key.");
      if (!this.safeStorage.isEncryptionAvailable())
        throw new Error(
          "The OS credential store is unavailable. Unlock your keychain and try again.",
        );
      next.encryptedKey = this.safeStorage
        .encryptString(input.apiKey)
        .toString("base64");
    }
    await atomicJSON(this.file, next);
    this.data = next;
    return this.public();
  }
}
