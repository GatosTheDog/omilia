# Natural Numbers Interpretation

A command-line tool that takes a sequence of recognized spoken numbers (each up to three digits, separated by spaces), prints the concatenated number, says whether it is a valid Greek phone number, and lists every plausible reading of ambiguous input.

## Requirements

- TypeScript (strict mode), compiled with `tsc` to `dist/`.
- Node.js 20 or later (the `engines` field requires `>=20`). Developed and tested with Node.js 20.20.2 and npm 10.8.2.
- npm, which installs the build and test toolchain exactly as pinned in `package-lock.json`.
- There are no runtime dependencies: `package.json` lists only `devDependencies` (TypeScript, Jest, ts-jest and type definitions), used to build and test.
- The commands below are written for a POSIX shell (macOS, Linux, WSL).

## Install, build, run and test

```bash
npm ci                                  # install exact versions from package-lock.json
npm run build                           # compile src/ to dist/ (tsc)
npm start --silent                      # interactive prompt; Ctrl+D ends it (exit 1)
npm start --silent -- 30 2 5 58         # one-shot via arguments (exit 0)
echo "30 2 5 58" | npm start --silent   # piped input (exit 0)
npm test                                # builds first (pretest), then runs Jest
```

- `--silent` keeps npm's own banner out of the output, so results can be piped.
- `npm start` compiles first (about 4 seconds), so the prompt appears after a short pause.
- At the prompt a rejected line prints its message and prompts again. Ctrl+D ends the session with exit code 1; under `npm start`, Ctrl+C stops the process by signal instead.
- Everything after `--` goes to the program. Arguments take precedence over piped input.
- `npm test` compiles first and runs Jest. The `ExperimentalWarning: VM Modules is an experimental feature` lines it prints are expected.

## Sample session

Real output for the input `2 10 69 30 6 6 4`:

```text
Enter a number sequence: 2 10 69 30 6 6 4
Identified number: 2106930664
Phone number: VALID

Interpretation  Output       Phone number
1               2106930664   VALID
2               210693664    INVALID
3               2106093664   VALID
4               21060930664  INVALID
```

## Ambiguity rules and assumptions

Speech recognition can transcribe the same utterance in more than one way, so some token sequences have several plausible readings. The tool applies three rules.

### Rules

| Rule | Applies when | Example |
|------|--------------|---------|
| Tens + unit merge | a tens token 20, 30, ..., 90 is followed by a single digit 1 to 9 | `30 6` gives `306` or `36` |
| Tens split | a two-digit token 21 to 99 that is not a multiple of 10 | `69` gives `69` or `609`; `75` gives `75` or `705` |
| Hundreds merge | a token 100, 200, ..., 900 is followed by a token 1 to 99 | `700 5` gives `7005` or `705` |

- `10` and the teens 11 to 19 are single spoken words. `10` never merges with a following digit (`10 6` stays `106`) and teens are never split, but they are valid second tokens of a hundreds merge: `700 15` gives `70015` or `715`, and `700 10` gives `70010` or `710`.
- The token right after a multiple of 100 is the number that hundreds token merges with, so it is never split. `700 24` gives exactly `70024` or `724`, and `700 69` gives exactly `70069` or `769`. A token further along splits as usual: the `24` in `700 5 24` still gives `24` or `204`.
- Tokens with a leading zero (`0`, `00`, `05`, `030`) and 3-digit tokens that are not multiples of 100 never take part in any rule.
- Each token takes part in at most one rule, so `700 20 5` gives `700205`, `70025` and `7205` and no chained reading.
- Numbers are joined as text, so leading zeros are kept.

### Assumptions

- Input: tokens are ASCII digits only, 1 to 3 characters, separated by one or more spaces. An empty line, a token with any other character or a token longer than 3 digits is rejected.
- Phone number: a number is VALID when it has 10 digits and starts with 2 or 69, or has 14 digits and starts with 00302 or 003069 (the `00` is the international prefix of `+30`). Every other length or prefix is INVALID. The check is on the digits exactly as joined, with no `+30` handling and no stripping of spaces or zeros.
- Display cap: at most `MAX_ROWS = 1000` rows are printed. It is a constant in `src/cli.ts`, not configurable. The total is counted exactly without listing the readings, so very long ambiguous input still answers at once.

### Order of the interpretations

The plain concatenation is always first. The rest follow reflected Gray-code order over the ambiguous choices, with the leftmost choice changing slowest: after the plain reading, the next rows change the last choice, and each earlier choice flips the order in which the later ones are listed. The same input always gives the same order.

For `2 10 69 30 6 6 4`:

1. `2106930664` (plain)
2. `210693664` (`30 6` merged)
3. `2106093664` (`69` split and `30 6` merged)
4. `21060930664` (`69` split only)

### Output

The tool first prints `Identified number:` and the `Phone number:` verdict for the plain concatenation. If the input has more than one distinct interpretation it then prints an empty line and a table with the columns Interpretation, Output and Phone number, one numbered row per distinct digit string, each marked VALID or INVALID. Unambiguous input prints only the first two lines.

The result is a set of distinct digit strings, but with these rules two different readings never produce the same digits, so no row is ever dropped as a duplicate; the de-duplication is only a safeguard.

When more readings exist than `MAX_ROWS`, the table shows the first 1000 and the last line names the exact total, for example `Showing first 1000 of 1024 interpretations (list truncated).` for ten repetitions of `30 6`.

### Exit codes and messages

- Exit 0 when the input is accepted, whether the verdict is VALID or INVALID.
- Exit 1 when the input is rejected, when piped input is empty, or when the prompt ends with Ctrl+D.
- Rejected input prints one message on stderr and nothing on stdout:
  - empty input: `Please enter at least one number.`
  - a token with a non-digit character (here `abc`): `Invalid token "abc": digits only.`
  - a token longer than 3 digits (here `1234`): `Invalid token "1234": must be 1–3 digits.`
- Any unexpected failure prints one line starting `Unexpected error:` followed by the error message, and exits 1.
- At the prompt, a rejected line prints its message and asks again.

### Example 3

The input `0 0 30 69 700 24 1 3 50 2` has three independent choices: split `69`, merge `700 24` and merge `50 2`. It therefore has 2 x 2 x 2 = 8 interpretations. `30 69` is not a merge because `69` is not a single digit, and the `24` after `700` is not split.

Four of the eight rows:

- row 1: `0030697002413502` (plain)
- row 2: `003069700241352` (`50 2` merged)
- row 4: `00306972413502` (`700 24` merged; the only VALID row)
- row 6: `00306097241352` (`69` split with both merges)

The leading `00` is kept in every row.

## Not covered

Chained merges (for example reading `700 20 5` as one number, `725`), splitting teens, splitting 3-digit hundreds tokens and a `--valid-only` filter flag are not implemented and are outside the scope of this version.
