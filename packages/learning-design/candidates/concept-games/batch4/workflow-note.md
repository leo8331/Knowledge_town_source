# Batch 4: execute bounded workflows

Exact frozen enhanced sources: `1.2-lesson-3`, `1.2.2-unit-3`, `1.2-lesson-2`, `1.2.2-unit-1`, `1.2.2-unit-2`. All five definitions are actual pure-data candidates, not frozen-package edits. Rules, identities, amounts, failures and source records are exercise assumptions. The root attaches original knowledge teaching/evidence, SHA binding and outer gates; plugin never grants collection or formal mastery.

UMD `workflow-games.js`: Node require or browser `ConceptWorkflowGames`; exports `{kinds,init(descriptor),step(descriptor,data,action)}`. Step clones data and returns `{data,feedback,passed}`. Feedback includes exact itemId, localized explanation and sourceUnitId revisit link. Root must own acknowledge, replay, bound context and collection. Invalidating old evidence never erases current correct settings or prior trace history.

## handoff-builder

Render `config.steps[].label` and their stated task needs, stages, handoffFields labels, owners, sourceRefs labels, scenarios and actions. `requires` describes the given task dependency, not a string to type. Hide private required/requiredOwner and injected scenario.failStep until the run reveals its trace. Both scenarios have visible labels describing the exercise failure to be simulated; locating its actual trace and human handover remains required.

- `{type:'setStage',stepId,stage:number}` places one step in a zero-based stage. UI labels can be “阶段1/Stage 1”. Independent retrievals share a stage; dependent consumers run later. The task asks learners to exploit the stated independent work, not memorize a universal sequence.
- `{type:'setHandoff',field,enabled:boolean}` chooses actual handoff evidence/enforcement fields.
- `{type:'setOwner',ownerId}` sets the designated human responder.
- `{type:'run',scenarioId}` executes the simulated graph. `data.runs` contains id, revision, events (stepId/stage/status), sources, selected fields, status and designated owner. Failures hold dependent later stages while the independent completed retrieval remains available. Config errors produce configuration-blocked events rather than fake completion.
- `{type:'diagnose',runId,stepId,ownerId}` locates the failed execution step and designated human responder in an actual current-revision run.
- `{type:'check'}` returns separate dependency, parallelism, source/status/failure/owner and run-evidence feedback.

The overview flow reads price and stock, drafts, then human-reviews. The detailed flow retrieves policy/order, reviews both, then drafts, requiring permitted-scope retention **and independent receiving authorization**. Scope text in material does not confer authorization. Passing requires normal and failure runs under the same final revision plus correct failure handover. Merely arranging stages or checking all fields cannot pass.

## bounded-agent

Render goal/settings options and tools, followed by case labels and probe actions. Do not show settings.expected/tools.allowed/cases.expectedResults as prefilled answers. `cases.requests` become execution trace on probe; their invisible expected values are grading data. All controls show natural language, never require internal IDs.

- `{type:'setSetting',key,value}` selects a visible option (value is string/number/boolean exactly as descriptor). Keys: goal, maxCalls, stopOnGoal, escalate, serverAuth, audit, contract.
- `{type:'setTool',toolId,allowed:boolean}` configures minimum tool allowlist.
- `{type:'probe',caseId}` executes that request sequence under current settings, recording per-request result, caller, audit flag and `simulated:true`. Render result via config.resultLabels. Counters restart for each exercise case, not each request.
- `{type:'check'}` diagnoses each setting/tool and missing current-revision probes.

Overview requires policy lookup then drafting, stopping only when draft goal completes; email remains forbidden. Autonomy focuses one lookup tool with goal-stop, consecutive-failure and quota boundaries. Tool-contract concept adds explicit server-denied unauthorized/above-20 requests, invalid-input errors, caller audit and authorized simulated state changes. Two attempts and amount 20 are this exercise’s conditions only. Prompt reminders alone permit unsafe simulated effects and fail; no real request or side effect occurs.

Every effective config change increments revision; previous probes do not validate changed-back configuration. Passing requires all meaningful cases under the final configuration, not a positive case or correct-looking settings. Error messages preserve selections and point to source knowledge. For diagnosis, C can highlight individual failed request results plus the final per-setting check, without clearing correct choices.

Validation command: `node --test packages/learning-design/candidates/concept-games/batch4/workflow-games.test.cjs`. Root independent review, binding/replay integration and real-browser checks remain necessary; this plugin test is not visual verification.
