(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ConceptWorkflowGames=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const kinds=['handoff-builder','bounded-agent'],t=(zh,en)=>({zh,en}),copy=x=>JSON.parse(JSON.stringify(x));
 function init(d){if(!kinds.includes(d.kind))throw Error('Unknown workflow kind');return d.kind==='handoff-builder'?{stages:{},fields:[],owner:null,revision:0,runs:[],diagnoses:{}}:{settings:{},tools:[],revision:0,probes:[]};}
 function step(d,input,a){const data=copy(input),c=d.config,feedback=[];a=a||{};const tell=(itemId,correct,message)=>feedback.push({itemId,correct,message,knowledgeIds:[d.sourceUnitId]});const bump=()=>data.revision++;
  if(d.kind==='handoff-builder'){
   if(a.type==='setStage'&&c.steps.some(s=>s.id===a.stepId)&&Number.isInteger(a.stage)&&a.stage>=0&&a.stage<c.steps.length&&data.stages[a.stepId]!==a.stage){data.stages[a.stepId]=a.stage;bump();}
   if(a.type==='setHandoff'&&c.handoffFields.some(f=>f.id===a.field)&&typeof a.enabled==='boolean'&&data.fields.includes(a.field)!==a.enabled){data.fields=a.enabled?data.fields.concat(a.field):data.fields.filter(x=>x!==a.field);bump();}
   if(a.type==='setOwner'&&c.owners.some(o=>o.id===a.ownerId)&&data.owner!==a.ownerId){data.owner=a.ownerId;bump();}
   const allPlaced=c.steps.every(s=>Number.isInteger(data.stages[s.id]));
   const depsOK=allPlaced&&c.steps.every(s=>s.requires.every(id=>data.stages[id]<data.stages[s.id]));
   const parallelOK=c.parallelPair.every(id=>Number.isInteger(data.stages[id]))&&data.stages[c.parallelPair[0]]===data.stages[c.parallelPair[1]];
   const fieldsOK=c.handoffFields.filter(f=>f.required).every(f=>data.fields.includes(f.id));
   const ownerOK=data.owner===c.requiredOwner;
   if(a.type==='run'){
    const scenario=c.scenarios.find(s=>s.id===a.scenarioId);
    if(scenario){
     const valid=depsOK&&parallelOK&&fieldsOK&&ownerOK;
     const events=c.steps.slice().sort((x,y)=>(data.stages[x.id]??99)-(data.stages[y.id]??99)).map(s=>({stepId:s.id,stage:data.stages[s.id]??null,status:!valid?'configuration-blocked':s.id===scenario.failStep?'failed':scenario.failStep&&data.stages[s.id]>data.stages[scenario.failStep]?'held':'completed'}));
     const run={id:'run-'+(data.runs.length+1),revision:data.revision,scenarioId:scenario.id,valid,events,failStep:valid?scenario.failStep:null,owner:data.owner,fields:data.fields.slice(),sourceRefs:valid&&data.fields.includes('sources')?c.sourceRefs.slice():[],status:!valid?'configuration-blocked':scenario.failStep?'escalated':'completed'};data.runs.push(run);
     tell(run.id,valid,valid?scenario.feedback:t('流程未执行：检查先修依赖、可并行步骤、交接证据和人类接手者；正确配置仍保留。','Flow not executed: check dependencies, parallel steps, handoff evidence and human responder; correct settings remain.'));
    }
   }
   if(a.type==='diagnose'){
    const run=data.runs.find(r=>r.id===a.runId),scenario=run&&c.scenarios.find(s=>s.id===run.scenarioId);
    const correct=!!run&&run.revision===data.revision&&run.valid&&!!scenario.failStep&&a.stepId===scenario.failStep&&a.ownerId===c.requiredOwner;
    if(run)data.diagnoses[run.id]={stepId:a.stepId,ownerId:a.ownerId,correct};
    tell(a.runId||'diagnosis',correct,correct?t('已定位失败执行步，并交给指定人类接手；后续依赖步骤保持暂停。','The failed execution step is located and assigned to the designated human responder; dependent downstream steps remain held.'):t('对照本次执行轨迹的失败步和指定接手者；不能将失败归给最后一个未执行步骤。','Compare this run’s failed step and designated responder; do not blame the last step that never executed.'));
   }
   const tested=c.scenarios.every(s=>data.runs.some(r=>r.revision===data.revision&&r.valid&&r.scenarioId===s.id&&(!s.failStep||data.diagnoses[r.id]&&data.diagnoses[r.id].correct)));
   if(a.type==='check'){
    tell('dependencies',!!depsOK,depsOK?t('所有依赖在接收步骤执行前完成。','All dependencies finish before their consumer executes.'):t('接收步骤必须等待所需资料，不能与自己的前置检索并行。','A consumer must wait for its required material; it cannot run in parallel with its own prerequisite.'));
    tell('parallel',!!parallelOK,parallelOK?t('两个互不依赖的检查安排在同一阶段。','Two independent checks share a stage.'):t('题设两个独立检查可在同一阶段进行；请检查是否误造依赖。','The two stated independent checks can share a stage; check for unnecessary dependencies.'));
    for(const f of c.handoffFields.filter(f=>f.required))tell(f.id,data.fields.includes(f.id),f.feedback);
    tell('owner',ownerOK,t('异常需交指定且已接受职责的人类处置者，不是再增加一个匿名代理。','Exceptions need the designated human who accepted responsibility, not another anonymous agent.'));
    tell('execution',!!tested,tested?t('最终配置已执行正常与失败场景，并定位了失败接手。','The final configuration ran normal and failure scenarios, with failed-step handover identified.'):t('请实际运行最终配置的正常、注入失败场景并对失败轨迹指定接手。','Actually run normal and injected-failure scenarios under the final configuration and diagnose the failed-step handover.'));
   }
   return {data,feedback,passed:!!(depsOK&&parallelOK&&fieldsOK&&ownerOK&&tested)};
  }
  if(a.type==='setSetting'&&c.settings.some(s=>s.id===a.key&&s.options.some(o=>o.value===a.value))&&data.settings[a.key]!==a.value){data.settings[a.key]=a.value;bump();}
  if(a.type==='setTool'&&c.tools.some(q=>q.id===a.toolId)&&typeof a.allowed==='boolean'&&data.tools.includes(a.toolId)!==a.allowed){data.tools=a.allowed?data.tools.concat(a.toolId):data.tools.filter(id=>id!==a.toolId);bump();}
  const settingsOK=c.settings.every(s=>data.settings[s.id]===s.expected),toolsOK=c.tools.every(q=>data.tools.includes(q.id)===q.allowed);
  if(a.type==='probe'){
   const scenario=c.cases.find(q=>q.id===a.caseId);
   if(scenario){let calls=0,failures=0,goalMet=false,halt=false;const events=[];
    for(const request of scenario.requests){let result;
     if(halt||goalMet&&data.settings.stopOnGoal===true)result='stopped';
     else if(calls>=Number(data.settings.maxCalls||0)){result=data.settings.escalate===true?'quota-escalated':'quota-stopped';halt=true;}
     else if(!data.tools.includes(request.toolId))result='tool-denied';
     else {calls++;
      if(request.validInput===false&&data.settings.contract===true)result='invalid-input';
      else if(request.sensitive&&data.settings.serverAuth===true&&(!request.authorized||request.amount>c.amountLimit))result='server-denied';
      else if(request.failure){failures++;result='tool-failed';if(failures>=c.failureLimit&&data.settings.escalate===true){result='failure-escalated';halt=true;}}
      else {result=request.sensitive?'simulated-side-effect':'result-returned';goalMet=!!request.goalMet;}
     }
     events.push({requestId:request.id,result,caller:c.caller,audited:data.settings.audit===true,simulated:true});
    }
    const correct=events.every((e,i)=>e.result===scenario.expectedResults[i])&&(!scenario.requireAudit||events.every(e=>e.audited));
    data.probes.push({caseId:scenario.id,revision:data.revision,events,correct,calls});
    tell(scenario.id,correct,correct?scenario.feedback:t('本次模拟轨迹越过目标、额度或权限边界，或缺审计；逐条对照响应并只修对应配置。提示词提醒不能替代服务端授权。','This simulated trace crossed a goal, quota or permission boundary, or lacks audit. Compare each response and correct only its setting. Prompt reminders cannot replace server authorization.'));
    events.forEach((e,i)=>{
     const ok=e.result===scenario.expectedResults[i]&&(!scenario.requireAudit||e.audited),actual=c.resultLabels[e.result],expected=c.resultLabels[scenario.expectedResults[i]];
     tell(e.requestId,ok,ok?t('该请求响应符合当前任务边界，正确操作已保留。','This request response respects the task boundary; correct operations remain.'):t('本请求实际：'+actual.zh+'；本题边界应为：'+expected.zh+(scenario.requireAudit&&!e.audited?'；另缺调用审计。':'。'),'This request returned: '+actual.en+'; the exercise boundary requires: '+expected.en+(scenario.requireAudit&&!e.audited?'; caller audit is also missing.':'.')));
    });
   }
  }
  const tested=c.cases.every(q=>{const p=data.probes.filter(p=>p.revision===data.revision&&p.caseId===q.id).slice(-1)[0];return p&&p.correct;});
  if(a.type==='check'){
   for(const s of c.settings)tell(s.id,data.settings[s.id]===s.expected,s.feedback);
   for(const tool of c.tools)tell(tool.id,data.tools.includes(tool.id)===tool.allowed,tool.feedback);
   tell('probes',!!tested,tested?t('同一最终配置已实际执行全部边界探测。','All boundary probes ran under the same final configuration.'):t('配置变更后旧轨迹不再证明新配置有效；请重跑当前各边界场景。','Old traces do not validate a changed configuration; rerun the boundary cases under the current settings.'));
  }
  return {data,feedback,passed:!!(settingsOK&&toolsOK&&tested)};
 }
 return {kinds,init,step};
});
