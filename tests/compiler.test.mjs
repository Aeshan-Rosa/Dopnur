import test from "node:test";
import assert from "node:assert/strict";
import { diagnostics, sourceFingerprint } from "../electron/compiler.mjs";
test("compiler diagnostics expose actionable errors and line numbers", () => {
  const parsed = diagnostics(
    "! Undefined control sequence.\nl.23 \\badcommand\nLaTeX Warning: Citation `missing` on input line 41 undefined.",
  );
  assert.deepEqual(
    parsed.map((item) => [item.severity, item.line]),
    [
      ["error", 23],
      ["warning", 41],
    ],
  );
});
test("PDF freshness tracks source changes and ignores editor-only file IDs", () => {
  const project = {
    mainFile: "main.tex",
    files: [{ id: "a", name: "main.tex", content: "hello" }],
  };
  assert.equal(
    sourceFingerprint(project),
    sourceFingerprint({
      ...project,
      files: [{ ...project.files[0], id: "b" }],
    }),
  );
  assert.notEqual(
    sourceFingerprint(project),
    sourceFingerprint({
      ...project,
      files: [{ ...project.files[0], content: "edited" }],
    }),
  );
});
