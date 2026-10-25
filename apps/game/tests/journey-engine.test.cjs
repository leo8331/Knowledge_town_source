'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const J=require(path.resolve(__dirname,'../src/town-journey-engine.js'));
const T=(s)=>Date.parse(s+'T12:00:00Z');

test('visits count distinct days and a missed day never subtracts anything',()=>{
 const j=J.fresh();
 J.visit(j,T('2026-10-20'),0);J.visit(j,T('2026-10-20'),0);J.visit(j,T('2026-10-21'),0);
 assert.deepEqual(j.visits,['2026-10-20','2026-10-21']);
 assert.equal(J.run(j,T('2026-10-21'),0),2);
 assert.equal(J.run(j,T('2026-10-22'),0),2,'an open evening after yesterday still shows the run');
 assert.equal(J.run(j,T('2026-10-25'),0),0,'after a gap the run restarts, but nothing else is lost');
 J.visit(j,T('2026-10-25'),0);
 assert.equal(j.visits.length,3);assert.equal(J.weekCount(j,T('2026-10-25'),0),3);
 assert.equal(J.weekCount(j,T('2026-11-20'),0),0);
});

test('local midnight is used, not UTC midnight',()=>{
 const t=Date.parse('2026-10-21T01:30:00Z');
 assert.equal(J.dayKey(t,0),'2026-10-21');
 assert.equal(J.dayKey(t,420),'2026-10-20','UTC-7 is still on the 20th');
});

test('normalize drops bad entries and keeps good ones',()=>{
 assert.deepEqual(J.normalize(undefined),J.fresh());
 const n=J.normalize({visits:['2026-10-21','nope',5,'2026-10-21','2026-10-20'],errands:{'2026-10-21':{done:true,score:9,total:3,rewarded:true},'bad':{done:true},'2026-10-22':{done:false,score:2,rewarded:true}},lastSeen:'x',welcomed:'2026-10-21-extra-long'});
 assert.deepEqual(n.visits,['2026-10-20','2026-10-21']);
 assert.equal(n.errands['2026-10-21'].score,5,'score is clamped');
 assert.equal(n.errands.bad,undefined);
 assert.equal(n.errands['2026-10-22'].rewarded,false,'an errand that is not done cannot have been rewarded');
 assert.equal(n.lastSeen,0);assert.equal(n.welcomed.length,10);
 assert.deepEqual(J.normalize(JSON.parse(JSON.stringify(n))),n);
});

test('the daily errand pays its coin once, even if finished twice',()=>{
 const j=J.fresh();
 assert.equal(J.completeErrand(j,'2026-10-21',3,3).reward,1);
 assert.equal(J.completeErrand(j,'2026-10-21',1,3).reward,0);
 assert.equal(J.errandState(j,'2026-10-21').score,1,'the latest result is shown');
 assert.equal(J.errandState(j,'2026-10-22').done,false);
});

const course={chapters:[
 {title:'A',english:'A',zone:'grove',sections:[{id:'1.1',title:'x',lessons:[{id:'l1'},{id:'l2'}]},{id:'1.2',title:'y',lessons:[{id:'l3'}]}]},
 {title:'B',english:'B',zone:'harbor',sections:[{id:'2.1',title:'z',lessons:[{id:'m1'},{id:'m2'}]}]}]};
const study=(over={})=>({deposited:[],sealed:[],submitted:[],assessments:[],records:{},...over});

test('progress only counts what the existing rules already recorded',()=>{
 let p=J.sectionProgress(course,study());
 assert.deepEqual(p.map(c=>J.stage(c)),['new','new']);
 p=J.sectionProgress(course,study({deposited:['l1']}));assert.equal(J.stage(p[0]),'learning');assert.equal(p[0].collected,1);
 p=J.sectionProgress(course,study({deposited:['l1','l2','l3'],sealed:['1.1','1.2']}));assert.equal(J.stage(p[0]),'submit');
 p=J.sectionProgress(course,study({deposited:['l1','l2','l3'],sealed:['1.1','1.2'],submitted:[0]}));assert.equal(J.stage(p[0]),'practice');
 p=J.sectionProgress(course,study({submitted:[0],assessments:[{chapter:0,total:10,correct:8}]}));
 assert.equal(J.stage(p[0]),'practice','80% is not a pass');assert.equal(p[0].attempted,true);assert.equal(p[0].passed,false);
 p=J.sectionProgress(course,study({submitted:[0],assessments:[{chapter:0,total:10,correct:8},{chapter:0,total:10,correct:9}]}));
 assert.equal(J.stage(p[0]),'passed','90% is exactly the pass line');
 const o=J.overall(p);assert.equal(o.passed,1);assert.equal(o.chapters,2);
});

test('chapters stay independent: passing one says nothing about another',()=>{
 const p=J.sectionProgress(course,study({submitted:[0],assessments:[{chapter:0,total:10,correct:10}]}));
 assert.equal(J.stage(p[0]),'passed');assert.equal(J.stage(p[1]),'new');
});

test('review counts come from the chapter records own due dates',()=>{
 const now=T('2026-10-21');
 const r=J.dueReview(study({records:{a:{attempts:2,wrong:1,resolved:false,due:now-1},b:{attempts:1,wrong:0,resolved:false,due:now+DAYS(2)},c:{attempts:0,due:now-1},d:{attempts:3,wrong:2,resolved:true,due:0}}}),course,now);
 assert.deepEqual(r,{due:1,wrong:1});
});
function DAYS(n){return n*86400000;}
