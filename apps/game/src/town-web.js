/* Knowledge web: where a concept sits among the others (prerequisites, follow-ups,
   common misunderstandings, same family). Reads only data the course already carries.
   Display only: it never changes foundations, applications, scores or saves. */
'use strict';
const TownWeb=(()=>{
 const tail=id=>String(id||'').split(':').pop();
 function ctx(){try{return typeof teachingContext==='function'?teachingContext():null;}catch{return null;}}
 function index(){
  const course=typeof currentCourse==='function'?currentCourse():null,map=new Map();
  if(!course)return map;
  course.chapters.forEach((ch,ci)=>ch.sections.forEach((sec,si)=>sec.lessons.forEach(l=>map.set(l.id,{lesson:l,section:sec,chapter:ch,ci,si}))));
  return map;
 }
 // unit id <-> lesson id, taken from the teaching entry when the course has one.
 function unitMaps(){
  const c=ctx(),toLesson={},toUnit={};
  if(!c)return {toLesson,toUnit,units:new Map()};
  for(const ch of c.entry.chapters||[])for(const sec of ch.sections||[])for(const [u,l] of Object.entries(sec.unitToLesson||{})){toLesson[u]=l;toUnit[l]??=u;}
  return {toLesson,toUnit,units:new Map((c.entry.knowledge?.units||[]).map(u=>[u.id,u]))};
 }
 function requiresOf(id,idx,c){
  const info=idx.get(id);if(!info||!c)return [];
  try{return (c.flow.foundation(info.section.id,id)?.requires||[]).map(tail).filter(x=>idx.has(x));}catch{return [];}
 }
 function relations(id){
  const idx=index(),info=idx.get(id);
  if(!info)return {requires:[],unlocks:[],mistakes:[],same:[]};
  const c=ctx(),maps=unitMaps(),requires=new Set(requiresOf(id,idx,c)),unlocks=[];
  const unit=maps.units.get(maps.toUnit[id]);
  for(const pid of unit?.prerequisiteIds||[]){const lid=maps.toLesson[pid]||(idx.has(pid)?pid:null);if(lid&&lid!==id&&idx.has(lid))requires.add(lid);}
  for(const l of info.section.lessons)if(l.id!==id&&requiresOf(l.id,idx,c).includes(id))unlocks.push(l.id);
  const mistakes=(unit?.misconceptions||[]).map(m=>({zh:m.zh,en:m.en||m.zh}));
  const used=new Set([id,...requires,...unlocks]);
  const same=info.section.lessons.filter(l=>!used.has(l.id)&&l.category&&l.category===info.lesson.category).map(l=>l.id).slice(0,4);
  return {requires:[...requires].slice(0,4),unlocks:unlocks.slice(0,4),mistakes:mistakes.slice(0,2),same};
 }
 // Order ids into one prerequisite chain; null when the course gives no single usable chain.
 function chain(ids,idx=index()){
  const c=ctx();if(!c)return null;
  const set=new Set(ids),next=new Map(),prev=new Map();
  for(const id of set){const r=requiresOf(id,idx,c).find(x=>set.has(x));if(r){prev.set(id,r);next.set(r,id);}}
  const head=[...set].filter(id=>!prev.has(id));
  if(head.length!==1)return null;
  const out=[head[0]];while(next.has(out[out.length-1])){const n=next.get(out[out.length-1]);if(out.includes(n))return null;out.push(n);}
  return out.length===set.size?out:null;
 }
 // Longest run of found lessons joined by prerequisite links (3..want long), or null.
 function foundChain(foundIds,want=4){
  const idx=index(),c=ctx();if(!c)return null;
  const have=new Set(foundIds);let best=null;
  for(const start of have){
   const run=[start];let cur=start;
   while(run.length<want){const nx=[...have].find(x=>!run.includes(x)&&requiresOf(x,idx,c).includes(cur));if(!nx)break;run.push(nx);cur=nx;}
   if(run.length>=3&&(!best||run.length>best.length))best=run;
  }
  return best;
 }
 const chip=(id,idx,done)=>`<span class="web-chip${done?' done':''}">${TownKit.tf(TownKit.title(idx.get(id).lesson))}${done?' ✓':''}</span>`;
 function block(id){
  const idx=index(),info=idx.get(id);if(!info)return '';
  const r=relations(id),s=typeof studyState==='function'?studyState():null,seen=new Set([...(s?.read||[]),...(s?.deposited||[]),...(s?.carried||[])]);
  const row=(zh,en,ids)=>ids.length?`<div class="web-row"><b>${TownKit.t(zh,en)}</b>${ids.map(x=>chip(x,idx,seen.has(x))).join('')}</div>`:'';
  const mistakes=r.mistakes.length?`<div class="web-row web-mistake"><b>${TownKit.t('容易想错','Easy to get wrong')}</b><span>${r.mistakes.map(m=>TownKit.t(m.zh,m.en)).join('<br>')}</span></div>`:'';
  const body=row('先要懂','Understand first',r.requires)+row('接着会用到','Leads to',r.unlocks)+mistakes+row('同一家族','Same family',r.same);
  if(!body)return '';
  return `<section class="web-block" data-locale-fixed="true" aria-label="${TownKit.safe(TownKit.plain('知识连线','Knowledge links'))}"><h3>${TownKit.t('知识连线','Knowledge links')}</h3>${body}</section>`;
 }
 // Add the block to an open reading dialog, once, just before its action row.
 function decorate(id){
  try{
   const body=$('dialogBody');if(!body||!$('leaveLesson'))return;
   if(/class="web-block"/.test(body.innerHTML))return;
   const html=block(id);if(!html)return;
   const marker='<div class="actions">',at=body.innerHTML.indexOf(marker);
   if(at<0)return;
   const next=body.innerHTML.slice(0,at)+html+body.innerHTML.slice(at);
   /* 重写 innerHTML 会让已经绑好的按钮（返回上一页、开启概念小游戏…）连同事件和禁用状态一起丢掉，
      表现是按钮还在但点不动、该锁的反而能点。改写前记下每个带 id 按钮的状态，改完逐个接回去。 */
   const kept=new Map(),nodes=[];
   const walk=node=>{for(const child of node.children||[]){nodes.push(child);if(child.id)kept.set(child.id,{onclick:child.onclick,disabled:child.disabled,hidden:child.hidden,checked:child.checked,value:child.value,text:child.textContent});walk(child);}};
   walk(body);
   const open=document.activeElement;
   body.innerHTML=next;
   const present=new Set([...body.children].map(child=>child.id).filter(Boolean));
   for(const child of nodes)if(child.id&&!present.has(child.id))body.appendChild(child);
   for(const [key,state]of kept){const el=$(key);if(!el)continue;if(state.onclick)el.onclick=state.onclick;for(const prop of ['disabled','hidden','checked','value','textContent'])if(state[prop]!==undefined)el[prop]=state[prop];}
   if(open&&open.id&&$(open.id))$(open.id).focus?.();
   }catch{}
   }
 // ---- section map: every concept of a section as a small tree, lit as you meet them ----
 // Depth = how many prerequisite steps lead to the concept inside this section.
 function layout(sectionId){
  const idx=index(),c=ctx(),ids=[...idx.values()].filter(i=>i.section.id===sectionId).map(i=>i.lesson.id);
  const depth=new Map(),parentOf=new Map();
  const walk=id=>{
   if(depth.has(id))return depth.get(id);
   depth.set(id,0);
   const req=requiresOf(id,idx,c).filter(x=>ids.includes(x));
   parentOf.set(id,req);
   const d=req.length?1+Math.max(...req.map(walk)):0;
   depth.set(id,d);return d;
  };
  ids.forEach(walk);
  const levels=[];ids.forEach(id=>{const d=depth.get(id);(levels[d]??=[]).push(id);});
  return {ids,levels:levels.filter(Boolean),parentOf,idx};
 }
 function mapHtml(sectionId,state2){
  const L2=layout(sectionId);if(!L2.ids.length)return '';
  const seen=new Set([...(state2.read||[]),...(state2.found||[])]),filed=new Set(state2.deposited||[]);
  const lit=L2.ids.filter(x=>seen.has(x)||filed.has(x)).length;
  const chainOnly=L2.levels.every(lv=>lv.length===1);
  const node=id=>{const l=L2.idx.get(id).lesson,st=filed.has(id)?'filed':seen.has(id)?'seen':'dark',mark=st==='filed'?'✓':st==='seen'?'●':'○';
   return `<button class="map-node ${st}" data-map-node="${TownKit.safe(id)}" aria-label="${TownKit.safe(TownKit.plain(l.title+(st==='filed'?'，已整理':st==='seen'?'，已看过':'，还没看'),(l.en?.title||l.title)+(st==='filed'?', filed':st==='seen'?', seen':', not seen yet')))}" data-locale-fixed="true"><span aria-hidden="true">${mark}</span>${TownKit.tf(TownKit.title(l))}</button>`;};
  if(chainOnly)return {html:`<div class="map-flow">${L2.levels.map(lv=>node(lv[0])).join('<span class="map-arrow" aria-hidden="true">→</span>')}</div>`,lit,total:L2.ids.length};
  const rows=L2.levels.map((lv,i)=>`<div class="map-level" data-level="${i}">${lv.map(id=>{const l=L2.idx.get(id).lesson,st=filed.has(id)?'filed':seen.has(id)?'seen':'dark';
   const mark=st==='filed'?'✓':st==='seen'?'●':'○';
   return `<button class="map-node ${st}" data-map-node="${TownKit.safe(id)}" aria-label="${TownKit.safe(TownKit.plain(l.title+(st==='filed'?'，已整理':st==='seen'?'，已看过':'，还没看'),(l.en?.title||l.title)+(st==='filed'?', filed':st==='seen'?', seen':', not seen yet')))}" data-locale-fixed="true"><span aria-hidden="true">${mark}</span>${TownKit.tf(TownKit.title(l))}</button>`;}).join('')}</div>`).join('<div class="map-arrow" aria-hidden="true">↓</div>');
  return {html:rows,lit,total:L2.ids.length};
 }
 return {relations,chain,foundChain,block,decorate,index,requiresOf,layout,mapHtml};
})();
if(typeof module==='object')module.exports=TownWeb;
