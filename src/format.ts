export type Verdict = 'VALID' | 'INVALID';

export interface TableRow {
  readonly output: string;
  readonly verdict: Verdict;
}

const HEADER = ['Interpretation', 'Output', 'Phone number'];
const SEPARATOR = '  ';

export function renderTable(rows: readonly TableRow[]): string {
  const body = rows.map((row, index) => [String(index + 1), row.output, row.verdict]);
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

export function isTruncated(total: bigint, cap: number): boolean {
  return total > BigInt(cap);
}

export function truncationNotice(shown: number, total: bigint): string {
  return `Showing first ${shown} of ${total} interpretations (list truncated).`;
}
