import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  rm,
  mkdir,
  writeFile,
  symlink,
} from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { zipSync } from "fflate";
import {
  ProjectStore,
  validateProject,
  safeName,
  importZip,
  exportZip,
  materialize,
  readDirectory,
} from "../electron/projects.mjs";

export const fixture = () => ({
  id: "test-project",
  name: "A test",
  mainFile: "main.tex",
  files: [
    {
      id: "main",
      name: "main.tex",
      content:
        "\\documentclass{article}\n\\begin{document}Hello\\end{document}",
    },
    { id: "bib", name: "references.bib", content: "@book{test,title={Test}}" },
  ],
  createdAt: 1,
  updatedAt: 1,
  starred: false,
  color: "sage",
  template: "blank",
});
test("portable paths reject traversal, Windows device names and hidden control files", () => {
  for (const filename of [
    "../secret.tex",
    "/etc/passwd",
    "a/../../x",
    "a\\b",
    "C:/x.tex",
    ".claude/settings.json",
    "a//b",
    "NUL.tex",
    "a/CON",
    "foo.",
    "x\0.tex",
    "a/.hidden",
  ])
    assert.throws(() => safeName(filename));
  assert.equal(safeName("chapters/Part 1.tex"), "chapters/Part 1.tex");
});
test("project validation rejects duplicate paths, missing root and unsupported encoding", () => {
  const p = fixture();
  assert.equal(validateProject(p).name, "A test");
  assert.throws(() => validateProject({ ...p, mainFile: "missing.tex" }));
  assert.throws(() =>
    validateProject({
      ...p,
      files: [...p.files, { id: "other", name: "MAIN.tex", content: "" }],
    }),
  );
  assert.throws(() =>
    validateProject({ ...p, files: [{ ...p.files[0], encoding: "utf8" }] }),
  );
});
test("ZIP export and import preserve UTF-8 and binary assets", () => {
  const p = fixture();
  p.files[0].content += "\nRésumé — café 🌿";
  p.files.push({
    id: "img",
    name: "figures/chart.png",
    content: Buffer.from([137, 80, 78, 71, 0, 255]).toString("base64"),
    encoding: "base64",
  });
  const restored = importZip(exportZip(p));
  assert.deepEqual(
    restored.map(({ id, ...f }) => f),
    p.files.map(({ id, ...f }) => f),
  );
});
test("ZIP import strips one wrapper and refuses unsafe paths", () => {
  const imported = importZip(
    zipSync({
      "my-paper/main.tex": Buffer.from("hello"),
      "my-paper/references.bib": Buffer.from("refs"),
    }),
  );
  assert.equal(imported[0].name, "main.tex");
  assert.throws(() =>
    importZip(zipSync({ "../main.tex": Buffer.from("escape") })),
  );
});
test("atomic saves serialize correctly; snapshots remain independent from later edits", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "dopnur-test-store-"));
  try {
    const store = new ProjectStore(directory, path.resolve("shared/assets"));
    await store.init();
    const p = fixture();
    await Promise.all([
      store.save({ ...p, name: "first" }),
      store.save({ ...p, name: "second" }),
    ]);
    assert.equal((await store.get(p.id)).name, "second");
    await store.snapshot(p, "Before edits");
    await store.save({ ...p, files: [{ ...p.files[0], content: "changed" }] });
    assert.equal(
      (await store.snapshots(p.id))[0].project.files[0].content,
      p.files[0].content,
    );
    assert.equal((await store.get(p.id)).files[0].content, "changed");
    await store.archive(p.id);
    assert.ok(!(await store.list()).some((item) => item.id === p.id));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("materialization confines files and folder import skips symlinks and hidden directories", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "dopnur-test-files-"));
  try {
    const p = fixture();
    await materialize(p, directory);
    assert.equal(
      await readFile(path.join(directory, "main.tex"), "utf8"),
      p.files[0].content,
    );
    await mkdir(path.join(directory, ".codex"));
    await writeFile(path.join(directory, ".codex", "config.toml"), "sensitive");
    if (process.platform !== "win32")
      await symlink(
        path.join(directory, "main.tex"),
        path.join(directory, "linked.tex"),
      );
    const files = await readDirectory(directory);
    assert.deepEqual(files.map((f) => f.name).sort(), [
      "main.tex",
      "references.bib",
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
