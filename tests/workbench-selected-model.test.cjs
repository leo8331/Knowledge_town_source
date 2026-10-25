'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'dist/workbench.html'),'utf8');
const launch=html.slice(html.indexOf('function openQuestionMaker(){'),html.indexOf("$('openQuestionMaker').addEventListener"));
function store(initial={}){const m=new Map(Object.entries(initial));return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};}
test('step three hands materials and selected scenery to the original full question maker',()=>{
 const storage=store({knowledgeTownScene:JSON.stringify({regions:[{x:20,y:30}]}),knowledgeTownPreview:'old-preview'}),elements={materialText:{value:'# 规则课程\n资料正文'},customStatus:{},questionMakerError:{}};
 const c=vm.createContext({$:id=>elements[id],localStorage:storage,sceneBusy:false,selectedTemplate:'custom',customImage:'/generated-scenes/user.png',templates:{custom:{name:'AI 自定义风格'}},crypto:{randomUUID:()=> 'handoff-1'},location:{},showStep(){}});
 vm.runInContext(launch+';openQuestionMaker()',c);assert.equal(c.location.href,'knowledge/index.html?from=workbench&handoff=handoff-1');const pending=JSON.parse(storage.getItem('knowledgeTownHandoff'));assert.equal(pending.material,elements.materialText.value);assert.equal(pending.customImage,'/generated-scenes/user.png');assert.equal(pending.topic,'规则课程');assert.equal(storage.getItem('knowledgeTownPreview'),'old-preview');assert.match(storage.getItem('knowledgeTownScene'),/regions/);
});
test('in-flight scene work blocks leaving for the question maker even with a built-in template',()=>{const el={};const c=vm.createContext({$:()=>el,sceneBusy:true,selectedTemplate:'forest',location:{}});vm.runInContext(launch+';openQuestionMaker()',c);assert.equal(c.location.href,undefined);assert.match(el.textContent,/场景生成完成/);});
test('full question maker chooses its own profile, supports its API config, and does not silently fall back',()=>{
 const select={value:'course-only',disabled:false},c=vm.createContext({window:{},document:{getElementById:()=>select},URLSearchParams,location:{search:''}});vm.runInContext(fs.readFileSync(path.join(root,'dist/knowledge/workbench-link.js'),'utf8'),c);const api=c.window.WorkbenchLink;
 assert.equal(api.withModel({target:3}).profileId,'course-only');select.value='';assert.equal(api.withModel({target:3}).profileId,undefined);select.value='__missing__';assert.throws(()=>api.withModel({}),/重新选择/);select.disabled=true;assert.throws(()=>api.withModel({}),/正在读取/);
});
const bridge=require('../dist/kb-bridge.js'),presentation=require('../dist/course-presentation.js'),flow=require('../dist/workbench-course.js');
const pack={id:'pack-real',title:'规则课程',cards:[{id:'q1',type:'single',point:'边界',q:'恰好2千克去哪里？',options:[{text:'自动柜台',correct:true},{text:'人工柜台',correct:false}],answer:'自动柜台'}]};
test('accepted real bank returns a playable course using its original custom scene and keeps old progress',()=>{
 const context={id:'one',template:'custom',templateName:'自定义',customImage:'/generated-scenes/user.png',regions:[]},storage=store({knowledgeTownHandoff:JSON.stringify(context),'knowledgeTownDone:older':'["a"]'});
 const out=flow.publish(storage,context,pack,bridge,presentation);assert.equal(out.preview.customImage,context.customImage);assert.equal(out.scene.source.packId,pack.id);assert.equal(out.scene.tasks.length,1);assert.equal(bridge.grade(out.scene.tasks[0],'自动柜台'),true);assert.equal(storage.getItem('knowledgeTownDone:older'),'["a"]');
});
test('stale handoffs and sample banks cannot overwrite the currently playable course',()=>{
 const context={id:'one'},storage=store({knowledgeTownHandoff:JSON.stringify({id:'newer'}),knowledgeTownScene:'old'});assert.throws(()=>flow.publish(storage,context,pack,bridge,presentation),/另一轮/);assert.equal(storage.getItem('knowledgeTownScene'),'old');storage.setItem('knowledgeTownHandoff',JSON.stringify(context));assert.throws(()=>flow.publish(storage,context,{...pack,demo:true},bridge,presentation),/真实题库/);assert.equal(storage.getItem('knowledgeTownScene'),'old');
});
test('failed preview save restores both prior course records',()=>{const context={id:'one',template:'forest'},storage=store({knowledgeTownHandoff:JSON.stringify(context),knowledgeTownScene:'old-scene',knowledgeTownPreview:'old-preview'}),set=storage.setItem;let once=true;storage.setItem=(k,v)=>{if(k==='knowledgeTownPreview'&&once){once=false;throw Error('quota');}set(k,v);};assert.throws(()=>flow.publish(storage,context,pack,bridge,presentation),/保存失败/);assert.equal(storage.getItem('knowledgeTownScene'),'old-scene');assert.equal(storage.getItem('knowledgeTownPreview'),'old-preview');});
