// Pure table and notice formatter: no I/O, no imports.

export type Verdict = 'VALID' | 'INVALID';

export interface TableRow {
  readonly output: string;
  readonly verdict: Verdict;
}

const HEADER = ['Interpretation', 'Output', 'Phone number'];
const SEPARATOR = '  ';

/** Renders the numbered interpretations as a padded plain-text table; no trailing newline. */
export function renderTable(rows: readonly TableRow[]): string {
  const body = rows.map((row, index) => [String(index + 1), row.output, row.verdict]);
  // A loop per column: spreading one argument per row overflows the call stack on very long tables.
  const widths = HEADER.map((cell, col) => {
    let width = cell.length;
    for (const cells of body) {
      const len = cells[col]?.length ?? 0;
      if (len > width) width = len;
    }
    return width;
  });
  const line = (cells: readonly string[]): string =>
    cells
      .map((cell, col) => (col < cells.length - 1 ? cell.padEnd(widths[col] ?? 0) : cell))
      .join(SEPARATOR);
  return [HEADER].concat(body).map(line).join('\n');
}

/** True when the exact total exceeds the display cap; pure so the boundary is unit-testable. */
export function isTruncated(total: bigint, cap: number): boolean {
  return total > BigInt(cap);
}

/** Names the cap and the exact total; a template literal prints every digit of a bigint. */
export function truncationNotice(shown: number, total: bigint): string {
  return `Showing first ${shown} of ${total} interpretations (list truncated).`;
}
