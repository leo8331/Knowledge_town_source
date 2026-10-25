const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
/* 出题器题库交接：主游戏只能通过这两个只读接口取题库，先确认边界（demo 不给、无答案题跳过、非法 id 拒绝）。 */
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kb-packs-'));
process.env.KB_DATA_DIR=dir;
const {configuration,createApp}=require('../server.cjs');
fs.mkdirSync(path.join(dir,'library'),{recursive:true});
const pack={id:'kbtest01',title:'链路诊断：确定性规则',topic:'确定性规则',summary:'一小题库',updatedAt:Date.now(),sources:[{id:'s1',url:'https://example.com/secret'}],cards:[{id:'c1',type:'single',point:'定义',q:'规则系统的确定性指什么？',quote:'规则不变时同一输入执行相同动作。',answer:'规则不变时同一输入执行相同动作。',wrong:['每次输出都随机','必须先训练参数']},{id:'c2',type:'single',point:'条件',q:'修改阈值算训练吗？',quote:'修改阈值是人为改规则。',answer:'不算，是人为修改规则。',wrong:['算，等于重新训练']},{id:'c3',type:'multi',point:'无答案',q:'没有答案的题会被跳过吗？',answer:'',wrong:[]}]};
fs.writeFileSync(path.join(dir,'library','kbtest01.json'),JSON.stringify(pack));
fs.writeFileSync(path.join(dir,'library','kbdemo01.json'),JSON.stringify({id:'kbdemo01',title:'示例题库',demo:true,cards:[{id:'d1',q:'示例问题是什么？',answer:'示例答案'}]}));
async function listen(app){await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));return'http://127.0.0.1:'+app.address().port;}
async function stop(app){app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}
test('main game reads question-maker packs through a read-only endpoint',async()=>{
 const app=createApp(configuration({})),base=await listen(app);
 try{
  const list=await(await fetch(base+'/api/kb-packs')).json();
  assert.equal(list.packs.length,1,'demo 题库不参与交接');
  assert.equal(list.packs[0].id,'kbtest01');
  assert.equal(list.packs[0].count,2,'没有答案的题不计入可导入题目');
  const detail=await(await fetch(base+'/api/kb-packs/kbtest01')).json();
  assert.equal(detail.pack.cards.length,2);
  assert.equal(detail.pack.cards[0].q,'规则系统的确定性指什么？');
  assert.ok(detail.pack.cards[0].wrong.length>0,'干扰项要一起交给主游戏');
  assert.equal('sources'in detail.pack,false,'不把来源清单和检索缓存交给前端');
  assert.equal((await fetch(base+'/api/kb-packs/kbdemo01')).status,404,'示例题库不能变成正式课程');
  assert.equal((await fetch(base+'/api/kb-packs/nosuchpack')).status,404);
  assert.equal((await fetch(base+'/api/kb-packs/..%2F..%2Fpackages')).status,404,'路径穿越必须挡住');
 }finally{await stop(app);}
});
