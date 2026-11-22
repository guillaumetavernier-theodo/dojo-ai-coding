# Fixing a red CI

`bernard pull-request` hands over when its checks are red (exit 4, `STOP_REASON=CI_RED`), with a `FAILED_CHECK=<name> STATE=<state> LINK=<link>` line per failed check, the state in the forge's own words (`TIMED_OUT`, `CANCELLED`, `broken`…). The checks are those of the feature's pull request when the ticket merges itself, of the ticket's pull request otherwise.

## Each attempt

1. **Diagnose.** For each failed check, read its log with `bernard pull-request --failed-log '<link>'`. On a forge that cannot serve the log, it prints the link back: read the cause from the check's name and from running the project's checks locally. Read the error before changing anything: never run a check again hoping it passes, and never call a failure flaky without evidence.
2. **A cause outside the code ends the round.** A missing secret, a runner that does not start, a service the check needs that is down, an expired credential: `blocked`, naming the check and the cause. No fix of yours can change it.
3. **Fix the cause, not the symptom.** No skipped test, no weakened assertion, no silenced warning.
4. **Verify locally.** Run the project's checks, under _Checks_ below, and leave nothing red.
5. **Commit and land.** A commit on the ticket's branch that follows the project's commit conventions, then run the same `bernard pull-request` command again: it pushes, lands the fix on the feature's branch when the ticket merges itself, and waits for the checks of the new commit.

## Checks

`npm --prefix modern run check`, which runs Biome (formatter, linter, import order), the type-checker (`tsc --noEmit`) and the unit tests (Vitest, `modern/src/**/*.test.ts`).

## The stop rule

`bernard pull-request` merges the base into a pull request that conflicts with it, without you. It stops on `CI_CONFLICT` (exit 9) when the pull request still conflicts afterwards: that is not a red check, run the same command again, except when the stop says the pull request holds only the records: report `blocked`, naming the branch.

One round of fixes per run. When the checks are red again after your fix, stop and report `failed` with `ci-red`, the failure class of the `CI_RED` stop. The step's failure budget in the graph, not you, decides whether it runs again. The failure goes into the ticket's committed record, so copy nothing from a log into it: give each failed check's name and state, and name the cause in your own words. A log line can carry a credential no filter catches.
