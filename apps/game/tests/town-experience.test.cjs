'use strict';
// Simulated DOM, not a browser. Covers the wiring of the escape room, journey strip, errand, sound
// preference and knowledge links against the real default course. Visuals are checked in a browser.
const test=require('node:test'),assert=require('node:assert/strict'),harness=require('../../../tests/town-harness.cjs');
const O={entrySchedule:true};
const tick=()=>new Promise(r=>setImmediate(r));

async function boot(data=new Map()){const h=await harness(data,O);h.run('close()');return h;}
const seeLessons=(h,n)=>h.run(`(()=>{const ctx=teachingContext();for(const l of studySection().lessons.slice(0,${n})){if(!ctx.p.found.includes(l.id))ctx.p.found.push(l.id);}save();})()`);

test('new modules load and add their state without touching existing progress',async()=>{
 const h=await boot();
 for(const name of ['TownKit','TownCloze','TownWeb','TownEscapeEngine','TownEscapeUI','TownSound','TownJourneyEngine','TownJourneyUI'])assert.notEqual(h.run(`typeof ${name}`),'undefined',name);
 assert.equal(h.run('JSON.stringify(Object.keys(state.escape))'),'["v","seenIntro","rooms"]');
 assert.equal(h.run('state.v'),3,'the save schema version is unchanged');
 assert.equal(h.run('studyState().deposited.length'),0);
});

test('the escape chain runs through the real scene and never changes foundations, sealed sections or assessments',async()=>{
 const h=await boot();
 const before=h.run('JSON.stringify([studyState().deposited,studyState().sealed,studyState().assessments,studyState().submitted,teachingContext().p.foundations])');
 assert.equal(h.list('[data-escape]').map(e=>e.dataset.escape).join(),'drawer');
 h.list('[data-escape]')[0].click();assert.ok(h.get('escapeOpenDrawer').disabled,'drawer is stuck until enough objects were seen');
 seeLessons(h,3);h.run('render()');
 h.list('[data-escape]')[0].click();assert.equal(h.get('escapeOpenDrawer').disabled,false);
 h.click('escapeOpenDrawer');h.click('escapeTakeKey');
 assert.equal(h.list('[data-escape]').map(e=>e.dataset.escape).join(),'chest');
 h.list('[data-escape]')[0].click();h.click('escapeOpenChest');
 const room=h.run('state.escape.rooms[Object.keys(state.escape.rooms)[0]]');assert.equal(room.slips.length,3);
 const coins=h.run('state.resources.coins');
 // every row answered correctly in one go
 room.slips.forEach((id,i)=>h.list('[data-opt]').find(o=>+o.dataset.row===i&&o.dataset.opt===id).click());
 h.click('escapeTry');
 assert.ok(h.get('escapePress')||h.get('escapeDone'),'the lock opens into the order plate or the clue card');
 const stored=h.run('state.escape.rooms[Object.keys(state.escape.rooms)[0]]');assert.equal(stored.lock,true);
 assert.equal(h.run('JSON.stringify([studyState().deposited,studyState().sealed,studyState().assessments,studyState().submitted,teachingContext().p.foundations])'),before,'optional side challenge leaves every learning record alone');
 assert.ok(h.run('state.resources.coins')>=coins);
});

test('wrong answers cost nothing and the coin for a finished room is paid once',async()=>{
 const h=await boot();seeLessons(h,3);h.run('render()');
 h.list('[data-escape]')[0].click();h.click('escapeOpenDrawer');h.click('escapeTakeKey');
 h.list('[data-escape]')[0].click();h.click('escapeOpenChest');
 const key=h.run('Object.keys(state.escape.rooms)[0]');
 const slips=h.run(`state.escape.rooms['${key}'].slips`);
 const wrong=h.list('[data-opt]').find(o=>+o.dataset.row===0&&o.dataset.opt!==slips[0]);wrong.click();
 const coins=h.run('state.resources.coins');h.click('escapeTry');
 assert.equal(h.run('state.resources.coins'),coins);assert.equal(h.run(`state.escape.rooms['${key}'].rows[0]`),false);assert.equal(h.run(`state.escape.rooms['${key}'].tries[0]`),1);
 assert.match(h.get('dialogBody').innerHTML,/escape-hint/);
 // finish properly, then call finish again through the engine
 slips.forEach((id,i)=>h.list('[data-opt]').find(o=>+o.dataset.row===i&&o.dataset.opt===id).click());h.click('escapeTry');
 h.run(`(()=>{const r=state.escape.rooms['${key}'];const has=!!TownWeb.chain(r.slips);if(has){TownEscapeEngine.tryOrder(r,TownWeb.chain(r.slips),TownWeb.chain(r.slips));}})()`);
 const out1=h.run(`TownEscapeEngine.finish(state.escape.rooms['${key}'],1,!!TownWeb.chain(state.escape.rooms['${key}'].slips))`);
 const out2=h.run(`TownEscapeEngine.finish(state.escape.rooms['${key}'],2,!!TownWeb.chain(state.escape.rooms['${key}'].slips))`);
 assert.equal(out2.reward,0);assert.ok(out1.ok);
});

test('the escape room and journey state survive save and reload; damaged fields are repaired, not fatal',async()=>{
 const h=await boot();seeLessons(h,3);h.run('render()');
 h.list('[data-escape]')[0].click();h.click('escapeOpenDrawer');h.click('escapeTakeKey');
 h.run('save()');await tick();await tick();
 const again=await harness(h.data,O);again.run('close()');
 assert.equal(again.run('Object.values(state.escape.rooms)[0].key'),true);
 assert.equal(again.list('[data-escape]').map(e=>e.dataset.escape).join(),'chest');
 // damage the optional fields in the stored save
 const k=[...h.data.keys()].find(key=>String(h.data.get(key)).includes('escape'));
 const wrap=JSON.parse(h.data.get(k)),raw=JSON.parse(wrap.json);
 raw.escape={rooms:{'x|1.1':{key:true,chest:true,slips:['a']}},seenIntro:'yes'};raw.journey={visits:[7,'nope'],errands:'bad'};
 wrap.json=JSON.stringify(raw);const bad=new Map(h.data);bad.set(k,JSON.stringify(wrap));
 const repaired=await harness(bad,O);
 assert.equal(repaired.run('state.escape.rooms["x|1.1"].key'),false,'a key without a drawer is dropped');
 assert.equal(repaired.run('state.journey.visits.every(v=>typeof v==="string")'),true);
 assert.equal(repaired.run('studyState().deposited.length'),0,'learning records are untouched');
});

test('journey panel shows existing progress and follows the display language',async()=>{
 const h=await boot();
 h.run('TownJourneyUI.showJourney()');assert.match(h.get('dialogBody').innerHTML,/0\/4/);assert.match(h.get('dialogBody').innerHTML,/未开始/);
 h.run(`changeTownLanguage('en')`);h.run('TownJourneyUI.showJourney()');assert.match(h.get('dialogBody').innerHTML,/Not started/);
 assert.equal(h.run('studyState().assessments.length'),0);
});

// The errand shows one question at a time; the harness has no way to read the hidden answer, so it
// reproduces the same deterministic questions the panel builds and answers them by id.
function errandAnswers(h){
 return h.run(`(()=>{const d=TownJourneyUI.data(),j=state.journey,key=TownJourneyEngine.errandKey(j,Date.now(),new Date().getTimezoneOffset());
  const all=d.course.chapters.flatMap(ch=>ch.sections.flatMap(sec=>sec.lessons.map(l=>({lesson:l,sec})))),own=new Set([...d.study.deposited,...d.study.read]);
  const mine=all.filter(x=>own.has(x.lesson.id)),pool=mine.length>=3?mine:all;
  const sibs=l=>(all.find(x=>x.lesson.id===l.id)?.sec.lessons||[]).filter(x=>x.id!==l.id);
  return TownCloze.items(pool.map(x=>x.lesson),sibs,3,{seed:'errand|'+d.study.chapter+'|'+key,seen:new Set(d.study.read)}).map(q=>q.answer);})()`);
}
function playErrand(h,answers){for(const a of answers){h.list('[data-pick]').find(o=>o.dataset.pick===a).click();h.click('errandGo');}}

test('daily errand pays once per day and counts nothing toward assessments',async()=>{
 const h=await boot();const answers=errandAnswers(h);assert.equal(answers.length,3);
 const coins=h.run('state.resources.coins');
 h.run('TownJourneyUI.showErrand()');assert.ok(h.list('[data-pick]').length>=3);
 // a wrong pick first: nothing is lost and the same question stays
 const q0=h.list('[data-pick]').find(o=>o.dataset.pick!==answers[0]);q0.click();h.click('errandGo');
 assert.equal(h.run('state.resources.coins'),coins);assert.match(h.get('dialogBody').innerHTML,/escape-hint/);
 playErrand(h,answers);
 assert.ok(h.get('errandDone'),'three favours end on the thank-you card');
 assert.equal(h.run('state.resources.coins'),coins+1);
 const key=h.run('Object.keys(state.journey.errands)[0]');assert.equal(h.run(`state.journey.errands['${key}'].done`),true);
 assert.equal(h.run(`state.journey.errands['${key}'].score`),2,'the question missed once does not count as first-try');
 h.click('errandDone');h.run('TownJourneyUI.showErrand()');playErrand(h,answers);
 assert.equal(h.run('state.resources.coins'),coins+1,'a second run on the same day gives no second reward');
 assert.equal(h.run('studyState().assessments.length'),0);
});

test('sound is off by default, keeps its own setting and never touches the save',async()=>{
 const h=await boot();
 assert.equal(h.run('TownSound.enabled()'),false);
 assert.equal(h.run('Object.keys(JSON.parse(JSON.stringify(state))).some(k=>/sound|music|audio/i.test(k))'),false);
 h.run('TownSound.play("good")');
 assert.equal(h.run('JSON.stringify(TownSound.prefs())'),'{"on":false,"music":0.7,"sfx":0.8}');
});

test('reading a concept shows knowledge links; the concept map lights what was seen and changes nothing',async()=>{
 const h=await boot();
 const lesson=h.run('studySection().lessons[3]');
 h.list('[data-study-fruit]').find(e=>e.dataset.studyFruit===lesson.id).click();
 assert.match(h.get('dialogBody').innerHTML,/知识连线/);assert.match(h.get('dialogBody').innerHTML,/先要懂/);
 const before=h.run('JSON.stringify(studyState())');
 h.click('leaveLesson');h.run('TownJourneyUI.showJourney()');h.click('journeyMap');
 assert.ok(h.list('[data-map-node]').length>=10);assert.equal(h.run('JSON.stringify(studyState())'),before);
});

test('knowledge relations cover the whole default course and chains are well formed',async()=>{
 const h=await boot();
 const r=h.run(`(()=>{const idx=TownWeb.index();let none=0,total=0;for(const [id] of idx){total++;const x=TownWeb.relations(id);if(!(x.requires.length||x.unlocks.length||x.mistakes.length||x.same.length))none++;}return {total,none};})()`);
 assert.equal(r.total,139);assert.equal(r.none,0);
});

test('fill-in questions blank the same number of terms in Chinese and English and always contain the answer',async()=>{
 const h=await boot();
 const r=h.run(`(()=>{const out={n:0,bad:[],noAnswer:0};for(const ch of currentCourse().chapters)for(const sec of ch.sections)for(const l of sec.lessons){const q=TownCloze.item(l,sec.lessons.filter(x=>x.id!==l.id),{seed:'t'});if(!q){out.bad.push(l.id);continue;}out.n++;if(!q.options.some(o=>o.id===q.answer))out.noAnswer++;if(new Set(q.options.map(o=>o.id)).size!==q.options.length)out.bad.push(l.id);if(q.cloze&&l.en?.body){const z=(q.text.zh.match(/＿＿/g)||[]).length,e=(q.text.en.match(/____/g)||[]).length;if(z!==e)out.bad.push(l.id);}}return out;})()`);
 assert.equal(r.n,139);assert.equal(r.noAnswer,0);assert.equal(JSON.stringify(r.bad),'[]');
});

// Regression for a real bug: #loot has pointer-events:none, so any prop added to it must switch them
// back on or a person's mouse passes straight through it (a scripted .click() would not notice).
test('every clickable prop added to the scene opts back in to pointer events',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const css=fs.readFileSync(path.join(process.env.TOWN_TEST_DIST||path.resolve(__dirname,'../../../dist'),'town-experience.css'),'utf8');
 const rule=css.match(/\.escape-prop\{[^}]*\}/);
 assert.ok(rule,'.escape-prop rule exists');
 assert.match(rule[0],/pointer-events:\s*auto/,'props must be clickable inside the click-through #loot layer');
 const world=fs.readFileSync(path.join(process.env.TOWN_TEST_DIST||path.resolve(__dirname,'../../../dist'),'world.css'),'utf8');
 assert.match(world,/#loot[^{]*\{[^}]*pointer-events:\s*none/,'precondition: the loot layer is click-through');
});
