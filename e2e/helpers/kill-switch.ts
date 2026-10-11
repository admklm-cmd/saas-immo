import { test } from "@playwright/test";

import { setAiPaused } from "./local-agency";
import { fixtureUser, type FixtureUserKey } from "./sign-in";

/**
 * Hooks that make a spec flipping the agency-wide AI kill switch REPLAYABLE.
 *
 * The kill switch is a single agency-wide boolean: once a run leaves it on, no
 * agent of that agency can run any more, so every later test that starts an
 * agent waits for a result that will never come, times out, and drags the rest
 * of the file down with it (serial mode). The same leak also fails the Vitest
 * fixtures check, which asserts every fictitious agency is left running.
 *
 * Two nets, on purpose:
 *
 *  * `beforeEach` ESTABLISHES the state instead of assuming it. This is the
 *    real guarantee: even if a previous run was killed with the switch on, the
 *    next run starts from a known agency.
 *  * `afterEach` / `afterAll` RESTORE it. A `try/finally` inside the test body
 *    is not enough: when the deadline is reached Playwright abandons the body,
 *    so the `finally` may never be reached — whereas hooks get their own time
 *    slice. `afterAll` also covers the tests the serial mode skipped after a
 *    failure.
 *
 * Both fixture users of agency A (`agentA`, `directorA`) share the same agency,
 * so one key is enough per spec.
 */
export function keepAgentsRunning(userKey: FixtureUserKey = "agentA"): void {
  const resume = async (): Promise<void> => {
    const user = await fixtureUser(userKey);
    await setAiPaused(user.agencyId, false);
  };

  test.beforeEach(resume);
  test.afterEach(resume);
  test.afterAll(resume);
}
