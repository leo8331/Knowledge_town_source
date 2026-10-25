'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const src=path.resolve(__dirname,'../src');
const E=require(path.join(src,'town-escape-engine.js'));

test('a room only opens in order: drawer, key, chest, lock, order plate, finish',()=>{
 const r=E.freshRoom();
 assert.equal(E.stage(r,true),'drawer');
 assert.equal(E.takeKey(r).ok,false,'no key before the drawer');
 assert.equal(E.openChest(r,['a','b','c']).ok,false,'no chest before the key');
 assert.equal(E.openDrawer(r,2,3).ok,false);assert.equal(E.openDrawer(r,2,3).missing,1);
 assert.equal(E.openDrawer(r,3,3).ok,true);assert.equal(E.stage(r,true),'key');
 assert.equal(E.takeKey(r).ok,true);assert.equal(E.stage(r,true),'chest');
 assert.equal(E.openChest(r,['a','a','b']).ok,false,'slips must be three different concepts');
 assert.equal(E.openChest(r,['a','b','c']).ok,true);assert.equal(E.stage(r,true),'lock');
 assert.equal(E.tryOrder(r,['a','b','c'],['a','b','c']).ok,false,'order plate stays shut until the lock opens');
 assert.equal(E.finish(r,1,true).ok,false);
});

test('lock rows stay solved, wrong picks only count tries and never block',()=>{
 const r=E.freshRoom();E.openDrawer(r,3,3);E.takeKey(r);E.openChest(r,['a','b','c']);
 let out=E.tryLock(r,['a','x','x']);
 assert.deepEqual(out.result.map(x=>x.correct),[true,false,false]);assert.equal(out.solved,false);
 assert.deepEqual(r.rows,[true,false,false]);assert.deepEqual(r.tries,[0,1,1]);
 out=E.tryLock(r,['x','b','x']);
 assert.equal(out.result[0].fixed,true,'a solved row cannot be undone by a later wrong pick');
 assert.deepEqual(r.rows,[true,true,false]);
 out=E.tryLock(r,[null,null,'c']);assert.equal(out.solved,true);assert.equal(r.lock,true);
 assert.equal(E.tryLock(r,['a','b','c']).ok,false,'an open lock cannot be tried again');
});

test('order plate: wrong order counts a try, right order completes, reward is paid once',()=>{
 const r=E.freshRoom();E.openDrawer(r,3,3);E.takeKey(r);E.openChest(r,['a','b','c']);E.tryLock(r,['a','b','c']);
 assert.equal(E.stage(r,true),'order');
 let o=E.tryOrder(r,['b','a','c'],['a','b','c']);assert.equal(o.solved,false);assert.deepEqual(o.positions,[false,false,true]);assert.equal(r.order.tries,1);
 assert.equal(E.finish(r,5,true).ok,false,'cannot finish before the order plate');
 o=E.tryOrder(r,['a','b','c'],['a','b','c']);assert.equal(o.solved,true);
 let f=E.finish(r,10,true);assert.equal(f.ok,true);assert.equal(f.reward,1);
 f=E.finish(r,20,true);assert.equal(f.already,true);assert.equal(f.reward,0,'no second reward');
 assert.equal(r.at,10);
});

test('sections without a prerequisite chain skip the order plate',()=>{
 const r=E.freshRoom();E.openDrawer(r,3,3);E.takeKey(r);E.openChest(r,['a','b','c']);E.tryLock(r,['a','b','c']);
 assert.equal(E.stage(r,false),'finish');assert.equal(E.stepsTotal(false),4);assert.equal(E.stepsTotal(true),5);
 assert.equal(E.finish(r,7,false).reward,1);assert.equal(E.stepsDone(r,false),4);
});

test('normalize repairs damaged saves instead of rejecting them',()=>{
 assert.deepEqual(E.normalize(null),E.fresh());
 assert.deepEqual(E.normalize('junk'),E.fresh());
 const s=E.normalize({v:9,seenIntro:true,rooms:{'b|1.1':{drawer:false,key:true,chest:true,slips:['a','b','c'],lock:true,done:true,rewarded:true},'broken':{drawer:true},'b|1.2':{drawer:true,key:true,chest:true,slips:['a','b'],rows:[true,true],lock:true,done:true}}});
 assert.equal(s.seenIntro,true);
 const a=s.rooms['b|1.1'];assert.equal(a.key,false,'key without drawer is dropped');assert.equal(a.chest,false);assert.equal(a.lock,false);assert.equal(a.done,false);assert.equal(a.rewarded,false);
 assert.equal(s.rooms.broken,undefined);
 const b=s.rooms['b|1.2'];assert.equal(b.chest,true);assert.deepEqual(b.slips,[],'wrong slip count is reset');assert.equal(b.lock,false);assert.equal(b.done,false);
 const good=E.fresh(),g=E.room(good,'b','1.1');E.openDrawer(g,3,3);E.takeKey(g);E.openChest(g,['a','b','c']);E.tryLock(g,['a','b','c']);E.finish(g,3,false);
 const round=E.normalize(JSON.parse(JSON.stringify(good)));assert.deepEqual(round,good,'a valid save survives a round trip unchanged');
});

test('availability and discovery threshold follow the section size',()=>{
 assert.equal(E.available({lessons:[1,2,3]}),false);assert.equal(E.available({lessons:[1,2,3,4]}),true);assert.equal(E.available(null),false);
 assert.equal(E.needFound({lessons:new Array(22)}),3);assert.equal(E.needFound({lessons:new Array(4)}),3);
});

test('rows the player did not touch are skipped, never counted as wrong',()=>{
 const r=E.freshRoom();E.openDrawer(r,3,3);E.takeKey(r);E.openChest(r,['a','b','c']);
 const out=E.tryLock(r,['x',null,undefined]);
 assert.deepEqual(out.result.map(x=>!!x.skipped),[false,true,true]);
 assert.deepEqual(r.tries,[1,0,0],'only the row that was actually answered wrongly counts a try');
 const again=E.tryLock(r,[null,null,null]);
 assert.deepEqual(r.tries,[1,0,0],'trying with nothing picked changes nothing');
 assert.equal(again.solved,false);
});
