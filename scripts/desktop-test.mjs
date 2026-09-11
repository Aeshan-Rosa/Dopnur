import { _electron as electron } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createServer } from "node:http";
const root = process.cwd();
const artifacts = path.join(root, ".test-artifacts");
const profile = path.join(root, ".test-profile", String(Date.now()));
await mkdir(artifacts, { recursive: true });
const env = { ...process.env, DOPNUR_USER_DATA: profile };
delete env.ELECTRON_RUN_AS_NODE;
delete env.DOPNUR_DEV_URL;
const app = await electron.launch({ args: [root], env });
const page = await app.firstWindow();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const report = [];
const check = (name) => {
  report.push(name);
  console.log("PASS " + name);
};
const screenshot = async (name) => {
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(artifacts, name + ".png"),
    animations: "disabled",
  });
};
try {
  await page
    .getByRole("button", { name: "Recompile", exact: true })
    .waitFor({ timeout: 30000 });
  await page.locator(".pdf-sheet canvas").first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(500);
  await screenshot("workspace");
  check("Desktop launches with real template PDF");
  const boot = await page.evaluate(() => window.dopnur.bootstrap());
  assert.ok(
    boot.connections.compilers.some((c) => c.name === "tectonic" && c.path),
  );
  const id = boot.projects[0].id;
  await page.locator(".cm-content").click();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+End" : "Control+End",
  );
  await page.keyboard.insertText("\n% Desktop autosave check\n");
  await page.waitForFunction(
    async (id) =>
      (await window.dopnur.getProject(id)).files.some((f) =>
        f.content.includes("Desktop autosave check"),
      ),
    id,
  );
  check("Editor changes autosave to native project storage");
  await page.getByRole("button", { name: "Recompile", exact: true }).click();
  await page
    .getByRole("button", { name: "Compiling…", exact: true })
    .waitFor({ state: "hidden", timeout: 240000 });
  await page.waitForFunction(() =>
    document
      .querySelector(".preview-footer")
      ?.textContent.includes("Compiled in"),
  );
  check("Real Tectonic compilation updates the PDF");
  const invalid = await page.evaluate((id) => window.dopnur.getProject(id), id);
  invalid.files = invalid.files.map((file) =>
    file.name === "main.tex"
      ? {
          ...file,
          content: file.content.replace(
            "\\end{document}",
            "\\DopnurInvalidCommand\n\\end{document}",
          ),
        }
      : file,
  );
  const badCompile = await page.evaluate(
    (project) => window.dopnur.compile(project),
    invalid,
  );
  assert.equal(badCompile.ok, false);
  assert.ok(badCompile.diagnostics.some((issue) => issue.severity === "error"));
  check(
    "Invalid LaTeX returns diagnostics without replacing the last valid PDF",
  );
  await page
    .getByRole("button", { name: "Open preferences", exact: true })
    .click();
  await page.getByRole("button", { name: "Editor", exact: true }).click();
  await page
    .getByRole("switch", { name: "Automatic compilation", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await page.locator(".cm-content").click();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+End" : "Control+End",
  );
  await page.keyboard.insertText("\n% Auto compilation check\n");
  await page
    .getByRole("button", { name: "Compiling…", exact: true })
    .waitFor({ timeout: 15000 });
  await page
    .getByRole("button", { name: "Compiling…", exact: true })
    .waitFor({ state: "hidden", timeout: 30000 });
  await page.waitForFunction(
    async (id) => !(await window.dopnur.getPdf(id)).stale,
    id,
  );
  check("Automatic compilation works after autosave");
  await page
    .getByRole("button", { name: "Open preferences", exact: true })
    .click();
  await page.getByRole("button", { name: "Editor", exact: true }).click();
  await page
    .getByRole("switch", { name: "Automatic compilation", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await page.getByRole("button", { name: "New file", exact: true }).click();
  await page
    .getByLabel("File name", { exact: true })
    .fill("chapters/ideas.tex");
  await page.getByRole("button", { name: "Create file", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.ok(
    (await page.evaluate((id) => window.dopnur.getProject(id), id)).files.some(
      (f) => f.name === "chapters/ideas.tex",
    ),
  );
  check("Nested project files can be created");
  await page.locator(".file-row").filter({ hasText: "main.tex" }).click();
  await page.getByRole("button", { name: "References", exact: true }).click();
  await page
    .getByLabel("Add a reference", { exact: false })
    .fill(
      "@book{desktoptest,\n title={A test reference},\n author={Example Author},\n year={2026}\n}",
    );
  await page
    .getByRole("button", { name: "Add to bibliography", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "A test reference", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  check("BibTeX library accepts and renders new references");
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page
    .getByRole("button", { name: "Keep this moment", exact: false })
    .click();
  await page.waitForTimeout(700);
  assert.ok(
    (await page.evaluate((id) => window.dopnur.snapshots(id), id)).length >= 2,
  );
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  check("Revision history persists real snapshots");
  const zipPath = path.join(artifacts, "source-export.zip");
  const pdfPath = path.join(artifacts, "document-export.pdf");
  await app.evaluate(
    ({ dialog }, { zipPath, pdfPath }) => {
      dialog.showSaveDialog = async (_window, options) => ({
        canceled: false,
        filePath: options.title === "Export PDF" ? pdfPath : zipPath,
      });
    },
    { zipPath, pdfPath },
  );
  const p = await page.evaluate((id) => window.dopnur.getProject(id), id);
  assert.equal(
    await page.evaluate((p) => window.dopnur.exportProject(p), p),
    true,
  );
  assert.equal(
    await page.evaluate((id) => window.dopnur.exportPdf(id), id),
    true,
  );
  assert.equal((await readFile(pdfPath)).subarray(0, 4).toString(), "%PDF");
  check("Native source ZIP and PDF export write valid artifacts");
  await app.evaluate(({ dialog }, zipPath) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [zipPath],
    });
  }, zipPath);
  const imported = await page.evaluate(() =>
    window.dopnur.importProject("zip"),
  );
  assert.equal(imported.files.length, p.files.length);
  check("Source ZIP re-import preserves project files");
  await page
    .getByRole("button", { name: "Dopnur Agent", exact: false })
    .first()
    .click();
  await page.locator(".agent-welcome").waitFor();
  await screenshot("agent");
  await page
    .getByRole("button", { name: "Agent connection settings", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  await screenshot("settings");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  check("Agent panel and connection settings open");
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const request = JSON.parse(body);
    assert.ok(request.input.includes("The quiet architecture"));
    const project = await page.evaluate(
      (id) => window.dopnur.getProject(id),
      id,
    );
    const main = project.files.find((f) => f.name === "main.tex");
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        output: [
          {
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  message: "A small proposed improvement.",
                  edits: [
                    {
                      path: "main.tex",
                      content: main.content + "\n% Agent proposal applied\n",
                      explanation: "A desktop test change.",
                    },
                  ],
                }),
              },
            ],
          },
        ],
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await page.evaluate(
      (base) =>
        window.dopnur.saveSettings({
          provider: "api",
          apiBase: base,
          apiFormat: "responses",
          model: "desktop-test",
        }),
      `http://127.0.0.1:${server.address().port}/v1`,
    );
    await page
      .getByLabel("Ask Dopnur Agent")
      .fill("Propose a small improvement.");
    await page
      .getByRole("button", { name: "Send to Dopnur Agent", exact: true })
      .click();
    await page.locator(".proposal-card").waitFor({ timeout: 20000 });
    const before = await page.evaluate(
      (id) => window.dopnur.getProject(id),
      id,
    );
    assert.ok(!before.files[0].content.includes("Agent proposal applied"));
    await page.locator(".proposal-card").click();
    await page.getByRole("dialog").waitFor();
    await screenshot("review");
    await page
      .getByRole("button", { name: "Apply 1 change", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    const after = await page.evaluate((id) => window.dopnur.getProject(id), id);
    assert.ok(after.files[0].content.includes("Agent proposal applied"));
    assert.ok(
      (await page.evaluate((id) => window.dopnur.snapshots(id), id)).some(
        (s) => s.label === "Before Dopnur Agent edits",
      ),
    );
    check(
      "Agent HTTP request, diff review, approval, insertion, and backup complete end to end",
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await page.evaluate(() =>
      window.dopnur.saveSettings({
        provider: "codex",
        apiBase: "https://api.openai.com/v1",
        model: "",
      }),
    );
  }
  await page.getByRole("button", { name: "Close agent", exact: true }).click();
  await page
    .getByRole("button", { name: "Project library", exact: true })
    .click();
  await page.locator(".library").waitFor();
  await screenshot("library");
  check("Project library and templates render");
  await page
    .getByRole("button", { name: "Open preferences", exact: true })
    .click();
  await page.getByRole("button", { name: "After hours", exact: false }).click();
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  await screenshot("dark");
  check("Appearance preferences persist and apply");
  await page
    .getByRole("button", { name: "Open preferences", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Morning light", exact: false })
    .click();
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Project files", exact: true })
    .click();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1080, 760),
  );
  await page.waitForTimeout(200);
  await screenshot("compact");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
  );
  check("Workspace fits a compact desktop window");
  assert.deepEqual(errors, []);
  check("No renderer exceptions");
  await page.locator(".cm-content").click();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+End" : "Control+End",
  );
  await page.keyboard.insertText("\n% Saved on window close\n");
  const closed = page.waitForEvent("close");
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].close(),
  );
  await closed;
  const persisted = JSON.parse(
    await readFile(path.join(profile, "projects", id + ".json"), "utf8"),
  );
  assert.ok(
    persisted.files
      .find((f) => f.name === "main.tex")
      .content.includes("Saved on window close"),
  );
  check("Closing the native window flushes pending edits");
  await writeFile(
    path.join(artifacts, "desktop-report.json"),
    JSON.stringify({ passed: report, errors, profile }, null, 2),
  );
} catch (error) {
  await page
    .screenshot({ path: path.join(artifacts, "failure.png") })
    .catch(() => {});
  console.error(
    await page
      .locator("body")
      .innerText()
      .catch(() => ""),
  );
  throw error;
} finally {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await app.close().catch(() => {});
}
