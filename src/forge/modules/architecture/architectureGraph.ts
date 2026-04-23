import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { extractImportSpecifiers } from "../skiarules/importExtract.js";

const pexec = promisify(exec);

export type ArchitectureEdgeV1 = {
  from: string;
  to: string;
};

export type ArchitectureNodeV1 = {
  module: string;
  importCount: number;
  couplingScore: number;
  changeFrequency: number;
};

export type ArchitectureGraphV1 = {
  generatedAt: string;
  nodes: ArchitectureNodeV1[];
  edges: ArchitectureEdgeV1[];
};

function resolveRelativeImport(relPath: string, spec: string): string | null {
  if (!spec.startsWith(".")) {
    return null;
  }
  const base = path.posix.dirname(relPath);
  return path.posix.normalize(path.posix.join(base, spec));
}

async function getChangeFrequency(projectRoot: string, relPath: string): Promise<number> {
  try {
    const { stdout } = await pexec(`git log --pretty=format: --name-only -- "${relPath}"`, {
      cwd: projectRoot,
      windowsHide: true,
      timeout: 15_000
    });
    return stdout
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter((x) => x === relPath).length;
  } catch {
    return 0;
  }
}

export async function buildArchitectureGraph(
  projectRoot: string,
  structurePaths: string[]
): Promise<ArchitectureGraphV1> {
  const edges: ArchitectureEdgeV1[] = [];
  const byModule = new Map<string, { importCount: number }>();
  for (const rel of structurePaths) {
    const abs = path.join(projectRoot, rel);
    let content: string;
    try {
      content = await fs.readFile(abs, "utf8");
    } catch {
      continue;
    }
    const imports = extractImportSpecifiers(content);
    byModule.set(rel, { importCount: imports.length });
    for (const spec of imports) {
      const target = resolveRelativeImport(rel, spec);
      if (target) {
        edges.push({ from: rel, to: target });
      }
    }
  }
  const nodes: ArchitectureNodeV1[] = [];
  for (const [module, meta] of byModule) {
    const outgoing = edges.filter((x) => x.from === module).length;
    const incoming = edges.filter((x) => x.to === module).length;
    const changeFrequency = await getChangeFrequency(projectRoot, module);
    nodes.push({
      module,
      importCount: meta.importCount,
      couplingScore: Number((outgoing * 0.6 + incoming * 0.4).toFixed(3)),
      changeFrequency
    });
  }
  return {
    generatedAt: new Date().toISOString(),
    nodes: nodes.sort((a, b) => b.couplingScore - a.couplingScore),
    edges
  };
}

