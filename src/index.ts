import { run } from './cli.js';

try {
  process.exitCode = await run({
    argv: process.argv.slice(2),
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
    interactive: process.stdin.isTTY === true,
  });
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Unexpected error: ${message}\n`);
  process.exitCode = 1;
}
