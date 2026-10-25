(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ConceptPromptGames=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';const kinds=['prompt-workbench','prompt-testbench'],t=(zh,en)=>({zh,en});
function init(d){if(d.kind==='prompt-workbench')return {components:Object.fromEntries(d.config.slots.map(s=>[s.id,s.initial])),runs:[],observedFailure:false,conclusion:null};if(d.kind==='prompt-testbench')return {selected:[],example:null,runs:[],conclusion:null};throw Error('Unsupported kind');}
function step(d,input,a){const data=JSON.parse(JSON.stringify(input)),c=d.config,feedback=[];let passed=false;const f=(itemId,correct,zh,en)=>feedback.push({itemId,correct,message:t(zh,en),knowledgeIds:[d.sourceUnitId]});
 if(d.kind==='prompt-workbench'){
  if(a.type==='configure'){const s=c.slots.find(x=>x.id===a.slotId);if(!s||!s.options.some(o=>o.id===a.optionId))throw Error('Invalid component');data.components[s.id]=a.optionId;data.conclusion=null;}
  else if(a.type==='run'){
   const ca=c.cases.find(x=>x.id===a.caseId);if(!ca)throw Error('Invalid case');const snapshot=JSON.stringify(data.components),missing=ca.required.filter(id=>{const slot=c.slots.find(s=>s.id===id);return !slot.options.find(o=>o.id===data.components[id]).valid;});
   const correct=missing.length===0;if(!correct)data.observedFailure=true;
   const output={format:missing.includes('format')?'unstructured':'fields',sourceCited:!missing.includes('context')&&!missing.includes('format'),material:ca.material,time:missing.includes('constraint')?t('模拟错误：凭空补为上午九点','Simulated error: invent 09:00'):t('原记录未提供时间，未知','Time absent from the report; unknown'),symptom:ca.id==='embedded'&&missing.includes('boundary')?t('模拟错误：听从资料中伪指令，全部正常','Simulated error: obey embedded instruction and mark all normal'):missing.includes('context')||missing.includes('goal')?t('模拟错误：输出宣传文字，未依据故障记录','Simulated error: promotional text without fault-report evidence'):t('按所引原记录保留实际故障症状','Retain the actual symptom in the cited source report')};
   data.runs.push({caseId:ca.id,snapshot,correct,failedComponents:missing,output});data.conclusion=null;
   for(const id of ca.required){const slot=c.slots.find(s=>s.id===id),ok=!missing.includes(id);f(id,ok,`${slot.label.zh}：${ok?'本模拟满足该职责':'当前组件不满足该案例，请保留其它正确组件只修复本项'}。`,`${slot.label.en}: ${ok?'satisfies this responsibility in the simulation':'does not satisfy this case; retain other correct components and repair this one'}.`);}
   f(ca.id,correct,correct?'模拟输出按字段引用故障记录；未提供时间写未知；资料中伪指令不执行（仅本题规则）。':'模拟输出未满足上述职责，不能把这次结果记作成功。',correct?'Simulated output cites the fault report by field, marks absent time unknown, and ignores source commands (exercise rules only).':'The simulated output fails the listed responsibilities and cannot count as successful.');
  }else if(a.type==='conclude'){
   if(!c.conclusions.some(x=>x.id===a.decision))throw Error('Invalid conclusion');const snap=JSON.stringify(data.components),complete=c.cases.every(ca=>data.runs.some(r=>r.caseId===ca.id&&r.snapshot===snap&&r.correct));
   if(!complete||!data.observedFailure)f('tests',false,'先观察一次失败，再将同一修复版本的三类案例全部重跑通过。','Observe a failure first, then rerun and pass all three case types on the same repaired version.');
   else{data.conclusion=a.decision;f('scope',a.decision===c.privateExpected.conclusion,'这些记录只验证已给模拟规则。真实模型效果和服务端权限仍需分别验证。','These records validate only the given simulation rules. Actual-model behavior and server permissions require separate checks.');}
  }else throw Error('Unknown action');
  const snapshot=JSON.stringify(data.components);passed=data.observedFailure&&data.conclusion===c.privateExpected.conclusion&&c.cases.every(ca=>data.runs.some(r=>r.caseId===ca.id&&r.snapshot===snapshot&&r.correct));
 }else if(d.kind==='prompt-testbench'){
  if(a.type==='select'){if(!c.cases.some(x=>x.id===a.caseId)||typeof a.include!=='boolean')throw Error('Invalid test case');data.selected=data.selected.filter(x=>x!==a.caseId);if(a.include)data.selected.push(a.caseId);data.conclusion=null;}
  else if(a.type==='example'){if(!c.examples.some(x=>x.id===a.exampleId))throw Error('Invalid example');data.example=a.exampleId;data.conclusion=null;}
  else if(a.type==='run'){
   if(!c.versions.some(x=>x.id===a.versionId))throw Error('Invalid version');
   if(!data.selected.length||data.example===null)f('tests',false,'先选择测试案例和独立少样本示例。','Select test cases and an independent few-shot example first.');
   else{const leak=c.examples.find(x=>x.id===data.example).leaks,snapshot=JSON.stringify({selected:[...data.selected].sort(),example:data.example}),results=data.selected.map(id=>{const ca=c.cases.find(x=>x.id===id);return {caseId:id,correct:a.versionId==='v2'||ca.category==='typical'};});data.runs.push({versionId:a.versionId,snapshot,leaked:leak,results});data.conclusion=null;
    f('example',!leak,leak?'示例含本测试题答案，结果受泄漏污染，不能当未见验证。':'示例只示范独立任务格式，不泄漏测试题答案。',leak?'The example contains this test’s answer, contaminating the result; it is not unseen validation.':'The independent example demonstrates task format without revealing test answers.');
    for(const r of results)f(r.caseId,r.correct,`${a.versionId}：${r.correct?'通过给定模拟评分':'未满足未知处理或资料边界的模拟评分'}。`,`${a.versionId}: ${r.correct?'passes the given simulated rubric':'fails the simulated rubric for unknown handling or source boundaries'}.`);
   }
  }else if(a.type==='conclude'){
   if(!c.conclusions.some(x=>x.id===a.decision))throw Error('Invalid conclusion');const cats=c.privateExpected.categories,covered=cats.every(cat=>data.selected.some(id=>c.cases.find(ca=>ca.id===id).category===cat)),snap=JSON.stringify({selected:[...data.selected].sort(),example:data.example}),compared=c.versions.every(v=>data.runs.some(r=>r.versionId===v.id&&r.snapshot===snap&&!r.leaked));
   if(!covered||!compared)f('tests',false,'需同一未泄漏测试集覆盖典型、边界、失败，并实际运行两个版本；不能只保留漂亮案例。','Use the same untainted set covering typical, boundary and failure cases and actually run both versions; attractive cases alone are insufficient.');
   else{data.conclusion=a.decision;f('scope',a.decision===c.privateExpected.conclusion,'v2在本题模拟标准更好；有限模拟不能保证真实模型稳定，也不替代部署验收。','v2 is better under this exercise rubric; finite simulations neither guarantee real-model reliability nor replace deployment acceptance.');}
  }else throw Error('Unknown action');
  const snap=JSON.stringify({selected:[...data.selected].sort(),example:data.example});passed=data.conclusion===c.privateExpected.conclusion&&c.privateExpected.categories.every(cat=>data.selected.some(id=>c.cases.find(ca=>ca.id===id).category===cat))&&c.versions.every(v=>data.runs.some(r=>r.versionId===v.id&&r.snapshot===snap&&!r.leaked));
 }else throw Error('Unsupported kind');return {data,feedback,passed};
}
return {kinds,init,step};
});
