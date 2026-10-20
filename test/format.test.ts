import { describe, expect, test } from '@jest/globals';
import { isTruncated, renderTable, truncationNotice } from '../src/format.js';
import type { TableRow } from '../src/format.js';

const HEADER = 'Interpretation  Output  Phone number';

describe('renderTable', () => {
  test('renders 250000 rows without a stack overflow', () => {
    const rows: TableRow[] = Array.from({ length: 250000 }, () => ({
      output: '1',
      verdict: 'INVALID' as const,
    }));
    let table = '';
    expect(() => {
      table = renderTable(rows);
    }).not.toThrow();
    const lines = table.split('\n');
    expect(lines).toHaveLength(250001);
    expect(lines[250000]?.startsWith('250000')).toBe(true);
  }, 30000);

  test('example 1 rows render the assignment table', () => {
    const rows: TableRow[] = [
      { output: '2106930664', verdict: 'VALID' },
      { output: '210693664', verdict: 'INVALID' },
    ];
    expect(renderTable(rows)).toBe(
      [
        'Interpretation  Output      Phone number',
        '1               2106930664  VALID',
        '2               210693664   INVALID',
      ].join('\n'),
    );
  });

  test('example 2 rows keep their order and are never re-sorted by verdict', () => {
    const rows: TableRow[] = [
      { output: '2106930664', verdict: 'VALID' },
      { output: '210693664', verdict: 'INVALID' },
      { output: '2106093664', verdict: 'VALID' },
      { output: '21060930664', verdict: 'INVALID' },
    ];
    expect(renderTable(rows)).toBe(
      [
        'Interpretation  Output       Phone number',
        '1               2106930664   VALID',
        '2               210693664    INVALID',
        '3               2106093664   VALID',
        '4               21060930664  INVALID',
      ].join('\n'),
    );
  });

  test('an empty row list renders the header alone', () => {
    expect(renderTable([])).toBe(HEADER);
  });

  test('a single row renders two lines', () => {
    expect(renderTable([{ output: '5', verdict: 'INVALID' }])).toBe(
      `${HEADER}\n1${' '.repeat(15)}5${' '.repeat(7)}INVALID`,
    );
  });

  test('a wide output widens the Output column', () => {
    const out = renderTable([{ output: '1'.repeat(20), verdict: 'VALID' }]);
    expect(out.split('\n')[0]).toBe(`Interpretation  Output${' '.repeat(16)}Phone number`);
  });

  test('two-digit row numbers stay left-aligned', () => {
    const rows: TableRow[] = Array.from({ length: 12 }, (_v, i) => ({
      output: `1${i}`,
      verdict: i % 2 === 0 ? 'VALID' : 'INVALID',
    }));
    const lines = renderTable(rows).split('\n');
    expect(lines).toHaveLength(13);
    expect(lines[10]?.startsWith(`10${' '.repeat(14)}`)).toBe(true);
    expect(lines[12]?.startsWith(`12${' '.repeat(14)}`)).toBe(true);
  });

  test('no trailing whitespace, no box characters, no trailing newline', () => {
    const tables = [
      renderTable([]),
      renderTable([{ output: '5', verdict: 'INVALID' }]),
      renderTable([
        { output: '2106930664', verdict: 'VALID' },
        { output: '210693664', verdict: 'INVALID' },
      ]),
    ];
    for (const table of tables) {
      for (const line of table.split('\n')) {
        expect(line).toBe(line.trimEnd());
        expect(line).not.toMatch(/[|+\-─│]/);
      }
      expect(table.endsWith('\n')).toBe(false);
    }
  });
});

describe('isTruncated', () => {
  test.each([
    [1000n, false],
    [1001n, true],
    [1n, false],
    [1024n, true],
    [2n ** 5000n, true],
  ])('isTruncated(%s, 1000) is %s', (total, expected) => {
    expect(isTruncated(total, 1000)).toBe(expected);
  });
});

describe('truncationNotice', () => {
  test('exact wording for 2^40', () => {
    expect(truncationNotice(1000, 1099511627776n)).toBe(
      'Showing first 1000 of 1099511627776 interpretations (list truncated).',
    );
  });

  test('exact wording for 1024', () => {
    expect(truncationNotice(1000, 1024n)).toBe(
      'Showing first 1000 of 1024 interpretations (list truncated).',
    );
  });

  test('the total 2^5000 is printed in full', () => {
    const digits = String(2n ** 5000n);
    expect(digits).toHaveLength(1506);
    const notice = truncationNotice(1000, 2n ** 5000n);
    expect(notice).toContain(digits);
    expect(notice).not.toContain('\n');
    expect(notice.startsWith('Showing first 1000 of ')).toBe(true);
    expect(notice.endsWith(' interpretations (list truncated).')).toBe(true);
  });
});
