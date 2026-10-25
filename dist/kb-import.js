/* 出题器题库交接：把「知识库出题器」生成并保存的题库，直接变成拾知小镇里的一份学习材料。
   数据来自主服务的只读接口 /api/kb-packs，导入时走 L.addBank，等于新建一份课程，原有存档与进度不受影响。 */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const copy=(zh,en)=>typeof courseCopy==='function'?courseCopy(zh,en):zh;
 function toCards(pack){
  const topic=pack.topic||pack.title||'';
  return (pack.cards||[]).map(c=>({q:c.q,a:c.answer,wrong:Array.isArray(c.wrong)&&c.wrong.length?c.wrong:['材料里没有这个说法。','和原文不一致的说法。'],quote:c.quote||c.answer,topic:c.point||topic,locator:(pack.title||topic||'出题器题库')+(c.point?' · '+c.point:'')}));
 }
 async function addPack(id){
  const hint=$('kbPackHint');
  try{
   if(hint)hint.textContent=copy('正在读取题库…','Loading the pack…');
   const response=await fetch('/api/kb-packs/'+encodeURIComponent(id));
   if(!response.ok)throw Error(copy('这份题库已经不在了，请回出题器重新保存。','This pack is gone; save it again in the question maker.'));
   const pack=(await response.json()).pack,cards=toCards(pack);
   if(!cards.length)throw Error(copy('题库里没有能变成练习的题目。','This pack has no questions that can become exercises.'));
   const bank=L.addBank(state,{title:pack.title||pack.topic||'出题器题库',kind:'出题器题库',cards},Date.now());
   try{render();}catch{}
   try{save();}catch{}
   const dialog=$('dialog');if(dialog&&dialog.open)dialog.close();
   toast(copy('已加入「'+bank.title+'」：'+bank.cards.length+' 题','Added “'+bank.title+'”: '+bank.cards.length+' questions'));
  }catch(error){if(hint)hint.textContent=error.message;}
 }
 async function showPacks(){
  modal(`<span class="eyebrow">${copy('出题器题库 · 先核对再加入','Question-maker library · review before adding')}</span><h2 id="dialogTitle">${copy('从知识库出题器导入','Import from the question maker')}</h2><p id="kbPackHint">${copy('正在读取题库…','Loading packs…')}</p><div id="kbPackList"></div>`,true);
  try{
   const response=await fetch('/api/kb-packs');
   if(!response.ok)throw Error();
   const packs=(await response.json()).packs||[],hint=$('kbPackHint'),list=$('kbPackList');
   if(!hint||!list)return;
   if(!packs.length){hint.textContent=copy('还没有题库。先到「知识库出题器」生成并保存一份，再回来导入。','No packs yet. Generate and save one in the question maker first.');return;}
   hint.textContent=copy('选一份题库作为新的学习材料：导入后是一门独立课程，原有章节与进度都不受影响。','Pick a pack to add as a new learning material. Your current chapters and progress stay untouched.');
   list.innerHTML=packs.map(p=>`<button data-pack="${esc(p.id)}" style="display:block;width:100%;text-align:left;margin:6px 0;padding:10px 12px"><strong>${esc(p.title)}</strong><span style="display:block;opacity:.72;font-size:12px">${p.count} ${copy('题','questions')}${p.topic&&p.topic!==p.title?' · '+esc(p.topic):''}</span></button>`).join('');
   for(const button of list.querySelectorAll('[data-pack]'))button.onclick=()=>addPack(button.dataset.pack);
  }catch{if($('kbPackHint'))$('kbPackHint').textContent=copy('读不到题库：这个地址没连到主服务，或服务刚重启。本机运行时请确认 npm start 已启动。','Cannot read packs: this address is not connected to the server, or it just restarted.');}
 }
 function installButton(){
  let nav=null;try{nav=document.querySelector('header nav');}catch{}
  let button=$('kbPacks');
  if(!button){
   button=document.createElement('button');button.id='kbPacks';button.onclick=showPacks;
   if(nav){const entry=$('importKnowledge'),next=entry?entry.nextSibling:null;if(next&&typeof nav.insertBefore==='function')nav.insertBefore(button,next);else nav.appendChild(button);}
   else if(document.body){button.style.setProperty('position','fixed');button.style.setProperty('right','16px');button.style.setProperty('bottom','16px');button.style.setProperty('z-index','30');document.body.appendChild(button);}
  }
  const label=copy('出题器题库','Question packs');if(button.textContent!==label)button.textContent=label;
 }
 const hudBase=renderHUD;
 renderHUD=function(...args){const result=hudBase.apply(this,args);try{installButton();}catch{}return result;};
 const start=()=>{try{renderHUD();}catch{}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{start();setTimeout(start,600);},{once:true});else start();
 window.KbImport=Object.freeze({showPacks,addPack});
})();
