import path from "node:path";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { materialize, validateProject, atomicJSON } from "./projects.mjs";
import { desktopEnv, locate, runProcess, commandFor } from "./processes.mjs";

export async function findCompilers(binDirectory, custom) {
  return Promise.all(
    ["tectonic", "latexmk", "pdflatex"].map(async (name) => ({
      name,
      path:
        (await locate(
          name,
          name === "tectonic"
            ? custom ||
                path.join(
                  binDirectory,
                  process.platform === "win32" ? "tectonic.exe" : "tectonic",
                )
            : undefined,
        )) || (await locate(name)),
    })),
  );
}
export function sourceFingerprint(project) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        mainFile: project.mainFile,
        files: project.files
          .map(({ name, content, encoding }) => ({ name, content, encoding }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }),
    )
    .digest("hex");
}
export function diagnostics(log) {
  const issues = [];
  const lines = log.split("\n");
  lines.forEach((line, index) => {
    if (/^!|error:/i.test(line))
      issues.push({
        severity: "error",
        message: line.replace(/^!\s*/, ""),
        line:
          Number(
            lines
              .slice(index, index + 5)
              .join("\n")
              .match(/l\.(\d+)/)?.[1],
          ) || undefined,
      });
    else if (
      /(?:LaTeX|Package .+) Warning:|warning:|Overfull \\hbox/i.test(line)
    )
      issues.push({
        severity: "warning",
        message: line.trim(),
        line: Number(line.match(/(?:line|lines) (\d+)/)?.[1]) || undefined,
      });
  });
  return issues.slice(0, 80);
}
export async function compileProject(
  project,
  {
    binDirectory,
    cacheDirectory,
    engine = "auto",
    compilerPath,
    signal,
    onOutput = () => {},
  },
) {
  const valid = validateProject(project);
  const compilers = await findCompilers(binDirectory, compilerPath);
  const compiler =
    engine === "auto"
      ? compilers.find((c) => c.path)
      : compilers.find((c) => c.name === engine && c.path);
  if (!compiler)
    return {
      ok: false,
      missingEngine: true,
      log: "No LaTeX compiler found. Install Tectonic, or choose an installed compiler in Settings.",
      diagnostics: [],
      duration: 0,
    };
  const started = Date.now();
  const directory = await mkdtemp(path.join(tmpdir(), "dopnur-build-"));
  const outputDirectory = path.join(directory, "dopnur-output");
  let log = "";
  try {
    await materialize(valid, directory);
    await mkdir(outputDirectory);
    const common = [
      "-interaction=nonstopmode",
      "-halt-on-error",
      "-file-line-error",
      "-no-shell-escape",
      `-output-directory=${outputDirectory}`,
      valid.mainFile,
    ];
    const args =
      compiler.name === "tectonic"
        ? [
            "--untrusted",
            "--keep-logs",
            "--synctex",
            "--outdir",
            outputDirectory,
            valid.mainFile,
          ]
        : compiler.name === "latexmk"
          ? ["-norc", "-pdf", ...common]
          : common;
    const command = await commandFor(compiler.path, args);
    const env = {
      ...desktopEnv(),
      openin_any: "p",
      openout_any: "p",
      shell_escape: "f",
    };
    const result = await runProcess(command.executable, command.args, {
      cwd: directory,
      signal,
      env,
      onOutput: (chunk) => {
        log += chunk;
        onOutput(chunk);
      },
      timeout: 240000,
    });
    let code = result.code;
    if (code === 0 && compiler.name === "pdflatex") {
      // A second pass resolves section references; bibliography users should select Tectonic/latexmk.
      code = (
        await runProcess(command.executable, command.args, {
          cwd: directory,
          signal,
          env,
          onOutput: (chunk) => {
            log += chunk;
            onOutput(chunk);
          },
        })
      ).code;
    }
    const basename = path.basename(valid.mainFile, ".tex");
    try {
      log +=
        "\n" +
        (await readFile(path.join(outputDirectory, basename + ".log"), "utf8"));
    } catch {}
    const issues = diagnostics(log);
    if (code !== 0)
      return {
        ok: false,
        log,
        diagnostics: issues,
        duration: Date.now() - started,
        engine: compiler.name,
      };
    const pdf = await readFile(path.join(outputDirectory, basename + ".pdf"));
    await mkdir(cacheDirectory, { recursive: true });
    await writeFile(path.join(cacheDirectory, valid.id + ".pdf"), pdf);
    await atomicJSON(path.join(cacheDirectory, valid.id + ".json"), {
      source: sourceFingerprint(valid),
      compiledAt: Date.now(),
      engine: compiler.name,
    });
    return {
      ok: true,
      pdf: pdf.toString("base64"),
      log,
      diagnostics: issues,
      duration: Date.now() - started,
      engine: compiler.name,
    };
  } catch (error) {
    return {
      ok: false,
      log: log + "\n" + error.message,
      diagnostics: [{ severity: "error", message: error.message }],
      duration: Date.now() - started,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
