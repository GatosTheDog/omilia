// Pure ambiguity engine: no I/O, no imports. Tokens are the validated digit strings from parseTokens (ASCII digits, 1 to 3 characters, leading zeros kept).

// Tens source: a tens token 20..90 (10 is excluded on purpose).
const TENS = /^[2-9]0$/;
// Tens unit: a single digit 1..9 (zero and zero-led tokens stay inert).
const UNIT = /^[1-9]$/;
// Split candidate: a two-digit token without a leading zero; the 21..99 non-multiple range is checked in code.
const TWO_DIGIT = /^[1-9][0-9]$/;
// Hundreds source: a multiple of 100, 100..900 (also used to test the previous token).
const HUNDREDS = /^[1-9]00$/;
// Hundreds target: 1..99 without a leading zero; 0, 00, 05 and 3-digit tokens are not targets; teens and 10 are.
const TARGET = /^[1-9][0-9]?$/;

/** One choice at a token index: the digits it emits and the index of the next unconsumed token. */
interface Step {
  readonly text: string;
  readonly next: number;
}

/**
 * Options at index i in canonical order: the plain step first, then at most one rule step.
 * Rules: tens + unit merge, tens split, hundreds merge; a token directly after a multiple
 * of 100 is never split. Leading-zero and 3-digit non-hundreds tokens are inert. Each token
 * takes part in at most one rule.
 */
function stepsAt(tokens: readonly string[], i: number): Step[] {
  const cur = tokens[i] ?? '';
  const steps: Step[] = [{ text: cur, next: i + 1 }];
  const prev = i > 0 ? tokens[i - 1] : undefined;
  // A multiple of 100 never matches another rule, so a token after one is a potential merge target and is never split.
  const afterHundreds = prev !== undefined && HUNDREDS.test(prev);
  if (!afterHundreds && TWO_DIGIT.test(cur)) {
    const v = Number(cur);
    // Split 21..99 into tens + unit; teens and multiples of ten fall outside.
    if (v >= 21 && v % 10 !== 0) {
      steps.push({ text: `${v - (v % 10)}${v % 10}`, next: i + 1 });
    }
  }
  const nxt = tokens[i + 1];
  if (
    nxt !== undefined &&
    ((TENS.test(cur) && UNIT.test(nxt)) || (HUNDREDS.test(cur) && TARGET.test(nxt)))
  ) {
    // A tens token + unit, or a multiple of 100 + a 1..99 token, also reads as their numeric sum.
    steps.push({ text: String(Number(cur) + Number(nxt)), next: i + 2 });
  }
  return steps;
}

interface Frame {
  readonly steps: Step[];
  readonly order: number[];
  cursor: number;
  readonly flip: boolean;
}

function openFrame(tokens: readonly string[], i: number, flip: boolean): Frame {
  const steps = stepsAt(tokens, i);
  const order = steps.map((_step, k) => k);
  if (flip) order.reverse();
  return { steps, order, cursor: 0, flip };
}

/**
 * Reflected Gray-code traversal with an explicit stack (no recursion, no nested
 * generators, so very long inputs cannot overflow the call stack). May repeat a string in
 * principle; interpretations() removes repeats.
 */
function* walk(tokens: readonly string[]): Generator<string, void, undefined> {
  if (tokens.length === 0) {
    yield '';
    return;
  }
  const stack: Frame[] = [openFrame(tokens, 0, false)];
  const parts: string[] = [];
  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame === undefined) break;
    if (frame.cursor === frame.order.length) {
      stack.pop();
      if (stack.length > 0) parts.pop();
      continue;
    }
    const k = frame.order[frame.cursor];
    frame.cursor += 1;
    if (k === undefined) continue;
    const step = frame.steps[k];
    if (step === undefined) continue;
    parts.push(step.text);
    if (step.next >= tokens.length) {
      yield parts.join('');
      parts.pop();
    } else {
      // Taking the rule option reverses the order in which the suffix is enumerated.
      stack.push(openFrame(tokens, step.next, frame.flip !== (k % 2 === 1)));
    }
  }
}

/** Yields each string the first time it is seen; the rules cannot produce duplicates today, the set is a safeguard. */
export function* distinct(source: Iterable<string>): Generator<string, void, undefined> {
  const seen = new Set<string>();
  for (const s of source) {
    if (!seen.has(s)) {
      seen.add(s);
      yield s;
    }
  }
}

/** Lazy, distinct digit strings for the tokens: plain concatenation first, then Gray-code order. */
export function interpretations(tokens: readonly string[]): Generator<string> {
  return distinct(walk(tokens));
}

/** Exact number of strings the traversal yields, computed from the same stepsAt options without enumerating them. */
export function countInterpretations(tokens: readonly string[]): bigint {
  const ways: bigint[] = Array.from({ length: tokens.length + 1 }, () => 0n);
  ways[tokens.length] = 1n;
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    let total = 0n;
    for (const step of stepsAt(tokens, i)) {
      total += ways[step.next] ?? 0n;
    }
    ways[i] = total;
  }
  return ways[0] ?? 1n;
}

/** At most `limit` interpretations, pulled lazily; the generator is never spread. */
export function firstInterpretations(tokens: readonly string[], limit: number): string[] {
  const taken: string[] = [];
  if (limit <= 0) return taken;
  for (const s of interpretations(tokens)) {
    taken.push(s);
    if (taken.length === limit) break;
  }
  return taken;
}
