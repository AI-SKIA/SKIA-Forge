const DESTRUCTIVE_PATTERNS = [
  /\brm\b/i,
  /\bdel\b/i,
  /\bformat\b/i,
  /\bshutdown\b/i,
  /\bdrop\b/i,
  /\btruncate\b/i
];

export function evaluateCommandSafety(command: string): {
  allowed: boolean;
  approvalRequired: boolean;
  reason: string;
} {
  const trimmed = command.trim();
  if (!trimmed) {
    return {
      allowed: false,
      approvalRequired: false,
      reason: "Command is empty."
    };
  }

  for (const pattern of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: false,
        approvalRequired: true,
        reason: "Destructive command detected. Explicit approval required."
      };
    }
  }

  return {
    allowed: true,
    approvalRequired: false,
    reason: "Command allowed."
  };
}
