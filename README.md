# Natural Numbers Interpretation

A command-line tool that takes a sequence of recognized spoken numbers (each up to three digits, separated by spaces), prints the concatenated number, says whether it is a valid Greek phone number, and lists every plausible reading of ambiguous input.

## Requirements

TypeScript (strict mode) on Node.js 20 or later, with npm. There are no runtime dependencies; `package.json` lists only dev dependencies (TypeScript, Jest, ts-jest) used to build and test.

## Install, build, run and test

```bash
npm ci                                  # install exact versions from package-lock.json
npm run build                           # compile src/ to dist/ (tsc)
npm start --silent                      # interactive prompt; Ctrl+D ends it
npm start --silent -- 30 2 5 58         # one-shot via arguments
echo "30 2 5 58" | npm start --silent   # piped input
npm test                                # builds first, then runs Jest
```

## Sample session

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

## Interpretation rules

The plain reading is always listed first, then the alternatives in a fixed order.

| Rule | Applies when | Example |
|------|--------------|---------|
| Tens + unit merge | a tens token 20, 30, ..., 90 is followed by a single digit 1 to 9 | `30 6` gives `306` or `36` |
| Tens split | a two-digit token 21 to 99 that is not a multiple of 10 | `69` gives `69` or `609` |
| Hundreds merge | a token 100, 200, ..., 900 is followed by a token 1 to 99 | `700 5` gives `7005` or `705` |

- `10` and the teens 11 to 19 are never split and `10` never merges with a following digit, but they can follow a hundreds token: `700 15` gives `70015` or `715`.
- The token after a multiple of 100 is never split (`700 24` gives `70024` or `724`), and each token takes part in at most one rule.
- Numbers are joined as text, so leading zeros are kept.

## Assumptions

- Input is 1 to 3 ASCII digits per token, separated by spaces. Anything else is rejected with a message on stderr and exit code 1.
- A phone number is VALID when it has 10 digits and starts with 2 or 69, or has 14 digits and starts with 00302 or 003069. Everything else is INVALID.
- At most `MAX_ROWS = 1000` rows are printed; the last line then states the exact total.

Not implemented: chained merges (reading `700 20 5` as `725`), splitting teens, and a `--valid-only` flag.
