import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import os from "node:os";

export function desktopEnv() {
  const home = os.homedir();
  const extra =
    process.platform === "win32"
      ? [
          path.join(home, ".local", "bin"),
          path.join(process.env.APPDATA || home, "npm"),
        ]
      : [
          "/opt/homebrew/bin",
          "/usr/local/bin",
          "/Library/TeX/texbin",
          path.join(home, ".local", "bin"),
          path.join(home, ".cargo", "bin"),
        ];
  return {
    ...process.env,
    PATH: [...extra, process.env.PATH || ""].join(path.delimiter),
  };
}
export async function locate(command, custom) {
  const names =
    process.platform === "win32"
      ? [command + ".exe", command + ".cmd", command]
      : [command];
  const candidates = custom
    ? [custom]
    : desktopEnv()
        .PATH.split(path.delimiter)
        .flatMap((dir) => names.map((name) => path.join(dir, name)));
  for (const candidate of candidates) {
    if (!path.isAbsolute(candidate)) continue;
    try {
      await access(
        candidate,
        process.platform === "win32" ? constants.F_OK : constants.X_OK,
      );
      return candidate;
    } catch {
      /* try next installation */
    }
  }
  return null;
}
export async function commandFor(executable, args) {
  // Run known npm shims through Node on Windows, without cmd.exe or shell interpolation.
  if (process.platform === "win32" && executable.endsWith(".cmd")) {
    const directory = path.dirname(executable);
    const node = await locate("node");
    const name = path.basename(executable, ".cmd");
    const entry =
      name === "codex"
        ? "node_modules/@openai/codex/bin/codex.js"
        : name === "claude"
          ? "node_modules/@anthropic-ai/claude-code/cli.js"
          : null;
    if (!node || !entry)
      throw new Error(
        "Select the native executable in Settings. This Windows shim is not supported.",
      );
    await readFile(path.join(directory, entry));
    return { executable: node, args: [path.join(directory, entry), ...args] };
  }
  return { executable, args };
}
export function runProcess(
  executable,
  args,
  {
    cwd,
    input,
    env = desktopEnv(),
    signal,
    onOutput = () => {},
    timeout = 180000,
    maxOutput = 4 * 1024 * 1024,
  } = {},
) {
  return new Promise((resolve, reject) => {
    let output = "",
      errors = "",
      finished = false,
      failure;
    const child = spawn(executable, args, {
      cwd,
      env,
      shell: false,
      windowsHide: true,
      detached: process.platform !== "win32",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const kill = () => {
      if (!child.pid) return;
      try {
        if (process.platform === "win32")
          spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
            windowsHide: true,
            stdio: "ignore",
          }).on("error", () => child.kill());
        else process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill();
      }
      const force = setTimeout(() => {
        if (!finished)
          try {
            process.kill(-child.pid, "SIGKILL");
          } catch {
            child.kill("SIGKILL");
          }
      }, 1500);
      force.unref();
    };
    const cancel = () => {
      failure = new Error("Run cancelled.");
      kill();
    };
    const timer = setTimeout(() => {
      failure = new Error(
        "The run timed out. Check the connection or simplify the document.",
      );
      kill();
    }, timeout);
    const cleanup = () => {
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
    };
    const collect = (chunk, type) => {
      const text = chunk.toString();
      if (type === "stdout") output += text;
      else errors += text;
      onOutput(text, type);
      if (output.length + errors.length > maxOutput) {
        failure = new Error("The run produced too much output.");
        kill();
      }
    };
    child.stdout.on("data", (chunk) => collect(chunk, "stdout"));
    child.stderr.on("data", (chunk) => collect(chunk, "stderr"));
    child.on("error", (error) => {
      cleanup();
      reject(error);
    });
    child.on("close", (code) => {
      cleanup();
      failure
        ? reject(failure)
        : resolve({ code, stdout: output, stderr: errors });
    });
    child.stdin.on("error", () => {});
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
    child.stdin.end(input || "");
  });
}
