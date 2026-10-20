import { describe, expect, test } from '@jest/globals';
import { PassThrough, Writable } from 'node:stream';
import { MAX_ROWS, PROMPT, run } from '../src/cli.js';
import type { CliIO } from '../src/cli.js';

// In-process harness: every stream is injected, nothing touches the real process.
function harness(interactive: boolean, argv: string[] = []) {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let out = '';
  let err = '';
  stdout.on('data', (chunk: Buffer) => {
    out += chunk.toString('utf8');
  });
  stderr.on('data', (chunk: Buffer) => {
    err += chunk.toString('utf8');
  });
  const io: CliIO = { argv, stdin, stdout, stderr, interactive };
  return {
    stdin,
    io,
    get out() {
      return out;
    },
    get err() {
      return err;
    },
  };
}

const NO_STACK = /\n\s+at /;
const TIMEOUT = 2000;

// Two-line stdout of a successful run: identified number, then the verdict.
function identified(n: string, verdict: 'VALID' | 'INVALID'): string {
  return `Identified number: ${n}\nPhone number: ${verdict}\n`;
}

function fixture(lines: string[]): string {
  return lines.join('\n') + '\n';
}

const OUT_EX1 = fixture([
  'Identified number: 2106930664',
  'Phone number: VALID',
  '',
  'Interpretation  Output      Phone number',
  '1               2106930664  VALID',
  '2               210693664   INVALID',
]);

const OUT_EX2 = fixture([
  'Identified number: 2106930664',
  'Phone number: VALID',
  '',
  'Interpretation  Output       Phone number',
  '1               2106930664   VALID',
  '2               210693664    INVALID',
  '3               2106093664   VALID',
  '4               21060930664  INVALID',
]);

const OUT_30_2 = fixture([
  'Identified number: 302',
  'Phone number: INVALID',
  '',
  'Interpretation  Output  Phone number',
  '1               302     INVALID',
  '2               32      INVALID',
]);

const OUT_30_2_5_58 = fixture([
  'Identified number: 302558',
  'Phone number: INVALID',
  '',
  'Interpretation  Output   Phone number',
  '1               302558   INVALID',
  '2               3025508  INVALID',
  '3               325508   INVALID',
  '4               32558    INVALID',
]);

// Structural check of an ambiguous run: head lines, empty separator, header, numbered rows.
function expectAmbiguousRun(
  stdout: string,
  plain: string,
  verdict: 'VALID' | 'INVALID',
  rowCount: number,
): void {
  expect(stdout.endsWith('\n')).toBe(true);
  const lines = stdout.split('\n');
  lines.pop();
  expect(lines.slice(0, 2).join('\n') + '\n').toBe(identified(plain, verdict));
  expect(lines[2]).toBe('');
  const header = lines[3] ?? '';
  expect(header.startsWith('Interpretation  Output')).toBe(true);
  expect(header.endsWith('Phone number')).toBe(true);
  const rows = lines.slice(4);
  expect(rows).toHaveLength(rowCount);
  rows.forEach((row, i) => {
    expect(row).toMatch(/^\d+ +\d+ +(VALID|INVALID)$/);
    const fields = row.split(/ +/);
    expect(fields[0]).toBe(String(i + 1));
    if (i === 0) {
      expect(fields[1]).toBe(plain);
      expect(fields[2]).toBe(verdict);
    }
  });
}

describe('interactive prompt loop', () => {
  test('prints the exact prompt then the identified number', async () => {
    const h = harness(true);
    h.stdin.write('30 2 5 58\n');
    const code = await run(h.io);
    expect(code).toBe(0);
    expect(h.out).toBe(PROMPT + OUT_30_2_5_58);
    expect(h.err).toBe('');
  }, TIMEOUT);

  test('example 1 at the prompt prints exactly two interpretations', async () => {
    const h = harness(true);
    h.stdin.write('2 10 6 9 30 6 6 4\n');
    const code = await run(h.io);
    expect(code).toBe(0);
    expect(h.out).toBe(PROMPT + OUT_EX1);
    expect(h.err).toBe('');
  }, TIMEOUT);

  test('PROMPT text is exact', () => {
    expect(PROMPT).toBe('Enter a number sequence: ');
  }, TIMEOUT);

  test('re-prompts until a valid line', async () => {
    const h = harness(true);
    h.stdin.write('abc\n1234\n\n30 2 5 58\n');
    const code = await run(h.io);
    expect(code).toBe(0);
    expect(h.out).toBe(PROMPT.repeat(4) + OUT_30_2_5_58);
    expect(h.err).toBe(
      'Invalid token "abc": digits only.\n' +
        'Invalid token "1234": must be 1–3 digits.\n' +
        'Please enter at least one number.\n',
    );
  }, TIMEOUT);

  test('EOF after an invalid line exits quietly with 1', async () => {
    const h = harness(true);
    h.stdin.write('abc\n');
    h.stdin.end();
    const code = await run(h.io);
    expect(code).toBe(1);
    expect(h.out).toBe(PROMPT.repeat(2) + '\n');
    expect(h.err).toBe('Invalid token "abc": digits only.\n');
    expect(h.err).not.toMatch(NO_STACK);
  }, TIMEOUT);

  test('EOF on an empty session exits 1', async () => {
    const h = harness(true);
    h.stdin.end();
    const code = await run(h.io);
    expect(code).toBe(1);
    expect(h.out).toBe(PROMPT + '\n');
    expect(h.err).toBe('');
  }, TIMEOUT);

  test('a typed control character is echoed escaped', async () => {
    const h = harness(true);
    h.stdin.write('\u001b[31mX\n30\n');
    const code = await run(h.io);
    expect(code).toBe(0);
    expect(h.err).toBe('Invalid token "\\u001b[31mX": digits only.\n');
    expect(h.err).not.toContain('\u001b');
    expect(h.out).toBe(PROMPT.repeat(2) + identified('30', 'INVALID'));
  }, TIMEOUT);

  test('one-shot: stops after the first valid line', async () => {
    const h = harness(true);
    h.stdin.write('5\n6\n');
    const code = await run(h.io);
    expect(code).toBe(0);
    expect(h.out).toBe(PROMPT + identified('5', 'INVALID'));
  }, TIMEOUT);

  test('an INVALID verdict is a normal answer: exit 0 and no re-prompt', async () => {
    const h = harness(true);
    h.stdin.write('30 2 5 58\n5\n');
    const code = await run(h.io);
    expect(code).toBe(0);
    expect(h.out).toBe(PROMPT + OUT_30_2_5_58);
    expect(h.err).toBe('');
  }, TIMEOUT);

  test('a valid number at the prompt is marked VALID', async () => {
    const h = harness(true);
    h.stdin.write('2 10 69 30 6 6 4\n');
    const code = await run(h.io);
    expect(code).toBe(0);
    expect(h.out).toBe(PROMPT + OUT_EX2);
    expect(h.err).toBe('');
  }, TIMEOUT);
});

describe('mode precedence', () => {
  test('args take precedence over prompting', async () => {
    const h = harness(true, ['30', '2']);
    const code = await run(h.io);
    expect(code).toBe(0);
    expect(h.out).toBe(OUT_30_2);
  }, TIMEOUT);

  test('arguments with the 14-digit example keep leading zeros and are VALID', async () => {
    const h = harness(true, ['0', '0', '30', '69', '74', '0', '9', '22', '52']);
    const code = await run(h.io);
    expect(code).toBe(0);
    expectAmbiguousRun(h.out, '00306974092252', 'VALID', 16);
    expect(h.err).toBe('');
  }, TIMEOUT);

  test('unambiguous input prints only the two lines and no table', async () => {
    const h = harness(true, ['6', '6', '4']);
    const code = await run(h.io);
    expect(code).toBe(0);
    expect(h.out).toBe(identified('664', 'INVALID'));
    expect(h.out).not.toContain('Interpretation');
  }, TIMEOUT);

  test('piped input never prompts', async () => {
    const h = harness(false);
    h.stdin.end('30 2 5 58\n');
    const code = await run(h.io);
    expect(code).toBe(0);
    expect(h.out).toBe(OUT_30_2_5_58);
  }, TIMEOUT);

  test('piped invalid input exits 1 without prompting', async () => {
    const h = harness(false);
    h.stdin.end('12 abc\n');
    const code = await run(h.io);
    expect(code).toBe(1);
    expect(h.out).toBe('');
    expect(h.err).toBe('Invalid token "abc": digits only.\n');
  }, TIMEOUT);
});

// Counts every write to stdout so a test can prove the output is delivered in one piece.
function recordingIo(argv: string[]): { io: CliIO; writes: string[]; err: () => string } {
  const writes: string[] = [];
  let err = '';
  const stdout = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      writes.push(chunk.toString('utf8'));
      callback();
    },
  });
  const stderr = new PassThrough();
  stderr.on('data', (chunk: Buffer) => {
    err += chunk.toString('utf8');
  });
  const io: CliIO = { argv, stdin: new PassThrough(), stdout, stderr, interactive: false };
  return { io, writes, err: () => err };
}

describe('single stdout write', () => {
  test('example 2 is written once', async () => {
    const r = recordingIo(['2', '10', '69', '30', '6', '6', '4']);
    const code = await run(r.io);
    expect(code).toBe(0);
    expect(r.writes).toHaveLength(1);
    expect(r.writes[0]).toBe(OUT_EX2);
  }, TIMEOUT);

  test('6 6 4 is written once', async () => {
    const r = recordingIo(['6', '6', '4']);
    const code = await run(r.io);
    expect(code).toBe(0);
    expect(r.writes).toHaveLength(1);
    expect(r.writes[0]).toBe(identified('664', 'INVALID'));
  }, TIMEOUT);
});

describe('row cap', () => {
  test('MAX_ROWS is 1000', () => {
    expect(MAX_ROWS).toBe(1000);
  });

  test('12 copies of 69 give MAX_ROWS rows and the notice of 4096', async () => {
    const r = recordingIo(Array<string>(12).fill('69'));
    const code = await run(r.io);
    expect(code).toBe(0);
    expect(r.err()).toBe('');
    expect(r.writes).toHaveLength(1);
    const lines = (r.writes[0] ?? '').split('\n');
    expect(lines).toHaveLength(4 + MAX_ROWS + 2);
    expect(lines[lines.length - 1]).toBe('');
    expect(lines[lines.length - 2]).toBe(
      `Showing first ${MAX_ROWS} of 4096 interpretations (list truncated).`,
    );
    expect(lines[3 + MAX_ROWS]?.startsWith(`${MAX_ROWS} `)).toBe(true);
    expect(lines[3]?.startsWith('Interpretation  Output')).toBe(true);
  }, TIMEOUT);
});
