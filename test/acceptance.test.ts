// The specification as tests.
//
// The assignment tables and Examples 1 to 3 appear verbatim as literals below;
// the edge cases follow.
// Expected values are typed literals and are never produced by the code under test.
// The table formatter is deliberately not used here: rendering is covered by
// test/format.test.ts and the spawn tests.
import { describe, expect, test } from '@jest/globals';
import { countInterpretations, distinct, interpretations } from '../src/interpret.js';
import { concatenate, formatParseError, parseTokens } from '../src/parse.js';
import { isValidGreekPhone } from '../src/validate.js';
import { EDGE_CASES, REJECTED } from './fixtures/edge-cases.js';
import type { EdgeCase, EdgeGroup, FixtureVerdict } from './fixtures/edge-cases.js';

function verdictOf(s: string): FixtureVerdict {
  return isValidGreekPhone(s) ? 'VALID' : 'INVALID';
}

function solve(input: string) {
  const parsed = parseTokens(input);
  if (!parsed.ok) {
    throw new Error(`input was rejected by the parser: "${input}"`);
  }
  const tokens = parsed.tokens;
  const plain = concatenate(tokens);
  return {
    tokens,
    plain,
    verdict: verdictOf(plain),
    rows: [...interpretations(tokens)].map((output): [string, FixtureVerdict] => [
      output,
      verdictOf(output),
    ]),
    count: countInterpretations(tokens),
  };
}

describe('assignment task section: the identified number', () => {
  const cases: Array<[string, string]> = [
    ['30 2 5 58', '302558'],
    ['2 10 69 30 6 60 4', '21069306604'],
    // The assignment gives no verdict for this input, so only the identified number is asserted.
    ['6 97 400 23 7 40 5', '697400237405'],
  ];

  test.each(cases)('%s gives %s', (input, plain) => {
    expect(solve(input).plain).toBe(plain);
  });
});

describe('assignment base level: phone number validation', () => {
  const cases: Array<[string, string, FixtureVerdict]> = [
    ['30 2 5 58', '302558', 'INVALID'],
    ['2 10 69 30 6 6 4', '2106930664', 'VALID'],
    ['2 10 69 30 6 60 4', '21069306604', 'INVALID'],
    ['0 0 30 69 74 0 9 22 52', '00306974092252', 'VALID'],
  ];

  test.each(cases)('%s gives %s which is %s', (input, plain, verdict) => {
    const result = solve(input);
    expect(result.plain).toBe(plain);
    expect(result.verdict).toBe(verdict);
  });
});

describe('assignment advanced level: example 1', () => {
  const result = solve('2 10 6 9 30 6 6 4');

  test('lists exactly the two assignment rows', () => {
    expect(result.rows).toEqual([
      ['2106930664', 'VALID'],
      ['210693664', 'INVALID'],
    ]);
  });

  test('the exact count is 2n', () => {
    expect(result.count).toBe(2n);
  });
});

describe('assignment advanced level: example 2', () => {
  const result = solve('2 10 69 30 6 6 4');

  test('lists exactly the four assignment rows', () => {
    expect(result.rows).toEqual([
      ['2106930664', 'VALID'],
      ['210693664', 'INVALID'],
      ['2106093664', 'VALID'],
      ['21060930664', 'INVALID'],
    ]);
  });

  test('the exact count is 4n', () => {
    expect(result.count).toBe(4n);
  });
});

describe('assignment advanced level: example 3', () => {
  // The assignment elides rows with an ellipsis and labels two of them n and m.
  // In the engine order n is row 4 and m is row 6; the eight rows below are the full list.
  const result = solve('0 0 30 69 700 24 1 3 50 2');

  test('lists all eight interpretations in order, row 4 being the only VALID one', () => {
    expect(result.rows).toEqual([
      ['0030697002413502', 'INVALID'],
      ['003069700241352', 'INVALID'],
      ['0030697241352', 'INVALID'],
      ['00306972413502', 'VALID'],
      ['003060972413502', 'INVALID'],
      ['00306097241352', 'INVALID'],
      ['0030609700241352', 'INVALID'],
      ['00306097002413502', 'INVALID'],
    ]);
  });

  test('the exact count is 8n', () => {
    expect(result.count).toBe(8n);
  });

  test('assignment row 1 is 0030697002413502 INVALID', () => {
    expect(result.rows[0]).toEqual(['0030697002413502', 'INVALID']);
  });

  test('assignment row 2 is 003069700241352 INVALID', () => {
    expect(result.rows[1]).toEqual(['003069700241352', 'INVALID']);
  });

  test('assignment row n (row 4) is 00306972413502 VALID', () => {
    expect(result.rows[3]).toEqual(['00306972413502', 'VALID']);
  });

  test('assignment row m (row 6) is 00306097241352 INVALID', () => {
    expect(result.rows[5]).toEqual(['00306097241352', 'INVALID']);
  });

  test('exactly one row is VALID', () => {
    expect(result.rows.filter(([, verdict]) => verdict === 'VALID')).toHaveLength(1);
  });
});

describe('edge cases: empty input', () => {
  test.each(REJECTED.map((r) => [r.name, r] as const))('%s is rejected with the exact message', (_name, r) => {
    const parsed = parseTokens(r.input);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(formatParseError(parsed.error)).toBe(r.stderr);
    }
  });

  test('the empty string is reported as the empty error kind', () => {
    const parsed = parseTokens('');
    expect(parsed).toEqual({ ok: false, error: { kind: 'empty' } });
  });

  test('an empty token list gives exactly one interpretation, the empty string', () => {
    expect([...interpretations([])]).toEqual(['']);
    expect(countInterpretations([])).toBe(1n);
  });
});

function expectEdgeCase(c: EdgeCase): void {
  const result = solve(c.input);
  expect(result.plain).toBe(c.plain);
  expect(result.verdict).toBe(c.verdict);
  expect(result.rows).toEqual(c.rows);
  expect(result.count).toBe(BigInt(c.rows.length));
  expect(result.rows[0]?.[0]).toBe(c.plain);
  const outputs = result.rows.map(([output]) => output);
  expect(new Set(outputs).size).toBe(outputs.length);
}

const GROUPS: readonly EdgeGroup[] = [
  'single token',
  'adjacent ambiguities',
  'rule boundaries',
  'valid verdicts',
];

describe.each(GROUPS)('edge cases: %s', (group) => {
  const cases = EDGE_CASES.filter((c) => c.group === group).map((c) => [c.name, c] as const);

  test.each(cases)('%s', (_name, c) => {
    expectEdgeCase(c);
  });
});

test('the shared fixture is sane: unique names and every group populated', () => {
  const names = EDGE_CASES.map((c) => c.name);
  expect(new Set(names).size).toBe(names.length);
  for (const group of GROUPS) {
    expect(EDGE_CASES.some((c) => c.group === group)).toBe(true);
  }
});

describe('edge cases: rule paths collapsing to the same digit string', () => {
  // Under the current rules no input yields the same digit string from two different rule paths
  // (checked exhaustively for all sequences up to length 5 over a 25-token alphabet and for
  // 200000 random lists up to length 14). The count-equals-distinct property tests in
  // test/interpret.test.ts guard this, and distinct() removes a collision if a future rule
  // creates one.
  test('distinct keeps the first occurrence when a second path yields an already-seen string', () => {
    // The plain reading and the merge reading of "20 5", each reached twice.
    expect([...distinct(['205', '25', '205', '25'])]).toEqual(['205', '25']);
  });

  test('the rule-path count equals the distinct count for every acceptance input', () => {
    const inputs = [
      '30 2 5 58',
      '2 10 69 30 6 60 4',
      '6 97 400 23 7 40 5',
      '2 10 69 30 6 6 4',
      '0 0 30 69 74 0 9 22 52',
      '2 10 6 9 30 6 6 4',
      '0 0 30 69 700 24 1 3 50 2',
      ...EDGE_CASES.map((c) => c.input),
    ];
    const mismatches: string[] = [];
    for (const input of inputs) {
      const { tokens, count } = solve(input);
      const distinctCount = BigInt(new Set(interpretations(tokens)).size);
      if (count !== distinctCount) {
        mismatches.push(input);
      }
    }
    expect(mismatches).toEqual([]);
  });
});
