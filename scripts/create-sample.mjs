import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProjectStore } from "../electron/projects.mjs";
import { compileProject } from "../electron/compiler.mjs";
const root = process.cwd();
const directory = await mkdtemp(path.join(tmpdir(), "dopnur-sample-"));
try {
  const store = new ProjectStore(directory, path.join(root, "shared/assets"));
  await store.init();
  const list = await store.list();
  const project = await store.get(list[0].id);
  const result = await compileProject(project, {
    binDirectory: path.join(root, "resources/bin"),
    cacheDirectory: path.join(directory, "pdf"),
    onOutput: (chunk) => process.stdout.write(chunk),
  });
  if (!result.ok) throw new Error(result.log.slice(-5000));
  await writeFile(
    path.join(root, "shared/assets/sample.pdf"),
    Buffer.from(result.pdf, "base64"),
  );
  console.log(
    `\nSample PDF compiled in ${(result.duration / 1000).toFixed(1)} seconds.`,
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
