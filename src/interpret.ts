const TENS = /^[2-9]0$/;
const UNIT = /^[1-9]$/;
const TWO_DIGIT = /^[1-9][0-9]$/;
const HUNDREDS = /^[1-9]00$/;
const TARGET = /^[1-9][0-9]?$/;

interface Step {
  readonly text: string;
  readonly next: number;
}

/** Options at index i: the plain step first, then at most one rule step (merge or split). */
function stepsAt(tokens: readonly string[], i: number): Step[] {
  const cur = tokens[i] ?? '';
  const steps: Step[] = [{ text: cur, next: i + 1 }];
  const prev = i > 0 ? tokens[i - 1] : undefined;
  const afterHundreds = prev !== undefined && HUNDREDS.test(prev);
  if (!afterHundreds && TWO_DIGIT.test(cur)) {
    const v = Number(cur);
    if (v >= 21 && v % 10 !== 0) {
      steps.push({ text: `${v - (v % 10)}${v % 10}`, next: i + 1 });
    }
  }
  const nxt = tokens[i + 1];
  if (
    nxt !== undefined &&
    ((TENS.test(cur) && UNIT.test(nxt)) || (HUNDREDS.test(cur) && TARGET.test(nxt)))
  ) {
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

/** Reflected Gray-code order via an explicit stack, so long inputs cannot overflow the call stack. */
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
      stack.push(openFrame(tokens, step.next, frame.flip !== (k % 2 === 1)));
    }
  }
}

export function* distinct(source: Iterable<string>): Generator<string, void, undefined> {
  const seen = new Set<string>();
  for (const s of source) {
    if (!seen.has(s)) {
      seen.add(s);
      yield s;
    }
  }
}

export function interpretations(tokens: readonly string[]): Generator<string> {
  return distinct(walk(tokens));
}

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

export function firstInterpretations(tokens: readonly string[], limit: number): string[] {
  const taken: string[] = [];
  if (limit <= 0) return taken;
  for (const s of interpretations(tokens)) {
    taken.push(s);
    if (taken.length === limit) break;
  }
  return taken;
}
