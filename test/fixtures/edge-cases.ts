// Shared edge-case fixture.
//
// Used by test/acceptance.test.ts (engine level) and test/cli.spawn.test.ts (real built CLI),
// so both layers assert the same inputs.
// Every value is a literal: nothing here is computed by the code under test.
// The file name does not match Jest's test pattern, so it is imported, never run as a suite.

export type FixtureVerdict = 'VALID' | 'INVALID';

export type EdgeGroup =
  | 'single token'
  | 'adjacent ambiguities'
  | 'rule boundaries'
  | 'valid verdicts';

export interface EdgeCase {
  readonly name: string;
  readonly group: EdgeGroup;
  /** The space-separated text a user types. */
  readonly input: string;
  /** The concatenation of the tokens. */
  readonly plain: string;
  /** The verdict of the plain number. */
  readonly verdict: FixtureVerdict;
  /** Every interpretation in engine order with its verdict (plain reading first). */
  readonly rows: ReadonlyArray<readonly [string, FixtureVerdict]>;
}

export interface RejectedCase {
  readonly name: string;
  readonly input: string;
  /** The stderr message without the trailing newline. */
  readonly stderr: string;
}

export const EDGE_CASES: readonly EdgeCase[] = [
  // single token
  {
    name: 'single digit has no ambiguity',
    group: 'single token',
    input: '5',
    plain: '5',
    verdict: 'INVALID',
    rows: [['5', 'INVALID']],
  },
  {
    name: 'single zero is inert',
    group: 'single token',
    input: '0',
    plain: '0',
    verdict: 'INVALID',
    rows: [['0', 'INVALID']],
  },
  {
    name: 'single multiple of ten never splits',
    group: 'single token',
    input: '20',
    plain: '20',
    verdict: 'INVALID',
    rows: [['20', 'INVALID']],
  },
  {
    name: 'ten never splits',
    group: 'single token',
    input: '10',
    plain: '10',
    verdict: 'INVALID',
    rows: [['10', 'INVALID']],
  },
  {
    name: 'one token with two readings',
    group: 'single token',
    input: '69',
    plain: '69',
    verdict: 'INVALID',
    rows: [
      ['69', 'INVALID'],
      ['609', 'INVALID'],
    ],
  },
  {
    name: '75 also reads as 705',
    group: 'single token',
    input: '75',
    plain: '75',
    verdict: 'INVALID',
    rows: [
      ['75', 'INVALID'],
      ['705', 'INVALID'],
    ],
  },

  // adjacent ambiguities
  {
    name: 'tens merge then a plain digit',
    group: 'adjacent ambiguities',
    input: '30 6 6',
    plain: '3066',
    verdict: 'INVALID',
    rows: [
      ['3066', 'INVALID'],
      ['366', 'INVALID'],
    ],
  },
  {
    name: 'tens merge next to a tens token',
    group: 'adjacent ambiguities',
    input: '20 20 5',
    plain: '20205',
    verdict: 'INVALID',
    rows: [
      ['20205', 'INVALID'],
      ['2025', 'INVALID'],
    ],
  },
  {
    name: 'two tens merges side by side',
    group: 'adjacent ambiguities',
    input: '30 6 30 6',
    plain: '306306',
    verdict: 'INVALID',
    rows: [
      ['306306', 'INVALID'],
      ['30636', 'INVALID'],
      ['3636', 'INVALID'],
      ['36306', 'INVALID'],
    ],
  },
  {
    name: 'two splits side by side',
    group: 'adjacent ambiguities',
    input: '69 69',
    plain: '6969',
    verdict: 'INVALID',
    rows: [
      ['6969', 'INVALID'],
      ['69609', 'INVALID'],
      ['609609', 'INVALID'],
      ['60969', 'INVALID'],
    ],
  },
  {
    name: 'two splits of 75',
    group: 'adjacent ambiguities',
    input: '75 75',
    plain: '7575',
    verdict: 'INVALID',
    rows: [
      ['7575', 'INVALID'],
      ['75705', 'INVALID'],
      ['705705', 'INVALID'],
      ['70575', 'INVALID'],
    ],
  },

  // rule boundaries
  {
    name: 'ten plus unit never gives sixteen',
    group: 'rule boundaries',
    input: '10 6',
    plain: '106',
    verdict: 'INVALID',
    rows: [['106', 'INVALID']],
  },
  {
    name: 'three-digit token that is not a multiple of 100 is inert',
    group: 'rule boundaries',
    input: '105 6',
    plain: '1056',
    verdict: 'INVALID',
    rows: [['1056', 'INVALID']],
  },
  {
    name: 'leading-zero token is inert',
    group: 'rule boundaries',
    input: '05 6',
    plain: '056',
    verdict: 'INVALID',
    rows: [['056', 'INVALID']],
  },
  {
    name: 'leading zeros are kept',
    group: 'rule boundaries',
    input: '0 0',
    plain: '00',
    verdict: 'INVALID',
    rows: [['00', 'INVALID']],
  },
  {
    name: 'hundreds merge never splits its target',
    group: 'rule boundaries',
    input: '700 24',
    plain: '70024',
    verdict: 'INVALID',
    rows: [
      ['70024', 'INVALID'],
      ['724', 'INVALID'],
    ],
  },
  {
    name: 'hundreds merge with a single digit',
    group: 'rule boundaries',
    input: '100 1',
    plain: '1001',
    verdict: 'INVALID',
    rows: [
      ['1001', 'INVALID'],
      ['101', 'INVALID'],
    ],
  },
  {
    name: 'no chained merge',
    group: 'rule boundaries',
    input: '700 20 5',
    plain: '700205',
    verdict: 'INVALID',
    rows: [
      ['700205', 'INVALID'],
      ['70025', 'INVALID'],
      ['7205', 'INVALID'],
    ],
  },

  // valid verdicts
  {
    name: 'ten-digit number starting with 2 stays VALID next to a split',
    group: 'valid verdicts',
    input: '2 0 0 0 0 0 0 0 69',
    plain: '2000000069',
    verdict: 'VALID',
    rows: [
      ['2000000069', 'VALID'],
      ['20000000609', 'INVALID'],
    ],
  },
  {
    name: 'ten-digit number starting with 69 and no ambiguity',
    group: 'valid verdicts',
    input: '6 9 1 2 3 4 5 6 7 8',
    plain: '6912345678',
    verdict: 'VALID',
    rows: [['6912345678', 'VALID']],
  },
];

export const REJECTED: readonly RejectedCase[] = [
  { name: 'empty input', input: '', stderr: 'Please enter at least one number.' },
  { name: 'whitespace-only input', input: '   ', stderr: 'Please enter at least one number.' },
  {
    name: 'non-numeric token after a valid one',
    input: '12 abc',
    stderr: 'Invalid token "abc": digits only.',
  },
  {
    name: 'token longer than three digits',
    input: '1234',
    stderr: 'Invalid token "1234": must be 1–3 digits.',
  },
];
