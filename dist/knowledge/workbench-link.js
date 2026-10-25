/* Workbench handoff is optional: the original question maker remains usable on its own. */
window.WorkbenchLink=(()=>{
 const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),handoff=params.get('from')==='workbench'?params.get('handoff'):null;
 let context=null,pack=null;
 function readContext(){try{const c=JSON.parse(localStorage.getItem('knowledgeTownHandoff')||'null');return c&&c.id===handoff?c:null;}catch{return null;}}
 function updatePack(value){pack=value;const button=$('useWorkbenchPack');button.disabled=!context||!readContext()||!pack?.cards?.length||!!pack.demo;$('workbenchPackHint').textContent=pack?.demo?'示例仅用于查看题型，请生成或打开自己的题库。':pack?.cards?.length?'当前题库：'+(pack.title||pack.topic||'未命名')+' · '+pack.cards.length+' 题':'生成或打开一份题库后，可将当前题库带回工作台。';}
 function withModel(payload){if($('courseProfileSelect').disabled)throw Error('模型配置正在读取，请稍后再生成。');const selected=$('courseProfileSelect').value;if(selected==='__missing__')throw Error('原出题模型不可用，请重新选择模型或使用本页 API 配置。');const out={...payload};if(selected)out.profileId=selected;return out;}
 async function loadModels(){
  const sel=$('courseProfileSelect'),saved=localStorage.getItem('knowledgeTownCourseProfileId')||'';
  sel.onchange=()=>localStorage.setItem('knowledgeTownCourseProfileId',sel.value);
  try{const response=await fetch('/api/model-profiles');if(!response.ok)throw Error('无法读取模型中心');const d=await response.json();for(const p of d.profiles||[]){const o=document.createElement('option');o.value=p.id;o.textContent=(p.name||p.provider||'模型')+' · '+p.model;sel.appendChild(o);}if(saved&&(d.profiles||[]).some(p=>p.id===saved))sel.value=saved;else if(saved){const o=document.createElement('option');o.value='__missing__';o.textContent='原出题模型已删除，请重新选择';sel.prepend(o);sel.value=o.value;}}
  catch{if(saved){const o=document.createElement('option');o.value='__missing__';o.textContent='暂时无法读取已选模型，请重试或选择本页 API 配置';sel.prepend(o);sel.value=o.value;}}
  sel.disabled=false;
 }
 function init(){
  loadModels();
  if(!handoff)return;
  $('workbenchBar').hidden=false;context=readContext();
  if(!context){$('workbenchContext').textContent='这次工作台衔接已失效，请返回工作台重新进入第三步。';updatePack(null);return;}
  $('workbenchContext').textContent='工作台第 3 步 · '+context.templateName+'场景已保留，可在这里完整配置和检查题库。';
  const draftKey='knowledgeTownKbDraft:'+handoff;let draft=null;try{draft=JSON.parse(sessionStorage.getItem(draftKey)||'null');}catch{}
  $('topic').value=draft?.topic??context.topic??'';$('materials').value=draft?.material??context.material??'';
  const saveDraft=()=>sessionStorage.setItem(draftKey,JSON.stringify({topic:$('topic').value,material:$('materials').value}));
  $('topic').addEventListener('input',saveDraft);$('materials').addEventListener('input',saveDraft);
  updatePack(pack);
  $('useWorkbenchPack').onclick=async()=>{
   const button=$('useWorkbenchPack');button.disabled=true;
   try{
    await import('../kb-bridge.js');await import('../course-presentation.js');await import('../workbench-course.js');
    WorkbenchCourse.publish(localStorage,context,pack,KbBridge,CoursePresentation);
    localStorage.setItem('knowledgeTownMaterial',$('materials').value);
    location.href='../workbench.html?step=4';
   }catch(e){$('workbenchPackHint').textContent=e.message;button.disabled=!pack?.cards?.length;}
  };
 }
 return {init,updatePack,withModel};
})();
