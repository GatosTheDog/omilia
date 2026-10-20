import { beforeAll, describe, expect, test } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { MAX_ROWS } from '../src/cli.js';
import { EDGE_CASES, REJECTED } from './fixtures/edge-cases.js';
import type { EdgeCase } from './fixtures/edge-cases.js';

const entry = fileURLToPath(new URL('../dist/index.js', import.meta.url));

// A 5000-token run prints about 10 MB; the default 1 MiB buffer would fail with ENOBUFS.
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;
// Jest cannot interrupt a blocking spawnSync, so the child needs its own hard limit.
const SPAWN_HARD_LIMIT_MS = 20_000;

beforeAll(() => {
  if (!existsSync(entry)) {
    throw new Error('dist/index.js is missing: run `npm test` (it builds first) or `npm run build`.');
  }
});

// Always pass `input` (even '') so stdin closes and no test can hang.
function runCli(args: string[], input = '') {
  return spawnSync(process.execPath, [entry, ...args], {
    input,
    encoding: 'utf8',
    maxBuffer: MAX_OUTPUT_BYTES,
    timeout: SPAWN_HARD_LIMIT_MS,
  });
}

const NO_STACK = /\n\s+at /;

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

const OUT_EX3 = fixture([
  'Identified number: 0030697002413502',
  'Phone number: INVALID',
  '',
  'Interpretation  Output             Phone number',
  '1               0030697002413502   INVALID',
  '2               003069700241352    INVALID',
  '3               0030697241352      INVALID',
  '4               00306972413502     VALID',
  '5               003060972413502    INVALID',
  '6               00306097241352     INVALID',
  '7               0030609700241352   INVALID',
  '8               00306097002413502  INVALID',
]);

const OUT_30_6 = fixture([
  'Identified number: 306',
  'Phone number: INVALID',
  '',
  'Interpretation  Output  Phone number',
  '1               306     INVALID',
  '2               36      INVALID',
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

// Structural check of a truncated run: head lines, header, MAX_ROWS numbered rows, then the notice.
function expectTruncatedRun(
  stdout: string,
  plain: string,
  verdict: 'VALID' | 'INVALID',
  total: bigint,
): string[] {
  expect(stdout.endsWith('\n')).toBe(true);
  const lines = stdout.split('\n');
  lines.pop();
  expect(lines).toHaveLength(4 + MAX_ROWS + 1);
  expect(lines.slice(0, 2).join('\n') + '\n').toBe(identified(plain, verdict));
  expect(lines[2]).toBe('');
  const header = lines[3] ?? '';
  expect(header.startsWith('Interpretation  Output')).toBe(true);
  expect(header.endsWith('Phone number')).toBe(true);
  const outputs: string[] = [];
  for (let i = 0; i < MAX_ROWS; i += 1) {
    const row = lines[4 + i] ?? '';
    expect(row).toMatch(/^\d+ +\d+ +(VALID|INVALID)$/);
    const fields = row.split(/ +/);
    expect(fields[0]).toBe(String(i + 1));
    outputs.push(fields[1] ?? '');
  }
  expect(lines[4 + MAX_ROWS]).toBe(
    `Showing first ${MAX_ROWS} of ${total} interpretations (list truncated).`,
  );
  expect(new Set(outputs).size).toBe(MAX_ROWS);
  expect(outputs[0]).toBe(plain);
  return outputs;
}

// Exact-row check of a shared-fixture run: the two identified lines, then (only when more than
// one interpretation exists) a blank line, the header and exactly the fixture rows.
function expectFixtureRows(stdout: string, c: EdgeCase): void {
  expect(stdout.endsWith('\n')).toBe(true);
  const lines = stdout.split('\n');
  lines.pop();
  expect(lines.slice(0, 2).join('\n') + '\n').toBe(identified(c.plain, c.verdict));
  if (c.rows.length === 1) {
    expect(lines).toHaveLength(2);
    expect(stdout).not.toContain('Interpretation');
    return;
  }
  expect(lines[2]).toBe('');
  const header = lines[3] ?? '';
  expect(header.startsWith('Interpretation  Output')).toBe(true);
  expect(header.endsWith('Phone number')).toBe(true);
  const rows = lines.slice(4);
  expect(rows).toHaveLength(c.rows.length);
  rows.forEach((row, i) => {
    expect(row.split(/ +/)).toEqual([String(i + 1), c.rows[i]?.[0], c.rows[i]?.[1]]);
  });
}

describe('CLI success cases', () => {
  const cases: Array<[string, string[], string, string]> = [
    ['leading zeros kept', ['0', '0', '30'], '', identified('0030', 'INVALID')],
    ['single one-digit token', ['5'], '', identified('5', 'INVALID')],
    ['leading zeros in 3-digit token', ['007', '6', '6'], '', identified('00766', 'INVALID')],
    [
      'beyond MAX_SAFE_INTEGER stays a string',
      ['999', '999', '999', '999', '999', '999'],
      '',
      identified('999999999999999999', 'INVALID'),
    ],
    ['6 6 4', ['6', '6', '4'], '', identified('664', 'INVALID')],
    [
      '14-digit number with prefix 00302 is VALID',
      ['0', '0', '302', '123', '456', '789'],
      '',
      identified('00302123456789', 'VALID'),
    ],
    ['single digit 2 is INVALID', ['2'], '', identified('2', 'INVALID')],
  ];

  test.each(cases)('%s', (_name, args, input, expected) => {
    const r = runCli(args, input);
    expect(r.stdout).toBe(expected);
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
  });
});

describe('CLI ambiguous cases', () => {
  const exact: Array<[string, string[], string, string]> = [
    ['30 6 gives both 306 and 36', ['30', '6'], '', OUT_30_6],
    ['spec example 1: 10 6 never gives 16', ['2', '10', '6', '9', '30', '6', '6', '4'], '', OUT_EX1],
    [
      'spec example 2: 10-digit number is VALID plus three more readings',
      ['2', '10', '69', '30', '6', '6', '4'],
      '',
      OUT_EX2,
    ],
    [
      'advanced example 3: 8 interpretations, rows 1, 2, 4 and 6 as in the assignment',
      ['0', '0', '30', '69', '700', '24', '1', '3', '50', '2'],
      '',
      OUT_EX3,
    ],
    ['piped spec example 2', [], '2 10 69 30 6 6 4\n', OUT_EX2],
  ];

  test.each(exact)('%s', (_name, args, input, expected) => {
    const r = runCli(args, input);
    expect(r.stdout).toBe(expected);
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    expect(r.stdout).not.toMatch(NO_STACK);
  });

  const structural: Array<[string, string[], string, string, 'VALID' | 'INVALID', number]> = [
    ['space-separated args', ['30', '2', '5', '58'], '', '302558', 'INVALID', 4],
    ['single argument with whitespace runs', ['30   2 5  58'], '', '302558', 'INVALID', 4],
    ['piped tab/space input', [], '30\t2 5  58\n', '302558', 'INVALID', 4],
    ['order preserved', ['58', '5', '2', '30'], '', '585230', 'INVALID', 2],
    [
      'spec example 3: 11-digit plain number is INVALID',
      ['2', '10', '69', '30', '6', '60', '4'],
      '',
      '21069306604',
      'INVALID',
      8,
    ],
    [
      'spec example 4: 14-digit number is VALID and keeps leading zeros',
      ['0', '0', '30', '69', '74', '0', '9', '22', '52'],
      '',
      '00306974092252',
      'VALID',
      16,
    ],
    ['10-digit number with prefix 69 is VALID', ['69', '12', '34', '56', '78'], '', '6912345678', 'VALID', 16],
    [
      '10-digit number with prefix 00 is INVALID',
      ['0', '0', '30', '69', '74', '0', '9'],
      '',
      '0030697409',
      'INVALID',
      4,
    ],
    [
      '14-digit number with prefix 003070 is INVALID',
      ['0', '0', '30', '70', '74', '0', '9', '22', '52'],
      '',
      '00307074092252',
      'INVALID',
      8,
    ],
    ['hundreds merge: 700 24 has two readings', ['700', '24'], '', '70024', 'INVALID', 2],
    ['no chained merge: 700 20 5 has three readings', ['700', '20', '5'], '', '700205', 'INVALID', 3],
  ];

  test.each(structural)('%s', (_name, args, input, plain, verdict, rowCount) => {
    const r = runCli(args, input);
    expectAmbiguousRun(r.stdout, plain, verdict, rowCount);
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    expect(r.stdout).not.toMatch(NO_STACK);
  });
});

describe('CLI rejection cases', () => {
  const cases: Array<[string, string[], string, string]> = [
    ['4-digit token', ['1234'], '', 'Invalid token "1234": must be 1–3 digits.\n'],
    ['non-digit token after valid one', ['12', 'abc'], '', 'Invalid token "abc": digits only.\n'],
    ['non-digit check before length check', ['abcd'], '', 'Invalid token "abcd": digits only.\n'],
    ['negative sign', ['-5'], '', 'Invalid token "-5": digits only.\n'],
    ['decimal point', ['1.5'], '', 'Invalid token "1.5": digits only.\n'],
    ['plus sign', ['+3'], '', 'Invalid token "+3": digits only.\n'],
    [
      'fullwidth digits',
      ['１２'],
      '',
      'Invalid token "１２": digits only.\n',
    ],
    ['Arabic-Indic digit', ['٣'], '', 'Invalid token "٣": digits only.\n'],
    ['empty piped input', [], '', 'Please enter at least one number.\n'],
    ['whitespace-only piped input', [], '   \n\t', 'Please enter at least one number.\n'],
    [
      'control character is escaped, not echoed raw',
      ['\u001b[31mX'],
      '',
      'Invalid token "\\u001b[31mX": digits only.\n',
    ],
  ];

  test.each(cases)('%s', (_name, args, input, expected) => {
    const r = runCli(args, input);
    expect(r.stdout).toBe('');
    expect(r.stderr).toBe(expected);
    expect(r.stderr).not.toMatch(NO_STACK);
    expect(r.stderr).not.toContain('\u001b');
    expect(r.status).toBe(1);
  });
});

describe('CLI long input is bounded', () => {
  test('40 copies of 69 (2^40 interpretations) answer promptly with MAX_ROWS rows and the notice', () => {
    const started = performance.now();
    const r = runCli(Array<string>(40).fill('69'));
    const elapsed = performance.now() - started;
    expect(r.error).toBeUndefined();
    expect(r.status).toBe(0);
    expect(r.stderr).toBe('');
    expect(r.stdout).not.toMatch(NO_STACK);
    expect(elapsed).toBeLessThan(5000);
    const outputs = expectTruncatedRun(r.stdout, '69'.repeat(40), 'INVALID', 2n ** 40n);
    expect(outputs[1]).toBe('69'.repeat(39) + '609');
  }, 30000);

  test('5000 copies of 69 piped on stdin answer promptly with MAX_ROWS rows and an exact 2^5000 total', () => {
    const input = Array<string>(5000).fill('69').join(' ') + '\n';
    const started = performance.now();
    const r = runCli([], input);
    const elapsed = performance.now() - started;
    expect(r.error).toBeUndefined();
    expect(r.status).toBe(0);
    expect(r.stderr).toBe('');
    expect(r.stdout).not.toMatch(NO_STACK);
    expect(elapsed).toBeLessThan(5000);
    const outputs = expectTruncatedRun(r.stdout, '69'.repeat(5000), 'INVALID', 2n ** 5000n);
    expect(outputs[0]).toHaveLength(10000);
  }, 30000);

  test('boundary: 9 copies of 69 give 512 rows and no notice', () => {
    const r = runCli(Array<string>(9).fill('69'));
    expect(r.error).toBeUndefined();
    expect(r.status).toBe(0);
    expect(r.stderr).toBe('');
    expect(r.stdout).not.toMatch(NO_STACK);
    expectAmbiguousRun(r.stdout, '69'.repeat(9), 'INVALID', 512);
    expect(r.stdout).not.toContain('truncated');
  }, 30000);

  test('boundary: 10 copies of 69 give 1024 interpretations, MAX_ROWS rows and the notice of 1024', () => {
    const r = runCli(Array<string>(10).fill('69'));
    expect(r.error).toBeUndefined();
    expect(r.status).toBe(0);
    expect(r.stderr).toBe('');
    expect(r.stdout).not.toMatch(NO_STACK);
    expectTruncatedRun(r.stdout, '69'.repeat(10), 'INVALID', 1024n);
  }, 30000);

  test('5000 unambiguous tokens print the two identified lines and no table', () => {
    const input = Array<string>(5000).fill('1').join(' ') + '\n';
    const r = runCli([], input);
    expect(r.error).toBeUndefined();
    expect(r.status).toBe(0);
    expect(r.stderr).toBe('');
    expect(r.stdout).not.toMatch(NO_STACK);
    expect(r.stdout).toBe(identified('1'.repeat(5000), 'INVALID'));
  }, 30000);
});

describe('CLI edge cases (shared fixture)', () => {
  const runs = EDGE_CASES.flatMap((c) =>
    (['stdin', 'argv'] as const).map((transport) => [`${c.name} [${c.input}] via ${transport}`, c, transport] as const),
  );

  test.each(runs)('%s', (_label, c, transport) => {
    const r = transport === 'stdin' ? runCli([], c.input + '\n') : runCli(c.input.split(' '));
    expect(r.error).toBeUndefined();
    expect(r.status).toBe(0);
    expect(r.stderr).toBe('');
    expect(r.stdout).not.toMatch(NO_STACK);
    expectFixtureRows(r.stdout, c);
  });
});

describe('CLI edge cases: rejected inputs (shared fixture)', () => {
  test.each(REJECTED.map((c) => [c.name, c.input, c.stderr] as const))('%s', (_name, input, stderr) => {
    const r = runCli([], input + '\n');
    expect(r.stdout).toBe('');
    expect(r.stderr).toBe(stderr + '\n');
    expect(r.stderr).not.toMatch(NO_STACK);
    expect(r.stderr).not.toContain('\u001b');
    expect(r.status).toBe(1);
  });
});
