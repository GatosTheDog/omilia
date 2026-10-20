import { describe, expect, test } from '@jest/globals';
import {
  countInterpretations,
  distinct,
  firstInterpretations,
  interpretations,
} from '../src/interpret.js';
import { isValidGreekPhone } from '../src/validate.js';

// Tokens are separated by single spaces in these inputs.
function all(input: string): string[] {
  return [...interpretations(input.split(' '))];
}

function count(input: string): bigint {
  return countInterpretations(input.split(' '));
}

describe('interpretations: tens + unit merge', () => {
  const cases: Array<[string, string[]]> = [
    ['30 6', ['306', '36']],
    ['20 5', ['205', '25']],
    ['50 2', ['502', '52']],
    ['90 9', ['909', '99']],
    ['60 4', ['604', '64']],
    ['10 6', ['106']],
    ['30 0', ['300']],
    ['30 05', ['3005']],
    ['05 6', ['056']],
    ['13 6', ['136']],
    ['30 6 6', ['3066', '366']],
    ['20 20 5', ['20205', '2025']],
    ['30 40 5', ['30405', '3045']],
  ];

  test.each(cases)('%s', (input, expected) => {
    expect(all(input)).toEqual(expected);
  });
});

describe('interpretations: tens split', () => {
  const cases: Array<[string, string[]]> = [
    ['69', ['69', '609']],
    ['75', ['75', '705']],
    ['21', ['21', '201']],
    ['99', ['99', '909']],
    ['30 69', ['3069', '30609']],
    ['99 99', ['9999', '99909', '909909', '90999']],
  ];

  test.each(cases)('%s', (input, expected) => {
    expect(all(input)).toEqual(expected);
  });
});

describe('interpretations: tokens with no ambiguity', () => {
  test.each(['11', '12', '13', '14', '15', '16', '17', '18', '19'])(
    'teen %j is never split',
    (token) => {
      expect(all(token)).toEqual([token]);
    },
  );

  test.each(['20', '30', '40', '50', '60', '70', '80', '90', '10'])(
    'multiple of ten %j is never split',
    (token) => {
      expect(all(token)).toEqual([token]);
    },
  );

  test.each(['105', '123', '100', '700'])('3-digit token %j is inert', (token) => {
    expect(all(token)).toEqual([token]);
  });

  test.each(['0', '5'])('single digit %j is inert', (token) => {
    expect(all(token)).toEqual([token]);
  });

  test.each(['00', '05', '030'])('leading zero token %j is inert', (token) => {
    expect(all(token)).toEqual([token]);
  });
});

describe('interpretations: distinct output, plain first', () => {
  test('distinct keeps the first occurrence', () => {
    expect([...distinct(['a', 'b', 'a', 'c', 'b'])]).toEqual(['a', 'b', 'c']);
  });

  test('distinct on interpretation-like strings keeps the first two', () => {
    expect([...distinct(['2106930664', '210693664', '2106930664'])]).toEqual([
      '2106930664',
      '210693664',
    ]);
  });

  test('distinct of an empty source yields nothing', () => {
    expect([...distinct([])]).toEqual([]);
  });

  test('distinct is lazy', () => {
    function* endless(): Generator<string> {
      for (;;) {
        yield '0';
        yield '1';
        yield '2';
      }
    }
    const it = distinct(endless());
    expect(it.next().value).toBe('0');
    expect(it.next().value).toBe('1');
    expect(it.next().value).toBe('2');
  });

  test('property: no duplicates and plain first for every list of length 1 to 3', () => {
    const alphabet = [
      '0', '5', '05', '6', '10', '13', '20', '24', '30', '40', '58', '69', '75', '100', '105', '700', '900',
    ];
    let lists: string[][] = alphabet.map((t) => [t]);
    let checked = 0;
    for (let length = 1; length <= 3; length += 1) {
      for (const tokens of lists) {
        const out = [...interpretations(tokens)];
        expect(new Set(out).size).toBe(out.length);
        expect(out[0]).toBe(tokens.join(''));
        checked += 1;
      }
      if (length < 3) {
        lists = lists.flatMap((l) => alphabet.map((t) => [...l, t]));
      }
    }
    expect(checked).toBe(5219);
  });

  test.each(['5', '0 0 30', '10 6', '13 6'])('unambiguous %j yields only the plain concatenation', (input) => {
    expect(all(input)).toEqual([input.split(' ').join('')]);
  });

  test.each([1, 2, 3, 5, 10])('%i independent sites give 2^k distinct strings', (k) => {
    expect(all(Array(k).fill('69').join(' '))).toHaveLength(2 ** k);
    expect(all(Array(k).fill('30 6').join(' '))).toHaveLength(2 ** k);
    expect(new Set(all(Array(k).fill('69').join(' '))).size).toBe(2 ** k);
  });
});

describe('interpretations: order is reflected Gray code, plain first', () => {
  const cases: Array<[string, string[]]> = [
    ['30 6 30 6', ['306306', '30636', '3636', '36306']],
    ['58 5 2 30', ['585230', '5085230']],
    ['13 30 6', ['13306', '1336']],
    ['30 6 69', ['30669', '306609', '36609', '3669']],
    ['69 30 6', ['69306', '6936', '60936', '609306']],
  ];

  test.each(cases)('%s', (input, expected) => {
    expect(all(input)).toEqual(expected);
  });

  test('two calls return the same order (stable)', () => {
    expect(all('2 10 69 30 6 6 4')).toEqual(all('2 10 69 30 6 6 4'));
  });

  test('plain concatenation is the first element', () => {
    expect(all('99 99')[0]).toBe('9999');
  });
});

describe('interpretations: examples 1 and 2', () => {
  test('example 1: 10 6 never gives 16', () => {
    expect(all('2 10 6 9 30 6 6 4')).toEqual(['2106930664', '210693664']);
  });

  test('example 2', () => {
    expect(all('2 10 69 30 6 6 4')).toEqual([
      '2106930664',
      '210693664',
      '2106093664',
      '21060930664',
    ]);
  });
});

describe('interpretations: long input is stack safe and lazy', () => {
  test('5000 unambiguous tokens give one string', () => {
    const out = [...interpretations(Array<string>(5000).fill('1'))];
    expect(out).toHaveLength(1);
    expect(out[0]).toHaveLength(5000);
  });

  test('first 1000 of 5000 copies of 69 are produced lazily', () => {
    const taken: string[] = [];
    for (const s of interpretations(Array<string>(5000).fill('69'))) {
      taken.push(s);
      if (taken.length === 1000) break;
    }
    expect(taken).toHaveLength(1000);
    expect(taken[0]).toBe('69'.repeat(5000));
    expect(taken[0]).toHaveLength(10000);
    expect(new Set(taken).size).toBe(1000);
  });

  test('first 1000 of 2500 repeated pairs 30 6 complete without throwing', () => {
    const tokens: string[] = [];
    for (let i = 0; i < 2500; i += 1) tokens.push('30', '6');
    let n = 0;
    for (const _s of interpretations(tokens)) {
      n += 1;
      if (n === 1000) break;
    }
    expect(n).toBe(1000);
  });
});

describe('interpretations: empty and single-token input', () => {
  test('empty token list yields exactly the empty string', () => {
    expect([...interpretations([])]).toEqual(['']);
  });

  test('a single multiple of ten yields only itself', () => {
    expect([...interpretations(['30'])]).toEqual(['30']);
  });

  test('a lone ambiguous token still yields two readings', () => {
    expect([...interpretations(['69'])]).toEqual(['69', '609']);
  });
});

describe('interpretations: hundreds merge', () => {
  const cases: Array<[string, string[]]> = [
    ['700 24', ['70024', '724']],
    ['700 5', ['7005', '705']],
    ['700 20', ['70020', '720']],
    ['700 6', ['7006', '706']],
    ['900 99', ['90099', '999']],
    ['100 1', ['1001', '101']],
    ['100 99', ['10099', '199']],
    ['500 5 6', ['50056', '5056']],
    ['200 60 4', ['200604', '20064', '2604']],
    ['700 7 6', ['70076', '7076']],
  ];

  test.each(cases)('%s', (input, expected) => {
    expect(all(input)).toEqual(expected);
  });
});

describe('interpretations: hundreds edge cases (adjacency and empty)', () => {
  const cases: Array<[string, string[]]> = [
    ['700', ['700']],
    ['1 700', ['1700']],
    ['700 123', ['700123']],
    ['700 100', ['700100']],
    ['800 700 24', ['80070024', '800724']],
    ['105 6', ['1056']],
    ['250 5', ['2505']],
    ['700 05 (leading zero)', ['70005']],
    ['700 0 (leading zero)', ['7000']],
    ['700 00 (leading zero)', ['70000']],
    ['1 700 24 1', ['1700241', '17241']],
  ];

  test.each(cases)('%s', (title, expected) => {
    const input = title.split(' (')[0] ?? title;
    expect(all(input)).toEqual(expected);
  });
});

describe('interpretations: rules are mutually exclusive per token', () => {
  test('700 20 5 has three readings and no chained one', () => {
    const out = all('700 20 5');
    expect(out).toEqual(['700205', '70025', '7205']);
    expect(out).not.toContain('725');
  });

  test('500 30 6 does not reuse the 30 consumed by the 500 merge', () => {
    expect(all('500 30 6')).toEqual(['500306', '50036', '5306']);
  });

  test('700 24 has exactly two rows and no split of the 24', () => {
    const out = all('700 24');
    expect(out).toEqual(['70024', '724']);
    expect(out).not.toContain('700204');
    expect(out).not.toContain('7204');
  });

  test('100 1 100 1 (two independent sites) keeps a stable order', () => {
    expect(all('100 1 100 1')).toEqual(['10011001', '1001101', '101101', '1011001']);
  });
});

describe('interpretations: a hundreds-merge target is never split', () => {
  const cases: Array<[string, string[]]> = [
    ['700 24', ['70024', '724']],
    ['700 69', ['70069', '769']],
    ['900 21', ['90021', '921']],
    ['700 5 24', ['700524', '7005204', '705204', '70524']],
    ['700 5 69', ['700569', '7005609', '705609', '70569']],
    ['105 24', ['10524', '105204']],
    ['1 24', ['124', '1204']],
    ['24', ['24', '204']],
    ['24 700', ['24700', '204700']],
  ];

  test.each(cases)('%s', (input, expected) => {
    expect(all(input)).toEqual(expected);
  });
});

describe('interpretations: teens and ten as hundreds targets', () => {
  const cases: Array<[string, string[]]> = [
    ['700 15', ['70015', '715']],
    ['700 11', ['70011', '711']],
    ['700 10', ['70010', '710']],
    ['100 10', ['10010', '110']],
    ['15', ['15']],
  ];

  test.each(cases)('%s', (input, expected) => {
    expect(all(input)).toEqual(expected);
  });
});

describe('interpretations: advanced example 3', () => {
  const input = '0 0 30 69 700 24 1 3 50 2';
  const expected = [
    '0030697002413502',
    '003069700241352',
    '0030697241352',
    '00306972413502',
    '003060972413502',
    '00306097241352',
    '0030609700241352',
    '00306097002413502',
  ];

  test('exactly the 8 interpretations of three independent choices, in order', () => {
    expect(all(input)).toEqual(expected);
  });

  test('assignment rows 1, 2, 4 and 6 are at their indexes', () => {
    const out = all(input);
    expect(out[0]).toBe('0030697002413502');
    expect(out[1]).toBe('003069700241352');
    expect(out[3]).toBe('00306972413502');
    expect(out[5]).toBe('00306097241352');
  });

  test('row 4 is the only valid phone number', () => {
    const verdicts = all(input).map((s) => isValidGreekPhone(s));
    expect(verdicts.map((v, i) => (v ? i : -1)).filter((i) => i >= 0)).toEqual([3]);
  });

  test('no row lost its leading 00', () => {
    for (const s of all(input)) expect(s.startsWith('00')).toBe(true);
  });
});

describe('countInterpretations', () => {
  test('the empty token list has one interpretation', () => {
    expect(countInterpretations([])).toBe(1n);
  });

  test.each([
    ['69', 2n],
    ['5', 1n],
    ['10 6', 1n],
  ])('%s gives %s', (input, expected) => {
    expect(count(input)).toBe(expected);
  });

  test.each(Array.from({ length: 21 }, (_v, k) => k))('%i copies of 69 give 2^k', (k) => {
    expect(countInterpretations(Array<string>(k).fill('69'))).toBe(2n ** BigInt(k));
  });

  test('40 copies of 69 give 1099511627776', () => {
    expect(countInterpretations(Array<string>(40).fill('69'))).toBe(1099511627776n);
  });

  test('5000 copies of 69 give exactly 2^5000 (beyond 2^53)', () => {
    expect(countInterpretations(Array<string>(5000).fill('69'))).toBe(2n ** 5000n);
  });

  test.each([
    ['2 10 6 9 30 6 6 4', 2n],
    ['2 10 69 30 6 6 4', 4n],
    ['0 0 30 69 700 24 1 3 50 2', 8n],
    ['2 10 69 30 6 60 4', 8n],
    ['0 0 30 69 74 0 9 22 52', 16n],
    ['30 2 5 58', 4n],
    ['700 20 5', 3n],
    ['700 24', 2n],
  ])('spec input %s gives %s', (input, expected) => {
    expect(count(input)).toBe(expected);
  });

  test('the result is a bigint', () => {
    expect(typeof count('69 69')).toBe('bigint');
    expect(typeof countInterpretations([])).toBe('bigint');
  });
});

describe('countInterpretations property: count equals the number of distinct generated strings', () => {
  const alphabet = [
    '0', '1', '5', '05', '6', '10', '13', '20', '24', '30', '40', '58', '69', '75', '100', '105', '700', '900',
  ];

  function mismatch(tokens: readonly string[]): string | undefined {
    const counted = countInterpretations(tokens);
    const generated = BigInt(new Set(interpretations(tokens)).size);
    return counted === generated
      ? undefined
      : `${tokens.join(' ')}: counted ${counted}, generated ${generated}`;
  }

  test('every list of length 1 to 4', () => {
    let lists: string[][] = alphabet.map((t) => [t]);
    let checked = 0;
    const mismatches: string[] = [];
    for (let length = 1; length <= 4; length += 1) {
      for (const tokens of lists) {
        const bad = mismatch(tokens);
        if (bad !== undefined) mismatches.push(bad);
        checked += 1;
      }
      if (length < 4) {
        lists = lists.flatMap((l) => alphabet.map((t) => [...l, t]));
      }
    }
    expect(mismatches).toEqual([]);
    const expectedChecked = [1, 2, 3, 4].reduce((sum, n) => sum + alphabet.length ** n, 0);
    expect(checked).toBe(expectedChecked);
  }, 30000);

  test('500 seeded random lists of length 5 to 10', () => {
    let state = 12345;
    const draw = (bound: number): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return (state >>> 16) % bound;
    };
    const mismatches: string[] = [];
    for (let n = 0; n < 500; n += 1) {
      const length = 5 + draw(6);
      const tokens: string[] = [];
      for (let k = 0; k < length; k += 1) tokens.push(alphabet[draw(alphabet.length)] ?? '0');
      const bad = mismatch(tokens);
      if (bad !== undefined) mismatches.push(bad);
    }
    expect(mismatches).toEqual([]);
  }, 30000);

  test('the empty list counts one and generates one string', () => {
    expect(countInterpretations([])).toBe(1n);
    expect(new Set(interpretations([])).size).toBe(1);
  });
});

describe('firstInterpretations', () => {
  test.each([0, -1])('limit %i gives an empty list', (limit) => {
    expect(firstInterpretations(['69'], limit)).toEqual([]);
  });

  test.each(['2 10 69 30 6 6 4', '30 6 30 6', '0 0 30 69 700 24 1 3 50 2', '5'])(
    '%s: the result is the prefix of interpretations for every limit',
    (input) => {
      const full = all(input);
      for (let limit = 0; limit <= full.length + 2; limit += 1) {
        const taken = firstInterpretations(input.split(' '), limit);
        expect(taken).toEqual(full.slice(0, limit));
        expect(taken).toHaveLength(Math.min(limit, full.length));
      }
    },
  );

  test('5000 copies of 69 with limit 1 give the plain concatenation', () => {
    expect(firstInterpretations(Array<string>(5000).fill('69'), 1)).toEqual(['69'.repeat(5000)]);
  });

  test('5000 copies of 69 with limit 1000 give 1000 different strings', () => {
    const taken = firstInterpretations(Array<string>(5000).fill('69'), 1000);
    expect(taken).toHaveLength(1000);
    expect(taken[0]).toBe('69'.repeat(5000));
    expect(new Set(taken).size).toBe(1000);
  });

  test('40 copies of 69 with limit 1000 give 1000 different strings and a known second one', () => {
    const taken = firstInterpretations(Array<string>(40).fill('69'), 1000);
    expect(taken).toHaveLength(1000);
    expect(new Set(taken).size).toBe(1000);
    expect(taken[1]).toBe('69'.repeat(39) + '609');
  });
});
