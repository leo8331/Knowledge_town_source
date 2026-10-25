/* Wires the escape-room chain, knowledge links, journey strip, daily errand and sound into the
   existing game. Loaded last. It wraps render / HUD / reading / language / restore the same way
   the earlier modules do and never edits their code. */
'use strict';
(function(){
 // ---- save repair: lenient, so a damaged optional field can never lock a player out of their game ----
 const restoreBase=L.restore;
 L.restore=function(raw){
  const restored=restoreBase(raw);if(!restored)return null;
  restored.escape=TownEscapeEngine.normalize(restored.escape);
  restored.journey=TownJourneyEngine.normalize(restored.journey);
  return restored;
 };
 const ensureFields=()=>{if(typeof state==='object'&&state){state.escape=TownEscapeEngine.ensure(state.escape);state.journey=TownJourneyEngine.ensure(state.journey);}};

 // ---- scene props: re-added after every loot render ----
 const lootBase=renderLoot;
 renderLoot=function(...a){const r=lootBase.apply(this,a);try{ensureFields();TownEscapeUI.sceneProps();}catch(e){}return r;};

 // ---- HUD: strip, sound control, daily errand button, zone-matched ambience ----
 const hudBase=renderHUD;
 renderHUD=function(...a){
  const r=hudBase.apply(this,a);
  try{
   ensureFields();TownJourneyUI.paintStrip();TownSound.install();TownSound.refresh();TownSound.onZoneChange();
   const nav=document.querySelector('header nav');
   if(nav&&!$('errandOpen')&&course()){const h=document.createElement('div');h.innerHTML=TownJourneyUI.errandButton();const b=h.children[0];if(b){nav.insertBefore(b,nav.children[0]);b.onclick=()=>TownJourneyUI.showErrand();}}
   const eb=$('errandOpen');if(eb){const has=!!course();eb.hidden=!has;const done=TownJourneyEngine.errandState(state.journey,TownJourneyEngine.errandKey(state.journey,Date.now(),new Date().getTimezoneOffset())).done;eb.classList.toggle('done',done);const label=TownKit.t(done?'今日订单 ✓':'今日订单','Daily errand'+(done?' ✓':''));if(eb.innerHTML!==label)eb.innerHTML=label;}
  }catch(e){}
  return r;
 };
 function course(){try{return currentCourse();}catch{return null;}}

 // ---- knowledge links inside the reading dialog ----
 const openBase=openStudyLesson;
 openStudyLesson=function(id,...rest){
  const r=openBase.call(this,id,...rest);
  try{TownWeb.decorate(id);}catch(e){}
  return r;
 };

 // ---- language switch: repaint our panels ----
 const langBase=changeTownLanguage;
 changeTownLanguage=function(mode){const r=langBase.call(this,mode);try{const strip=$('journeyStrip');if(strip)strip.dataset.sig='';TownJourneyUI.paintStrip();const eb=$('errandOpen');if(eb)eb.remove();TownSound.refresh();renderHUD();}catch(e){}return r;};

 // ---- journal: add a way into the journey panel ----
 const recordsBase=showRecords;
 showRecords=function(...a){
  const r=recordsBase.apply(this,a);
  try{
   const body=$('dialogBody');const actions=body&&[...body.children].find(x=>x.className==='actions');
   if(body&&actions&&course()&&!$('recordsJourney')){const h=document.createElement('div');h.innerHTML='<div class="actions"><button id="recordsJourney" data-locale-fixed="true">'+TownKit.t('我的旅程（各章进度）','My journey (chapter progress)')+'</button></div>';body.insertBefore(h.children[0],actions);$('recordsJourney').onclick=()=>TownJourneyUI.showJourney();}
  }catch(e){}
  return r;
 };

 // ---- first paint after the saved game is loaded ----
 const start=()=>{try{ensureFields();TownJourneyUI.noteVisit();renderHUD();TownSound.install();}catch(e){}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(start,400),{once:true});else setTimeout(start,400);

 window.TownExperience=Object.freeze({start});
})();
