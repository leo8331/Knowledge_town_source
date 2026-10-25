(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WorkbenchCourse=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const KEY='knowledgeTownHandoff';
 function read(storage,id){try{const c=JSON.parse(storage.getItem(KEY)||'null');return c&&c.id===id?c:null;}catch{return null;}}
 function publish(storage,context,pack,bridge,presentation){
  if(!read(storage,context.id))throw Error('工作台已开启另一轮课程，请返回工作台重新进入出题器。');
  if(!pack||pack.demo||!Array.isArray(pack.cards)||!pack.cards.length)throw Error('请先生成或打开一份真实题库。');
  const converted=bridge.toTasks(pack,{regions:context.regions||[]});
  if(!converted.tasks.length)throw Error('当前题库没有可用的互动题，请先检查题目格式。');
  const title=presentation.cleanTitle(pack.title||pack.topic,'学习课程'),summary=(pack.summary?pack.summary+' ':'')+bridge.summary(converted).text+'。';
  const points=(pack.outline||[]).map(o=>typeof o==='string'?o:o.point||o.title||o.name||'').filter(Boolean);
  const scene={title,regions:context.regions||[],tasks:converted.tasks,completion:{title:'全部完成',message:'你已经走完了这份资料里的所有任务点。'},source:{kind:'knowledge-base',packId:pack.id||context.id,generatedAt:Date.now()}};
  const preview={title,summary,template:context.template,templateName:context.templateName,customImage:context.template==='custom'?context.customImage:'',customPrompt:context.customPrompt||'',sourceName:'知识库出题器 · '+(pack.id||''),packId:pack.id||'',points:points.length?points:converted.tasks.slice(0,4).map(t=>t.name),modules:converted.tasks.slice(0,4).map(t=>({name:t.name,goal:t.prompt.slice(0,40)})),exercise:'走完地图上的 '+converted.tasks.length+' 个任务点。',taskCount:converted.tasks.length,skipped:converted.skipped.length};
  const keys=['knowledgeTownScene','knowledgeTownPreview'],previous=keys.map(k=>storage.getItem(k));
  try{storage.setItem(keys[0],JSON.stringify(scene));storage.setItem(keys[1],JSON.stringify(preview));}catch(error){keys.forEach((k,i)=>{try{previous[i]===null?storage.removeItem(k):storage.setItem(k,previous[i]);}catch{}});throw Error('课程保存失败，请检查浏览器存储空间后重试。');}
  return {scene,preview};
 }
 return {KEY,read,publish};
});
