'use strict';
// Uses a local fake "relay" so no real key, quota or network is touched.
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const server=require('../apps/server/index.cjs');

function fakeRelay(script){
 const calls=[];
 const srv=http.createServer(async(req,res)=>{
  const chunks=[];for await(const c of req)chunks.push(c);
  const body=chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{};
  calls.push({url:req.url,auth:req.headers.authorization,body});
  const step=script(calls.length,req.url,body);
  res.writeHead(step.status,{'Content-Type':'application/json',...(step.headers||{})});res.end(JSON.stringify(step.json));
 });
 return new Promise(r=>srv.listen(0,'127.0.0.1',()=>r({srv,calls,base:'http://127.0.0.1:'+srv.address().port+'/v1'})));
}
const RATE={status:429,json:{error:{message:'unpaid users shared requests-per-minute limit exceeded',type:'rate_limit_exceeded'}}};
const sceneBody=n=>JSON.stringify({title:'t',regions:[],tasks:Array.from({length:n},(_,i)=>({id:'t'+i,name:'n',x:1,y:1,kind:'quiz',prompt:'p',options:['a','b'],answer:0,correctFeedback:'c',wrongFeedback:'w'})),completion:{title:'',message:''}});
const scene=n=>({status:200,json:{choices:[{finish_reason:'stop',message:{content:sceneBody(n)}}]}});
const PNG={status:200,json:{data:[{b64_json:Buffer.from('fake-png').toString('base64')}]}};

// Run fast: shrink the waits, restore afterwards.
function fastWaits(t){const saved=[...server.UPSTREAM_RETRY_MS];server.UPSTREAM_RETRY_MS.splice(0,3,5,5,5);t.after(()=>server.UPSTREAM_RETRY_MS.splice(0,3,...saved));}

// The server reads TOWN_PROFILE_FILE, so tests write to a throw-away file and never touch the real
// artifacts/runtime/model-profiles.json that holds the player's own keys.
async function withProfile(t,base,extra={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'town-prof-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,'model-profiles.json');
 fs.writeFileSync(file,JSON.stringify([{id:'p1',name:'fake',provider:'custom',baseUrl:base,model:'fake-model',key:'sk-test-not-real',...extra}]));
 process.env.TOWN_PROFILE_FILE=file;t.after(()=>{delete process.env.TOWN_PROFILE_FILE;});
 return 'p1';
}
const cfg={timeout:5000};

test('429 from the relay is retried automatically and then succeeds (scene design)',async t=>{
 fastWaits(t);
 const {srv,calls,base}=await fakeRelay(n=>n<3?RATE:scene(4));t.after(()=>srv.close());
 const id=await withProfile(t,base);
 const waits=[];
 const out=await server.designScene(cfg,'style','materials',id,(ms,why)=>waits.push(why));
 assert.equal(out.tasks.length,4);assert.equal(calls.length,3,'two 429s then one success');assert.deepEqual(waits,['HTTP 429','HTTP 429']);
 assert.ok(calls.every(c=>c.auth==='Bearer sk-test-not-real'));
});

test('persistent 429 ends with an explanation a person can act on, not a bare status',async t=>{
 fastWaits(t);
 const {srv,calls,base}=await fakeRelay(()=>RATE);t.after(()=>srv.close());
 const id=await withProfile(t,base);
 await assert.rejects(()=>server.designScene(cfg,'s','m',id),e=>{
  assert.match(e.message,/HTTP 429/);assert.match(e.message,/未付费/);assert.match(e.message,/已自动等待并重试/);
  assert.match(e.message,/unpaid users shared requests-per-minute limit exceeded/,'keeps the provider\'s own words');
  assert.doesNotMatch(e.message,/sk-test/,'never leaks the key');return true;});
 assert.equal(calls.length,4,'1 try + 3 automatic retries, then stops');
});

test('image generation retries 429 and uses the configured image model, not a hard-coded one',async t=>{
 fastWaits(t);
 const {srv,calls,base}=await fakeRelay(n=>n<2?RATE:PNG);t.after(()=>srv.close());
 const id=await withProfile(t,base,{imageModel:'my-image-model'});
 const url=await server.generateImage(cfg,'a map',id);
 assert.match(url,/^\/generated-scenes\/.+\.png$/);assert.equal(calls.length,2);
 assert.equal(calls[1].body.model,'my-image-model');assert.ok(calls[1].url.endsWith('/images/generations'));
 fs.rmSync(path.join(__dirname,'../dist',url),{force:true});
});

test('image model falls back to gpt-image-1 when nothing is configured',async t=>{
 const {srv,calls,base}=await fakeRelay(()=>PNG);t.after(()=>srv.close());
 const id=await withProfile(t,base);delete process.env.IMAGE_API_MODEL;
 const url=await server.generateImage(cfg,'a map',id);assert.equal(calls[0].body.model,'gpt-image-1');
 fs.rmSync(path.join(__dirname,'../dist',url),{force:true});
});

test('errors that retrying cannot fix fail at once with the right explanation',async t=>{
 fastWaits(t);
 for(const [status,expect] of [[401,/密钥无效/],[402,/余额不足/],[404,/接口地址或模型名不对/]]){
  const {srv,calls,base}=await fakeRelay(()=>({status,json:{error:{message:'nope '+status}}}));
  const id=await withProfile(t,base);
  await assert.rejects(()=>server.designScene(cfg,'s','m',id),e=>expect.test(e.message)&&e.message.includes('nope '+status));
  assert.equal(calls.length,1,status+' must not be retried');srv.close();
 }
});

test('a reasoning model that burns the whole output budget gets one larger retry',async t=>{
 fastWaits(t);
 const truncated={status:200,json:{choices:[{finish_reason:'length',message:{content:''}}]}};
 const {srv,calls,base}=await fakeRelay(n=>n===1?truncated:scene(3));t.after(()=>srv.close());
 const id=await withProfile(t,base);
 const out=await server.designScene(cfg,'s','m',id);
 assert.equal(out.tasks.length,3);assert.equal(calls.length,2);
 assert.ok(calls[1].body.max_tokens>calls[0].body.max_tokens,'second try asks for more output room: '+calls[0].body.max_tokens+' -> '+calls[1].body.max_tokens);
 assert.ok(calls[0].body.max_tokens>=12000,'default budget leaves room for reasoning');
});

test('still truncated after the larger retry reports why instead of "invalid JSON"',async t=>{
 fastWaits(t);
 const {srv,base}=await fakeRelay(()=>({status:200,json:{choices:[{finish_reason:'length',message:{content:''}}]}}));t.after(()=>srv.close());
 const id=await withProfile(t,base);
 await assert.rejects(()=>server.designScene(cfg,'s','m',id),e=>/思考.*用光了输出额度/.test(e.message)&&/非推理模型/.test(e.message));
});

test('server errors (5xx) are retried too',async t=>{
 fastWaits(t);
 const {srv,calls,base}=await fakeRelay(n=>n<2?{status:502,json:{error:{message:'bad gateway'}}}:scene(3));t.after(()=>srv.close());
 const id=await withProfile(t,base);await server.designScene(cfg,'s','m',id);assert.equal(calls.length,2);
});

test('Retry-After from the relay is honoured, capped at one minute',async t=>{
 const waits=[];
 const fake=async()=>({ok:false,status:429,headers:{get:k=>k.toLowerCase()==='retry-after'?'1':null},text:async()=>JSON.stringify(RATE.json)});
 let n=0;const okRes={ok:true,status:200,json:async()=>({})};
 const f=async()=>(++n<2?fake():okRes);
 await server.callUpstream('x',{key:'k',baseUrl:'http://127.0.0.1'},'http://127.0.0.1/x',()=>({}),{fetchImpl:f,onWait:ms=>waits.push(ms)});
 assert.deepEqual(waits,[1000]);
});
