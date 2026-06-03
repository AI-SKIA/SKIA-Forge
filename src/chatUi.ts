import { forgeDownloadAppLink, forgeDownloadClientGateScript } from "./utils/forgeDownloadMarkup.js";

export function renderChatHtml(_releaseBase = "https://skia.ca/download"): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SKIA Forge | Intelligence Console</title>
  <link rel="stylesheet" href="/forge-premium-ui.css" />
  <link rel="stylesheet" href="/forge-platform-console.css" />
</head>
<body class="forge-context-b forge-chat-shell">
  ${forgeDownloadAppLink("ide-download-app")}
  <div class="root">
    <section class="panel">
      <h2>SKIA Intelligence Console</h2>
      <div class="muted">Status: <span id="status">Loading...</span></div>
      <div id="messages"></div>
      <textarea id="prompt" rows="6" placeholder="Describe what you need SKIA to execute…"></textarea>
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
  ${forgeDownloadClientGateScript()}
</body>
</html>`;
}
