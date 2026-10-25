/* Shared fill-in / "which concept is this" questions built only from the current
   course's own lessons. Used by the escape-room locks and the daily errand.
   Practice only: nothing here grades formal work, writes foundations or marks mastery.
   Every item carries both Chinese and English so panels can follow the display language. */
'use strict';
const TownCloze=(()=>{
 const ASCII=/^[\x20-\x7e]+$/;
 function hash(text){let h=2166136261;for(const c of String(text)){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return h>>>0;}
 function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
 function shuffle(list,random){const out=[...list];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
 // Only the whole term (or its bracketed acronym) is ever blanked. Single words such as "language"
 // or "training" appear all over other sentences, and blanking them makes nonsense.
 //  "人工智能 AI" -> ["人工智能 AI","人工智能","AI"]   "Artificial intelligence (AI)" -> full, bare, acronym
 function variants(title){
  const base=String(title||'').trim(),set=new Set([base]);
  const paren=base.match(/^(.*?)\s*[(（]([^)）]+)[)）]\s*$/);
  if(paren){set.add(paren[1].trim());set.add(paren[2].trim());}
  const cn=base.match(/^([\u3400-\u9fff][\u3400-\u9fff\s]*?)\s+([A-Za-z][A-Za-z0-9 .+-]*)$/);
  if(cn){set.add(cn[1].trim());set.add(cn[2].trim());}
  return [...set].filter(v=>v.length>=2).sort((a,b)=>b.length-a.length);
 }
 const escapeRegExp=v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 // Blank every standalone mention of the term. Case-insensitive for English; the term must not sit
 // inside a longer word. Returns how many blanks were made.
 function mask(text,vs,blank){
  let out=String(text||''),count=0;
  for(const v of vs){
   const pattern=ASCII.test(v)?new RegExp('(?<![A-Za-z0-9])'+escapeRegExp(v)+'(?![A-Za-z0-9])','gi'):new RegExp(escapeRegExp(v),'g');
   out=out.replace(pattern,()=>{count++;return blank;});
  }
  return {text:out,count};
 }
 // One question for one lesson. Wrong options come from the same section and prefer the same
 // category, because neighbouring concepts are exactly the ones learners confuse.
 function item(lesson,siblings,opts={}){
  if(!lesson||!lesson.body||lesson.body.length<8)return null;
  const random=rng(hash((opts.seed||'')+'|'+lesson.id)),seen=opts.seen||new Set();
  const pool=siblings.filter(x=>x&&x.id!==lesson.id&&x.title&&x.title!==lesson.title);
  const rank=x=>(x.category&&x.category===lesson.category?0:2)+(seen.has(x.id)?0:1);
  const wrong=shuffle(pool,random).sort((a,b)=>rank(a)-rank(b)).slice(0,3);
  if(wrong.length<2)return null;
  let zh=mask(lesson.body,variants(lesson.title),'＿＿');
  let en=lesson.en?.body?mask(lesson.en.body,variants(lesson.en.title||''),'____'):{text:'',count:0};
  // A fill-in only makes sense when the term appears at least once and in the same count on both sides.
  const okZh=zh.count>=1&&zh.count<=2,okEn=!lesson.en?.body||(en.count>=1&&en.count<=2&&en.count===zh.count);
  if(!(okZh&&okEn)){zh={text:lesson.body,count:0};en={text:lesson.en?.body||lesson.body,count:0};}
  const options=shuffle([lesson,...wrong],random).map(x=>({id:x.id,title:x.title,en:x.en?.title||x.title}));
  return {lessonId:lesson.id,answer:lesson.id,options,
   text:{zh:zh.text,en:en.text||zh.text},cloze:zh.count>0,
   category:{zh:lesson.category||'',en:lesson.en?.category||lesson.category||''},
   example:{zh:lesson.example||'',en:lesson.en?.example||lesson.example||''}};
 }
 function items(lessons,siblingsOf,count,opts={}){
  const random=rng(hash(opts.seed||'seed')),out=[];
  for(const l of shuffle(lessons,random)){if(out.length>=count)break;const made=item(l,siblingsOf(l),opts);if(made)out.push(made);}
  return out;
 }
 const lead=q=>q.cloze?{zh:'把话填完整，选出缺少的词：',en:'Complete the sentence. Pick the missing term:'}:{zh:'这段话在说哪个概念？',en:'Which concept does this describe?'};
 // Gentle hints after a wrong pick: first the family, then the worked example. Never the answer.
 function hint(q,level){
  if(level<=1&&q.category.zh)return {zh:'提示：它属于「'+q.category.zh+'」。',en:'Hint: it belongs to “'+q.category.en+'”.'};
  if(q.example.zh)return {zh:'提示：想想这个例子 —— '+q.example.zh,en:'Hint: think of this example: '+q.example.en};
  return {zh:'再想想，也可以回到场景里重读这个物件。',en:'Think again, or reread the object in the scene.'};
 }
 return {hash,rng,shuffle,variants,mask,item,items,lead,hint};
})();
if(typeof module==='object')module.exports=TownCloze;
