import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import { isTruncated, renderTable, truncationNotice } from './format.js';
import type { TableRow, Verdict } from './format.js';
import { countInterpretations, firstInterpretations } from './interpret.js';
import { concatenate, formatParseError, parseTokens } from './parse.js';
import { isValidGreekPhone } from './validate.js';

export const PROMPT = 'Enter a number sequence: ';

export const MAX_ROWS = 1000;

export interface CliIO {
  argv: readonly string[];
  stdin: Readable;
  stdout: Writable;
  stderr: Writable;
  interactive: boolean;
}

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
  io.stdout.write(`${lines.join('\n')}\n`);
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

async function promptLoop(io: CliIO): Promise<number> {
  const rl = createInterface({ input: io.stdin, output: io.stdout });
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
  io.stdout.write('\n');
  return 1;
}

export async function run(io: CliIO): Promise<number> {
  if (io.argv.length > 0) {
    return handle(io.argv.join(' '), io) ? 0 : 1;
  }
  if (!io.interactive) {
    return handle(await readAll(io.stdin), io) ? 0 : 1;
  }
  return promptLoop(io);
}
