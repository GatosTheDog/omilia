import { describe, expect, test } from '@jest/globals';
import { isValidGreekPhone } from '../src/validate.js';

const VALID_10 = ['2106930664', '2000000000', '2999999999', '6900000000', '6999999999', '6912345678'];

const WRONG_PREFIX_10 = [
  '1999999999',
  '3000000000',
  '6800000000',
  '7000000000',
  '6012345678',
  '0212345678',
  '9912345678',
  '1234567890',
  '0030697409',
];

const VALID_14 = [
  '00302123456789',
  '00302000000000',
  '00302999999999',
  '00306900000000',
  '00306999999999',
  '00306974092252',
];

const WRONG_PREFIX_14 = [
  '00301999999999',
  '00303000000000',
  '00306800000000',
  '00307000000000',
  '00304123456789',
  '00301123456789',
  '21069306640000',
  '69123456780000',
  '00212345678901',
  '10302123456789',
  '00307074092252',
];

// [input, expected length]: every one of these must be INVALID.
const WRONG_LENGTH: Array<[string, number]> = [
  ['210693066', 9],
  ['691234567', 9],
  ['21069306604', 11],
  ['69123456789', 11],
  ['210693066400', 12],
  ['2106930664000', 13],
  ['0030212345678', 13],
  ['0030691234567', 13],
  ['003021234567890', 15],
  ['003069123456789', 15],
  ['0030212345', 10],
  ['0030691234', 10],
  ['999999999999999999', 18],
  ['302558', 6],
  ['2', 1],
  ['30', 2],
  ['', 0],
];

// Not plain ASCII digits: all must be INVALID even when the length looks right.
const NOT_PLAIN_DIGITS: string[] = [
  '+302106930664',
  '+30 2106930664',
  '2106930664 ',
  ' 2106930664',
  '2106930664\n',
  '21069a0664',
  '210 693 0664',
  '0030-6974092252',
  '２１０６９３０６６４', // fullwidth, 10 chars
  '2١٠٦٩٣٠٦٦٤', // ASCII 2 then Arabic-Indic, 10 chars
  '００３０２１２３４５６７８９', // fullwidth, 14 chars
];

describe('isValidGreekPhone: 10-digit numbers', () => {
  test.each(VALID_10)('%s is VALID', (n) => {
    expect(n).toHaveLength(10);
    expect(isValidGreekPhone(n)).toBe(true);
  });

  test.each(WRONG_PREFIX_10)('%s is INVALID (wrong prefix)', (n) => {
    expect(n).toHaveLength(10);
    expect(isValidGreekPhone(n)).toBe(false);
  });
});

describe('isValidGreekPhone: 14-digit numbers', () => {
  test.each(VALID_14)('%s is VALID', (n) => {
    expect(n).toHaveLength(14);
    expect(isValidGreekPhone(n)).toBe(true);
  });

  test.each(WRONG_PREFIX_14)('%s is INVALID (wrong prefix)', (n) => {
    expect(n).toHaveLength(14);
    expect(isValidGreekPhone(n)).toBe(false);
  });
});

describe('isValidGreekPhone: every other length is INVALID', () => {
  test.each(WRONG_LENGTH)('%j has the wrong length and is INVALID', (n, length) => {
    expect(n).toHaveLength(length);
    expect(isValidGreekPhone(n)).toBe(false);
  });
});

describe('isValidGreekPhone: strict, no normalisation', () => {
  test.each(NOT_PLAIN_DIGITS)('%j is INVALID', (n) => {
    expect(isValidGreekPhone(n)).toBe(false);
  });
});

describe('isValidGreekPhone: assignment examples', () => {
  const cases: Array<[string, boolean]> = [
    ['302558', false],
    ['2106930664', true],
    ['21069306604', false],
    ['00306974092252', true],
  ];

  test.each(cases)('%s -> %s', (n, expected) => {
    expect(isValidGreekPhone(n)).toBe(expected);
  });
});

describe('isValidGreekPhone: precision and statelessness', () => {
  test('leading zeros are significant', () => {
    expect(isValidGreekPhone('00306974092252')).toBe(true);
    expect(isValidGreekPhone('306974092252')).toBe(false);
  });

  test('repeated calls give the same answer (no regex state)', () => {
    expect(isValidGreekPhone('2106930664')).toBe(true);
    expect(isValidGreekPhone('2106930664')).toBe(true);
    expect(isValidGreekPhone('2106930664')).toBe(true);
    expect(isValidGreekPhone('2106930664')).toBe(true);
  });

  test('a very long input returns promptly and the result is a boolean', () => {
    expect(isValidGreekPhone('2'.repeat(100000))).toBe(false);
    expect(typeof isValidGreekPhone('2106930664')).toBe('boolean');
    expect(typeof isValidGreekPhone('1')).toBe('boolean');
  });
});
