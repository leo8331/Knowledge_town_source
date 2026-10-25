/* Escape-room chain on top of the existing scene (optional side challenge).
   Drawer -> key -> locked chest -> clue slips -> combination lock -> order plate -> recap card.
   Wrong picks never subtract anything. Nothing here changes foundations, applications,
   assessments or the 90% rule; the only reward is one learning coin per room. */
'use strict';
const TownEscapeUI=(()=>{
 const E=TownEscapeEngine,K=TownKit;
 const PROPS={drawer:{icon:'🗄️',zh:'旧抽屉',en:'Old drawer'},chest:{icon:'🧰',zh:'上锁的木箱',en:'Locked chest'},lock:{icon:'🔐',zh:'密码锁',en:'Combination lock'},plate:{icon:'🧩',zh:'顺序石板',en:'Order plate'}};
 let draft=null,placement=null;
 function esc2(v){return K.safe(v);}
 const store=()=>{state.escape=E.ensure(state.escape);return state.escape;};
 function ctxInfo(){
  try{
   if(!K.inStudyScene())return null;
   const course=currentCourse(),sec=studySection(),bank=L.bank(state);
   if(!bank||!E.available(sec))return null;
   return {course,sec,bank,chapter:studyChapter()};
  }catch{return null;}
 }
 function foundIds(info){
  try{const ctx=teachingContext();return ctx?[...new Set([...(ctx.p.found||[]),...(ctx.p.viewed||[])])].filter(id=>info.sec.lessons.some(l=>l.id===id)):[];}catch{return [];}
 }
 function roomOf(info,create=true){return E.room(store(),info.bank.id,info.sec.id,create);}
 // Slips are chosen when the chest opens. Prefer three that form a prerequisite chain so the order plate has meaning.
 function pickSlips(info){
  const found=foundIds(info),lessons=info.sec.lessons;
  const chain=TownWeb.foundChain(found,3);
  if(chain&&chain.length>=3)return chain.slice(0,3);
  const random=TownCloze.rng(TownCloze.hash(info.bank.id+'|'+info.sec.id+'|slips')),pool=found.length>=3?found:lessons.map(l=>l.id);
  return TownCloze.shuffle(pool,random).slice(0,3);
 }
 const lessonOf=(info,id)=>info.sec.lessons.find(l=>l.id===id);
 const siblings=(info)=>l=>info.sec.lessons.filter(x=>x.id!==l.id);
 function questions(info,room){
  return room.slips.map(id=>TownCloze.item(lessonOf(info,id),siblings(info)(lessonOf(info,id)),{seed:info.bank.id+'|'+info.sec.id,seen:new Set(foundIds(info))}));
 }
 function progressLine(info,room){
  const chain=room.slips.length===3?TownWeb.chain(room.slips):null,has=!!chain;
  return {done:E.stepsDone(room,has),total:E.stepsTotal(has),hasOrder:has,chain};
 }
 // ---------- scene props ----------
 function propHtml(kind,pos,extra=''){
  const p=PROPS[kind];
  return `<button class="escape-prop ${kind}" data-escape="${kind}" style="left:${pos.x}%;top:${pos.y}%" aria-label="${esc2(K.plain(p.zh,p.en))}" data-locale-fixed="true"><i aria-hidden="true">${p.icon}</i>${extra}<small>${K.t(p.zh,p.en)}</small></button>`;
 }
 function places(info){
  const key=info.bank.id+'|'+info.sec.id+'|'+state.zone;
  if(placement?.key===key)return placement.points;
  const avoid=K.fruitPoints(info.sec),pts=K.freePoints(3,avoid,12,{x0:12,x1:88,y0:36,y1:64});
  const fallback=[{x:30,y:48},{x:70,y:44},{x:50,y:58}];
  const points=[0,1,2].map(i=>pts[i]||fallback[i]);
  placement={key,points};return points;
 }
 function sceneProps(){
  const info=ctxInfo(),host=$('loot');
  if(!host)return;
  for(const el of [...host.children])if(el.className&&String(el.className).includes('escape-prop'))el.remove();
  if(!info)return;
  const room=roomOf(info,false),r=room||E.freshRoom(),pts=places(info),stg=E.stage(r,!!TownWeb.chain(r.slips));
  const add=html=>{const h=document.createElement('div');h.innerHTML=html;const el=h.children[0];if(el){host.appendChild(el);el.onclick=ev=>{ev?.stopPropagation?.();if(Date.now()<suppressClick)return;openProp(el.dataset.escape);};}};
  if(stg==='drawer'||stg==='key')add(propHtml('drawer',pts[0],r.drawer&&!r.key?'<b class="escape-glint" aria-hidden="true">✦</b>':''));
  if(r.key||r.chest){if(!r.lock)add(propHtml('chest',pts[1],r.chest?'':'<b class="escape-glint" aria-hidden="true">🔒</b>'));}
  if(r.chest&&!r.lock)add(propHtml('lock',pts[2]));
  if(r.lock&&!r.done&&TownWeb.chain(r.slips))add(propHtml('plate',pts[2]));
 }
 function openProp(kind){
  const info=ctxInfo();if(!info)return;
  if(kind==='drawer')return showDrawer(info);
  if(kind==='chest')return showChest(info);
  if(kind==='lock')return showLock(info);
  if(kind==='plate')return showPlate(info);
 }
 // ---------- dialogs ----------
 function head(info,room,eyebrow,title){
  const pr=progressLine(info,room);
  const dots=Array.from({length:pr.total},(_,i)=>`<i class="${i<pr.done?'on':''}"></i>`).join('');
  return `<span class="eyebrow" data-locale-fixed="true">${K.t(eyebrow.zh,eyebrow.en)}</span><h2 id="dialogTitle" data-locale-fixed="true">${K.t(title.zh,title.en)}</h2><div class="escape-steps" role="img" aria-label="${esc2(K.plain('密室进度 '+pr.done+'/'+pr.total,'Room progress '+pr.done+'/'+pr.total))}" data-locale-fixed="true">${dots}</div>`;
 }
 const sectionName=info=>({zh:info.sec.title,en:info.sec.english||info.sec.title});
 function showDrawer(info){
  const room=roomOf(info),found=foundIds(info).length,need=E.needFound(info.sec);
  const m=sectionName(info);
  if(room.drawer&&!room.key){
   modal(head(info,room,{zh:'小节密室 · '+info.sec.id,en:'Section room · '+info.sec.id},{zh:'抽屉里有一把黄铜钥匙',en:'A brass key is inside'})+`<p data-locale-fixed="true">${K.t('抽屉开了，里面躺着一把小小的黄铜钥匙，钥匙柄上刻着一只木箱。','The drawer is open. A small brass key lies inside, its handle carved with a chest.')}</p><div class="actions"><button id="escapeBack" data-locale-fixed="true">${K.t('先放着','Not now')}</button><button id="escapeTakeKey" class="primary" data-locale-fixed="true">${K.t('收下钥匙','Take the key')}</button></div>`);
   $('escapeBack').onclick=close;
   $('escapeTakeKey').onclick=()=>{E.takeKey(room);save();TownSound.play('key');close();render();toast(K.plain('拿到黄铜钥匙了。去场景里找那只上锁的木箱。','Got the brass key. Find the locked chest in the scene.'));};
   return;
  }
  if(room.key){showChest(info);return;}
  const ok=found>=need;
  modal(head(info,room,{zh:'小节密室 · '+info.sec.id,en:'Section room · '+info.sec.id},{zh:'卡住的旧抽屉',en:'A stuck old drawer'})+`<p data-locale-fixed="true">${K.t('这只抽屉被潮气卡住了。多在场景里看看这一节的知识物件，抽屉会慢慢松开。','The drawer is swollen shut. Look through more of this section’s knowledge objects and it will loosen.')}</p><p class="escape-meter" data-locale-fixed="true">${K.t('已看过 '+Math.min(found,need)+' / '+need+' 件','Seen '+Math.min(found,need)+' / '+need+' objects')}</p><div class="actions"><button id="escapeBack" data-locale-fixed="true">${K.t('继续找线索','Keep looking')}</button><button id="escapeOpenDrawer" class="primary" ${ok?'':'disabled'} data-locale-fixed="true">${K.t(ok?'拉开抽屉':'还差一点','Open the drawer')}</button></div>`);
  $('escapeBack').onclick=close;
  $('escapeOpenDrawer').onclick=()=>{const out=E.openDrawer(room,foundIds(info).length,need);if(!out.ok)return;save();TownSound.play('drawer');showDrawer(info);render();};
 }
 function showChest(info){
  const room=roomOf(info);
  if(!room.key){modal(head(info,room,{zh:'小节密室',en:'Section room'},{zh:'木箱上着锁',en:'The chest is locked'})+`<p data-locale-fixed="true">${K.t('锁孔是黄铜色的。也许附近的抽屉里有钥匙。','The keyhole is brass. Maybe a key is in a drawer nearby.')}</p><div class="actions"><button id="escapeBack" data-locale-fixed="true">${K.t('知道了','OK')}</button></div>`);$('escapeBack').onclick=close;return;}
  if(!room.chest){
   modal(head(info,room,{zh:'小节密室 · '+info.sec.id,en:'Section room · '+info.sec.id},{zh:'用钥匙打开木箱',en:'Open the chest with the key'})+`<p data-locale-fixed="true">${K.t('钥匙转了半圈，咔哒一声。箱子里是三张折好的线索纸条。','The key turns with a click. Inside are three folded clue slips.')}</p><div class="actions"><button id="escapeBack" data-locale-fixed="true">${K.t('先不开','Not yet')}</button><button id="escapeOpenChest" class="primary" data-locale-fixed="true">${K.t('打开木箱','Open the chest')}</button></div>`);
   $('escapeBack').onclick=close;
   $('escapeOpenChest').onclick=()=>{const out=E.openChest(room,pickSlips(info));if(!out.ok)return;save();TownSound.play('chest');showLock(info);render();};
   return;
  }
  showLock(info);
 }
 function showLock(info){
  const room=roomOf(info);
  if(!room.chest){showChest(info);return;}
  const qs=questions(info,room);
  if(qs.some(q=>!q)){room.slips=[];room.chest=false;save();toast(K.plain('这个房间的线索暂时凑不齐，换一节试试。','This room cannot build its clues right now. Try another section.'));return;}
  if(room.lock){afterLock(info,room);return;}
  draft??={key:'',picks:[null,null,null],msg:[]};
  const dk=info.bank.id+'|'+info.sec.id;if(draft.key!==dk)draft={key:dk,picks:[null,null,null],msg:[]};
  const rows=qs.map((q,i)=>{
   const solved=room.rows[i],pick=draft.picks[i],lead=TownCloze.lead(q);
   const opts=q.options.map(o=>`<button class="escape-opt${solved&&o.id===q.answer?' right':''}${!solved&&pick===o.id?' chosen':''}" data-row="${i}" data-opt="${esc2(o.id)}" ${solved?'disabled':''} aria-pressed="${!solved&&pick===o.id}" data-locale-fixed="true">${K.tf({zh:o.title,en:o.en})}</button>`).join('');
   const note=!solved&&draft.msg[i]?`<p class="escape-hint" role="status" data-locale-fixed="true">${K.tf(draft.msg[i])}</p>`:'';
   return `<div class="escape-row${solved?' solved':''}" data-locale-fixed="true"><div class="escape-dial"><span class="escape-num" aria-hidden="true">${i+1}</span><p><b>${K.tf(lead)}</b><br>${K.tf(q.text)}</p></div><div class="escape-opts" role="group">${opts}</div>${note}${solved?`<p class="escape-ok" data-locale-fixed="true">✓ ${K.t('这一格对上了','This dial clicked into place')}</p>`:''}</div>`;
  }).join('');
  modal(head(info,room,{zh:'小节密室 · '+info.sec.id,en:'Section room · '+info.sec.id},{zh:'密码锁：三格线索',en:'Combination lock: three clues'})+`<p class="muted" data-locale-fixed="true">${K.t('每张纸条缺了一个词。选对三个词，锁才会开；选错不扣东西，也没有次数限制。','Each slip is missing a word. Pick all three right and the lock opens. A wrong pick costs nothing and there is no limit.')}</p>${rows}<div class="actions"><button id="escapeBack" data-locale-fixed="true">${K.t('离开','Leave')}</button><button id="escapeTry" class="primary" ${draft.picks.some(Boolean)?'':'disabled'} data-locale-fixed="true">${K.t('试一试这把锁','Try the lock')}</button></div>`,true);
  $('escapeBack').onclick=close;
  document.querySelectorAll('[data-opt]').forEach(el=>el.onclick=()=>{const i=+el.dataset.row;draft.picks[i]=draft.picks[i]===el.dataset.opt?null:el.dataset.opt;TownSound.play('tap');showLock(info);});
  const tryBtn=$('escapeTry');if(tryBtn)tryBtn.onclick=()=>{
   const before=[...room.rows],out=E.tryLock(room,draft.picks);if(!out.ok)return;
   out.result.forEach((r,i)=>{if(r.correct&&!before[i]){draft.picks[i]=null;draft.msg[i]=null;}else if(!r.correct&&!r.fixed&&!r.skipped){const q=qs[i];draft.msg[i]=TownCloze.hint(q,room.tries[i]);draft.picks[i]=null;}});
   save();
   TownSound.play(out.solved?'unlock':out.result.some((r,i)=>r.correct&&!before[i])?'good':'soft');
   if(out.solved){draft=null;afterLock(info,room);render();}else showLock(info);
  };
 }
 function afterLock(info,room){
  const pr=progressLine(info,room);
  if(pr.hasOrder&&!(room.order&&room.order.done)){showPlate(info);return;}
  finishRoom(info,room);
 }
 function showPlate(info){
  const room=roomOf(info);if(!room.lock){showLock(info);return;}
  const expected=TownWeb.chain(room.slips);if(!expected){finishRoom(info,room);return;}
  if(room.order?.done){finishRoom(info,room);return;}
  const rng=TownCloze.rng(TownCloze.hash(info.bank.id+'|'+info.sec.id+'|plate'+(room.order?.tries||0)));
  let tiles=TownCloze.shuffle(expected,rng);if(tiles.join()===expected.join())tiles=[...tiles].reverse();
  const slots=[];
  const view=()=>{
   const tileHtml=tiles.map(id=>{const l=lessonOf(info,id);return `<button class="escape-tile" data-tile="${esc2(id)}" data-locale-fixed="true">${K.tf(K.title(l))}</button>`;}).join('');
   const slotHtml=expected.map((_,i)=>{const id=slots[i];const l=id?lessonOf(info,id):null;return `<button class="escape-slot${id?' filled':''}" data-slot="${i}" aria-label="${esc2(K.plain('第 '+(i+1)+' 位','Position '+(i+1)))}" data-locale-fixed="true"><span aria-hidden="true">${i+1}</span>${l?K.tf(K.title(l)):''}</button>`;}).join('');
   modal(head(info,room,{zh:'小节密室 · '+info.sec.id,en:'Section room · '+info.sec.id},{zh:'顺序石板',en:'The order plate'})+`<p class="muted" data-locale-fixed="true">${K.t('锁开了，下面是一块刻着三个概念的石板。按「先懂什么，再学什么」的顺序，把它们依次放进凹槽。点一下概念，再点凹槽。','The lock is open, revealing a plate with three concepts. Place them in the order you would learn them: what to understand first, then what comes next. Tap a concept, then a slot.')}</p><div class="escape-slots" data-locale-fixed="true">${slotHtml}</div><div class="escape-tiles" data-locale-fixed="true">${tileHtml}</div><p id="escapePlateNote" class="escape-hint" role="status" data-locale-fixed="true"></p><div class="actions"><button id="escapeBack" data-locale-fixed="true">${K.t('离开','Leave')}</button><button id="escapeReset" data-locale-fixed="true">${K.t('重新摆','Clear')}</button><button id="escapePress" class="primary" ${slots.filter(Boolean).length===expected.length?'':'disabled'} data-locale-fixed="true">${K.t('按下石板','Press the plate')}</button></div>`,true);
   let held=null;
   $('escapeBack').onclick=close;
   $('escapeReset').onclick=()=>{slots.length=0;tiles=TownCloze.shuffle(expected,rng);view();};
   document.querySelectorAll('[data-tile]').forEach(el=>el.onclick=()=>{held=el.dataset.tile;TownSound.play('tap');document.querySelectorAll('[data-tile]').forEach(x=>x.classList.toggle('held',x===el));});
   document.querySelectorAll('[data-slot]').forEach(el=>el.onclick=()=>{
    const i=+el.dataset.slot;
    if(slots[i]){tiles.push(slots[i]);slots[i]=undefined;view();return;}
    if(!held)return;
    slots[i]=held;tiles=tiles.filter(x=>x!==held);held=null;TownSound.play('tap');view();
   });
   const press=$('escapePress');
   if(press)press.onclick=()=>{
    const out=E.tryOrder(room,expected.map((_,i)=>slots[i]),expected);if(!out.ok)return;save();
    if(out.solved){TownSound.play('unlock');finishRoom(info,room);render();return;}
    TownSound.play('soft');
    const wrong=out.positions.map((ok,i)=>ok?-1:i).filter(i=>i>=0);
    slots.forEach((id,i)=>{if(!out.positions[i]&&id){tiles.push(id);slots[i]=undefined;}});
    view();const note=$('escapePlateNote');
    if(note)note.innerHTML=K.t('石板微微一晃，没按下去。位置 '+wrong.map(i=>i+1).join('、')+' 还不对，其余的先保留。想想哪个概念是别的概念的前提。','The plate wobbles but does not sink. Position '+wrong.map(i=>i+1).join(', ')+' is off; the rest stay. Think about which concept the others depend on.');
   };
  };
  view();
 }
 function finishRoom(info,room){
  const pr=progressLine(info,room),out=E.finish(room,Date.now(),pr.hasOrder);if(!out.ok)return;
  if(out.reward){state.resources.coins+=out.reward;}
  save();TownSound.play(out.reward?'win':'good');
  const cards=room.slips.map(id=>{const l=lessonOf(info,id);return `<div class="escape-card" data-locale-fixed="true"><b>${K.tf(K.title(l))}</b><p>${K.tf(K.body(l))}</p></div>`;}).join('');
  const order=pr.chain?`<p class="escape-chain" data-locale-fixed="true">${pr.chain.map(id=>K.tf(K.title(lessonOf(info,id)))).join(' → ')}</p>`:'';
  modal(head(info,room,{zh:'小节密室 · '+info.sec.id,en:'Section room · '+info.sec.id},{zh:'锁开了：线索卡到手',en:'Unlocked: clue card collected'})+`<p data-locale-fixed="true">${K.t(out.reward?'你从木箱底层取出一张线索卡，并得到 1 枚学习币。':'你又看了一遍这张线索卡。','You take a clue card from the bottom of the chest'+(out.reward?' and earn 1 learning coin.':'.'))}</p>${order}<div class="escape-cards">${cards}</div><p class="muted" data-locale-fixed="true">${K.t('这是一次温和的复习，不计入本节应用，也不影响章末 90% 测验。','This is a gentle review. It does not count toward the section applications or the 90% chapter assessment.')}</p><div class="actions"><button id="escapeDone" class="primary" data-locale-fixed="true">${K.t('收好线索卡','Keep the card')}</button></div>`,true);
  $('escapeDone').onclick=()=>{close();render();};
 }
 // ---------- header strip: what is the next small thing in this room ----------
 function nextHint(){
  const info=ctxInfo();if(!info)return null;
  const room=roomOf(info,false)||E.freshRoom(),pr=progressLine(info,room),stg=E.stage(room,pr.hasOrder);
  const need=E.needFound(info.sec),seen=foundIds(info).length;
  const map={drawer:seen>=need?{zh:'场景里的旧抽屉可以拉开了',en:'The old drawer can be opened'}:{zh:'再多看 '+(need-seen)+' 件物件，抽屉会松开',en:'Look at '+(need-seen)+' more objects to loosen the drawer'},key:{zh:'抽屉里有一把钥匙',en:'There is a key in the drawer'},chest:{zh:'用钥匙去开那只木箱',en:'Use the key on the chest'},lock:{zh:'木箱里的密码锁等你解',en:'The combination lock is waiting'},order:{zh:'石板上的概念等你排序',en:'Put the plate concepts in order'},finish:{zh:'取出线索卡',en:'Collect the clue card'},done:null};
  return {stage:stg,done:pr.done,total:pr.total,text:map[stg],room};
 }
 function pointToNext(){
  const info=ctxInfo();if(!info)return false;
  const room=roomOf(info,false)||E.freshRoom(),pts=places(info),stg=E.stage(room,!!TownWeb.chain(room.slips));
  const at=stg==='drawer'||stg==='key'?pts[0]:stg==='chest'?pts[1]:pts[2];
  return K.pointAtScene(at.x,at.y);
 }
 return {sceneProps,openProp,nextHint,pointToNext,roomOf,ctxInfo,store};
})();
if(typeof module==='object')module.exports=TownEscapeUI;
