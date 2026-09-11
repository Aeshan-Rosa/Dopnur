import test from "node:test";
import assert from "node:assert/strict";
import {
  parseProposal,
  validateEdits,
  apiEndpoint,
  buildPrompt,
  runAgent,
} from "../electron/agent.mjs";
import { runProcess } from "../electron/processes.mjs";
import { createServer } from "node:http";
const project = {
  id: "agent-test",
  name: "Paper",
  mainFile: "main.tex",
  files: [{ id: "main", name: "main.tex", content: "Original source" }],
};
test("agent proposals preserve their base and reject dangerous file writes", () => {
  const parsed = parseProposal(
    {
      message: "A change",
      edits: [
        {
          path: "main.tex",
          content: "Changed source",
          explanation: "Clearer.",
        },
      ],
    },
    project,
  );
  assert.equal(parsed.edits[0].original, "Original source");
  assert.equal(validateEdits(project, parsed.edits).length, 1);
  assert.throws(
    () =>
      validateEdits(
        {
          ...project,
          files: [{ ...project.files[0], content: "Concurrent user edit" }],
        },
        parsed.edits,
      ),
    /changed since/,
  );
  for (const name of [
    "../main.tex",
    ".codex/config.toml",
    "run.sh",
    "image.png",
  ])
    assert.throws(() =>
      parseProposal(
        { message: "bad", edits: [{ path: name, content: "bad" }] },
        project,
      ),
    );
});
test("new file proposals cannot overwrite a file added during the run", () => {
  const parsed = parseProposal(
    {
      message: "Add chapter",
      edits: [
        { path: "chapter.tex", content: "New", explanation: "New chapter" },
      ],
    },
    project,
  );
  assert.throws(() =>
    validateEdits(
      {
        ...project,
        files: [
          ...project.files,
          { id: "new", name: "chapter.tex", content: "User version" },
        ],
      },
      parsed.edits,
    ),
  );
});
test("context contains source, selection, diagnostics, and recent conversation", () => {
  const prompt = buildPrompt({
    project,
    prompt: "Improve it",
    activeFile: "main.tex",
    selection: "selected",
    diagnostics: "missing reference",
    history: [{ role: "user", text: "previous" }],
  });
  for (const text of [
    "Original source",
    "selected",
    "missing reference",
    "previous",
    "Improve it",
  ])
    assert.ok(prompt.includes(text));
  assert.throws(() => buildPrompt({ project, prompt: "x".repeat(17000) }));
});
test("API configuration allows HTTPS and local models without allowing plaintext remote credentials", () => {
  assert.equal(
    apiEndpoint("https://api.openai.com/v1", "responses"),
    "https://api.openai.com/v1/responses",
  );
  assert.equal(
    apiEndpoint("http://localhost:11434/v1/", "chat"),
    "http://localhost:11434/v1/chat/completions",
  );
  for (const url of [
    "http://example.com/v1",
    "https://key:secret@example.com",
    "file:///tmp/x",
    "https://example.com?api_key=secret",
  ])
    assert.throws(() => apiEndpoint(url, "chat"));
});
test("API mode sends structured context and parses a real HTTP response", async () => {
  const requests = [];
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    requests.push({ url: req.url, body: JSON.parse(body) });
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  message: "Done",
                  edits: [
                    {
                      path: "main.tex",
                      content: "Improved",
                      explanation: "Clarity",
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
    const response = await runAgent(
      { project, prompt: "Improve", activeFile: "main.tex" },
      {
        provider: "api",
        apiBase: `http://127.0.0.1:${server.address().port}/v1`,
        apiFormat: "responses",
        model: "test-model",
      },
    );
    assert.equal(response.edits[0].content, "Improved");
    assert.equal(requests[0].url, "/v1/responses");
    assert.equal(requests[0].body.store, false);
    assert.ok(requests[0].body.input.includes("Original source"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test("process runner passes literal arguments and cancels subprocesses", async () => {
  const result = await runProcess(
    process.execPath,
    [
      "-e",
      "process.stdout.write(process.argv[1])",
      "$(echo unsafe); & literal",
    ],
    { timeout: 3000 },
  );
  assert.equal(result.stdout, "$(echo unsafe); & literal");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 100);
  await assert.rejects(
    runProcess(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
      signal: controller.signal,
    }),
    /cancelled/,
  );
  clearTimeout(timer);
});
