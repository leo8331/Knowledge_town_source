'use strict';
// Read-only baseline check; deliberately does not apply any proposed edit.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path'),C=require('../../../contracts');
const root=path.resolve(__dirname,'../../../..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const raw=read('dist/teaching-catalog-v5.js');
assert.equal(C.digest(raw),'d2e64e109a6708446ff346c2c1614cba4262b9a15d091c400209d08cef14499c','Catalog baseline changed: re-review required');
const catalog=vm.runInNewContext(raw+';TeachingCatalogV5');
const lesson=(entry,id)=>entry.course.chapters.flatMap(c=>c.sections.flatMap(s=>s.lessons)).find(l=>l.sourceUnitId===id);
const legacy=lesson(catalog.legacy,'1.1-lesson-5'),aib=lesson(catalog.aib,'1.1-lesson-5');
assert.equal(legacy.id,'1.1-lesson-12');assert.match(legacy.example,/低估/);assert.doesNotMatch(legacy.en.example,/underestimat|stockout/i);assert.match(aib.en.example,/underestimating.*stockouts/);
const modulePath=path.join(root,'packages/learning-design/candidates/playtest-fix/decision-task.js'),task=require(modulePath).task;
assert.equal(C.digest(JSON.stringify(task)),'95c767d878f2c87ae6f51215ac5459d56c297d2437c09e24117c4b015d72fc35','Task baseline changed: re-review required');
assert.equal(read('dist/playtest-decision-task.js'),fs.readFileSync(modulePath,'utf8'));
assert.equal(task.questions.find(q=>q.id==='job-a').expected,'run');assert.equal(task.questions.find(q=>q.id==='job-b').expected,'fit');
assert.match(task.questions.find(q=>q.id==='job-a').prompt.en,/unchanged weights/);assert.match(task.questions.find(q=>q.id==='job-b').prompt.en,/adjust weights/);
console.log('PASS: fixed baselines, legacy translation omission, A/B explicit weight conditions and unchanged answer interpretation; no files written.');
