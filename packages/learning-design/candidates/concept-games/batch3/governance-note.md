# Governance operations: batch 3 candidate

Four exact A-reviewed source concepts from `packages/knowledge/candidates/concept-games/batch2.v1.json`; source wording, assumptions, policy and boundaries retained. No real permission requests, backend reads or infrastructure changes occur. All cases are exercise assumptions. Root attaches frozen source teaching/evidence/hash and precise bindings; these files never grant collection or formal mastery.

Plugin `governance-games.js` is UMD: Node require or browser `ConceptGovernanceGames`. Exports `{kinds,init(descriptor),step(descriptor,data,action)}`. `step` clones its data and returns `{data,feedback,passed}`. Feedback is per-item `{itemId,correct,message:{zh,en},knowledgeIds:[sourceUnitId]}`; wrong actions do not clear correct settings. Root supplies acknowledge and replay, signatures, source binding and collection gates.

## permission-gate

Render `identity,purpose`, resources (labels, selected grants), filterOptions, requests and human-readable resultLabels. Do not render resources.allowed or requests.expected as the answer. The authorized purpose is taught in natural language before operation, not hidden: the task is to configure and test that boundary.

- `{type:'setGrant',resourceId,allowed:boolean}` changes one grant.
- `{type:'setFilter',choice:'before'|'after'}` selects gate placement using visible labels.
- `{type:'probe',requestId}` actually simulates the request under current configuration; `data.probes` contains revision, requestId and result, with resultLabels supplying visible text. No personnel contents are ever stored.
- `{type:'check'}` evaluates current minimum grants, gate placement and same-revision probes.

Passing requires exactly the stated minimum grants, a pre-retrieval gate, successful positive policy probe and both negative personnel/approval probes under the same final revision. Any effective config change increments revision, so changing back does not revive old test evidence. Correct settings remain selected; rerun only current tests. Merely choosing the expected settings cannot pass.

## runbook-rehearsal

Render scenario, requirements as evidence-selection slots, evidence cards, routes, targets and action labels. Do not render requirements.expected, responderRoute, knownTarget or recoveryEvidence as answers. The recovery-record card is evidence the learner must select **after** running the simulation; choosing the card before execution cannot prove recovery.

- `{type:'selectEvidence',slotId:'owner'|'runbook',evidenceId}` selects an actual supporting record, not a readiness checkbox.
- `{type:'setRoute',routeId}` and `{type:'setTarget',targetId}` configure the simulation.
- `{type:'testAlert'}` records whether the simulated test reached the accepted owner under this revision.
- `{type:'rehearseRollback'}` records a simulated rollback attempt to the chosen target using the selected runbook. A new rollback clears the prior recovery verification.
- `{type:'verifyRecovery',evidenceId}` checks a post-rollback record. A demo screenshot cannot establish recovered version/service probes.
- `{type:'check'}` gives individual owner/runbook/alert/rollback/recovery feedback.

Passing requires accepted owner, current runbook and all three actual simulation/check results under the final config revision. Changing any configuration invalidates prior results without deleting selected correct evidence. This proves only the stated exercise checklist, never full production readiness, legal compliance or universal incident order.

## evidence-board (existing staging root engine)

Policy version and pilot transfer reuse the existing `{type:'inspect',evidenceId}` → `{type:'judge',claimId,decision,evidenceIds}` API, with standard supported/refuted/unknown labels. Render evidence/claims text, not hidden expected/evidenceIds/feedback fields before judgment. Policy preserves unopened, within 7 days of receipt, submission versus approval, and unknown opened/damaged handling. Transfer pauses only the unvalidated new department; it preserves the original pilot’s tested scope and distinguishes material-only updates from remaining handover/load gaps. These are taught cases, not unseen independent formal exam items.

Tests: `node --test packages/learning-design/candidates/concept-games/batch3/governance-games.test.cjs`. Root must independently review, integrate into wrapper and test bindings/replay; no real-browser verification claimed.
