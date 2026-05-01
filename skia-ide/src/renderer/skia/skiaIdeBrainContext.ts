import { getEditor } from "../editor/monacoSetup";
import { getActiveFile, getWorkspacePath } from "./skiaSessionStore";

/** Keep payloads bounded — upstream chat routes enforce their own limits too. */
const MAX_BUFFER_CHARS = 120_000;
const MAX_SELECTION_CHARS = 32_000;

const SKIP_DIR_NAMES = new Set([
    "node_modules",
    ".git",
    ".svn",
    ".hg",
    "dist",
    "build",
    ".next",
    "out",
    "target",
    "__pycache__",
    ".venv",
    "venv",
    ".turbo",
    ".cache",
    ".cursor",
    "coverage",
    ".nyc_output",
]);

const TEXT_EXT =
    /\.(ts|tsx|js|jsx|mjs|cjs|json|md|mdx|txt|css|scss|sass|less|html|htm|xml|yml|yaml|toml|ini|env|sh|bat|ps1|py|rs|go|java|kt|swift|c|h|cpp|hpp|cs|rb|php|sql|graphql|vue|svelte|astro|r|lua|zig|proto|gradle|kts|properties)$/i;

const MAX_WORKSPACE_FILES = 150;
const MAX_FILE_READ_CHARS = 120_000;
const MAX_WORKSPACE_PACK_CHARS = 250_000;

type MinimalEditor = {
    getValue?: () => string;
    getModel?: () => {
        getLanguageId?: () => string;
        getValueInRange?: (range: {
            startLineNumber: number;
            startColumn: number;
            endLineNumber: number;
            endColumn: number;
        }) => string;
    } | null;
    getSelection?: () => {
        isEmpty?: () => boolean;
        startLineNumber: number;
        startColumn: number;
        endLineNumber: number;
        endColumn: number;
    } | null;
};

function flattenFilePaths(nodes: SkiaDirectoryNode[], acc: string[] = []): string[] {
    for (const n of nodes) {
        if (n.type === "file") acc.push(n.path);
        else if (n.children?.length) flattenFilePaths(n.children, acc);
    }
    return acc;
}

function shouldIndexFile(absPath: string): boolean {
    const norm = absPath.replace(/\\/g, "/");
    const segments = norm.split("/").filter(Boolean);
    for (const seg of segments) {
        if (SKIP_DIR_NAMES.has(seg.toLowerCase())) return false;
    }
    const base = segments[segments.length - 1] || "";
    if (TEXT_EXT.test(base)) return true;
    if (/^(dockerfile|makefile|license|readme|contributing|changelog|gemfile|rakefile|vagrantfile)$/i.test(base)) {
        return true;
    }
    if (/^\.env/i.test(base)) return true;
    return false;
}

/**
 * Bounded multi-file snapshot of the opened project (IDE-only). Skips binaries and heavy dirs.
 */
export async function collectWorkspaceFilesPack(
    workspaceRoot: string,
    activeFile: string,
): Promise<string> {
    const root = workspaceRoot.trim();
    if (!root || root === "browser-workspace") return "";
    const api = window.skiaElectron;
    if (!api?.readDirectoryTree || !api.readFileText) return "";

    let tree: SkiaDirectoryNode[];
    try {
        tree = await api.readDirectoryTree(root);
    } catch {
        return "";
    }

    const all = flattenFilePaths(tree).filter(shouldIndexFile);
    all.sort((a, b) => {
        if (a === activeFile) return -1;
        if (b === activeFile) return 1;
        return a.localeCompare(b);
    });

    const parts: string[] = [];
    let total = 0;
    let fileCount = 0;

    for (const fp of all) {
        if (fileCount >= MAX_WORKSPACE_FILES || total >= MAX_WORKSPACE_PACK_CHARS) break;
        try {
            let text = await api.readFileText(fp);
            if (text.length > 0 && /\0/.test(text.slice(0, 4096))) continue;
            if (text.length > MAX_FILE_READ_CHARS) {
                text = `${text.slice(0, MAX_FILE_READ_CHARS)}\n...[file truncated]\n`;
            }
            const rel = fp.replace(/\\/g, "/");
            const header = `### FILE: ${rel}\n\`\`\`\n`;
            const footer = `\n\`\`\`\n`;
            const block = header + text + footer;
            if (total + block.length > MAX_WORKSPACE_PACK_CHARS) {
                const room = MAX_WORKSPACE_PACK_CHARS - total - header.length - footer.length - 80;
                if (room < 200) break;
                const slice = text.slice(0, room) + "\n...[truncated to workspace budget]\n";
                parts.push(header + slice + footer);
                total += header.length + slice.length + footer.length;
                fileCount += 1;
                break;
            }
            parts.push(block);
            total += block.length;
            fileCount += 1;
        } catch {
            // skip unreadable
        }
    }

    if (!parts.length) {
        return "";
    }

    return [
        "### WORKSPACE_FILES_SNAPSHOT",
        "Bounded read of project files on disk. Prefer `active_file_path` and the active editor buffer for the user’s current focus; use this snapshot for cross-file reasoning and refactors.",
        "",
        ...parts,
        "### END_WORKSPACE_FILES_SNAPSHOT",
        "",
    ].join("\n");
}

/**
 * Bundles workspace tree snapshot, Monaco buffer, selection, and paths so SKIA reasons over real IDE state.
 * Only the last user turn is wrapped; earlier turns stay verbatim.
 */
export async function buildIdeBrainEnvelope(userMessage: string): Promise<string> {
    const workspace = getWorkspacePath().trim() || "(no workspace folder recorded — use Open Project)";
    const activeFile = getActiveFile().trim() || "(no file open)";
    const workspacePack = await collectWorkspaceFilesPack(workspace, activeFile);

    const editor = getEditor() as MinimalEditor | null;

    let language = "";
    let buffer = "";
    let selection = "";

    if (editor && typeof editor.getValue === "function") {
        buffer = editor.getValue() ?? "";
        const model = typeof editor.getModel === "function" ? editor.getModel() : null;
        if (model && typeof model.getLanguageId === "function") {
            language = model.getLanguageId() ?? "";
        }
        if (typeof editor.getSelection === "function") {
            const range = editor.getSelection();
            if (
                range &&
                typeof range.isEmpty === "function" &&
                !range.isEmpty() &&
                model &&
                typeof model.getValueInRange === "function"
            ) {
                const selText = model.getValueInRange(range);
                selection =
                    selText.length > MAX_SELECTION_CHARS
                        ? `${selText.slice(0, MAX_SELECTION_CHARS)}\n...[selection truncated]`
                        : selText;
            }
        }
    }

    if (buffer.length > MAX_BUFFER_CHARS) {
        buffer = `${buffer.slice(0, MAX_BUFFER_CHARS)}\n...[active buffer truncated — cite paths or ask for smaller scopes if needed]`;
    }

    const fenceLang = language || "text";
    const langLine = language ? `active_buffer_language_id: ${language}\n\n` : "";
    const selBlock = selection
        ? `current_selection:\n\`\`\`${fenceLang}\n${selection}\n\`\`\`\n\n`
        : "(no non-empty selection)\n\n";
    const bufBlock = buffer
        ? `active_editor_buffer:\n\`\`\`${fenceLang}\n${buffer}\n\`\`\`\n\n`
        : "### active_editor_buffer\n(empty)\n\n";

    const snapshotBlock = workspacePack
        ? `${workspacePack}\n`
        : "### WORKSPACE_FILES_SNAPSHOT\n(no indexed text files in budget, or workspace not opened)\n\n";

    return (
        "### SKIA_FORGE_IDE_LIVE_CONTEXT\n" +
        "You are assisting inside the SKIA Forge desktop IDE. Treat paths and file contents below as live workspace truth for coding, refactors, debugging, and reasoning.\n\n" +
        `workspace_root: ${workspace}\n` +
        `active_file_path: ${activeFile}\n\n` +
        snapshotBlock +
        langLine +
        selBlock +
        bufBlock +
        "### END_SKIA_FORGE_IDE_LIVE_CONTEXT\n\n" +
        "### USER_MESSAGE\n\n" +
        userMessage.trim()
    );
}

export async function applyIdeBrainToMessagesPayload(
    messages: Array<{ role: string; content: string }>,
): Promise<Array<{ role: string; content: string }>> {
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
            lastUserIdx = i;
            break;
        }
    }
    if (lastUserIdx < 0) {
        return messages;
    }
    const wrapped = await buildIdeBrainEnvelope(messages[lastUserIdx].content);
    return messages.map((m, i) =>
        i === lastUserIdx ? { role: m.role, content: wrapped } : { ...m },
    );
}
