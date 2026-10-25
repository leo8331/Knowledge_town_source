(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ConceptGovernanceGames=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const kinds=['permission-gate','runbook-rehearsal'];
  const clone=x=>JSON.parse(JSON.stringify(x));
  const t=(zh,en)=>({zh,en});
  function init(d){if(!kinds.includes(d.kind))throw Error('Unknown governance kind');return d.kind==='permission-gate'?{grants:[],filter:null,revision:0,probes:[]}:{selected:{},route:null,target:null,revision:0,alert:null,rollback:null,recovery:null};}
  function step(d,input,a){
    const data=clone(input),c=d.config,feedback=[];
    const tell=(itemId,correct,message)=>feedback.push({itemId,correct,message,knowledgeIds:[d.sourceUnitId]});
    const bump=()=>{data.revision++;};
    if(!a||typeof a.type!=='string')a={type:'noop'};
    if(d.kind==='permission-gate'){
      if(a.type==='setGrant'&&typeof a.allowed==='boolean'&&c.resources.some(r=>r.id===a.resourceId)){
        const has=data.grants.includes(a.resourceId);if(has!==a.allowed){data.grants=a.allowed?data.grants.concat(a.resourceId):data.grants.filter(id=>id!==a.resourceId);bump();}
      }
      if(a.type==='setFilter'&&c.filterOptions.some(x=>x.id===a.choice)&&data.filter!==a.choice){data.filter=a.choice;bump();}
      if(a.type==='probe'){
        const req=c.requests.find(x=>x.id===a.requestId);
        if(req){
          let result;
          if(data.filter!=='before')result='unsafe-route';
          else if(data.grants.includes(req.resourceId))result='retrieved';
          else result=req.resourceId===c.approvalResource?'refer-approver':'denied-before-retrieval';
          data.probes.push({requestId:req.id,revision:data.revision,result});
          const correct=result===req.expected;
          tell(req.id,correct,correct?req.feedback:t('该探测越过授权边界或阻断了工作所需资料。修改最小授权与检索前闸门，再重测正、负请求。这里仅为模拟，不读取真实资料。','This probe crossed the stated authorization boundary or blocked needed material. Correct minimum grants and the pre-retrieval gate, then rerun positive and negative requests. This is a simulation; no real material is read.'));
        }
      }
      const correctGrants=c.resources.every(r=>data.grants.includes(r.id)===r.allowed);
      const tested=c.requests.every(r=>{const p=data.probes.filter(p=>p.revision===data.revision&&p.requestId===r.id).slice(-1)[0];return p&&p.result===r.expected;});
      if(a.type==='check'){
        for(const r of c.resources)tell(r.id,data.grants.includes(r.id)===r.allowed,r.feedback);
        tell('filter',data.filter==='before',data.filter==='before'?t('授权在取回或执行前验证。','Authorization is checked before retrieval or execution.'):t('输出遮盖发生在取回之后，不能替代检索前过滤。','Output masking occurs after retrieval and cannot replace pre-retrieval filtering.'));
        tell('probes',!!tested,tested?t('同一最终配置下，允许、禁止和批准边界均有实际探测记录。','The same final configuration has actual probes for allowed, denied and approval boundaries.'):t('配置变更后，旧探测不证明新配置有效；请在当前配置重跑每类请求。','Old probes do not validate a changed configuration; rerun every request type under the current configuration.'));
      }
      return {data,feedback,passed:correctGrants&&data.filter==='before'&&!!tested};
    }
    if(a.type==='selectEvidence'){
      const slot=c.requirements.find(r=>r.id===a.slotId);
      if(slot&&c.evidence.some(e=>e.id===a.evidenceId)&&data.selected[slot.id]!==a.evidenceId){data.selected[slot.id]=a.evidenceId;bump();}
    }
    if(a.type==='setRoute'&&c.routes.some(r=>r.id===a.routeId)&&data.route!==a.routeId){data.route=a.routeId;bump();}
    if(a.type==='setTarget'&&c.targets.some(r=>r.id===a.targetId)&&data.target!==a.targetId){data.target=a.targetId;bump();}
    const evidenceOK=slot=>data.selected[slot]===c.requirements.find(r=>r.id===slot).expected;
    if(a.type==='testAlert'){
      const delivered=evidenceOK('owner')&&data.route===c.responderRoute;
      data.alert={revision:data.revision,delivered};
      tell('alert',delivered,delivered?t('模拟测试告警已由接手者确认收到；不是只保存了联系方式。','The simulated test alert was acknowledged by the responder; this is more than saving contact details.'):t('测试告警未到达已接受接手者：核对接手接受证据与告警路由。','The test alert did not reach an accepted responder: check accepted ownership evidence and alert routing.'));
    }
    if(a.type==='rehearseRollback'){
      const restored=evidenceOK('runbook')&&data.target===c.knownTarget;
      data.rollback={revision:data.revision,restored,target:data.target};data.recovery=null;
      tell('rollback',restored,restored?t('已模拟回到已知版本；还须核对恢复探测。','The simulation returned to a known version; recovery probes must still be checked.'):t('未完成已知版本回退：检查手册版本和目标，演示页面能打开不等于回退。','Known-version rollback is incomplete: check runbook version and target. An open demo page is not rollback evidence.'));
    }
    if(a.type==='verifyRecovery'){
      const restored=!!data.rollback&&data.rollback.revision===data.revision&&data.rollback.restored;
      const verified=restored&&a.evidenceId===c.recoveryEvidence;
      data.recovery={revision:data.revision,verified};
      tell('recovery',verified,verified?t('已核对本次模拟回退的版本与服务探测记录。仅本清单条件获得证据。','The version and service probes for this simulated rollback were checked. Only this checklist has evidence.'):t('先执行当前配置回退，再选对应的版本与服务探测记录；截图或自我声明不证明恢复。','First rehearse rollback for the current configuration, then choose its version and service probe record; a screenshot or self-declaration does not prove recovery.'));
    }
    const alertOK=!!data.alert&&data.alert.revision===data.revision&&data.alert.delivered;
    const rollbackOK=!!data.rollback&&data.rollback.revision===data.revision&&data.rollback.restored;
    const recoveryOK=!!data.recovery&&data.recovery.revision===data.revision&&data.recovery.verified;
    if(a.type==='check'){
      for(const r of c.requirements)tell(r.id,evidenceOK(r.id),r.feedback);
      for(const [id,ok] of [['alert',alertOK],['rollback',rollbackOK],['recovery',recoveryOK]])tell(id,!!ok,ok?t('当前配置已有对应演练证据。','The current configuration has the corresponding rehearsal evidence.'):t('缺少当前配置的实际演练证据；配置变更后须重测，不能只勾选完成。','Actual rehearsal evidence for the current configuration is missing. Retest after configuration changes; a checkbox is insufficient.'));
    }
    return {data,feedback,passed:c.requirements.every(r=>evidenceOK(r.id))&&alertOK&&rollbackOK&&recoveryOK};
  }
  return {kinds,init,step};
});
