import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const cwd = fileURLToPath(new URL("../api", import.meta.url));
const command = process.platform === "win32" ? "mvnw.cmd" : "./mvnw";
const child = spawn(command, process.argv.slice(2), {
  cwd,
  stdio: "inherit",
  shell: process.platform === "win32",
});
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
