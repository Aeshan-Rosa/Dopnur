import { _electron as electron } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const executablePath = path.join(
  root,
  "release/mac-arm64/Dopnur.app/Contents/MacOS/Dopnur",
);
const env = {
  ...process.env,
  DOPNUR_USER_DATA: path.join(root, ".test-profile", "packaged-" + Date.now()),
};
delete env.ELECTRON_RUN_AS_NODE;
delete env.DOPNUR_DEV_URL;
const app = await electron.launch({ executablePath, args: [], env });
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page
    .getByRole("button", { name: "Recompile", exact: true })
    .waitFor({ timeout: 30000 });
  assert.equal(await app.evaluate(({ app }) => app.isPackaged), true);
  const boot = await page.evaluate(() => window.dopnur.bootstrap());
  const compiler = boot.connections.compilers.find(
    (engine) => engine.name === "tectonic",
  );
  assert.ok(
    compiler.path.includes("Dopnur.app/Contents/Resources/bin/tectonic"),
  );
  await page.getByRole("button", { name: "Recompile", exact: true }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector(".preview-footer")
        ?.textContent.includes("Compiled in"),
    null,
    { timeout: 240000 },
  );
  await page.locator(".pdf-sheet canvas").first().waitFor();
  await page
    .getByRole("button", { name: "Dismiss notification", exact: true })
    .click();
  await page.waitForTimeout(400);
  await mkdir(path.join(root, "docs/screenshots"), { recursive: true });
  await page.screenshot({
    path: path.join(root, "docs/screenshots/workspace.png"),
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Dopnur Agent", exact: false })
    .first()
    .click();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(root, "docs/screenshots/agent.png"),
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Close agent", exact: true }).click();
  await page
    .getByRole("button", { name: "Project library", exact: true })
    .click();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(root, "docs/screenshots/library.png"),
    animations: "disabled",
  });
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(root, ".test-artifacts/packaged-report.json"),
    JSON.stringify(
      {
        packaged: true,
        compiler: compiler.path,
        realCompilation: true,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS Packaged macOS application launches, locates its bundled compiler, compiles LaTeX, and renders the PDF.",
  );
} finally {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await app.close().catch(() => {});
}
