# Batch 5: retrieval checks and parameter/source updates

Four definitions reference frozen enhanced units `1.3-lesson-3`, `1.3.3-unit-1`, `1.3-lesson-4`, `1.3.3-unit-2`. Policies and all behaviors are synthetic exercise conditions. Root attaches original knowledge text/evidence, exact course/lesson/source binding and outer acknowledge/replay/collection. No changes to frozen packages, frontend or live data.

UMD `knowledge-update-games.js`: Node require or browser `ConceptKnowledgeUpdateGames`, exports `{kinds,init(descriptor),step(descriptor,data,action)}`. Pure step returns `{data,feedback,passed}`; feedback includes localized per-item diagnosis and sourceUnitId. Completion is corrected practice, never formal independent mastery.

## retrieval-pipeline

Render topic, filterOptions, document labels, case questions and answerOptions. Hide expectedDocumentId/expectedAnswer and post-attempt feedback until evaluation. **Do not display document.text before a simulated retrieval with `contentVisible:true`; unauthorized documents never return contents.** Render documents only through a matching retrieval record. The overview uses delivery timing; the detailed version uses refund eligibility and separate review.

- `{type:'setFilter',choice:'before'|'after'}` configures authorization position. An effective change increments revision and invalidates prior retrieval evidence without clearing answers.
- `{type:'retrieve',caseId,documentId}` actually simulates the selected route. `data.retrievals` exposes id, revision, caseId, documentId, result, contentVisible and whether the selected material satisfied the question’s version/relevance/authorization check. Show retrieved document text only when contentVisible.
- `{type:'answer',caseId,choice,retrievalId}` binds a natural-language answer to its actual retrieval record. Options must not be auto-selected.
- `{type:'check'}` gives separate per-case answer feedback; retrieval itself already gives the retrieval-check feedback.

Every case needs current/relevant/authorized retrieval **and** a supported answer. A current citation cannot make a universal guarantee supported. Missing holiday/opened-damaged coverage remains unknown rather than automatically permitted or forbidden. Retired and irrelevant documents fail even when authorized. Correct answers in other cases remain selected during correction. The positive, overclaim and missing-evidence cases are taught practice, not unseen exam items.

## adaptation-lab

This is a deterministic, explicitly simplified **format-parameter simulator**, not a real model or fine-tuning algorithm. The two variants adapt to two brief points versus two named fields; actual `formattedOutput` changes visibly for a held-out new ticket. It does not claim real training succeeds in one action.

Render formats, sample.text, documents labels, probe labels and question/options. Hide sample.forTraining, question.expected and internal private completion metadata. Display run formattedOutput, source version and parameter before/after visibly; that evidence is the teaching operation.

- `{type:'attach',documentId}` adds one document to the current request. Records that the parameter is unchanged; then run to observe. It does not maintain the external index.
- `{type:'setSample',sampleId,selected:boolean}` chooses training examples matching the target format. Incorrect mixed-format selections remain editable; correct selections persist.
- `{type:'train'}` performs the toy format-parameter update if the selected sample set matches the exercise task; records unchanged external source version. Does not modify policy facts.
- `{type:'retrieve'}` supplies the document from the current external index, initially v1; no parameter change.
- `{type:'refreshSource',version:'v2'}` maintains that index without training. Still requires a fresh retrieval and fact probe.
- `{type:'run',probeId}` runs the selected new-ticket/active-policy probe. `data.runs` provides localized formattedOutput, fact/source, parameter before/after and history markers.
- `{type:'judge',questionId,choice}` answers observed distinctions; `{type:'check'}` reports each missing or mistaken operation separately.

Concrete operation order: attach v2 → run new ticket (no training) → select correct samples and train → run new ticket (new format) → retrieve still-v1 index → run current-policy probe (stale facts despite changed format) → refreshSource v2 → retrieve → run current-policy probe (current facts) → judgments/check. This makes both contrasts observable; pure correct-looking settings or a one-off document attachment cannot pass. Correct history, source operations and samples survive wrong judgments.

Passing checks observation of request-only information without parameter change, an actual format-parameter change, held-out format behavior, stale external facts after training, maintained/retrieved current facts and the two conceptual judgments. Outer root remains responsible for replay, signatures and exact bindings. No real-browser verification is claimed.

Validation: `node --test packages/learning-design/candidates/concept-games/batch5/knowledge-update-games.test.cjs`. Root independent review and wrapper integration remain required.
