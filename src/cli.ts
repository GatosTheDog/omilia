import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import { isTruncated, renderTable, truncationNotice } from './format.js';
import type { TableRow, Verdict } from './format.js';
import { countInterpretations, firstInterpretations } from './interpret.js';
import { concatenate, formatParseError, parseTokens } from './parse.js';
import { isValidGreekPhone } from './validate.js';

export const PROMPT = 'Enter a number sequence: ';

// Fixed display cap, exported so tests import it; not configurable (no flag, no environment variable).
export const MAX_ROWS = 1000;

export interface CliIO {
  argv: readonly string[];
  stdin: Readable;
  stdout: Writable;
  stderr: Writable;
  /** True only when stdin is a TTY; supplied by the entry point. */
  interactive: boolean;
}

// One validator feeds the Phone number line and every table row.
function verdictOf(s: string): Verdict {
  return isValidGreekPhone(s) ? 'VALID' : 'INVALID';
}

function handle(input: string, io: CliIO): boolean {
  const result = parseTokens(input);
  if (!result.ok) {
    io.stderr.write(`${formatParseError(result.error)}\n`);
    return false;
  }
  const digits = concatenate(result.tokens);
  const lines = [`Identified number: ${digits}`, `Phone number: ${verdictOf(digits)}`];
  // Exact total without enumerating; the table appears only when more than one interpretation exists.
  const total = countInterpretations(result.tokens);
  if (total > 1n) {
    const rows: TableRow[] = firstInterpretations(result.tokens, MAX_ROWS).map((output) => ({
      output,
      verdict: verdictOf(output),
    }));
    lines.push('', renderTable(rows));
    if (isTruncated(total, MAX_ROWS)) {
      lines.push(truncationNotice(rows.length, total));
    }
  }
  // One write of the whole text: a late failure cannot leave a half-written result.
  io.stdout.write(`${lines.join('\n')}\n`);
  // An INVALID number is still a successful run: only rejected input returns false.
  return true;
}

async function readAll(stdin: Readable): Promise<string> {
  stdin.setEncoding('utf8');
  let text = '';
  for await (const chunk of stdin) {
    text += chunk;
  }
  return text;
}

/** Prompts until one valid line is entered (0), or input ends (1). */
async function promptLoop(io: CliIO): Promise<number> {
  const rl = createInterface({ input: io.stdin, output: io.stdout });
  // On Ctrl+C close the interface so the loop below ends like EOF.
  rl.on('SIGINT', () => {
    rl.close();
  });
  rl.setPrompt(PROMPT);
  rl.prompt();
  for await (const line of rl) {
    if (handle(line, io)) {
      rl.close();
      return 0;
    }
    rl.prompt();
  }
  // Stream end, Ctrl+D or Ctrl+C: finish the prompt line quietly.
  io.stdout.write('\n');
  return 1;
}

/** Runs the CLI against injected streams and returns the exit code. */
export async function run(io: CliIO): Promise<number> {
  if (io.argv.length > 0) {
    return handle(io.argv.join(' '), io) ? 0 : 1;
  }
  if (!io.interactive) {
    return handle(await readAll(io.stdin), io) ? 0 : 1;
  }
  return promptLoop(io);
}
