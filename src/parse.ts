// Pure functions: no I/O, no imports.

export type ParseError =
  | { kind: 'empty' }
  | { kind: 'non-digit'; token: string }
  | { kind: 'too-long'; token: string };

export type ParseResult =
  | { ok: true; tokens: string[] }
  | { ok: false; error: ParseError };

// Explicit ASCII range: only 0-9 count as digits.
const DIGITS_ONLY = /^[0-9]+$/;
const MAX_TOKEN_LENGTH = 3;

/** Trim, split on whitespace runs, validate each token. Never throws. */
export function parseTokens(input: string): ParseResult {
  const trimmed = input.trim();
  // Check before splitting: ''.split(/\s+/) yields one empty token.
  if (trimmed === '') {
    return { ok: false, error: { kind: 'empty' } };
  }

  const tokens = trimmed.split(/\s+/);
  for (const token of tokens) {
    if (!DIGITS_ONLY.test(token)) {
      return { ok: false, error: { kind: 'non-digit', token } };
    }
    if (token.length > MAX_TOKEN_LENGTH) {
      return { ok: false, error: { kind: 'too-long', token } };
    }
  }
  return { ok: true, tokens };
}

export function concatenate(tokens: readonly string[]): string {
  return tokens.join(''); // string join keeps leading zeros
}

export function formatParseError(error: ParseError): string {
  switch (error.kind) {
    case 'empty':
      return 'Please enter at least one number.';
    case 'non-digit':
      return `Invalid token ${JSON.stringify(error.token)}: digits only.`;
    case 'too-long':
      return `Invalid token ${JSON.stringify(error.token)}: must be 1–3 digits.`;
  }
}
