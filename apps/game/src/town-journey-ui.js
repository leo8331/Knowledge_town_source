/* Journey strip, "我的旅程" panel, daily errand and soft return welcome.
   Reads existing progress and shows it; never decides what counts as learned or passed.
   Display state lives in state.journey and is repaired leniently on load. */
'use strict';
const TownJourneyUI=(()=>{
 const J=TownJourneyEngine,K=TownKit;
 const store=()=>{state.journey=J.ensure(state.journey);return state.journey;};
 const offset=()=>{try{return new Date().getTimezoneOffset();}catch{return 0;}};
 const course=()=>{try{return currentCourse();}catch{return null;}};
 function ctxFor(sec){
  try{const c=teachingContext();if(!c)return {found:0,confirmed:0};
   const ids=new Set(sec.lessons.map(l=>l.id));
   return {found:(c.p.found||[]).filter(id=>ids.has(id)).length,confirmed:sec.lessons.filter(l=>{try{return c.p.foundations.includes(c.flow.foundation(sec.id,l.id)?.id);}catch{return false;}}).length};
  }catch{return {found:0,confirmed:0};}
 }
 const data=()=>{const c=course();if(!c)return null;const s=studyState();return {course:c,study:s,chapters:J.sectionProgress(c,s,ctxFor)};};
 const STAGE={new:{zh:'未开始',en:'Not started'},learning:{zh:'学习中',en:'Learning'},submit:{zh:'待交付',en:'Ready to submit'},practice:{zh:'练习中',en:'Practice'},passed:{zh:'已通关',en:'Passed'}};
 const stageText=ch=>{const st=J.stage(ch);return {key:st,...STAGE[st]};};
 // ---------- the strip under the header ----------
 function ensureStrip(){
  const header=document.querySelector?.('body > header');if(!header)return null;
  let strip=$('journeyStrip');
  if(!strip){
   strip=document.createElement('div');strip.id='journeyStrip';strip.className='journey-strip';strip.setAttribute('data-locale-fixed','true');
   const guide=$('releaseGuide');if(guide?.parentNode===header)header.insertBefore(strip,guide);else header.appendChild(strip);
  }
  return strip;
 }
 function stripHtml(d){
  const o=J.overall(d.chapters),cur=d.chapters[d.study.chapter]||d.chapters[0],st=stageText(cur);
  const cells=d.chapters.map(ch=>{const s=J.stage(ch),pct=ch.total?Math.round(ch.collected/ch.total*100):0;
   return `<button class="journey-cell ${s}${ch.index===d.study.chapter?' current':''}" data-journey-chapter="${ch.index}" aria-label="${K.safe(K.plain('第 '+(ch.index+1)+' 章，'+STAGE[s].zh+'，知识 '+ch.collected+'/'+ch.total,'Chapter '+(ch.index+1)+', '+STAGE[s].en+', knowledge '+ch.collected+'/'+ch.total))}" data-locale-fixed="true"><span class="journey-num">${ch.index+1}</span><span class="journey-bar"><i style="width:${s==='passed'?100:pct}%"></i></span></button>`;}).join('');
  const next=nextText(d);
  const due=J.dueReview(d.study,d.course,Date.now()),dueTag=due.due||due.wrong?`<span class="journey-due" title="${K.safe(K.plain('有复习在等你','Review is waiting'))}">${K.t('复习 '+(due.due+due.wrong),'Review '+(due.due+due.wrong))}</span>`:'';
  return `<div class="journey-cells" role="group" aria-label="${K.safe(K.plain('四章学习进度','Progress across four chapters'))}">${cells}</div><div class="journey-text"><b>${K.t('第 '+(cur.index+1)+' 章 · '+st.zh,'Chapter '+(cur.index+1)+' · '+st.en)}</b><span>${next}</span></div>${dueTag}<button class="journey-open" id="journeyOpen" data-locale-fixed="true">${K.t('我的旅程','My journey')}</button>`;
 }
 function nextText(d){
  try{
   const hint=TownEscapeUI.nextHint();
   if(hint&&hint.text&&hint.stage!=='done')return K.t(hint.text.zh,hint.text.en);
  }catch{}
  try{const n=guideNextStep();if(n?.title)return K.safe(n.title);}catch{}
  return K.t('继续探索','Keep exploring');
 }
 function paintStrip(){
  const strip=ensureStrip();if(!strip)return;
  const d=data();
  if(!d){strip.hidden=true;return;}
  strip.hidden=false;const html=stripHtml(d);if(strip.dataset.sig!==html){strip.innerHTML=html;strip.dataset.sig=html;}
  strip.querySelectorAll?.('[data-journey-chapter]')?.forEach(el=>el.onclick=()=>{try{TownSound.play('tap');enterStudyChapter(+el.dataset.journeyChapter);}catch{}});
  const open=$('journeyOpen');if(open)open.onclick=()=>showJourney();
  const text=strip.querySelector?.('.journey-text');if(text)text.onclick=()=>{try{if(!TownEscapeUI.pointToNext())guideNextStep().run();}catch{}};
 }
 // ---------- the journey panel ----------
 function chapterCard(ch,cur,idx){
  const st=stageText(ch),pct=ch.total?Math.round(ch.collected/ch.total*100):0;
  const secs=ch.sections.map(s=>`<li class="${s.sealed?'sealed':''}"><span>${K.safe(s.id)}</span><em>${K.tf({zh:s.title,en:s.title})}</em><b>${s.sealed?'✓':s.deposited+'/'+s.total}</b></li>`).join('');
  const best=ch.attempted?`<p class="journey-best">${K.t('章末最高 '+Math.floor(ch.best*100)+'%','Best assessment '+Math.floor(ch.best*100)+'%')}${ch.passed?' · '+K.t('已通关','Passed'):' · '+K.t('90% 通关','90% to pass')}</p>`:'';
  return `<article class="journey-card ${st.key}${ch.index===cur?' current':''}" style="--chapter-image:url('assets/world-${ch.zone}.webp')" data-locale-fixed="true"><header><small>${K.t('第 '+(ch.index+1)+' 章','Chapter '+(ch.index+1))}</small><strong>${K.tf({zh:ch.title,en:ch.english||ch.title})}</strong><span class="journey-stage">${K.t(st.zh,st.en)}</span></header><div class="journey-meter" role="img" aria-label="${K.safe(K.plain('知识 '+ch.collected+'/'+ch.total,'Knowledge '+ch.collected+'/'+ch.total))}"><i style="width:${pct}%"></i></div><p>${K.t('知识 '+ch.collected+'/'+ch.total+' · 小节 '+ch.sealedCount+'/'+ch.sectionCount,'Knowledge '+ch.collected+'/'+ch.total+' · Sections '+ch.sealedCount+'/'+ch.sectionCount)}</p>${best}<ul class="journey-secs">${secs}</ul><button data-journey-go="${ch.index}">${K.t(ch.index===cur?'回到这一章':'去这一章','Go to this chapter')}</button></article>`;
 }
 function showJourney(){
  const d=data();if(!d){toast(K.plain('请先在“我的材料”选择课程。','Choose a course in My materials first.'));return;}
  const j=store(),now=Date.now(),o=J.overall(d.chapters),run=J.run(j,now,offset()),week=J.weekCount(j,now,offset());
  const due=J.dueReview(d.study,d.course,now),rooms=Object.values(state.escape?.rooms||{}).filter(r=>r.done).length;
  const stats=[[o.passed+'/'+o.chapters,'章已通关','Chapters passed'],[o.sealed+'/'+o.sections,'小节完成','Sections done'],[o.collected+'/'+o.total,'知识整理','Knowledge filed'],[rooms,'密室线索卡','Room clue cards']];
  const note=due.due||due.wrong?`<p class="journey-review" data-locale-fixed="true">${K.t('有 '+due.due+' 道题到了复习时间，'+due.wrong+' 道错题等你订正。去“复习”和“错题”里处理。','You have '+due.due+' questions due and '+due.wrong+' mistakes to fix. Use Review and Mistakes.')}</p>`:'';
  modal(`<span class="eyebrow" data-locale-fixed="true">${K.t('我的旅程','My journey')}</span><h2 id="dialogTitle" data-locale-fixed="true">${K.t('你已经走到哪里了','Where you are')}</h2><div class="journey-stats" data-locale-fixed="true">${stats.map(([v,zh,en])=>`<div><strong>${v}</strong><small>${K.t(zh,en)}</small></div>`).join('')}</div><p class="journey-visits" data-locale-fixed="true">${K.t('这周来了 '+week+' 天'+(run>=2?'，已经连着 '+run+' 天了。':'。')+' 中断一天也不会失去任何东西。','You came '+week+' day'+(week===1?'':'s')+' this week'+(run>=2?', '+run+' in a row.':'.')+' Missing a day costs nothing.')}</p>${note}<div class="journey-grid">${d.chapters.map(ch=>chapterCard(ch,d.study.chapter,ch.index)).join('')}</div><p class="muted" data-locale-fixed="true">${K.t('进度保存在这个浏览器里。想换电脑或清理浏览器前，请到“成长手记”导出完整备份。','Progress is saved in this browser. Export a full backup in the Learning journal before switching computers or clearing browser data.')}</p><div class="actions"><button id="journeyMap" data-locale-fixed="true">${K.t('本节知识地图','This section’s map')}</button><button id="journeyJournal" data-locale-fixed="true">${K.t('成长手记与备份','Journal and backup')}</button><button id="journeyClose" class="primary" data-locale-fixed="true">${K.t('继续探索','Keep exploring')}</button></div>`,true);
  $('journeyClose').onclick=close;
  $('journeyMap').onclick=()=>showMap();
  $('journeyJournal').onclick=()=>{try{showRecords();}catch{}};
  document.querySelectorAll('[data-journey-go]').forEach(el=>el.onclick=()=>{TownSound.play('tap');enterStudyChapter(+el.dataset.journeyGo);close();});
 }
 // ---------- section knowledge map ----------
 function showMap(sectionId){
  const d=data();if(!d)return;
  const sec=d.course.chapters.flatMap(c=>c.sections).find(x=>x.id===(sectionId||studySection().id));if(!sec)return;
  const ctx=(()=>{try{return teachingContext();}catch{return null;}})();
  const m=TownWeb.mapHtml(sec.id,{read:d.study.read,found:ctx?.p.found||[],deposited:d.study.deposited});
  if(!m){toast(K.plain('这一节暂时画不出知识地图。','This section has no map yet.'));return;}
  modal(`<span class="eyebrow" data-locale-fixed="true">${K.t('本节知识地图 · '+sec.id,'Section knowledge map · '+sec.id)}</span><h2 id="dialogTitle" data-locale-fixed="true">${K.tf({zh:sec.title,en:sec.english||sec.title})}</h2><p class="muted" data-locale-fixed="true">${K.t('越靠上越基础，箭头向下是“学了上面才好懂下面”。已看过 '+m.lit+' / '+m.total+' 个。灰色的还没翻开，去场景里找找。','Higher means more basic; arrows point to what builds on it. Seen '+m.lit+' / '+m.total+'. Grey ones are unopened. Look for them in the scene.')}</p><div class="knowledge-map" data-locale-fixed="true">${m.html}</div><p class="muted" data-locale-fixed="true">${K.t('这只是帮你看清结构的地图，不影响任何进度或测验。','This map only shows structure. It changes no progress or assessment.')}</p><div class="actions"><button id="mapBack" data-locale-fixed="true">${K.t('回到旅程','Back to journey')}</button><button id="mapClose" class="primary" data-locale-fixed="true">${K.t('继续探索','Keep exploring')}</button></div>`,true);
  $('mapBack').onclick=()=>showJourney();$('mapClose').onclick=close;
  document.querySelectorAll('[data-map-node]').forEach(el=>el.onclick=()=>{close();try{openStudyLesson(el.dataset.mapNode,true);}catch{}});
 }
 // ---------- daily errand ----------
 function errandPool(d){
  const lessons=d.course.chapters.flatMap(ch=>ch.sections.flatMap(sec=>sec.lessons.map(l=>({lesson:l,sec})))),own=new Set([...d.study.deposited,...d.study.read]);
  const mine=lessons.filter(x=>own.has(x.lesson.id));
  return {mine,all:lessons};
 }
 function errandItems(d,key){
  const {mine,all}=errandPool(d),pool=mine.length>=3?mine:all,sibs=l=>{const group=all.find(x=>x.lesson.id===l.id)?.sec.lessons||[];return group.filter(x=>x.id!==l.id);};
  const by=new Map(pool.map(x=>[x.lesson.id,x]));
  return TownCloze.items(pool.map(x=>x.lesson),l=>sibs(l),3,{seed:'errand|'+d.study.chapter+'|'+key,seen:new Set(d.study.read)});
 }
 function showErrand(){
  const d=data();if(!d){toast(K.plain('请先在“我的材料”选择课程。','Choose a course in My materials first.'));return;}
  const j=store(),key=J.errandKey(j,Date.now(),offset()),done=J.errandState(j,key);
  const items=errandItems(d,key);
  if(items.length<3){toast(K.plain('今天的订单还没准备好，先去场景里看几件物件。','Today’s errand is not ready. Look at a few objects in the scene first.'));return;}
  let at=0,score=0,tries=0,msg=null,picked=null;
  const view=()=>{
   if(at>=items.length){finish();return;}
   const q=items[at];
   const opts=q.options.map(o=>`<button class="escape-opt${picked===o.id?' chosen':''}" data-pick="${K.safe(o.id)}" aria-pressed="${picked===o.id}" data-locale-fixed="true">${K.tf({zh:o.title,en:o.en})}</button>`).join('');
   const dots=items.map((_,i)=>`<i class="${i<at?'on':i===at?'now':''}"></i>`).join('');
   modal(`<span class="eyebrow" data-locale-fixed="true">${K.t('今日小订单','Today’s errand')}</span><h2 id="dialogTitle" data-locale-fixed="true">${K.t('邻居托你办三件小事','Three small favours for the neighbours')}</h2><div class="escape-steps" data-locale-fixed="true">${dots}</div>${done.done?`<p class="muted" data-locale-fixed="true">${K.t('今天已经办完了，再做一遍只是复习，不会再给奖励。','Already done today. Doing it again is just review, with no further reward.')}</p>`:''}<div class="escape-row" data-locale-fixed="true"><div class="escape-dial"><span class="escape-num" aria-hidden="true">${at+1}</span><p><b>${K.tf(TownCloze.lead(q))}</b><br>${K.tf(q.text)}</p></div><div class="escape-opts" role="group">${opts}</div>${msg?`<p class="escape-hint" role="status">${K.tf(msg)}</p>`:''}</div><div class="actions"><button id="errandBack" data-locale-fixed="true">${K.t('改天再办','Later')}</button><button id="errandGo" class="primary" ${picked?'':'disabled'} data-locale-fixed="true">${K.t('交给邻居','Hand it over')}</button></div>`,true);
   $('errandBack').onclick=close;
   document.querySelectorAll('[data-pick]').forEach(el=>el.onclick=()=>{picked=picked===el.dataset.pick?null:el.dataset.pick;TownSound.play('tap');view();});
   const go=$('errandGo');if(go)go.onclick=()=>{
    if(picked===q.answer){if(!tries)score++;TownSound.play('good');at++;tries=0;msg=null;picked=null;view();return;}
    tries++;msg=TownCloze.hint(q,tries);picked=null;TownSound.play('soft');view();
   };
  };
  const finish=()=>{
   const out=J.completeErrand(j,key,score,items.length);
   if(out.reward)state.resources.coins+=out.reward;
   save();TownSound.play(out.reward?'win':'good');renderHUD();paintStrip();
   modal(`<span class="eyebrow" data-locale-fixed="true">${K.t('今日小订单','Today’s errand')}</span><h2 id="dialogTitle" data-locale-fixed="true">${K.t('办完了，邻居很高兴','All done. The neighbours are pleased')}</h2><p data-locale-fixed="true">${K.t('第一次就选对 '+score+' / '+items.length+' 件。'+(out.reward?'得到 1 枚学习币。':'今天的奖励已经领过了。'),'Right on the first try: '+score+' / '+items.length+'.'+(out.reward?' You earned 1 learning coin.':' Today’s reward was already collected.'))}</p><p class="muted" data-locale-fixed="true">${K.t('这是轻松的回顾，不计入本节应用，也不影响章末 90% 测验。明天会有新的订单。','This is a light recap. It does not count toward section applications or the 90% assessment. Tomorrow brings new errands.')}</p><div class="actions"><button id="errandDone" class="primary" data-locale-fixed="true">${K.t('好的','Great')}</button></div>`);
   $('errandDone').onclick=close;
  };
  view();
 }
 // ---------- soft welcome when you come back ----------
 function noteVisit(){
  try{
   const j=store(),now=Date.now(),before=j.lastSeen,key=J.visit(j,now,offset());
   const away=before?Math.floor((now-before)/J.DAY):0;
   const d=data();
   if(d&&j.welcomed!==key&&away>=1&&!document.querySelector?.('dialog')?.open){
    j.welcomed=key;
    const due=J.dueReview(d.study,d.course,now),ch=d.chapters[d.study.chapter],st=stageText(ch);
    const bits=[K.plain('欢迎回来。','Welcome back.'),K.plain('你上次在第 '+(ch.index+1)+' 章（'+st.zh+'）。','You were in chapter '+(ch.index+1)+' ('+st.en+').')];
    if(due.due||due.wrong)bits.push(K.plain('有 '+(due.due+due.wrong)+' 件复习在等你。','There are '+(due.due+due.wrong)+' review items waiting.'));
    setTimeout(()=>toast(bits.join(' ')),900);
   }else if(j.welcomed!==key&&!away){j.welcomed=key;}
   save();
  }catch{}
 }
 function errandButton(){
  const j=store(),done=J.errandState(j,J.errandKey(j,Date.now(),offset())).done;
  return `<button id="errandOpen" class="errand-open${done?' done':''}" data-locale-fixed="true">${K.t(done?'今日订单 ✓':'今日订单','Daily errand'+(done?' ✓':''))}</button>`;
 }
 return {paintStrip,showJourney,showMap,showErrand,noteVisit,errandButton,store,data,stageText};
})();
if(typeof module==='object')module.exports=TownJourneyUI;
