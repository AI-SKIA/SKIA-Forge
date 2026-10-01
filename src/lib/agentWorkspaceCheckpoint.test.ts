import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { AgentWorkspaceCheckpoint, type CheckpointIo } from "./agentWorkspaceCheckpoint.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function memoryWorkspace(initial: Record<string, string>): { files: Map<string, string>; io: CheckpointIo } {
  const files = new Map(Object.entries(initial));
  return {
    files,
    io: {
      readFile: async (p) => {
        const v = files.get(p);
        if (v === undefined) throw new Error("ENOENT");
        return v;
      },
      saveFile: async (p, c) => {
        files.set(p, c);
        return true;
      },
      deleteFile: async (p) => files.delete(p)
    }
  };
}

test("restore puts edited files back and removes files the agent created", async () => {
  const ws = memoryWorkspace({ "/w/a.ts": "original a", "/w/b.ts": "original b" });
  const cp = new AgentWorkspaceCheckpoint("run-1", ws.io);

  await cp.captureBeforeWrite("/w/a.ts");
  ws.files.set("/w/a.ts", "agent edit 1");
  await cp.captureBeforeWrite("/w/a.ts");
  ws.files.set("/w/a.ts", "agent edit 2");
  await cp.captureBeforeWrite("/w/new.ts");
  ws.files.set("/w/new.ts", "agent created");

  assert.equal(cp.size, 2);
  const result = await cp.restore();
  assert.deepEqual(result.restored, ["/w/a.ts"]);
  assert.deepEqual(result.deleted, ["/w/new.ts"]);
  assert.deepEqual(result.failed, []);
  assert.deepEqual(Object.fromEntries(ws.files), { "/w/a.ts": "original a", "/w/b.ts": "original b" });
  assert.equal(cp.size, 0);
});

test("a refused write is reported and kept so the user can retry", async () => {
  const ws = memoryWorkspace({ "/w/a.ts": "original" });
  const cp = new AgentWorkspaceCheckpoint("run-2", { ...ws.io, saveFile: async () => false });
  await cp.captureBeforeWrite("/w/a.ts");
  const result = await cp.restore();
  assert.deepEqual(result.failed, [{ absPath: "/w/a.ts", error: "write refused" }]);
  assert.equal(cp.size, 1);
});

test("IDE agent panel checkpoints before each local write and offers restore; delete IPC is scoped to the project root", () => {
  const panel = fs.readFileSync(path.join(root, "skia-ide/src/renderer/skia/skiaAgentPanel.ts"), "utf8");
  const write = panel.indexOf("await window.skiaElectron.saveFile(abs, nextContent)");
  assert.ok(write > 0);
  assert.ok(panel.lastIndexOf("captureBeforeWrite(abs)", write) > 0, "snapshot must precede the write");
  assert.match(panel, /RESTORE PRE-AGENT STATE/);
  const main = fs.readFileSync(path.join(root, "skia-ide/src/main/main.ts"), "utf8");
  const del = main.slice(main.indexOf('ipcMain.handle("skia:deleteFile"'), main.indexOf('ipcMain.handle("skia:saveFileAs"'));
  assert.match(del, /startsWith\(root \+ path\.sep\)/);
  assert.equal(fs.existsSync(path.join(root, "src/forge/modules/agent-executor/AgentCheckpointService.ts")), false);
});
