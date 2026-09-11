import {
  mkdir,
  writeFile,
  readFile,
  chmod,
  mkdtemp,
  rm,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { unzipSync } from "fflate";

// Pin both the release and its publisher-provided SHA-256 digest.
const version = "0.17.0";
const targets = {
  "darwin-arm64": [
    "aarch64-apple-darwin.tar.gz",
    "a3f1cac7c5678f01661a92212f58480ae3b0634115d880dbc59e2953ded45667",
  ],
  "darwin-x64": [
    "x86_64-apple-darwin.tar.gz",
    "7c90ef5b6ddb1eb1937e4337add5237b79338e4b9676459fa91187d24d6cdf80",
  ],
  "win32-x64": [
    "x86_64-pc-windows-msvc.zip",
    "f61ce51f0b0ade1015b7de7ef368541c5424e9756ecbd0d7af97d6d48030845f",
  ],
  "linux-x64": [
    "x86_64-unknown-linux-musl.tar.gz",
    "8533d07f9ccbd7a65824b9e0459041bca34af1eb33daba48f59215593753a3b7",
  ],
};
const target =
  process.env.DOPNUR_TARGET || `${process.platform}-${process.arch}`;
const release = targets[target];
if (!release)
  throw new Error(
    `No bundled compiler for ${target}. Install Tectonic on PATH.`,
  );
const [suffix, digest] = release;
const url = `https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${version}/tectonic-${version}-${suffix}`;
console.log(`Downloading Tectonic ${version} for ${target}…`);
const response = await fetch(url);
if (!response.ok) throw new Error(`Download failed: ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
if (createHash("sha256").update(bytes).digest("hex") !== digest)
  throw new Error("Compiler checksum mismatch");
const directory = path.resolve("resources/bin");
await mkdir(directory, { recursive: true });
const name = target.startsWith("win32") ? "tectonic.exe" : "tectonic";
if (suffix.endsWith(".zip")) {
  const archive = unzipSync(bytes);
  const entry = Object.entries(archive).find(
    ([key]) => path.posix.basename(key) === name,
  );
  if (!entry) throw new Error("Compiler missing from release");
  await writeFile(path.join(directory, name), entry[1]);
} else {
  const temporary = await mkdtemp(path.join(tmpdir(), "dopnur-compiler-"));
  try {
    await writeFile(path.join(temporary, "compiler.tar.gz"), bytes);
    execFileSync("tar", [
      "-xzf",
      path.join(temporary, "compiler.tar.gz"),
      "-C",
      temporary,
      "tectonic",
    ]);
    await writeFile(
      path.join(directory, name),
      await readFile(path.join(temporary, name)),
    );
    await chmod(path.join(directory, name), 0o755);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
await writeFile(
  path.join(directory, name + ".version.json"),
  JSON.stringify({ version, target, digest, source: url }, null, 2),
);
console.log(`Verified and installed ${path.join(directory, name)}`);
