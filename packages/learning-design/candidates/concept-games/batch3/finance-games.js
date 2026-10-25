(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ConceptFinanceGames=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const kinds=['cost-ledger','volume-simulator'];
const t=(zh,en)=>({zh,en});
function init(d){if(d.kind==='cost-ledger')return {entries:{},values:{},checked:false};if(d.kind==='volume-simulator')return {volume:null,experiments:[],conclusion:null};throw Error('Unsupported kind');}
function step(d,input,a){const data=JSON.parse(JSON.stringify(input)),c=d.config,feedback=[];let passed=false;
 const f=(id,ok,zh,en)=>feedback.push({itemId:id,correct:ok,message:t(zh,en),knowledgeIds:[d.sourceUnitId]});
 if(d.kind==='cost-ledger'){
  if(a.type==='entry'){
   if(!c.entries.some(e=>e.id===a.entryId)||typeof a.include!=='boolean')throw Error('Invalid ledger entry');
   data.entries[a.entryId]=a.include;data.checked=false;
  }else if(a.type==='values'){
   if(!a.values||typeof a.values!=='object')throw Error('Invalid calculation');
   for(const key of Object.keys(a.values)){if(!c.fields.some(x=>x.id===key)||!Number.isFinite(a.values[key]))throw Error('Invalid numeric field');data.values[key]=a.values[key];}data.checked=false;
  }else if(a.type==='check'){
   let valid=true;for(const e of c.entries){const expected=c.privateExpected.include[e.id],ok=data.entries[e.id]===expected;valid=valid&&ok;
    let zh,en;
    if(e.category==='cost'){zh='这是明确归属本月的成本，完整成本不能删去这项。';en='This cost is explicitly assigned to this month and must remain in full costs.';}
    else if(expected){zh='该现金节支已核验兑现，本月计一次。';en='This verified realized cash saving counts once this month.';}
    else if(e.id==='released-capacity'){zh='释放工时尚未兑现为现金，本题现金ROI中另列；这不表示产能没有价值。';en='Released hours are not realized cash and are listed separately from this cash ROI; capacity is not worthless.';}
    else{zh='这是同笔现金节支的重复登记，不能再加一次。';en='This repeats the same cash saving and cannot be counted again.';}f(e.id,ok,zh,en);
   }
   const correctEntries=c.entries.filter(e=>c.privateExpected.include[e.id]),cost=correctEntries.filter(e=>e.category==='cost').reduce((v,e)=>v+e.amount,0),benefit=correctEntries.filter(e=>e.category==='benefit').reduce((v,e)=>v+e.amount,0);
   for(const key of ['net','roiPercent']){const ok=Number.isFinite(data.values[key])&&Math.abs(data.values[key]-c.privateExpected[key])<1e-8;valid=valid&&ok;
    if(key==='net')f(key,ok,`同月核验现金收益 ${benefit} − 完整成本 ${cost} = 净收益 ${benefit-cost}。`,`Same-month verified cash benefit ${benefit} minus full cost ${cost} gives net benefit ${benefit-cost}.`);
    else f(key,ok,`简单现金ROI=(${benefit}−${cost})÷${cost}×100=${(benefit-cost)/cost*100}%。分母是完整成本。`,`Simple cash ROI = (${benefit}−${cost}) ÷ ${cost} × 100 = ${(benefit-cost)/cost*100}%. The denominator is full cost.`);
   }data.checked=valid;
  }else throw Error('Unknown action');
  passed=data.checked;
 }else if(d.kind==='volume-simulator'){
  if(a.type==='setVolume'){if(!c.volumes.includes(a.value))throw Error('Invalid volume');data.volume=a.value;}
  else if(a.type==='run'){
   if(data.volume===null)f('volume',false,'先设置要试验的本月业务量。','Set this month’s request volume before running.');
   else{const fixed=c.fixedCosts.reduce((v,x)=>v+x.amount,0),calls=data.volume*c.computePerRequest,review=data.volume*c.reviewHoursPerRequest*c.reviewHourlyRate,total=fixed+calls+review;
    data.experiments.push({volume:data.volume,fixed,calls,review,total,unitCost:total/data.volume});
    f('experiment',true,`本次量 ${data.volume}：固定 ${fixed}，调用 ${calls}，人工复核 ${review}，总额 ${total}，每请求 ${total/data.volume}。`,`Volume ${data.volume}: fixed ${fixed}, calls ${calls}, human review ${review}, total ${total}, cost per request ${total/data.volume}.`);
   }
  }else if(a.type==='conclude'){
   if(!c.conclusions.some(x=>x.id===a.decision))throw Error('Invalid conclusion');
   if(!c.volumes.every(v=>data.experiments.some(e=>e.volume===v)))f('conclusion',false,'两种业务量都需要实际运行；重复同一个量不能替代第二个实验。','Run both volumes; repeating one volume does not replace the second experiment.');
   else{data.conclusion=a.decision;const records=c.volumes.map(v=>data.experiments.find(e=>e.volume===v));f('conclusion',a.decision===c.privateExpected.conclusion,`两次总额为 ${records.map(e=>e.total).join('、')}，单位成本为 ${records.map(e=>e.unitCost).join('、')}。量增加分摊固定成本，但调用和人工复核仍随量增加。`,`Totals are ${records.map(e=>e.total).join(', ')} and unit costs are ${records.map(e=>e.unitCost).join(', ')}. Higher volume spreads fixed costs, while calls and human review still grow with volume.`);}
  }else throw Error('Unknown action');
  passed=c.volumes.every(v=>data.experiments.some(e=>e.volume===v))&&data.conclusion===c.privateExpected.conclusion;
 }else throw Error('Unsupported kind');
 return {data,feedback,passed};
}
return {kinds,init,step};
});
