import fs from 'node:fs/promises';
import path from 'node:path';

export type SecurityFinding = {
  type: 'hardcoded-secrets' | 'sql-injection' | 'xss' | 'unsafe-eval' | 'insecure-deserialization' | 'ssrf';
  severity: 'low' | 'medium' | 'high';
  message: string;
  file?: string;
  line?: number;
};

export type SecurityReport = { file: string; findings: SecurityFinding[] };
export type SecuritySummary = { totalFiles: number; findings: SecurityFinding[] };
export type CodeFix = { patchHint: string };

const FILE_TYPES = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.json', '.yaml', '.yml']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next']);

export class SecurityAnalysisService {
  async scan(file: string): Promise<SecurityReport> {
    let content = '';
    try {
      content = await fs.readFile(file, 'utf8');
    } catch {
      return { file, findings: [] };
    }
    const findings = this.detectFindings(content, file);
    return {
      file,
      findings,
    };
  }

  async scan_repo(rootPath: string): Promise<SecuritySummary> {
    const files = await this.listFiles(rootPath);
    const reports = await Promise.all(files.map((file) => this.scan(file)));
    const findings = reports
      .flatMap((r) => r.findings)
      .sort((a, b) => this.rankSeverity(b.severity) - this.rankSeverity(a.severity));
    return { totalFiles: files.length, findings };
  }

  async autofix(finding: SecurityFinding): Promise<CodeFix> {
    const suggestions: Record<SecurityFinding['type'], string> = {
      'hardcoded-secrets': 'Move secret to env var and replace literal with process.env access.',
      'sql-injection': 'Use parameterized queries; never concatenate user input into SQL.',
      xss: 'Escape untrusted HTML or render as text; apply a safe sanitizer.',
      'unsafe-eval': 'Replace eval/new Function with explicit parser or whitelist dispatcher.',
      'insecure-deserialization': 'Use strict schema validation before deserializing payloads.',
      ssrf: 'Validate outbound URLs against allow-list and block internal/private ranges.',
    };
    return { patchHint: `${suggestions[finding.type]} (${finding.message})` };
  }

  async scan_on_save(file: string): Promise<SecurityReport> {
    return this.scan(file);
  }

  private detectFindings(content: string, file: string): SecurityFinding[] {
    const lines = content.split(/\r?\n/);
    const out: SecurityFinding[] = [];
    const push = (type: SecurityFinding['type'], severity: SecurityFinding['severity'], line: number, message: string) => {
      out.push({ type, severity, line, message, file });
    };
    lines.forEach((lineText, idx) => {
      const line = idx + 1;
      if (/(api[_-]?key|secret|token|password)\s*[:=]\s*["'][^"']{8,}["']/i.test(lineText)) {
        push('hardcoded-secrets', 'high', line, 'Potential hardcoded secret detected.');
      }
      if (/(SELECT|INSERT|UPDATE|DELETE).*\+.*(req\.|input|params|query)/i.test(lineText)) {
        push('sql-injection', 'high', line, 'Potential SQL injection string concatenation.');
      }
      if (/innerHTML\s*=\s*.*(req\.|input|params|query|location)/i.test(lineText)) {
        push('xss', 'high', line, 'Untrusted data assigned to innerHTML.');
      }
      if (/\beval\s*\(|new Function\s*\(/.test(lineText)) {
        push('unsafe-eval', 'high', line, 'Unsafe dynamic code execution.');
      }
      if (/JSON\.parse\(.+\)|yaml\.load\(.+\)|deserialize\(.+\)/i.test(lineText) && /req\.|input|payload/i.test(lineText)) {
        push('insecure-deserialization', 'medium', line, 'Potential insecure deserialization path.');
      }
      if (/fetch\(.+(req\.|input|query|url)/i.test(lineText) && !/allow|trusted|whitelist/i.test(lineText)) {
        push('ssrf', 'medium', line, 'Potential SSRF through unvalidated outbound URL.');
      }
    });
    return out;
  }

  private async listFiles(rootPath: string): Promise<string[]> {
    const out: string[] = [];
    const walk = async (dir: string) => {
      let entries: Array<{ name: string; isDirectory: () => boolean }>;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true }) as Array<{ name: string; isDirectory: () => boolean }>;
      } catch {
        return;
      }
      await Promise.all(
        entries.map(async (entry) => {
          if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) return;
            await walk(path.join(dir, entry.name));
            return;
          }
          const full = path.join(dir, entry.name);
          if (FILE_TYPES.has(path.extname(entry.name).toLowerCase())) out.push(full);
        })
      );
    };
    await walk(rootPath);
    return out;
  }

  private rankSeverity(severity: SecurityFinding['severity']): number {
    return severity === 'high' ? 3 : severity === 'medium' ? 2 : 1;
  }
}

export const securityAnalysisService = new SecurityAnalysisService();
