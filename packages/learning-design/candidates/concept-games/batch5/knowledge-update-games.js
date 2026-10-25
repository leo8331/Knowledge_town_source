(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ConceptKnowledgeUpdateGames=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const kinds=['retrieval-pipeline','adaptation-lab'],t=(zh,en)=>({zh,en}),copy=x=>JSON.parse(JSON.stringify(x));
 function init(d){if(!kinds.includes(d.kind))throw Error('Unknown knowledge-update kind');return d.kind==='retrieval-pipeline'?{filter:null,revision:0,retrievals:[],answers:{}}:{parameter:'plain',samples:[],requestDoc:null,sourceVersion:'v1',runs:[],training:[],maintenance:[],retrieved:[],answers:{}};}
 function step(d,input,a){const data=copy(input),c=d.config,feedback=[];a=a||{};const tell=(itemId,correct,message)=>feedback.push({itemId,correct,message,knowledgeIds:[d.sourceUnitId]});
  if(d.kind==='retrieval-pipeline'){
   if(a.type==='setFilter'&&c.filterOptions.some(o=>o.id===a.choice)&&data.filter!==a.choice){data.filter=a.choice;data.revision++;}
   if(a.type==='retrieve'){
    const scenario=c.cases.find(s=>s.id===a.caseId),doc=c.documents.find(q=>q.id===a.documentId);
    if(scenario&&doc){const authorized=doc.authorized&&data.filter==='before';const result=authorized?'retrieved':data.filter==='before'?'denied-before-retrieval':'unsafe-route';
     const correct=result==='retrieved'&&scenario.expectedDocumentId===doc.id;
     const r={id:'retrieval-'+(data.retrievals.length+1),revision:data.revision,caseId:scenario.id,documentId:doc.id,result,contentVisible:result==='retrieved',correct};data.retrievals.push(r);
     tell(scenario.id+'-retrieval',correct,correct?scenario.retrievalFeedback:result!=='retrieved'?t('此请求未获得合格资料：须在检索前验证授权，禁止先读私密资料再遮盖。','This request did not obtain eligible material: verify authorization before retrieval, never read private material first and mask it later.'):t('虽取回了资料，但版本或问题相关性不符；回答引用它仍不能修复检索关。','Material was retrieved, but its version or relevance is wrong; citing it cannot repair the retrieval check.'));
    }
   }
   if(a.type==='answer'){
    const scenario=c.cases.find(s=>s.id===a.caseId);
    if(scenario&&scenario.answerOptions.some(o=>o.id===a.choice))data.answers[scenario.id]={choice:a.choice,retrievalId:a.retrievalId};
   }
   const evaluate=scenario=>{const ans=data.answers[scenario.id],r=ans&&data.retrievals.find(r=>r.id===ans.retrievalId);return !!r&&r.revision===data.revision&&r.caseId===scenario.id&&r.correct&&ans.choice===scenario.expectedAnswer;};
   if(a.type==='check')for(const s of c.cases){const ok=evaluate(s);tell(s.id+'-answer',ok,ok?s.answerFeedback:t('分别核对：本次引用是否来自当前、相关、获授权资料，以及结论是否被该片段支持。没写的条件保留未知，不能把有引用等同于答案正确。','Check separately: whether this citation comes from current, relevant, authorized material, and whether it supports the claim. Leave unstated conditions unknown; a citation alone is not correctness.'));}
   return {data,feedback,passed:c.cases.every(evaluate)};
  }
  if(a.type==='attach'&&c.documents.some(doc=>doc.id===a.documentId)){
   data.requestDoc=a.documentId;data.retrieved.push({kind:'attached',documentId:a.documentId,parameterBefore:data.parameter,parameterAfter:data.parameter});
   tell('context',true,t('资料仅加入这次请求，模拟参数未改变；请运行观察行为。','Material was added only to this request; the simulated parameter did not change. Run to observe behavior.'));
  }
  if(a.type==='setSample'&&c.samples.some(s=>s.id===a.sampleId)&&typeof a.selected==='boolean')data.samples=a.selected?Array.from(new Set(data.samples.concat(a.sampleId))):data.samples.filter(s=>s!==a.sampleId);
  if(a.type==='train'){
   const correct=c.samples.every(s=>data.samples.includes(s.id)===s.forTraining),before=data.parameter;
   if(correct)data.parameter=c.trainedParameter;
   data.training.push({before,after:data.parameter,selected:data.samples.slice(),sourceVersionBefore:data.sourceVersion,sourceVersionAfter:data.sourceVersion,correct});
   tell('training',correct,correct?t('极简模拟训练已调整格式参数；外部资料版本保持原值。真实微调不保证一次训练成功。','The simplified training simulation adjusted a format parameter; external source version stayed unchanged. Real fine-tuning does not guarantee success in one step.'):t('样本格式与本题目标不一致；保留已选正确样本，排除不符合目标的记录后再训练。','Sample formats do not match the exercise goal. Retain the correct samples and remove mismatching records before retraining.'));
  }
  if(a.type==='refreshSource'&&a.version==='v2'){
   const before=data.sourceVersion;data.sourceVersion='v2';data.maintenance.push({before,after:'v2',parameterBefore:data.parameter,parameterAfter:data.parameter});
   tell('source',true,t('已更新演练外部资料索引；格式参数未改变。还须重新检索并验证新事实。','The exercise external index was updated; the format parameter did not change. Retrieve again and verify the new fact.'));
  }
  if(a.type==='retrieve'){
   const doc=c.documents.find(q=>q.version===data.sourceVersion);data.requestDoc=doc.id;data.retrieved.push({kind:'retrieved',documentId:doc.id,sourceVersion:data.sourceVersion,parameterBefore:data.parameter,parameterAfter:data.parameter,maintenanceCount:data.maintenance.length});
   tell('retrieval',true,t('已从当前演练索引取回资料，取回动作没有训练参数。','Material was retrieved from the current exercise index; retrieval did not train parameters.'));
  }
  if(a.type==='run'&&c.probes.some(p=>p.id===a.probeId)){
   const doc=c.documents.find(q=>q.id===data.requestDoc),output=c.formats.find(f=>f.id===data.parameter),retrieved=data.retrieved.at(-1)||null,probe=c.probes.find(p=>p.id===a.probeId),fact=doc?doc.fact:t('资料缺失，保留未知','Material missing; unknown');
   const formattedOutput={};for(const lang of ['zh','en'])formattedOutput[lang]=output.headings?output.headings[0][lang]+': '+probe.request[lang]+'\n'+output.headings[1][lang]+': '+fact[lang]:probe.request[lang]+' '+fact[lang];
   const r={id:'run-'+(data.runs.length+1),probeId:a.probeId,parameterBefore:data.parameter,parameterAfter:data.parameter,format:output.label,formattedOutput,documentId:doc?doc.id:null,fact,sourceVersion:data.sourceVersion,trainingCount:data.training.length,maintenanceCount:data.maintenance.length,contextMethod:retrieved?retrieved.kind:null};data.runs.push(r);
   tell(r.id,true,t('观察本次格式、事实来源与参数前后记录，再分别判断两类更新。','Observe this run’s format, fact source and before/after parameter records, then distinguish the two update types.'));
  }
  if(a.type==='judge'&&c.questions.some(q=>q.id===a.questionId))data.answers[a.questionId]=a.choice;
  const contextObserved=data.runs.some(r=>r.trainingCount===0&&r.contextMethod==='attached'&&r.documentId===c.currentDoc&&r.parameterBefore==='plain'&&r.parameterAfter==='plain');
  const trained=data.training.some(r=>r.correct&&r.before==='plain'&&r.after===c.trainedParameter&&r.sourceVersionBefore===r.sourceVersionAfter);
  const formatVerified=data.runs.some(r=>r.parameterBefore===c.trainedParameter&&r.probeId===c.formatProbe);
  const staleObserved=data.runs.some(r=>r.trainingCount>0&&r.sourceVersion==='v1'&&r.documentId===c.oldDoc&&r.probeId===c.factProbe&&r.contextMethod==='retrieved');
  const updated=data.runs.some(r=>r.maintenanceCount>0&&r.sourceVersion==='v2'&&r.documentId===c.currentDoc&&r.probeId===c.factProbe&&r.contextMethod==='retrieved');
  const judged=c.questions.every(q=>data.answers[q.id]===q.expected);
  if(a.type==='check'){
   const checks=[['context-observation',contextObserved,t('先把v2资料加入一次请求并运行；观察资料变了而参数不变。','First attach v2 to a request and run; observe changed information without parameter changes.')],['training-change',trained,t('选符合目标的格式样本并实际训练，观察参数改变且外部版本未改变。','Select target-format samples and actually train; observe parameter change without external-version change.')],['format-validation',formatVerified,t('用未参与训练的新工单探测目标格式。','Probe target formatting with a new ticket not used in training.')],['stale-fact',staleObserved,t('训练后从仍为v1的资料索引检索并运行事实探测，观察格式已变但事实仍旧。','After training, retrieve from the still-v1 index and run the fact probe; observe changed format but stale fact.')],['current-fact',updated,t('维护资料索引到v2，重新检索并运行事实探测；只附一次新资料不等于维护外部来源。','Maintain the source index to v2, retrieve again and run the fact probe; attaching material once does not maintain the external source.')]];
   for(const [id,ok,message] of checks)tell(id,ok,message);
   for(const q of c.questions)tell(q.id,data.answers[q.id]===q.expected,q.feedback);
  }
  return {data,feedback,passed:contextObserved&&trained&&formatVerified&&staleObserved&&updated&&judged};
 }
 return {kinds,init,step};
});
