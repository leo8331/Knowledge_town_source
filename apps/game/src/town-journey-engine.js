/* Journey summary and return-visit rules (no DOM).
   Everything here is derived from state the game already keeps, or from small display-only
   fields kept in state.journey. It never decides what counts as foundation, application or pass:
   it only counts what those existing rules already recorded. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TownJourneyEngine=api;})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
const DAY=86400000,PASS=0.9;
const isObj=v=>v&&typeof v==='object'&&!Array.isArray(v);
const dayKey=(t,offset)=>{const d=new Date(t-(offset||0)*60000);return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0');};
const dayNumber=key=>{const [y,m,d]=key.split('-').map(Number);return Math.round(Date.UTC(y,m-1,d)/DAY);};
const OK=new WeakSet();
function fresh(){const f={v:1,visits:[],errands:{},lastSeen:0,welcomed:''};OK.add(f);return f;}
function ensure(raw){if(isObj(raw)&&OK.has(raw))return raw;return normalize(raw);}
function normalize(raw){
 const out=fresh();if(!isObj(raw))return out;
 out.visits=(Array.isArray(raw.visits)?raw.visits:[]).filter(x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)).slice(-120);
 out.visits=[...new Set(out.visits)].sort();
 if(isObj(raw.errands))for(const [k,v] of Object.entries(raw.errands).slice(-200)){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(k)||!isObj(v))continue;
  out.errands[k]={done:v.done===true,score:Number.isInteger(v.score)?Math.min(5,Math.max(0,v.score)):0,total:Number.isInteger(v.total)?Math.min(5,Math.max(0,v.total)):0,rewarded:v.rewarded===true&&v.done===true};
 }
 out.lastSeen=Number.isFinite(raw.lastSeen)?raw.lastSeen:0;
 out.welcomed=typeof raw.welcomed==='string'?raw.welcomed.slice(0,10):'';
 OK.add(out);
 return out;
}
// Soft streak: only counts distinct days you came. A missed day never subtracts anything.
function visit(j,now,offset){
 const key=dayKey(now,offset);if(!j.visits.includes(key)){j.visits.push(key);j.visits.sort();if(j.visits.length>120)j.visits.splice(0,j.visits.length-120);}
 j.lastSeen=now;return key;
}
function weekCount(j,now,offset){
 const today=dayNumber(dayKey(now,offset));return j.visits.filter(k=>{const n=dayNumber(k);return n<=today&&n>today-7;}).length;
}
// Consecutive-day run ending today (or yesterday, so an open evening does not look like a loss).
function run(j,now,offset){
 const set=new Set(j.visits.map(dayNumber));let n=dayNumber(dayKey(now,offset)),count=0;
 if(!set.has(n))n-=1;
 while(set.has(n)){count++;n-=1;}return count;
}
function sectionProgress(course,study,ctxFor){
 return course.chapters.map((ch,ci)=>{
  const all=ch.sections.flatMap(s=>s.lessons),collected=all.filter(l=>study.deposited.includes(l.id)).length;
  const secs=ch.sections.map(sec=>({id:sec.id,title:sec.title,total:sec.lessons.length,sealed:study.sealed.includes(sec.id),
   deposited:sec.lessons.filter(l=>study.deposited.includes(l.id)).length,
   found:ctxFor?ctxFor(sec).found:0,confirmed:ctxFor?ctxFor(sec).confirmed:0}));
  const assessments=study.assessments.filter(a=>a.chapter===ci&&a.total>0),best=assessments.reduce((m,a)=>Math.max(m,a.correct/a.total),0);
  return {index:ci,title:ch.title,english:ch.english,zone:ch.zone,sections:secs,total:all.length,collected,
   sealedCount:secs.filter(s=>s.sealed).length,sectionCount:secs.length,
   submitted:study.submitted.includes(ci),best,attempted:assessments.length>0,passed:best>=PASS};
 });
}
// Layered state for one chapter, from "not started" to "passed". Matches the wording the game already uses.
function stage(ch){
 if(ch.passed)return 'passed';
 if(ch.submitted)return 'practice';
 if(ch.sealedCount===ch.sectionCount&&ch.sectionCount>0)return 'submit';
 if(ch.sealedCount>0||ch.collected>0)return 'learning';
 return 'new';
}
function overall(chapters){
 const total=chapters.reduce((n,c)=>n+c.total,0),collected=chapters.reduce((n,c)=>n+c.collected,0);
 return {chapters:chapters.length,passed:chapters.filter(c=>c.passed).length,submitted:chapters.filter(c=>c.submitted).length,
  sections:chapters.reduce((n,c)=>n+c.sectionCount,0),sealed:chapters.reduce((n,c)=>n+c.sealedCount,0),total,collected,
  percent:total?Math.round(collected/total*100):0};
}
// What review work is waiting. dueCount comes from the chapter records' own due dates.
function dueReview(study,course,now){
 let due=0,wrong=0;
 for(const [id,r] of Object.entries(study.records||{})){
  if(!isObj(r)||!r.attempts)continue;
  if(r.wrong&&!r.resolved)wrong++;
  if(Number.isFinite(r.due)&&r.due>0&&r.due<=now)due++;
 }
 return {due,wrong};
}
function errandKey(j,now,offset){return dayKey(now,offset);}
function errandState(j,key){return j.errands[key]||{done:false,score:0,total:0,rewarded:false};}
function completeErrand(j,key,score,total){
 const e=j.errands[key]=j.errands[key]||{done:false,score:0,total:0,rewarded:false};
 e.done=true;e.score=Math.min(5,Math.max(0,score|0));e.total=Math.min(5,Math.max(0,total|0));
 const reward=e.rewarded?0:1;e.rewarded=true;
 const keys=Object.keys(j.errands).sort();while(keys.length>200)delete j.errands[keys.shift()];
 return {reward};
}
return {DAY,PASS,fresh,normalize,ensure,dayKey,dayNumber,visit,weekCount,run,sectionProgress,stage,overall,dueReview,errandKey,errandState,completeErrand};
});
