# Third batch: four-chapter operations

Candidate only; no DOM/storage/network, no automatic favorite, filing, section pass or independent/formal mastery. New collection still requires real discovery plus replay-validated concept-game completion. Existing favorites remain preserved. This catalog is cumulative: 29 unique source concepts, 15 kinds, 118 exact bindings; **110 of 139 source concepts remain uncovered**. coverage.json describes all route-specific gaps, including local repeated lessons. Do not treat missing renderer/resolve=null as completed.

Node: require('./engine.js'). Browser load in order (paths relative to this directory):

1. ../engine.js → ConceptGames
2. ../staging/learning-methods.js → ConceptLearningMethods
3. ../staging/content-workshops.js → ConceptContentWorkshops
4. ../staging/engine.js → ConceptGamesNext
5. finance-games.js → ConceptFinanceGames
6. governance-games.js → ConceptGovernanceGames
7. engine.js → ConceptGamesThird

Use this directory's catalog.json with ConceptGamesThird. Same resolve/fresh/dispatch/restore/serialize/validate/collection API and six-field context as ../API.md. Hashes remain SHA256 of UTF8(JSON.stringify complete original object)), not sorted canonical text. New four kinds use engineFamily=concept-games-extension-2; all original 23 descriptors and their valid drafts delegate unchanged to the previous engine. New evidence boards use the fixed staging evidence implementation with read-at-judgment evidence; earlier guesses do not turn into a pass just by opening evidence afterward. Duplicate bindings fail closed.

Root wrapper owns teaching acknowledgement, replay and collection evidence. Never invoke a plugin directly as collection authority. C's draft wrapper is {serialized,ui}; supply draft.serialized to restore. Record passed evidence as earned exercise evidence, not a guarantee that every subsequent experimental configuration is correct. Incorrect exploration preserves earlier valid completion; inspect current feedback/data for the current configuration.

New kinds and actions, full labels/initial values/feedback rules/white lists:

- cost-ledger, volume-simulator: finance-note.md.
- permission-gate, runbook-rehearsal: governance-note.md.
- Two new evidence-board cases (policy version and pilot transfer): governance-note.md and ../staging/API.md.

Do not display privateExpected, allowed, expected, responderRoute, knownTarget, recoveryEvidence or feedback solution text as upfront answers. Ledger evidence can teach how to account for costs; the learner must classify all entries and calculate. Simulator results only appear after actual runs. Permissions and handover evidence are simulations with explicit exercise assumptions, no actual sensitive data or infrastructure. Teaching/evidence can be reread at any time; explanations and corrected passes remain assisted practice, never independent assessment. Keep correct selections/values and provide per-item knowledgeIds mapped via sourceUnitId, not guessed runtime lesson numbers.

Build reads reviewed A batch2 exercise bytes with a fixed SHA256, frozen enhanced knowledge, and exact original B4/B5 course/lesson objects. It writes only this directory's catalog/coverage. Replacing A bytes requires a new review, not bypassing the guard. Independent reviews and byte hashes are in review.json once accepted. Tests do not constitute real UI/visual/touch/storage integration acceptance; D/C must support each kind explicitly before enabling it.
