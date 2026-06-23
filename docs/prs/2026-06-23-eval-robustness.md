# Eval robustness: per-item isolation + spec alignment

Date: 2026-06-23
Branch: `fix/eval-robustness`
Time since implementation: same session.

## Summary

Third engineering-audit PR. Closes P2-3: one malformed judge response no longer
aborts a whole Opus-priced eval run, and the spec now matches the real judge.

## What changed

- **Per-item isolation:** new `src/services/eval/runDataset.ts` runs each dataset
  item (`collectAgentRun` then `judgeResult`) inside a try/catch, returning
  `{ results, failures }`. A thrown error records `{ id, error }` and the run
  continues. `evals/runEval.ts` uses it and prints any failures instead of dying.
- **Spec alignment:** the design spec said the judge used `messages.parse` +
  `zodOutputFormat` structured output; the implementation uses `messages.create`
    - JSON parse (fence-stripped) + Zod `ScoreSchema` validation. The spec now
      describes the actual mechanism and notes the per-item isolation.

## Architectural decisions

- **A tested `runDataset` helper** (chosen) vs an inline try/catch in the script.
  Why: `runEval.ts` is a `void main()` script that reads/writes disk; extracting
  the loop makes the isolation behavior unit-testable without touching the
  filesystem. One mocked item throws, the other still scores.
- **Record-and-continue** (chosen) vs a sentinel failed `Score`. Why: `ScoreSchema`
  has a `min(1)` floor, so a zeroed sentinel would not validate; a separate
  `failures` list is honest and keeps the report's averages over real scores only.
- **Update the spec, not the code** (chosen) for the mechanism drift. Why: the
  `messages.create` + validate path is the robust, SDK-version-independent one
  already shipped and reviewed; the spec was the stale artifact.

## Testing

TDD: `runDataset.test.ts` mocks the agent collector and judge, makes the judge
throw for the second of two items, and asserts the first still scores while the
second lands in `failures`. 43 tests pass. tsc/lint/prettier/build all green.

## Reflection

The fence-stripping regex in the judge was the tell that the model was never
constrained to structured output; isolating per-item failure is the pragmatic
guard for a probabilistic judge whose output cannot be fully trusted to parse.
