/* Load after teaching-v5-ui.js. Viewing release information never migrates a bank. */
'use strict';
window.ReleaseGuide = (() => {
 const copy=(zh,en)=>state.language==='en'?esc(en):state.language==='bi'?`${esc(zh)}<small lang="en">${esc(en)}</small>`:esc(zh);
 const plain=(zh,en)=>state.language==='en'?en:state.language==='bi'?zh+' / '+en:zh;
 function current(){
  const course=currentCourse(),bank=L.bank(state),entry=typeof teachingEntry==='function'?teachingEntry(course):null;
  let kind=null;
  if(course&&typeof TeachingCatalog!=='undefined'){
   const signature=TaskWorkshop.signature(course);
   for(const [key,value] of Object.entries(TeachingCatalog))if(['legacy','legacy5','aib','aib5'].includes(key)&&value.course.id===course.id&&value.signature===signature)kind=key.startsWith('legacy')?'legacy':'aib';
   if(!kind&&typeof StrategistCourse!=='undefined'&&course.id===StrategistCourse.id&&signature===TaskWorkshop.signature(StrategistCourse))kind='legacy';
  }
  const target=kind?kind+'5':null;
  const available=!!(target&&typeof openTeachingCourse==='function'&&TeachingCatalog[target]?.revision===5);
  return {bankId:bank?.id,courseId:course?.id,title:course?.title||bank?.title||'',revision:entry?.revision||null,binding:entry?.binding||null,invalid:!!bank?.teachingSnapshot&&!entry,kind,target,available,upgrade:!!course&&entry?.revision!==5&&available,hasCourse:!!course};
 }
 function label(info){
  if(info.invalid)return copy('当前课程 · 教学快照未验证','Current course · teaching snapshot unverified');
  if(info.revision===5)return copy('当前课程 · 探索教学5','Current course · exploration teaching 5');
  if(info.revision===4)return copy('当前课程 · 探索教学4','Current course · exploration teaching 4');
  return info.hasCourse?copy('当前课程 · 兼容教学','Current course · compatibility teaching'):copy('当前材料 · 自由探索','Current material · free exploration');
 }
 function same(a,b){return ['bankId','courseId','revision','binding','target','invalid'].every(key=>a[key]===b[key]);}
 function concepts(){
  if(typeof ConceptGameCatalog==='undefined'||typeof ConceptGameHash==='undefined'||!currentCourse())return null;
  const course=currentCourse(),hash=ConceptGameHash.sha256(JSON.stringify(course)),games=ConceptGameCatalog.games.filter(g=>g.bindings.some(b=>b.courseId===course.id&&b.courseHash===hash)),lessons=new Set(games.flatMap(g=>g.bindings.filter(b=>b.courseId===course.id&&b.courseHash===hash).map(b=>b.lessonId)));
  return {count:lessons.size,kinds:new Set(games.map(g=>g.kind)).size,total:course.chapters.reduce((n,ch)=>n+ch.sections.reduce((m,sec)=>m+sec.lessons.length,0),0)};
 }
 function upgrade(expected){
  const next=current();
  // A bank may change while the details dialog is open. Never upgrade a stale selection.
  if(!same(expected,next)||!next.upgrade||next.invalid){open();return;}
  openTeachingCourse(next.target);refresh();
 }
 function paint(html,rerender){if(rerender===true)$('dialogBody').innerHTML=html;else modal(html,true);}
 function open(rerender=false){
  const focusId=document.activeElement?.id;
  const info=current();
  const concept=concepts(),conceptNote=concept?.count?`<p class="release-guide-concepts">${copy('本课程已接 '+concept.count+'/'+concept.total+' 个物件小游戏，包含 '+concept.kinds+' 种玩法。找到物件后，从知识页进入小游戏，通过后再手动收藏；原有收藏保留。','This course has '+concept.count+'/'+concept.total+' concept-game objects across '+concept.kinds+' interaction types. Find an object, enter its game from the knowledge page, then collect it manually after passing. Existing collections stay.')}</p>`:'';
  const experienceNote=`<section class="release-guide-experience"><h3>${copy('这次可以这样体验变化','Try these changes')}</h3><p>${copy('已绑定小游戏的知识物件，找到后可点开游戏，亲自操作后再收藏。已收藏且带小游戏的物件可从知识素材箱回看并体验，无需清空旧进度；未绑定物件保留原流程。','For objects with a bound concept game, find the object and operate its game before collecting. Reopen an existing collection with a game from the knowledge chest without clearing old progress. Unbound objects keep their original flow.')}</p><p>${copy('本地试玩版：四个学习场景的瀑布有向下水纹与落水波纹，森间学苑和星钟山丘水车持续转动，原位花草随风摆动。其他建筑保持静止；减少动态效果设置会关闭这些运动。','Local preview: waterfalls in the four learning scenes have downward currents and splash ripples; waterwheels in Woodland Academy and Starclock Hill rotate, and planted flowers sway in place. Other buildings stay still. Reduced-motion settings disable this motion.')}</p></section>`;
  const steps=info.revision===5?copy('当前课程已使用基础→示范→引导→独立应用。请从场景知识物件开始；在知识素材箱确认基础，在应用工坊继续本节。','This course uses foundations → worked example → guided practice → independent application. Begin with scene knowledge objects, confirm foundations in the knowledge chest, and continue in the application workshop.'):
   info.upgrade?copy('当前仍是原课程的教学流程。可以继续，也可以主动体验新版；原课程和旧记录保留，新版学习进度独立记录。','This bank keeps its original teaching flow. Continue here or choose the new edition. The original course and records remain; learning progress in the new edition is separate.'):
   copy('当前保留本材料的原教学流程。此入口不会替换自定义内容，也不会迁移学习进度。','This material keeps its original learning flow. This entry does not replace custom content or migrate progress.');
  paint(`<section class="release-guide-details" data-locale-fixed="true"><span class="eyebrow">${copy('课程版本与更新','Course edition and updates')}</span><h2 id="dialogTitle">${label(info)}</h2><p class="release-guide-course">${esc(info.title)}</p><p>${steps}</p>${conceptNote}${experienceNote}<p>${copy('本次入口用于看清当前课程版本。新版课程包含分阶段学习和逐项反馈；旧银行不会自动变成新版。浏览、发现和收藏不等于掌握，整章仍需90%测验。','This entry identifies the current course edition. New editions include staged learning and item feedback; old banks do not change automatically. Browsing, discovery and favorites are not mastery. The chapter still requires a 90% assessment.')}</p>${info.invalid?`<p>${copy('当前教学快照无法验证，请保留记录并交集成负责人检查。','The current teaching snapshot cannot be verified. Keep the records and ask the integration owner to check.')}</p>`:''}${info.kind&&!info.available?`<p>${copy('新版课程入口当前不可用，请检查集成是否完整。','The new course entry is currently unavailable. Check that integration is complete.')}</p>`:''}<div class="actions">${info.upgrade&&!info.invalid?`<button id="releaseGuideUpgrade" class="primary">${copy('体验新版（旧记录保留）','Try the new edition (keep old records)')}</button>`:''}<button id="releaseGuideBanks">${copy('选择已有课程','Choose an existing course')}</button><button id="releaseGuideClose">${copy('返回场景','Return to scene')}</button></div></section>`,rerender);
  if($('releaseGuideUpgrade'))$('releaseGuideUpgrade').onclick=()=>upgrade(info);
  $('releaseGuideBanks').onclick=()=>{$('bankButton')?.click();};
  $('releaseGuideClose').onclick=close;
  if(rerender===true&&focusId)$(focusId)?.focus();
 }
 function refresh(){
  const header=document.querySelector?.('body > header');if(!header)return;
  let root=$('releaseGuide');
  if(!root){
   root=document.createElement('div');root.id='releaseGuide';root.className='release-guide';root.setAttribute('data-locale-fixed','true');
   root.innerHTML='<span id="releaseGuideVersion"></span><div class="release-guide-actions"><button id="releaseGuideUpdates"></button><button id="releaseGuideTry"></button></div>';
   header.classList.add('release-guide-header');header.appendChild(root);
   $('releaseGuideUpdates').onclick=open;
   $('releaseGuideTry').onclick=()=>upgrade(current());
  }
  const info=current(),version=$('releaseGuideVersion'),updates=$('releaseGuideUpdates'),tryButton=$('releaseGuideTry');
  const html=label(info);if(version.innerHTML!==html)version.innerHTML=html;
  const updatesHTML=copy('查看本次更新 · 物件小游戏与场景动态','View this update · object games and scene motion');if(updates.innerHTML!==updatesHTML)updates.innerHTML=updatesHTML;
  const tryHTML=copy('体验新版（旧记录保留）','Try the new edition (keep old records)');if(tryButton.innerHTML!==tryHTML)tryButton.innerHTML=tryHTML;
  tryButton.hidden=!info.upgrade||info.invalid;
  version.setAttribute('aria-label',plain('当前课程的教学版本','Teaching edition of the current course'));
 }
 const previousHUD=renderHUD;renderHUD=function(){previousHUD();refresh();};
 const previousLanguage=changeTownLanguage;changeTownLanguage=function(mode){previousLanguage(mode);refresh();if($('releaseGuideClose'))open(true);};
 // No popup and no storage writes on installation. The actual first render supplies the selected bank.
 if(document.readyState!=='loading')refresh();
 return Object.freeze({current,refresh,open});
})();
