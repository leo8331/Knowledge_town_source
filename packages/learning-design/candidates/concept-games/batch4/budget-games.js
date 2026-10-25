(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ConceptBudgetGames=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';const kinds=['context-budget','relevance-window'],t=(zh,en)=>({zh,en});
function init(d){if(d.kind==='context-budget')return {modes:Object.fromEntries(d.config.blocks.map(b=>[b.id,'keep'])),output:d.config.initialOutput,run:null,answer:null};if(d.kind==='relevance-window')return {selected:[],checked:false,answer:null};throw Error('Unsupported kind');}
function step(d,input,a){const data=JSON.parse(JSON.stringify(input)),c=d.config,feedback=[];let passed=false;const f=(id,correct,zh,en)=>feedback.push({itemId:id,correct,message:t(zh,en),knowledgeIds:[d.sourceUnitId]});
 if(d.kind==='context-budget'){
  if(a.type==='mode'){const b=c.blocks.find(x=>x.id===a.blockId);if(!b||!b.modes.some(x=>x.id===a.mode))throw Error('Invalid block/mode');data.modes[b.id]=a.mode;data.run=null;data.answer=null;}
  else if(a.type==='reserve'){if(!c.outputChoices.includes(a.value))throw Error('Invalid output');data.output=a.value;data.run=null;data.answer=null;}
  else if(a.type==='run'){
   const used=c.blocks.map(b=>({...b.modes.find(m=>m.id===data.modes[b.id]),id:b.id}));const total=used.reduce((v,b)=>v+b.cost,0)+data.output;
   const within=total<=c.limit,outputOK=data.output>=c.minimumOutput;let evidenceOK=true;
   f('budget',within,`全部输入 ${total-data.output} + 输出预留 ${data.output} = ${total}，窗口上限 ${c.limit}。`,`All input ${total-data.output} + reserved output ${data.output} = ${total}; limit ${c.limit}.`);
   f('output',outputOK,`本题完成回答至少需预留 ${c.minimumOutput} 点输出，不能只删输出腾位置。`,`This exercise needs at least ${c.minimumOutput} output points; removing output is not a valid substitute.`);
   for(const id of c.privateExpected.requiredBlocks){const b=used.find(x=>x.id===id),ok=b.preserves&&b.cost>0;evidenceOK=evidenceOK&&ok;f(id,ok,id==='policy'?'预约政策必须保留申请、培训、管理员确认全部条件，不能截掉限制。':'保留此块的指令或版本/权限依据；其它正确压缩不清空。',id==='policy'?'Keep every reservation condition: application, training and administrator confirmation; do not truncate limitations.':'Keep this block’s instructions or version/access evidence; other valid compression choices remain.');}
   data.run={total,valid:within&&outputOK&&evidenceOK};data.answer=null;
  }else if(a.type==='answer'){
   if(!c.answers.some(x=>x.id===a.decision)||!Array.isArray(a.evidenceIds)||a.evidenceIds.some(id=>!c.evidenceChoices.some(x=>x.id===id)))throw Error('Invalid answer/evidence');
   if(!data.run||!data.run.valid)f('answer',false,'先实际运行并通过预算、输出和依据检查。','Run and satisfy the budget, output and evidence checks first.');
   else{const answerOK=a.decision===c.privateExpected.answer,evidenceOK=c.privateExpected.evidence.every(id=>a.evidenceIds.includes(id))&&a.evidenceIds.every(id=>c.privateExpected.evidence.includes(id));data.answer={decision:a.decision,evidenceIds:a.evidenceIds,valid:answerOK&&evidenceOK};f('answer',answerOK,'申请不等于批准；还需要培训和管理员确认，个案批准记录仍未知。','Application is not approval; training and administrator confirmation are also required, and individual approval is unknown.');f('citation',evidenceOK,'应引用保留的预约政策；海报历史不能支持预约结论。','Cite the retained reservation policy; poster history does not support the reservation conclusion.');}
  }else throw Error('Unknown action');
  passed=!!data.run&&data.run.valid&&!!data.answer&&data.answer.valid;
 }else if(d.kind==='relevance-window'){
  if(a.type==='select'){if(!c.passages.some(p=>p.id===a.passageId)||typeof a.include!=='boolean')throw Error('Invalid passage');data.selected=data.selected.filter(id=>id!==a.passageId);if(a.include)data.selected.push(a.passageId);data.checked=false;data.answer=null;}
  else if(a.type==='check'){
   let valid=true;const selected=c.passages.filter(p=>data.selected.includes(p.id)),total=selected.reduce((v,p)=>v+p.cost,0);f('capacity',total<=c.limit,`片段总计 ${total}，窗口 ${c.limit}；装得下不等于可用。`,`Passages total ${total}, limit ${c.limit}; fitting does not establish suitability.`);valid=total<=c.limit;
   for(const p of selected){const ok=p.authorized&&p.current&&p.relevant;valid=valid&&ok;f(p.id,ok,!p.authorized?'当前用户没有读取权限，不能先取回再遮盖。':!p.current?'此版本已停用，不能支持当前政策结论。':!p.relevant?'这个片段谈海报，不能支持预约结论。':'该片段已授权、当月有效且直接谈预约条件。',!p.authorized?'This user lacks read permission; do not retrieve first and mask later.':!p.current?'This version is retired and cannot establish current policy.':!p.relevant?'This passage concerns posters and cannot support reservation claims.':'This passage is authorized, current and directly addresses reservation conditions.');}
   for(const id of c.privateExpected.requiredEvidence)if(!data.selected.includes(id)){valid=false;f(id,false,'缺少当前问题的有效政策依据。','The applicable current-policy evidence is missing.');}data.checked=valid;
  }else if(a.type==='answer'){
   if(!c.answers.some(x=>x.id===a.decision)||!Array.isArray(a.evidenceIds)||a.evidenceIds.some(id=>!c.passages.some(p=>p.id===id)))throw Error('Invalid answer');
   if(!data.checked)f('answer',false,'先检查选定片段的授权、版本和相关性。','Check authorization, version and relevance of selected passages first.');
   else{const answerOK=a.decision===c.privateExpected.answer,citationOK=c.privateExpected.requiredEvidence.every(id=>a.evidenceIds.includes(id))&&a.evidenceIds.every(id=>data.selected.includes(id)&&c.privateExpected.requiredEvidence.includes(id));data.answer={valid:answerOK&&citationOK,decision:a.decision,evidenceIds:a.evidenceIds};f('answer',answerOK,'当前政策保留培训和管理员确认条件，资料没有证明该申请已经批准。','The current policy retains training and administrator confirmation requirements; these materials do not establish approval for this request.');f('citation',citationOK,'回答需要引用所选的当前预约政策，不可引用旧版、无关或无权读取的资料。','Cite the selected current reservation policy, not retired, irrelevant or unauthorized material.');}
  }else throw Error('Unknown action');
  passed=data.checked&&!!data.answer&&data.answer.valid;
 }else throw Error('Unsupported kind');return {data,feedback,passed};
}
return {kinds,init,step};
});
