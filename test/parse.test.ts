import { describe, expect, test } from '@jest/globals';
import { concatenate, formatParseError, parseTokens } from '../src/parse.js';

describe('parseTokens: accepted input', () => {
  test('splits on single spaces', () => {
    expect(parseTokens('30 2 5 58')).toEqual({ ok: true, tokens: ['30', '2', '5', '58'] });
  });

  test.each([
    ['multiple spaces', '30   2 5  58'],
    ['tabs, newline and surrounding whitespace', '\t30\t2  5 58\n'],
    ['non-breaking space', '30 2 5 58'],
  ])('treats %s as separators', (_name, input) => {
    expect(parseTokens(input)).toEqual({ ok: true, tokens: ['30', '2', '5', '58'] });
  });

  test('keeps leading zeros', () => {
    expect(parseTokens('0 0 30')).toEqual({ ok: true, tokens: ['0', '0', '30'] });
    expect(parseTokens('007')).toEqual({ ok: true, tokens: ['007'] });
    expect(parseTokens('0')).toEqual({ ok: true, tokens: ['0'] });
  });

  test('accepts 1-digit and 3-digit tokens', () => {
    expect(parseTokens('5')).toEqual({ ok: true, tokens: ['5'] });
    expect(parseTokens('999')).toEqual({ ok: true, tokens: ['999'] });
  });
});

describe('parseTokens: rejected input', () => {
  test('rejects a 4-digit token as too-long', () => {
    expect(parseTokens('1234')).toEqual({ ok: false, error: { kind: 'too-long', token: '1234' } });
  });

  test.each(['', '   ', '\t\n'])('rejects empty/whitespace-only input %j', (input) => {
    expect(parseTokens(input)).toEqual({ ok: false, error: { kind: 'empty' } });
  });

  test.each([
    ['12 abc', 'abc'],
    ['-5', '-5'],
    ['1.5', '1.5'],
    ['+3', '+3'],
    ['abcd', 'abcd'],
  ])('rejects %j as non-digit token %j', (input, token) => {
    expect(parseTokens(input)).toEqual({ ok: false, error: { kind: 'non-digit', token } });
  });

  test('reports the first offending token', () => {
    expect(parseTokens('1234 abc')).toEqual({
      ok: false,
      error: { kind: 'too-long', token: '1234' },
    });
    expect(parseTokens('abc 1234')).toEqual({
      ok: false,
      error: { kind: 'non-digit', token: 'abc' },
    });
  });

  test.each([
    ['fullwidth digits', '１２'],
    ['Arabic-Indic digit', '٣'],
  ])('only ASCII 0-9 are digits (%s)', (_name, token) => {
    expect(parseTokens(token)).toEqual({ ok: false, error: { kind: 'non-digit', token } });
  });
});

describe('formatParseError', () => {
  test('formats each error kind with the expected wording', () => {
    expect(formatParseError({ kind: 'empty' })).toBe('Please enter at least one number.');
    expect(formatParseError({ kind: 'non-digit', token: 'abc' })).toBe(
      'Invalid token "abc": digits only.',
    );
    expect(formatParseError({ kind: 'too-long', token: '1234' })).toBe(
      'Invalid token "1234": must be 1–3 digits.',
    );
  });

  test('escapes control characters in the echoed token', () => {
    const out = formatParseError({ kind: 'non-digit', token: '\u001b[31mX' });
    expect(out).toBe('Invalid token "\\u001b[31mX": digits only.');
    expect(out).not.toContain('\u001b');
  });
});

describe('concatenate', () => {
  test('joins as a string, beyond MAX_SAFE_INTEGER', () => {
    expect(concatenate(['999', '999', '999', '999', '999', '999'])).toBe('999999999999999999');
  });

  test('keeps order and leading zeros', () => {
    expect(concatenate(['58', '5', '2', '30'])).toBe('585230');
    expect(concatenate(['6', '6', '4'])).toBe('664');
    expect(concatenate(['0', '0', '30'])).toBe('0030');
    expect(concatenate(['30', '2', '5', '58'])).toBe('302558');
  });
});
