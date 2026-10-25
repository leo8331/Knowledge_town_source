(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ConceptSelectionGames=factory();})(typeof globalThis==='undefined'?this:globalThis,function(){
'use strict';
const kinds=['evidence-decision','tool-routing','capability-workflow'],copy=x=>JSON.parse(JSON.stringify(x)),t=(zh,en)=>({zh,en});
function init(d){if(d.kind==='evidence-decision')return {opened:[],decisions:{}};if(d.kind==='tool-routing')return {routes:{},runs:[],judgments:{}};if(d.kind==='capability-workflow')return {prediction:null,draft:null,action:null,answers:{}};throw Error('Unknown selection game');}
function step(d,input,a){const n=copy(input),c=d.config,feedback=[];let passed=false;const f=(id,correct,message)=>feedback.push({itemId:id,correct,message,knowledgeIds:[d.sourceUnitId]});
 if(d.kind==='evidence-decision'){
  const q=c.cases.find(q=>q.id===a.caseId);if(!q)throw Error('Unknown selection case');
  if(a.type==='inspect'){if(!n.opened.includes(q.id))n.opened.push(q.id);}
  else if(a.type==='decide'){if(!c.actions.some(o=>o.id===a.decision))throw Error('Unknown next action');if(!n.opened.includes(q.id))f(q.id,false,t('先查看本情境的政策、数据或结果证据，不能按标题猜选型。','Inspect the case’s policy, data or outcome evidence before choosing; a heading is insufficient.'));else{n.decisions[q.id]=a.decision;f(q.id,a.decision===q.expected,q.reason);}}
  else throw Error('Unknown selection action');passed=c.cases.every(q=>n.opened.includes(q.id)&&n.decisions[q.id]===q.expected);
 }else if(d.kind==='tool-routing'){
  const q=c.tasks.find(q=>q.id===a.taskId);if(!q)throw Error('Unknown tool task');
  if(a.type==='route'){if(!c.tools.some(x=>x.id===a.toolId))throw Error('Unknown tool');n.routes[q.id]=a.toolId;delete n.judgments[q.id];}
  else if(a.type==='run'){
   const tool=c.tools.find(x=>x.id===n.routes[q.id]);if(!tool){f(q.id,false,t('先为该用途选择工具，再运行演练请求。','Select a tool for this purpose before running the exercise request.'));}
   else{const granted=tool.status==='approved'?q.dataClass==='public':tool.status==='restricted'?q.dataClass==='internal'&&q.verifiedIdentity===true:tool.status==='evaluation'?q.dataClass==='synthetic'&&q.environment==='sandbox':false;const r={id:'route-'+(n.runs.length+1),taskId:q.id,toolId:tool.id,granted,result:granted?'simulated-allowed':'simulated-denied'};n.runs.push(r);f(q.id,granted,granted?q.success:t('该工具状态、用途或数据范围不允许本请求；演练未发送资料。保留其它任务的正确路由，再选获准替代。','Tool status, purpose or data scope does not permit this request; the simulation sent no material. Retain other correct routes and select an approved alternative.'));}
  }else if(a.type==='explain'){if(!c.reasons.some(o=>o.id===a.decision))throw Error('Unknown routing explanation');const latest=[...n.runs].reverse().find(r=>r.taskId===q.id);if(!latest||latest.toolId!==n.routes[q.id]||!latest.granted)f(q.id+':reason',false,t('先在当前路由实际取得合规的模拟结果，再解释适用范围。','Obtain an allowed simulated result under the current route before explaining its scope.'));else{n.judgments[q.id]=a.decision;f(q.id+':reason',a.decision===q.expectedReason,q.reason);}}
  else throw Error('Unknown routing action');
  passed=c.tasks.every(q=>{const r=[...n.runs].reverse().find(r=>r.taskId===q.id);return r&&r.toolId===n.routes[q.id]&&r.granted&&n.judgments[q.id]===q.expectedReason;});
 }else if(d.kind==='capability-workflow'){
  if(a.type==='predict'){n.prediction={estimated:c.estimated,actual:c.actual};f('prediction',true,t('模型估计与演练实际结果已展示；估计本身不会发送消息或更新参数。','The estimate and exercise actual outcome are shown; estimating does not send messages or update parameters.'));}
  else if(a.type==='generate'){n.draft=copy(c.draft);f('generation',true,t('已产生一份固定模拟草稿。生成新文字不保证其中每个承诺都有依据；请对照来源。','A fixed simulated draft is produced. New text does not guarantee support for every promise; compare it with the source.'));}
  else if(a.type==='attemptAction'){n.action={attempted:true,authorized:c.authorization,sideEffect:false,result:'denied'};f('action',true,t('模拟服务端检查当前身份无发信权限，已拒绝；没有发送真实消息。生成草稿不会自动授予行动权限。','The simulated server denied the current identity’s email permission; no real message was sent. Draft generation does not grant action authority.'));}
  else if(a.type==='answer'){const q=c.checks.find(q=>q.id===a.itemId);if(!q||!(typeof a.value==='boolean'||Number.isFinite(a.value)))throw Error('Unknown capability answer');if(!(n.prediction&&n.draft&&n.action))f(q.id,false,t('先分别运行估计、生成草稿和行动权限探测，再验收三种证据。','Run estimation, draft generation and action-authorization probing before assessing their three evidence types.'));else{n.answers[q.id]=a.value;f(q.id,a.value===q.expected,q.reason);}}
  else throw Error('Unknown capability action');passed=!!(n.prediction&&n.draft&&n.action)&&c.checks.every(q=>n.answers[q.id]===q.expected);
 }else throw Error('Unknown selection game');return {data:n,feedback,passed};
}
return {kinds,init,step};
});
