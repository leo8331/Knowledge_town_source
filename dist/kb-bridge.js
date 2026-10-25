/* Bridge between the question maker (知识库出题器) and the playable map.
   - toTasks(pack, opts): turns a saved question pack into map tasks (all six question types).
   - grade(task, answer): decides right/wrong for one task.
   Pure functions, no DOM, no network. The map page only renders what comes out of here.
   A question that cannot be played correctly is skipped and listed in `skipped`, never faked. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.KbBridge=api;})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
const TYPES=['single','multi','order','sort','pair','numeric'];
const str=v=>typeof v==='string'?v.trim():'';
const uniq=a=>[...new Set(a)];
function hash(text){let h=2166136261;for(const c of String(text)){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function shuffle(list,random){const out=[...list];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
const norm=s=>String(s).replace(/[\s。.，,；;、]+$/g,'').trim();

// ---- one card -> one task, per type. Returns {task} or {skip:reason} ----
function fromSingle(c){
 const answer=str(c.answer),wrong=(c.wrong||[]).map(str).filter(Boolean);
 let correct=(c.options||[]).filter(o=>o&&o.correct).map(o=>str(o.text));
 if(!correct.length&&answer)correct=[answer];
 if(correct.length!==1)return {skip:'单选题需要恰好一个正确选项'};
 const others=uniq([...(c.options||[]).filter(o=>o&&!o.correct).map(o=>str(o.text)),...wrong]).filter(x=>x&&norm(x)!==norm(correct[0]));
 if(others.length<1)return {skip:'单选题至少要有一个干扰项'};
 return {task:{type:'single',options:[correct[0],...others.slice(0,3)],correct:[correct[0]]}};
}
function fromMulti(c){
 const answers=uniq((c.answers||[]).map(str).filter(Boolean));
 const wrong=uniq([...(c.options||[]).filter(o=>o&&!o.correct).map(o=>str(o.text)),...(c.wrong||[]).map(str)]).filter(x=>x&&!answers.some(a=>norm(a)===norm(x)));
 if(answers.length<2)return {skip:'多选题至少要两个正确答案'};
 if(wrong.length<1)return {skip:'多选题至少要一个干扰项'};
 return {task:{type:'multi',options:[...answers,...wrong.slice(0,4)],correct:answers}};
}
function fromOrder(c){
 const steps=(c.steps||[]).map(str).filter(Boolean);
 if(steps.length<2||new Set(steps).size!==steps.length)return {skip:'排序题至少两个互不相同的步骤'};
 return {task:{type:'order',items:steps,correct:steps}};
}
function fromSort(c){
 const cats=(c.categories||[]).map(k=>({label:str(k&&k.label),items:(k&&k.items||[]).map(str).filter(Boolean)})).filter(k=>k.label&&k.items.length);
 const all=cats.flatMap(k=>k.items);
 if(cats.length<2)return {skip:'分类题至少两个类别'};
 if(new Set(all).size!==all.length)return {skip:'分类题里有条目同时出现在两个类别'};
 return {task:{type:'sort',categories:cats.map(k=>k.label),items:all,correct:Object.fromEntries(cats.flatMap(k=>k.items.map(i=>[i,k.label])))}};
}
function fromPair(c){
 const pairs=(c.pairs||[]).map(p=>({left:str(p&&p.left),right:str(p&&p.right)})).filter(p=>p.left&&p.right);
 if(pairs.length<2)return {skip:'连线题至少两对'};
 if(new Set(pairs.map(p=>p.left)).size!==pairs.length||new Set(pairs.map(p=>p.right)).size!==pairs.length)return {skip:'连线题的左右两列不能有重复'};
 return {task:{type:'pair',lefts:pairs.map(p=>p.left),rights:pairs.map(p=>p.right),correct:Object.fromEntries(pairs.map(p=>[p.left,p.right]))}};
}
function fromNumeric(c){
 const v=c.numeric&&Number(c.numeric.value);
 if(!Number.isFinite(v))return {skip:'数值题缺少数字答案'};
 return {task:{type:'numeric',unit:str(c.numeric.unit),correct:v,formula:str(c.formula)}};
}
const BUILD={single:fromSingle,multi:fromMulti,order:fromOrder,sort:fromSort,pair:fromPair,numeric:fromNumeric};

// Spread points over the map without overlapping, using the scene's own regions if it has any.
function place(count,regions,random){
 const spots=[];
 const boxes=Array.isArray(regions)&&regions.length?regions:[{x:8,y:14,w:84,h:72}];
 const cols=Math.ceil(Math.sqrt(count*1.6)),rows=Math.ceil(count/cols);
 for(let i=0;i<count;i++){
  const box=boxes[i%boxes.length];
  const bx=Number(box.x)||8,by=Number(box.y)||14,bw=Math.max(14,Number(box.w)||84),bh=Math.max(14,Number(box.h)||72);
  const k=Math.floor(i/boxes.length),per=Math.max(1,Math.ceil(count/boxes.length)),c2=Math.max(1,Math.ceil(Math.sqrt(per))),r2=Math.max(1,Math.ceil(per/c2));
  const cx=k%c2,cy=Math.floor(k/c2);
  const x=bx+bw*((cx+0.5+(random()-0.5)*0.4)/c2),y=by+bh*((cy+0.5+(random()-0.5)*0.4)/r2);
  spots.push({x:Math.round(Math.min(92,Math.max(8,x))*10)/10,y:Math.round(Math.min(88,Math.max(14,y))*10)/10});
 }
 return spots;
}

function toTasks(pack,opts={}){
 const out={tasks:[],skipped:[],byType:{},title:str(pack&&pack.title)||str(pack&&pack.topic)||'知识库题目'};
 const cards=Array.isArray(pack&&pack.cards)?pack.cards:[];
 const seed=hash((pack&&pack.id)||out.title)^(opts.seed||0),random=rng(seed);
 const built=[];
 cards.forEach((c,i)=>{
  if(!c||!TYPES.includes(c.type)||!str(c.q)){out.skipped.push({index:i,type:c&&c.type,reason:'题目缺少题干或题型未知'});return;}
  const r=BUILD[c.type](c);
  if(r.skip){out.skipped.push({index:i,type:c.type,q:str(c.q).slice(0,40),reason:r.skip});return;}
  built.push({id:str(c.id)||('q'+i),name:str(c.point)||('题目 '+(built.length+1)),prompt:str(c.q),explain:str(c.explain),quote:str(c.quote),...r.task});
 });
 // pick a stable, shuffled presentation so options are not always in the answer's position
 const spots=place(built.length,opts.regions,random);
 built.forEach((t,i)=>{
  const r=rng(hash(t.id)^seed);
  if(t.type==='single'||t.type==='multi')t.options=shuffle(t.options,r);
  if(t.type==='order'){t.items=shuffle(t.items,r);if(t.items.join('\u0001')===t.correct.join('\u0001'))t.items=[...t.items].reverse();}
  if(t.type==='sort')t.items=shuffle(t.items,r);
  if(t.type==='pair')t.rights=shuffle(t.rights,r);
  t.x=spots[i].x;t.y=spots[i].y;out.byType[t.type]=(out.byType[t.type]||0)+1;
 });
 out.tasks=built;
 return out;
}

// answer shapes: single:string | multi:string[] | order:string[] | sort:{item:label} | pair:{left:right} | numeric:number|string
function grade(task,answer){
 switch(task.type){
  case 'single':return typeof answer==='string'&&norm(answer)===norm(task.correct[0]);
  case 'multi':{if(!Array.isArray(answer))return false;const a=new Set(answer.map(norm)),b=new Set(task.correct.map(norm));return a.size===b.size&&[...a].every(x=>b.has(x));}
  case 'order':return Array.isArray(answer)&&answer.length===task.correct.length&&answer.every((x,i)=>x===task.correct[i]);
  case 'sort':{if(!answer||typeof answer!=='object')return false;return task.items.every(i=>answer[i]===task.correct[i])&&Object.keys(answer).length===task.items.length;}
  case 'pair':{if(!answer||typeof answer!=='object')return false;return task.lefts.every(l=>answer[l]===task.correct[l])&&Object.keys(answer).length===task.lefts.length;}
  case 'numeric':{const v=typeof answer==='number'?answer:Number(String(answer).replace(/[,，\s]/g,''));if(!Number.isFinite(v))return false;const c=task.correct;return Math.abs(v-c)<=Math.max(1e-9,Math.abs(c)*1e-9);}
 }
 return false;
}
// Which parts were right, so the feedback can point at the exact mistake.
function detail(task,answer){
 switch(task.type){
  case 'order':return task.correct.map((x,i)=>Array.isArray(answer)&&answer[i]===x);
  case 'sort':return task.items.map(i=>!!answer&&answer[i]===task.correct[i]);
  case 'pair':return task.lefts.map(l=>!!answer&&answer[l]===task.correct[l]);
  case 'multi':{const b=new Set(task.correct.map(norm));return (Array.isArray(answer)?answer:[]).map(a=>b.has(norm(a)));}
 }
 return null;
}
function summary(result){
 const types=Object.entries(result.byType).map(([k,n])=>n+' 道'+({single:'单选',multi:'多选',order:'排序',sort:'分类',pair:'连线',numeric:'数值'}[k]||k)).join('、');
 return {playable:result.tasks.length,skipped:result.skipped.length,text:'共 '+result.tasks.length+' 个任务点（'+(types||'无')+'）'+(result.skipped.length?'；有 '+result.skipped.length+' 道题格式不完整，已跳过':'')};
}
return {TYPES,toTasks,grade,detail,summary};
});
