import { execFile } from "node:child_process";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const DEFAULT_LIVE_STATE_PATH = resolve("../public/live-execution.json");

export async function publishLiveState(state, path = DEFAULT_LIVE_STATE_PATH) {
  const next = { ...state, updatedAt: new Date().toISOString() };
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o644 });
  await rename(temporaryPath, path);
  return next;
}

export function openLiveDashboard(url) {
  execFile("/usr/bin/open", [url], { stdio: "ignore" }, () => {});
}

export function event(stage, title, detail, kind = "active") {
  return { at: new Date().toISOString(), stage, title, detail, kind };
}
