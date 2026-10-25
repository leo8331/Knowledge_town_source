/* Escape-room chain rules (no DOM). One room per study section:
   drawer (needs enough scene discoveries) -> brass key -> locked chest -> three clue slips
   -> combination lock (three fill-in dials) -> order plate (put concepts in learning order, if the
   section has a prerequisite chain) -> clue card.
   It is an optional side challenge: it never changes foundations, applications, assessments or
   the 90% rule. Its only rewards are one learning coin per room and a recap card. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TownEscapeEngine=api;})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
const MIN_LESSONS=4,NEED_FOUND=3,SLIPS=3;
const key=(bankId,sectionId)=>String(bankId)+'|'+String(sectionId);
function freshRoom(){return {drawer:false,key:false,chest:false,slips:[],rows:[],tries:[],lock:false,order:null,done:false,rewarded:false,at:0};}
function fresh(){const f={v:1,seenIntro:false,rooms:{}};OK.add(f);return f;}
// Objects we built (or repaired) carry this mark, so callers keep using the live object instead of a copy.
const isObj=v=>v&&typeof v==='object'&&!Array.isArray(v);
const OK=new WeakSet();
function ensure(raw){if(isObj(raw)&&OK.has(raw))return raw;return normalize(raw);}
const bool=v=>v===true;
const ids=v=>Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,8):[];
// Lenient repair. Bad data is dropped instead of rejecting the whole save.
function normalize(raw){
 const out=fresh();if(!isObj(raw))return out;
 out.seenIntro=bool(raw.seenIntro);
 if(isObj(raw.rooms))for(const [k,r] of Object.entries(raw.rooms).slice(0,200)){
  if(!isObj(r)||typeof k!=='string'||!k.includes('|'))continue;
  const room=freshRoom();
  room.drawer=bool(r.drawer);room.key=bool(r.key)&&room.drawer;room.chest=bool(r.chest)&&room.key;
  room.slips=room.chest?ids(r.slips).slice(0,SLIPS):[];
  if(room.slips.length!==SLIPS){room.slips=[];room.chest=bool(r.chest)&&room.key;}
  room.rows=room.slips.map((_,i)=>bool(r.rows?.[i]));
  room.tries=room.slips.map((_,i)=>Number.isInteger(r.tries?.[i])&&r.tries[i]>=0?Math.min(r.tries[i],99):0);
  room.lock=room.slips.length===SLIPS&&room.rows.every(Boolean)&&bool(r.lock);
  if(isObj(r.order))room.order={done:bool(r.order.done),tries:Number.isInteger(r.order.tries)&&r.order.tries>=0?Math.min(r.order.tries,99):0,ids:ids(r.order.ids)};
  room.done=bool(r.done)&&room.lock;room.rewarded=bool(r.rewarded)&&room.done;
  room.at=Number.isFinite(r.at)?r.at:0;
  out.rooms[k]=room;
 }
  OK.add(out);
 return out;
}
function room(escape,bankId,sectionId,create=true){
 const k=key(bankId,sectionId);
 if(!escape.rooms[k]){if(!create)return null;escape.rooms[k]=freshRoom();}
 return escape.rooms[k];
}
// A section is playable when it has enough concepts to build three different questions.
function available(section){return !!section&&Array.isArray(section.lessons)&&section.lessons.length>=MIN_LESSONS;}
function needFound(section){return Math.min(NEED_FOUND,Math.max(1,(section?.lessons?.length||NEED_FOUND)-1));}
function stage(r,hasOrder){
 if(!r.drawer)return 'drawer';
 if(!r.key)return 'key';
 if(!r.chest)return 'chest';
 if(!r.lock)return 'lock';
 if(hasOrder&&!(r.order&&r.order.done))return 'order';
 return r.done?'done':'finish';
}
function stepsTotal(hasOrder){return hasOrder?5:4;}
function stepsDone(r,hasOrder){return [r.key,r.chest,r.lock,hasOrder?(r.order&&r.order.done):null,r.done].filter(x=>x!==null).filter(Boolean).length;}
function openDrawer(r,foundCount,need){if(r.drawer)return {ok:true,already:true};if(foundCount<need)return {ok:false,missing:need-foundCount};r.drawer=true;return {ok:true};}
function takeKey(r){if(!r.drawer)return {ok:false};if(r.key)return {ok:true,already:true};r.key=true;return {ok:true};}
function openChest(r,slipIds){
 if(!r.key)return {ok:false,reason:'key'};
 if(r.chest)return {ok:true,already:true};
 if(!Array.isArray(slipIds)||slipIds.length!==SLIPS||new Set(slipIds).size!==SLIPS)return {ok:false,reason:'slips'};
 r.chest=true;r.slips=[...slipIds];r.rows=slipIds.map(()=>false);r.tries=slipIds.map(()=>0);return {ok:true};
}
// picks[i] = chosen lesson id for slip i (or null). Rows that are right stay solved.
function tryLock(r,picks){
 if(!r.chest||r.lock)return {ok:false};
 const result=r.slips.map((answer,i)=>{
  if(r.rows[i])return {row:i,correct:true,fixed:true};
  if(!picks?.[i])return {row:i,correct:false,fixed:false,skipped:true,tries:r.tries[i]||0};
  const correct=picks[i]===answer;
  if(correct)r.rows[i]=true;else r.tries[i]=Math.min(99,(r.tries[i]||0)+1);
  return {row:i,correct,fixed:false,tries:r.tries[i]};
 });
 const solved=r.rows.every(Boolean);if(solved)r.lock=true;
 return {ok:true,result,solved};
}
// order = ids in the player's chosen sequence; expected = correct sequence.
function tryOrder(r,order,expected){
 if(!r.lock)return {ok:false};
 r.order??={done:false,tries:0,ids:[]};
 if(r.order.done)return {ok:true,solved:true,positions:expected.map(()=>true)};
 const positions=expected.map((id,i)=>order?.[i]===id),solved=positions.length>0&&positions.every(Boolean)&&order.length===expected.length;
 if(solved){r.order.done=true;r.order.ids=[...expected];}else r.order.tries=Math.min(99,r.order.tries+1);
 return {ok:true,solved,positions,tries:r.order.tries};
}
function finish(r,now=Date.now(),hasOrder=false){
 if(!r.lock||(hasOrder&&!(r.order&&r.order.done)))return {ok:false};
 if(r.done)return {ok:true,already:true,reward:0};
 r.done=true;r.at=now;
 const reward=r.rewarded?0:1;r.rewarded=true;
 return {ok:true,reward};
}
return {MIN_LESSONS,NEED_FOUND,SLIPS,key,fresh,freshRoom,normalize,ensure,room,available,needFound,stage,stepsTotal,stepsDone,openDrawer,takeKey,openChest,tryLock,tryOrder,finish};
});
