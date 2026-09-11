import { spawn } from "node:child_process";
import { createServer } from "vite";
import electron from "electron";
const server = await createServer();
await server.listen();
server.printUrls();
const env = { ...process.env, DOPNUR_DEV_URL: "http://127.0.0.1:5173" };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ["."], { stdio: "inherit", env });
child.on("exit", async (code) => {
  await server.close();
  process.exit(code || 0);
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill());
