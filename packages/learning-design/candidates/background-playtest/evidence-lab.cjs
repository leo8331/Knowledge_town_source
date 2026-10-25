'use strict';
const W=require('../../../contracts/runtime/task-workshop-engine.js'),C=require('../../../contracts');
const L=(zh,en)=>({zh,en}),I=(id,zh,en)=>({id,text:L(zh,en)}),copy=structuredClone;
const sourceIds=['1.1-lesson-3','1.1-lesson-12','1.1-lesson-13'];
const itemFeedback={
 p:L('甲虽然没参与权重调整，但记录来自旧仓库。它能提供旧环境的独立表现，不能单独代替新仓库证据。','A was not used to adjust weights, but its records come from the old warehouse. It supports independent old-context performance, not the new warehouse on its own.'),
 q:L('乙的误差被用来修改当前权重。即使文件叫“测试”，也不能再用它证明当前模型处理未见样本的表现。','B errors were used to change the current weights. Calling the file test does not make it independent evidence for unseen cases.'),
 r:L('丙来自目标新仓库，答案在模型版本冻结之后才向评估员开放，且未用于调整本次模型。它是本题中独立且用途相符的评价证据；仍不保证以后所有情况。','C comes from the target warehouse; answers were released to evaluators after the model version was frozen and were not used to fit it. It is independent, use-relevant evidence here, not a guarantee for every future case.')
};
const activity={version:1,kind:'evidence-review-lab',title:L('新仓库证据审查台','Evidence review for a new warehouse'),
 brief:L('目标：从实际资料使用记录判断评价是否独立、环境是否匹配，再计算这批证据的正确率。先回看训练、泛化与验证知识；不是按文件名或已给的顺序操作。','Goal: use data-use records to judge independence and context fit, then calculate accuracy on that evidence. Review training, generalization and evaluation first; do not follow file names or a supplied sequence.'),
 rounds:[
 {id:'inspect-evaluation-records',type:'sort',skills:['1.1.1','1.1.5'],
  prompt:L('演练：模型v7用于新仓库的同类包装检查。三份日志如下。把每份记录放到最直接反映其证据边界的区域；不是选最高分。甲：旧仓库同类任务，模型发布后才取样，18/20正确，未回流调整权重。乙：文件名“新仓库测试”，20/20正确；工程日志记载它的错误和人工答案用于更新v7权重。丙：新仓库同类任务，答案由评估员封存至v7冻结后，18/24正确；本次权重调整未接触这批资料或答案。所有数量及记录为本题演练条件。','Exercise: model v7 will inspect comparable packaging at a new warehouse. Classify the evidence boundary in each log, rather than pick the highest score. A: the old warehouse, sampled after release, 18/20 correct, with no weight-update feedback. B: a file named new-warehouse test scores 20/20; engineering logs say its errors and human answers were used to update v7 weights. C: the new warehouse; evaluators sealed answers until v7 was frozen, scoring 18/24, and fitting did not access those records or answers. All counts and records are exercise assumptions.'),
  bins:[I('fit','已影响本次模型，不能证明未见表现','Influenced this model; not unseen-case evidence'),I('context','未影响本次模型，但环境证据还不匹配','Did not influence this model, but context evidence differs'),I('evaluate','可评价本次模型在目标用途的这批表现','Can evaluate this model on these target-use records')],
  items:[{...I('r','丙记录','Record C'),target:'evaluate'},{...I('p','甲记录','Record A'),target:'context'},{...I('q','乙记录','Record B'),target:'fit'}],
  reason:L('先核对资料是否影响当前参数，再核对它能支持哪个环境的结论。文件名和最高分不能代替两项证据检查。甲可作旧环境对照，乙已影响当前权重，丙支持本题目标用途的一次独立评价。','Check whether records affected the current parameters, then which context the evidence supports. File names and highest scores replace neither check. A is an old-context comparison, B affected current weights, and C supports one independent target-use evaluation.')},
 {id:'calculate-and-limit-claim',type:'number',skills:['1.1.1','1.1.5'],
  prompt:L('只核算刚确认可用于本次新仓库独立评价的那份记录：正确率百分数是多少，错误记录有多少条？不汇总三份日志，不取最高分。本题没有给上线阈值，计算结果不单独构成上线许可。','For only the record just found suitable for this independent new-warehouse evaluation, enter accuracy as a percentage and the number of errors. Do not pool all three records or pick the highest score. No deployment threshold is given; this calculation alone is not deployment approval.'),
  fields:[{id:'accuracy',label:L('这批记录的正确率（百分数，不带%）','Accuracy percentage for these records (without %)'),expected:75,tolerance:0},{id:'errors',label:L('这批记录的错误条数','Errors in these records'),expected:6,tolerance:0}],
  reason:L('丙18/24×100%=75%，24−18=6条错误。乙虽显示100%，但不能作本次独立证据；不能把甲乙丙混算，也不能凭75%编造一个未给出的上线阈值。','C gives 18/24×100%=75% and 24−18=6 errors. B displays 100% but is not independent evidence here. Do not pool A/B/C or invent a deployment threshold from 75%.')}
 ]};
function knowledge(){const pack=require('../../../course-compiler/enrich-aib.cjs').enrichedAib().knowledgePack;return {packHash:C.digest(JSON.stringify(pack)),units:sourceIds.map(id=>copy(pack.units.find(u=>u.id===id)))};}
function fresh(){return {candidate:'evidence-review-v1',round:0,answers:[],draft:{},helpSeen:false};}
function submit(state,answer){if(state?.candidate!=='evidence-review-v1'||!Number.isInteger(state.round)||state.round<0||state.round>=activity.rounds.length||!Array.isArray(state.answers)||state.answers.length!==state.round||typeof state.helpSeen!=='boolean'||state.answers.some((a,i)=>!W.grade(activity.rounds[i],a)))throw Error('Unknown candidate state');const next=copy(state),r=activity.rounds[next.round];next.draft=copy(answer);const correct=W.grade(r,answer),checks=[];
 if(r.type==='sort')for(const i of r.items)checks.push({id:i.id,correct:answer?.placements?.[i.id]===i.target,message:answer?.placements?.[i.id]===i.target?L('这一项的证据边界判断正确，保留。','This evidence-boundary judgment is correct; keep it.'):itemFeedback[i.id],knowledgeIds:sourceIds});
 if(r.type==='number')for(const f of r.fields){const ok=W.grade({...r,fields:[f]},answer);checks.push({id:f.id,correct:ok,message:ok?L('本字段正确，保留。','This field is correct; keep it.'):f.id==='accuracy'?L('只用丙的正确条数除以总条数再乘100；不要输入18、0.75或乙的100。','Use C correct records divided by its total, times 100; do not enter 18, 0.75 or B’s 100.'):L('从丙的总条数中减去正确条数；不是把三份记录一起汇总。','Subtract C’s correct records from its total; do not pool all three logs.'),knowledgeIds:sourceIds});}
 if(correct){next.answers.push(copy(answer));next.round++;next.draft={};}else next.helpSeen=true;
 return {correct,state:next,checks,completed:next.round===activity.rounds.length,independentEvidence:next.round===activity.rounds.length&&!next.helpSeen,formalAssessmentRequired:true};
}
module.exports={activity,itemFeedback,sourceIds,knowledge,fresh,submit};
