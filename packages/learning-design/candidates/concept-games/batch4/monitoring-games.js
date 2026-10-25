(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ConceptMonitoringGames=factory();})(typeof globalThis==='undefined'?this:globalThis,function(){
'use strict';
const kinds=['drift-observatory'],copy=x=>JSON.parse(JSON.stringify(x)),t=(zh,en)=>({zh,en});
function init(){return {opened:[],metrics:{},judgments:{},responses:{}};}
function step(d,input,a){const n=copy(input),c=d.config,feedback=[];const say=(id,correct,zh,en)=>feedback.push({itemId:id,correct,message:t(zh,en),knowledgeIds:[d.sourceUnitId]});
 if(a.type==='inspect'){if(!c.windows.some(w=>w.id===a.windowId))throw Error('Unknown monitoring window');if(!n.opened.includes(a.windowId))n.opened.push(a.windowId);}
 else if(a.type==='measure'){
  const w=c.windows.find(w=>w.id===a.windowId);if(!w||!a.values||Object.keys(a.values).some(k=>!['highPercent','errors'].includes(k)))throw Error('Unknown monitoring measure');
  if(!n.opened.includes(w.id)){say(w.id,false,'先打开该时间窗的原始记录，再计算，不能用猜数代替观察。','Open this window’s records before calculating; a guessed number is not an observation.');}
  else{const previous=n.metrics[w.id]||{};for(const key of Object.keys(a.values)){const value=a.values[key];if(value!==null&&!Number.isFinite(value))throw Error('Invalid monitoring value');previous[key]=value;}n.metrics[w.id]=previous;
   for(const key of Object.keys(a.values)){const expected=key==='highPercent'?100*w.rows.filter(r=>r.input==='high').length/w.rows.length:w.rows.some(r=>r.actual===null)?null:w.rows.filter(r=>r.predicted!==r.actual).length;const correct=previous[key]===expected;
    say(w.id+':'+key,correct,key==='highPercent'?`本窗高输入占比为高输入条数÷总条数×100；记录共${w.rows.length}条。`:expected===null?'真实结果尚未回流，错误数必须保留未知，不能填零。':'逐条比较模型输出与真实结果，累计不一致条数。',key==='highPercent'?`High-input share is high-input rows divided by all ${w.rows.length} rows, times 100.`:expected===null?'Actual outcomes have not arrived; keep the error count unknown rather than zero.':'Compare each prediction with its actual outcome and count disagreements.');}
  }
 }else if(a.type==='judge'){
  const q=c.comparisons.find(q=>q.id===a.comparisonId);if(!q||!c.options.some(o=>o.id===a.decision))throw Error('Unknown drift judgment');
  if(![q.baselineId,q.currentId].every(id=>n.opened.includes(id)&&measured(c,n,id))){say(q.id,false,'先观察基线与当前记录，完成占比和错误数核算，再比较。','Inspect baseline and current records and calculate their input shares and error counts before comparing.');}
  else{n.judgments[q.id]=a.decision;say(q.id,a.decision===q.expected,q.reason.zh,q.reason.en);}
 }else if(a.type==='respond'){
  const q=c.comparisons.find(q=>q.id===a.comparisonId);if(!q||!c.responses.some(o=>o.id===a.decision))throw Error('Unknown monitoring response');
  if(n.judgments[q.id]!==q.expected){say(q.id+':response',false,'先根据已计算记录完成变化判断，再选择处置；收益或输入变化不能单独触发重训。','Judge the change from calculated records before choosing a response; benefits or input shift alone do not establish a retraining need.');}
  else{n.responses[q.id]=a.decision;say(q.id+':response',a.decision===q.response,q.responseReason.zh,q.responseReason.en);}
 }else throw Error('Unknown monitoring action');
 const passed=c.comparisons.every(q=>[q.baselineId,q.currentId].every(id=>measured(c,n,id))&&n.judgments[q.id]===q.expected&&n.responses[q.id]===q.response);return {data:n,feedback,passed};
}
function measured(c,n,id){const w=c.windows.find(w=>w.id===id),m=n.metrics[id];return !!m&&m.highPercent===100*w.rows.filter(r=>r.input==='high').length/w.rows.length&&Object.hasOwn(m,'errors')&&m.errors===(w.rows.some(r=>r.actual===null)?null:w.rows.filter(r=>r.predicted!==r.actual).length);}
return {kinds,init,step};
});
