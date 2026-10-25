/* Shared helpers for the newer town panels: language-aware text and scene placement.
   Panels built with these mark themselves data-locale-fixed so the display layer does not
   translate them a second time. Nothing here touches saves. */
'use strict';
const TownKit=(()=>{
 const lang=()=>(typeof state==='object'&&state&&state.language)||'zh';
 const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 // HTML-safe text in the current display language. bi shows Chinese with the English line beneath.
 function t(zh,en){const l=lang();if(l==='en')return safe(en||zh);if(l==='bi'&&en&&en!==zh)return safe(zh)+'<small lang="en">'+safe(en)+'</small>';return safe(zh);}
 // Plain text (toast, aria-label, title).
 function plain(zh,en){const l=lang();if(l==='en')return en||zh;if(l==='bi'&&en&&en!==zh)return zh+' / '+en;return zh;}
 // Lesson fields. Courses without English fall back to the Chinese text.
 const title=l=>({zh:l?.title||'',en:l?.en?.title||l?.title||''});
 const body=l=>({zh:l?.body||'',en:l?.en?.body||l?.body||''});
 const example=l=>({zh:l?.example||'',en:l?.en?.example||l?.example||''});
 const category=l=>({zh:l?.category||'',en:l?.en?.category||l?.category||''});
 const tf=f=>t(f.zh,f.en);
 const pf=f=>plain(f.zh,f.en);
 // Pick scene points that stay clear of the lesson fruits, the stations and each other.
 function freePoints(count,avoid=[],gap=11,box={x0:10,x1:90,y0:14,y1:86}){
  try{
   const all=CAT.objects(state.zone),stations=(zoneInfo().stations||[]).map(s=>[s[2],s[3]]);
   const blocked=[...avoid,...stations];
   const good=all.filter(o=>o.x>box.x0&&o.x<box.x1&&o.y>box.y0&&o.y<box.y1&&blocked.every(([x,y])=>Math.abs(o.x-x)>gap||Math.abs(o.y-y)>gap));
   const out=[];
   for(let i=0;i<good.length&&out.length<count;i++){const o=good[(i*5+3)%good.length];if(out.every(p=>Math.abs(p.x-o.x)>gap||Math.abs(p.y-o.y)>gap))out.push({x:o.x,y:o.y});}
   return out;
  }catch{return [];}
 }
 function fruitPoints(section){try{return section.lessons.map((_,i)=>{const p=lessonPosition(i);return [p.x,p.y];});}catch{return [];}}
 // Centre the camera on a scene point and show the hint ring there (same mechanism as the compass).
 function pointAtScene(x,y){
  try{
   const ring=$('hintRing');ring.hidden=false;ring.style.left=x+'%';ring.style.top=y+'%';
   zoomAt(Math.max(1.3,camera.z));
   const scale=cameraBase()*camera.z;camera.x=$('viewport').clientWidth/2-x/100*W*scale;camera.y=$('viewport').clientHeight/2-y/100*H*scale;applyCamera();
   clearTimeout(pointAtScene.timer);pointAtScene.timer=setTimeout(()=>{ring.hidden=true;},6500);
   return true;
  }catch{return false;}
 }
 const inStudyScene=()=>{try{return !!currentCourse()&&studyState().mode==='learn'&&!document.body.classList.contains('away-open');}catch{return false;}};
 return {lang,safe,t,plain,title,body,example,category,tf,pf,freePoints,fruitPoints,pointAtScene,inStudyScene};
})();
if(typeof module==='object')module.exports=TownKit;
