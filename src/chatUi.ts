export function renderChatHtml(releaseBase = "https://github.com/AI-SKIA/skia/releases/latest/download"): string {
  const releasePage = releaseBase.endsWith("/download")
    ? releaseBase.slice(0, -"/download".length)
    : "https://github.com/AI-SKIA/skia/releases/latest";
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SKIA Forge | Web IDE</title>
  <style>
    body { margin: 0; font-family: Calibri, Arial, sans-serif; background: #0a0a0a; color: #e8e8e8; }
    .ide-download-app {
      position: fixed;
      top: 12px;
      right: 12px;
      z-index: 50;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 8px 14px;
      border: 1px solid rgba(212, 175, 55, 0.45);
      border-radius: 6px;
      background: rgba(212, 175, 55, 0.08);
      color: #d4af37;
      text-decoration: none;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 11px;
      font-weight: 600;
      backdrop-filter: blur(3px);
      transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
    }
    .ide-download-app:hover {
      border-color: rgba(212, 175, 55, 0.75);
      background: rgba(212, 175, 55, 0.18);
      color: #f5dc85;
    }
    .root { display: grid; grid-template-columns: 1fr 1fr; height: 100vh; }
    .panel { border-right: 1px solid #2a2a2a; padding: 14px; overflow: auto; }
    .panel:last-child { border-right: none; }
    h2 { margin: 0 0 10px; color: #d4af37; font-size: 18px; }
    textarea, input { width: 100%; background: #111; color: #e8e8e8; border: 1px solid #444; padding: 8px; border-radius: 6px; }
    button { margin-top: 8px; background: #d4af37; color: #000; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; }
    pre { background: #111; border: 1px solid #333; padding: 10px; white-space: pre-wrap; border-radius: 6px; }
    .msg { margin: 8px 0; padding: 8px; background: #121212; border-left: 3px solid #d4af37; }
    .added { color: #8ddf8d; }
    .removed { color: #f08f8f; }
    .muted { color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <a class="ide-download-app" href="${releasePage}" target="_blank" rel="noreferrer">Download App</a>
  <div class="root">
    <section class="panel">
      <h2>SKIA Chat</h2>
      <div class="muted">Status: <span id="status">Loading...</span></div>
      <div id="messages"></div>
      <textarea id="prompt" rows="6" placeholder="Ask SKIA..."></textarea>
      <button id="send">Send</button>
    </section>
    <section class="panel">
      <h2>Diff Preview</h2>
      <textarea id="oldText" rows="8" placeholder="Old code"></textarea>
      <textarea id="newText" rows="8" placeholder="New code"></textarea>
      <button id="preview">Preview Diff</button>
      <pre id="diff"></pre>
    </section>
  </div>
  <script>
    const messages = document.getElementById("messages");
    const statusNode = document.getElementById("status");
    async function refreshStatus() {
      const res = await fetch("/providers/status");
      const data = await res.json();
      statusNode.textContent = data.status + " (" + data.activeProvider + ")";
    }
    function addMessage(label, text) {
      const box = document.createElement("div");
      box.className = "msg";
      box.innerHTML = "<strong>" + label + ":</strong><br>" + text.replaceAll("<", "&lt;");
      messages.appendChild(box);
      messages.scrollTop = messages.scrollHeight;
    }
    document.getElementById("send").addEventListener("click", async () => {
      const prompt = document.getElementById("prompt").value;
      addMessage("You", prompt);
      const body = { jsonrpc: "2.0", id: Date.now(), method: "skia/explain", params: { code: prompt } };
      const res = await fetch("/rpc", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      addMessage("SKIA", JSON.stringify(data.result ?? data.error, null, 2));
      await refreshStatus();
    });
    document.getElementById("preview").addEventListener("click", async () => {
      const oldText = document.getElementById("oldText").value;
      const newText = document.getElementById("newText").value;
      const res = await fetch("/diff/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ oldText, newText })
      });
      const data = await res.json();
      const out = data.lines.map((line) => {
        if (line.type === "add") return "+ " + line.text;
        if (line.type === "remove") return "- " + line.text;
        return "  " + line.text;
      }).join("\\n");
      document.getElementById("diff").textContent = out;
    });
    refreshStatus();
  </script>
</body>
</html>`;
}
