'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const K=require('../dist/kb-bridge.js');

// The six shapes exactly as the question maker saves them (copied from its own library files).
const CARDS=[
 {id:'a',type:'single',point:'黑洞定义',q:'黑洞怎么定义？',options:[{text:'连光都逃不出的天体。',correct:true},{text:'密度极小的云团',correct:false},{text:'没有引力的空洞',correct:false}],answer:'连光都逃不出的天体。',wrong:['密度极小的云团','没有引力的空洞']},
 {id:'b',type:'multi',point:'史瓦西半径',q:'会出现哪些情况？',options:[{text:'变成白洞',correct:false},{text:'连光也无法逃脱',correct:true},{text:'奇异现象',correct:true},{text:'开始自转',correct:false},{text:'存在视界',correct:true}],answers:['奇异现象','存在视界','连光也无法逃脱']},
 {id:'c',type:'order',point:'质量分类',q:'按质量从小到大排。',steps:['恒星级','中等质量','超大质量']},
 {id:'d',type:'sort',point:'奇点',q:'分个类',categories:[{label:'奇点本身',items:['密度无限大','体积无限小']},{label:'落入之后',items:['单行道','被压碎']}]},
 {id:'e',type:'pair',point:'霍金辐射',q:'配对',pairs:[{left:'怎么来的',right:'量子效应'},{left:'名字从哪来',right:'霍金预言'},{left:'够久会怎样',right:'黑洞消亡'}]},
 {id:'f',type:'numeric',point:'间接观测',q:'约是太阳的多少亿倍？',numeric:{value:65,unit:'亿倍'},formula:'材料直接给出'}
];

test('all six question types become playable tasks',()=>{
 const r=K.toTasks({id:'p',title:'黑洞',cards:CARDS});
 assert.equal(r.tasks.length,6);assert.deepEqual(r.skipped,[]);
 assert.deepEqual(Object.keys(r.byType).sort(),[...K.TYPES].sort());
 for(const t of r.tasks){assert.ok(t.prompt&&t.name,t.type);assert.ok(t.x>=8&&t.x<=92&&t.y>=14&&t.y<=88,t.type+' stays on the map');}
});

test('a correct answer grades right and every kind of wrong answer grades wrong',()=>{
 const r=K.toTasks({id:'p',cards:CARDS}),by=Object.fromEntries(r.tasks.map(t=>[t.type,t]));
 assert.equal(K.grade(by.single,by.single.correct[0]),true);assert.equal(K.grade(by.single,by.single.options.find(o=>o!==by.single.correct[0])),false);
 assert.equal(K.grade(by.multi,[...by.multi.correct].reverse()),true,'order of ticks does not matter');
 assert.equal(K.grade(by.multi,by.multi.correct.slice(1)),false,'missing one');assert.equal(K.grade(by.multi,[...by.multi.correct,'开始自转']),false,'one extra');
 assert.equal(K.grade(by.order,by.order.correct),true);assert.equal(K.grade(by.order,[...by.order.correct].reverse()),false);
 assert.equal(K.grade(by.sort,by.sort.correct),true);assert.equal(K.grade(by.sort,{...by.sort.correct,'单行道':'奇点本身'}),false);assert.equal(K.grade(by.sort,{}),false,'empty is wrong');
 assert.equal(K.grade(by.pair,by.pair.correct),true);assert.equal(K.grade(by.pair,{...by.pair.correct,'怎么来的':'霍金预言'}),false);
 assert.equal(K.grade(by.numeric,65),true);assert.equal(K.grade(by.numeric,'65'),true);assert.equal(K.grade(by.numeric,'6,5'),true,'thousands separators are ignored');assert.equal(K.grade(by.numeric,'66'),false);assert.equal(K.grade(by.numeric,''),false);assert.equal(K.grade(by.numeric,'abc'),false);
});

test('the right answer is never always in the same position',()=>{
 const cards=Array.from({length:24},(_,i)=>({id:'s'+i,type:'single',q:'q'+i,options:[{text:'对'+i,correct:true},{text:'错a'+i,correct:false},{text:'错b'+i,correct:false}]}));
 const r=K.toTasks({id:'pos',cards}),pos=new Set(r.tasks.map(t=>t.options.indexOf(t.correct[0])));
 assert.ok(pos.size>=2,'answer lands in more than one slot: '+[...pos]);
});

test('an ordering question is never handed over already solved',()=>{
 for(let i=0;i<40;i++){const r=K.toTasks({id:'o'+i,cards:[{id:'x',type:'order',q:'q',steps:['一','二','三']}]});assert.notDeepEqual(r.tasks[0].items,r.tasks[0].correct);}
});

test('broken questions are skipped with a reason, never faked into a playable task',()=>{
 const bad=[
  {id:'1',type:'single',q:'没有正确答案',options:[{text:'a',correct:false},{text:'b',correct:false}]},
  {id:'2',type:'single',q:'只有一个选项',options:[{text:'a',correct:true}]},
  {id:'3',type:'multi',q:'只有一个答案',answers:['a'],options:[{text:'a',correct:true},{text:'b',correct:false}]},
  {id:'4',type:'order',q:'一步',steps:['a']},
  {id:'5',type:'sort',q:'同条目两边',categories:[{label:'A',items:['x']},{label:'B',items:['x']}]},
  {id:'6',type:'pair',q:'右列重复',pairs:[{left:'a',right:'z'},{left:'b',right:'z'}]},
  {id:'7',type:'numeric',q:'没数字',numeric:{unit:'个'}},
  {id:'8',type:'cloze',q:'未知题型'},{id:'9',type:'single',q:'',options:[]},null
 ];
 const r=K.toTasks({id:'bad',cards:bad});
 assert.equal(r.tasks.length,0);assert.equal(r.skipped.length,bad.length);assert.ok(r.skipped.every(s=>s.reason));
 assert.match(K.summary(r).text,/已跳过/);
});

test('a pack mixing good and broken cards plays the good ones and reports the rest',()=>{
 const r=K.toTasks({id:'mix',cards:[...CARDS,{id:'z',type:'order',q:'坏',steps:['只有一步']}]});
 assert.equal(r.tasks.length,6);assert.equal(r.skipped.length,1);assert.match(K.summary(r).text,/6 个任务点.*跳过/);
});

test('tasks are placed inside the scene regions when the scene designer gave some',()=>{
 const regions=[{x:10,y:20,w:20,h:20},{x:60,y:50,w:25,h:25}];
 const r=K.toTasks({id:'reg',cards:CARDS},{regions});
 for(const t of r.tasks){const inside=regions.some(g=>t.x>=g.x-4&&t.x<=g.x+g.w+4&&t.y>=g.y-4&&t.y<=g.y+g.h+4);assert.ok(inside,t.type+' at '+t.x+','+t.y);}
});

test('same pack gives the same layout every time (a refresh must not move the pins)',()=>{
 const a=K.toTasks({id:'stable',cards:CARDS}),b=K.toTasks({id:'stable',cards:CARDS});
 assert.deepEqual(a.tasks,b.tasks);
});

test('real saved libraries from the question maker all convert without surprises',()=>{
 const dir=path.join(__dirname,'../dist/knowledge/library');if(!fs.existsSync(dir))return;
 let packs=0,tasks=0,skipped=0;
 for(const f of fs.readdirSync(dir).filter(n=>/^kb[0-9a-f]+\.json$/.test(n))){
  const pack=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));if(!Array.isArray(pack.cards))continue;
  const r=K.toTasks(pack);packs++;tasks+=r.tasks.length;skipped+=r.skipped.length;
  for(const t of r.tasks){assert.equal(K.grade(t,t.type==='single'?t.correct[0]:t.correct),true,f+' '+t.type+' correct answer must grade right');}
 }
 console.log('# real packs:',packs,'playable:',tasks,'skipped:',skipped);
 assert.ok(packs>0);
});
