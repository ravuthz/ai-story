import { delimiter, dirname, isAbsolute } from "node:path";

export interface CliRunOptions {
  cwd?: string;
  stdin?: string;
  timeoutMs: number;
  env?: Record<string, string>;
  /** Folders added to PATH after the executable's own folder. */
  extraPath?: string[];
}

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class CliError extends Error {
  constructor(message: string, readonly result?: CliResult) {
    super(message);
  }
}

/** Thin wrapper over Bun.spawn with timeout and non-zero exit handling. */
export class CliRunner {
  /** Absolute path of the executable, or null if it can't be found / isn't executable. */
  static resolve(command: string): string | null {
    return Bun.which(command);
  }

  static async which(command: string): Promise<boolean> {
    return CliRunner.resolve(command) !== null;
  }

  /**
   * Puts the executable's own folder first on PATH, so CLIs configured by absolute
   * path still find their siblings (e.g. omp's `#!/usr/bin/env bun` in ~/.bun/bin).
   */
  private static pathFor(command: string, extra: string[] = []): string {
    const resolved = CliRunner.resolve(command) ?? (isAbsolute(command) ? command : null);
    const dirs = [resolved && dirname(resolved), ...extra, ...(process.env.PATH ?? "").split(delimiter)];
    return [...new Set(dirs.filter(Boolean))].join(delimiter);
  }

  static async run(command: string, args: string[], options: CliRunOptions): Promise<CliResult> {
    const proc = Bun.spawn([command, ...args], {
      cwd: options.cwd,
      env: { ...process.env, PATH: CliRunner.pathFor(command, options.extraPath), ...options.env },
      stdin: options.stdin !== undefined ? new TextEncoder().encode(options.stdin) : "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    const timer = setTimeout(() => proc.kill(), options.timeoutMs);
    try {
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      const result = { stdout, stderr, exitCode };
      if (proc.signalCode) throw new CliError(`${command} timed out after ${options.timeoutMs}ms`, result);
      if (exitCode !== 0) throw new CliError(`${command} exited with ${exitCode}: ${stderr.slice(-800) || stdout.slice(-800)}`, result);
      return result;
    } finally {
      clearTimeout(timer);
    }
  }
}
