'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Schema=require('../../packages/course-compiler');
const PROJECT_ROOT=path.resolve(__dirname,'../..'),ROOT=path.join(PROJECT_ROOT,'dist'),DEFAULT_PROFILE_FILE=path.join(PROJECT_ROOT,'artifacts','runtime','model-profiles.json'),SCENE_DIR=path.join(ROOT,'generated-scenes');
/* 根路径给门户页：别人打开网站先看到“推门进入 / 工作台 / 出题器 / 其他冒险”的入口，而不是直接掉进游戏。
   门户缺失时回退到游戏首页，避免发布目录不完整时整站 404。 */
const HOME_PAGE=fs.existsSync(path.join(ROOT,'portal.html'))?'portal.html':'index.html';
/* 出题器题库交接：出题器把自己的题库写进 library 目录（KB_DATA_DIR 可改），主游戏通过下面两个只读接口取用。
   只给标题和题目本体，不暴露文件路径、来源清单与检索缓存；demo 题库不参与交接。 */
const KB_LIBRARY=path.join(process.env.KB_DATA_DIR||path.join(ROOT,'knowledge'),'library'),KB_PACK_ID=/^[a-z0-9-]{1,64}$/i;
function kbPackCards(pack){return(Array.isArray(pack.cards)?pack.cards:[]).map((c,i)=>{const answer=String(c.answer||'').trim()||(Array.isArray(c.options)?c.options.filter(o=>o&&o.correct).map(o=>String(o.text||'').trim()).filter(Boolean).join('；'):'');return{id:String(c.id||i),type:String(c.type||'single'),point:String(c.point||''),q:String(c.q||''),quote:String(c.quote||''),explain:String(c.explain||''),answer,wrong:(Array.isArray(c.wrong)?c.wrong:[]).map(x=>String(x&&typeof x==='object'?x.text:x||'')).filter(Boolean).slice(0,4)};}).filter(c=>c.q.trim().length>=3&&c.answer);}
function kbPackList(){let names=[];try{names=fs.readdirSync(KB_LIBRARY);}catch{return[];}const packs=[];for(const name of names){if(!KB_PACK_ID.test(name.replace(/\.json$/i,'')))continue;try{const pack=JSON.parse(fs.readFileSync(path.join(KB_LIBRARY,name),'utf8'));if(!pack||pack.demo)continue;const cards=kbPackCards(pack);if(!cards.length)continue;packs.push({id:String(pack.id||name.replace(/\.json$/i,'')),title:String(pack.title||pack.topic||'未命名题库').slice(0,120),topic:String(pack.topic||'').slice(0,120),count:cards.length,updatedAt:Number(pack.updatedAt)||0});}catch{}}return packs.sort((a,b)=>b.updatedAt-a.updatedAt);}
function kbPackRead(id){if(!KB_PACK_ID.test(id))return null;try{const pack=JSON.parse(fs.readFileSync(path.join(KB_LIBRARY,id+'.json'),'utf8'));if(!pack||pack.demo)return null;const cards=kbPackCards(pack);if(!cards.length)return null;return{id:String(pack.id||id),title:String(pack.title||pack.topic||'未命名题库').slice(0,120),topic:String(pack.topic||'').slice(0,120),summary:String(pack.summary||'').slice(0,400),cards};}catch{return null;}}
const {INVENTORY_PROMPT}=require('../../packages/knowledge/prompts.cjs');
const {PROMPT,ACTIVITY_PROMPT}=require('../../packages/learning-design/prompts.cjs');
function configuration(env=process.env){
 const base=(env.API_BASE_URL||'').trim(),model=(env.API_MODEL||'').trim(),key=(env.API_KEY||'').trim();
 let endpoint='';if(base){const u=new URL(base);if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(u.hostname)))throw Error('API地址需要HTTPS，或本机HTTP地址。');if(u.username||u.password||u.search||u.hash)throw Error('API地址不能包含用户名、密码或查询参数。');endpoint=base.replace(/\/+$/,'');if(!endpoint.endsWith('/chat/completions'))endpoint+='/chat/completions';}
 const imageBase=(env.IMAGE_API_BASE_URL||base).trim(),imageModel=(env.IMAGE_API_MODEL||'gpt-image-1').trim(),imageKey=(env.IMAGE_API_KEY||key).trim();
 return{endpoint,model,key,configured:!!(endpoint&&model&&key),imageEndpoint:imageBase?imageBase.replace(/\/+$/,'').replace(/\/chat\/completions$/,'')+'/images/generations':'',imageModel,imageKey,imageConfigured:!!(imageBase&&imageModel&&imageKey),chunkChars:Math.max(2000,Math.min(30000,Number(env.API_CHUNK_CHARS)||12000)),maxChunks:Math.max(1,Math.min(100,Number(env.API_MAX_CHUNKS)||40)),outputTokens:Math.max(1000,Math.min(32000,Number(env.API_MAX_OUTPUT_TOKENS)||6000)),jsonMode:env.API_JSON_MODE!=='false',tokenParameter:env.API_TOKEN_PARAMETER==='max_completion_tokens'?'max_completion_tokens':'max_tokens',timeout:Math.max(1000,Math.min(180000,Number(env.API_TIMEOUT_MS)||90000))};
}
/* ── 部署模式：默认只服务本机；要放到公网（Render / Railway / Fly / 自己的服务器）时设 TOWN_PUBLIC=1 ──
   公网模式下不再固定 127.0.0.1，且反向代理后面用 x-forwarded-proto 判断同源，否则 https 页面调 http 判断会 403。
   TOWN_PUBLIC_HOSTS 可填逗号分隔的域名白名单；留空表示接受任意域名（平台分配的域名经常变，默认放开）。 */
function publicMode(){return /^(1|true|yes)$/i.test(String(process.env.TOWN_PUBLIC||''));}
function publicHosts(){return String(process.env.TOWN_PUBLIC_HOSTS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);}
function listenHost(){const fixed=String(process.env.HOST||'').trim();return fixed||(publicMode()?'0.0.0.0':'127.0.0.1');}
function hostAllowed(hostname){const host=String(hostname||'').toLowerCase().replace(/^\[|\]$/g,'');if(['127.0.0.1','localhost','::1'].includes(host))return true;if(!publicMode())return false;const allowed=publicHosts();return !allowed.length||allowed.includes(host);}
function sameOrigin(req){const origin=req.headers.origin;if(!origin)return true;const host=req.headers.host;return origin==='http://'+host||origin==='https://'+host;}
/* 公网模式给“会花钱”的接口加按 IP 限额：别人打开你的站点时刷不出你的密钥额度。本机模式不限。 */
const RATE_LIMIT_WINDOW=10*60*1000,RATE_LIMIT_MAX=()=>Math.max(1,Number(process.env.TOWN_RATE_LIMIT)||5),RATE_LIMIT_TRACK=new Map();
function rateLimited(req,scope){if(!publicMode())return false;const ip=String(req.headers['x-forwarded-for']||'').split(',')[0].trim()||req.socket.remoteAddress||'unknown',id=ip+'|'+scope,now=Date.now();if(RATE_LIMIT_TRACK.size>5000)for(const[key,hit]of RATE_LIMIT_TRACK)if(now-hit.start>RATE_LIMIT_WINDOW)RATE_LIMIT_TRACK.delete(key);const hit=RATE_LIMIT_TRACK.get(id);if(!hit||now-hit.start>RATE_LIMIT_WINDOW){RATE_LIMIT_TRACK.set(id,{start:now,count:1});return false;}hit.count++;return hit.count>RATE_LIMIT_MAX();}
const PROVIDERS={openai:{name:'ChatGPT / OpenAI',baseUrl:'https://api.openai.com/v1',models:['gpt-6.1-sol','gpt-6.1-astra','gpt-5.6-sol','gpt-4.1']},deepseek:{name:'DeepSeek',baseUrl:'https://api.deepseek.com/v1',models:['deepseek-chat','deepseek-reasoner','deepseek-v4-1-flash-261017']},toklens:{name:'Toklens API',baseUrl:'https://lax.toklens.ai/v1',models:['gpt-4o','gpt-4o-mini','gpt-4.1-mini','deepseek-chat','deepseek-reasoner']}};
/* 测试可用 TOWN_PROFILE_FILE 指向临时文件，避免碰到真实的密钥配置；每次调用时读取，设置后立刻生效 */
function profileFile(){return process.env.TOWN_PROFILE_FILE?path.resolve(process.env.TOWN_PROFILE_FILE):DEFAULT_PROFILE_FILE;}
/* 环境变量里的接口（API_BASE_URL/API_MODEL/API_KEY）在没有本地配置文件时也当成可选模型：
   公网部署每次重启都会清空容器文件系统，这样不用每次都回模型中心重填。 */
function envProfile(base){const config=base||configuration();if(!config.configured)return null;return{id:'env',name:'服务器环境变量',provider:'custom',baseUrl:config.endpoint.replace(/\/chat\/completions$/,''),model:config.model,key:config.key,imageModel:String(process.env.IMAGE_API_MODEL||'').trim()||undefined};}
function readProfiles(base){try{const raw=JSON.parse(fs.readFileSync(profileFile(),'utf8'));const list=Array.isArray(raw)?raw.filter(x=>x&&x.id&&x.name&&x.baseUrl&&x.model&&x.key):[];if(list.length)return list;}catch{}const fallback=envProfile(base);return fallback?[fallback]:[];}
function writeProfiles(profiles){fs.mkdirSync(path.dirname(profileFile()),{recursive:true});fs.writeFileSync(profileFile(),JSON.stringify(profiles,null,2)+'\n','utf8');}
function publicProfiles(){return readProfiles().map(({key,...p})=>({...p,hasKey:true}));}
function configForProfile(base,profileId,kind){const p=readProfiles(base).find(x=>x.id===profileId);if(!p)return base;const endpoint=p.baseUrl.replace(/\/+$/,'').replace(/\/chat\/completions$/,'')+'/chat/completions';return {...base,endpoint,model:p.model,key:p.key,configured:true,activeProvider:p.provider||'custom',activeProfile:p.id};}
function chunks(materials,size){const out=[];for(const m of materials){let start=0;while(start<m.text.length){let end=Math.min(m.text.length,start+size);if(end<m.text.length){const br=m.text.lastIndexOf('\n',end);if(br>start+size*.5)end=br+1;}out.push({name:m.name,offset:start,text:m.text.slice(start,end)});start=end;}}return out;}
function mergeOutputs(outputs,title){const chapters=[1,2,3,4].map(id=>({id:String(id),title:'',sections:[]})),questions=new Set();
 for(const output of outputs){if(!Array.isArray(output.chapters))throw Error('API结果缺少章节列表。');for(const ch of output.chapters){const i=Number(ch.id)-1;if(!Number.isInteger(i)||i<0||i>3)throw Error('API章节编号需要为1至4。');const target=chapters[i];target.title=target.title||ch.title;target.english=target.english||ch.english;if(!Array.isArray(ch.sections))throw Error('API章节缺少小节。');for(const sec of ch.sections){let found=target.sections.find(x=>x.title===sec.title);if(!found){found={title:sec.title,english:sec.english,lessons:[],questions:[],activity:sec.activity};target.sections.push(found);}else if(sec.activity){if(!found.activity)found.activity=sec.activity;else for(const round of sec.activity.rounds||[])if(!found.activity.rounds.some(r=>r.id===round.id&&r.prompt?.zh===round.prompt?.zh))found.activity.rounds.push({...round,id:'merged-'+found.activity.rounds.length+'-'+round.id});}for(const l of sec.lessons||[])if(!found.lessons.some(x=>x.title===l.title&&x.body===l.body))found.lessons.push(l);for(const q of sec.questions||[]){const key=(q.q||q.question)+'\n'+(q.a||q.answer);if(!questions.has(key)){questions.add(key);found.questions.push(q);}}}}}
 return{title,chapters};
}
async function modelChunk(config,chunk,overview,signal,prompt=PROMPT){
 const timeout=AbortSignal.timeout(config.timeout),combined=AbortSignal.any([signal,timeout]);
 const body={model:config.model,messages:[{role:'system',content:prompt},{role:'user',content:JSON.stringify({courseOverview:overview,material:chunk})}],[config.tokenParameter]:config.outputTokens};if(config.jsonMode)body.response_format={type:'json_object'};
 let r;try{r=await fetch(config.endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.key},body:JSON.stringify(body),signal:combined,redirect:'error'});}catch(error){if(signal.aborted)throw Error('任务已取消。');if(timeout.aborted)throw Error('API调用超时，请缩小分片或检查服务。');throw Error('无法连接配置的API服务，请检查地址与网络。');}
 if(!r.ok)throw Error('API服务返回 HTTP '+r.status+'。请检查密钥、模型权限、额度及服务设置。');
 const data=await r.json();if(data.choices?.[0]?.finish_reason==='length')throw Error('API输出达到长度限制。请减小API_CHUNK_CHARS或增大API_MAX_OUTPUT_TOKENS后重试。');
 const content=data.choices?.[0]?.message?.content;if(typeof content!=='string')throw Error('API没有返回可解析的课程文字。');
 try{return JSON.parse(content.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));}catch{throw Error('API返回的课程不是有效JSON。请启用JSON模式，或换用支持结构化输出的模型。');}
}
async function generate(config,materials,title,job){const parts=chunks(materials,config.chunkChars);if(parts.length>config.maxChunks)throw Error('材料需要'+parts.length+'次分片调用，超过当前'+config.maxChunks+'次限制。请按课程拆分，或调整API_MAX_CHUNKS。');job.total=parts.length*2;job.phase='inventory';const outputs=[],inventories=[],overview=materials.map(m=>m.name+'\n'+m.text.slice(0,1500)).join('\n').slice(0,6000);
 const clean=s=>s.replace(/\s+/g,' ').trim();
 for(const part of parts){if(job.controller.signal.aborted)throw Error('任务已取消。');const inventory=await modelChunk(config,part,overview,job.controller.signal,INVENTORY_PROMPT);if(!Array.isArray(inventory.units)||!Array.isArray(inventory.gaps)||inventory.units.length>1000)throw Error('知识库抽取结果不完整，请补充定义与材料后重试。');for(const u of inventory.units){if(!u||typeof u.title!=='string'||!u.title.trim()||typeof u.body!=='string'||!u.body.trim()||!u.en||typeof u.en.title!=='string'||!u.en.title.trim()||typeof u.en.body!=='string'||!u.en.body.trim()||typeof u.quote!=='string'||clean(u.quote).length<6||!clean(part.text).includes(clean(u.quote)))throw Error('知识库条目缺少定义或其出处无法在原文中核对。');}inventories.push(inventory);job.done++;}
 const gaps=[...new Set(inventories.flatMap(i=>i.gaps).filter(x=>typeof x==='string'&&x.trim()))];if(gaps.length)throw Error('资料尚不足以形成完整知识库，请补充：'+gaps.slice(0,12).join('；'));
 if(!inventories.some(i=>i.units.length))throw Error('材料没有可学习的知识条目，请补充定义、原理或示例。');
 job.phase='course';for(let i=0;i<parts.length;i++){const part=parts[i],inventory=inventories[i];outputs.push(await modelChunk(config,{...part,knowledgeInventory:inventory.units},overview,job.controller.signal,PROMPT+ACTIVITY_PROMPT+'先使用已核实知识库组织章节。每个知识条目必须有学习卡，不遗漏条目。学习卡保留知识条目的title、body、quote、source、en、interaction；题目只能基于知识库。'));job.done++;}
 const merged=mergeOutputs(outputs,title);for(const ch of merged.chapters)for(const sec of ch.sections)for(const q of sec.questions)if(!q.en?.q||!q.en?.a||!Array.isArray(q.en.wrong)||q.en.wrong.length!==q.wrong?.length)throw Error('生成题目缺少与原选项一一对应的英文版本，请重试。');if(merged.chapters.some(ch=>ch.sections.some(sec=>!sec.activity)))throw Error('课程缺少按知识目标设计的交互方案，请重新生成。');const activityTypes=new Set(merged.chapters.flatMap(ch=>ch.sections.flatMap(sec=>sec.activity.rounds?.map(r=>r.type)||[])));if(activityTypes.size<3)throw Error('课程交互过于单一，请按知识目标设计至少三类不同操作。');const course=Schema.normalize(merged,materials),all=course.chapters.flatMap(c=>c.sections.flatMap(s=>s.lessons));for(const u of inventories.flatMap(i=>i.units))if(!all.some(l=>l.title===u.title&&clean(l.body)===clean(u.body)&&clean(l.en?.body||'')===clean(u.en?.body||'')&&clean(l.quote)===clean(u.quote)))throw Error('课程遗漏知识库条目「'+u.title+'」，请重新生成或拆分材料。');course.knowledgeInventory={units:inventories.flatMap(i=>i.units),gaps:[],coverage:all.map(l=>({id:l.id,title:l.title,source:l.source}))};return course;
}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function readBody(req){let size=0;const parts=[];for await(const part of req){size+=part.length;if(size>8*1024*1024)throw Error('单次上传最多8MB，请拆分材料。');parts.push(part);}try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw Error('请求内容格式错误。');}}
/* ── 上游模型/图片调用：429 与 5xx 自动退避重试，并把失败翻译成能看懂的话 ──
   中转站的“未付费用户共享限额”是全站共享的每分钟额度，稍等通常就恢复，所以先自己等，而不是让用户反复点。 */
const UPSTREAM_RETRY_MS=[4000,12000,25000];
function sleepMs(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function upstreamMessage(label,status,detail,profile){
 let reason='';try{const parsed=JSON.parse(detail);reason=parsed.error?.message||parsed.message||'';}catch{reason=String(detail||'').slice(0,160);}
 const host=(()=>{try{return new URL(profile?.baseUrl||'').host;}catch{return '';}})();
 const hint=status===401?'（密钥无效、已过期，或这把密钥不属于该服务商）':status===402?'（账户余额不足，需要充值）':status===403?'（该密钥没有权限使用这个模型，或地区/IP 被限制）':status===404?'（接口地址或模型名不对，或该服务商不提供这个接口）':status===429?(/unpaid|shared|free/i.test(reason)?'（中转站对“未付费”账户设了全站共享的每分钟限额，现在被别人用满了。已自动等待并重试仍未恢复，请隔几分钟再试，或给这个账户充值成为付费用户）':'（请求太频繁或额度用完，已自动等待并重试仍未恢复）'):status>=500?'（服务商那边出错了，已自动重试仍未恢复）':'';
 return label+' 返回 HTTP '+status+hint+(reason?'｜服务商原话：'+reason:'')+(host?'｜接口：'+host:'');
}
async function callUpstream(label,profile,endpoint,makeBody,{timeout=90000,onWait,fetchImpl}={}){
 const doFetch=fetchImpl||fetch;
 for(let attempt=0;;attempt++){
  let r;
  try{r=await doFetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+profile.key},body:JSON.stringify(makeBody(attempt)),signal:AbortSignal.timeout(timeout),redirect:'error'});}
  catch(error){
   if(attempt<UPSTREAM_RETRY_MS.length&&error?.name!=='TimeoutError'){if(onWait)onWait(UPSTREAM_RETRY_MS[attempt],'连接失败');await sleepMs(UPSTREAM_RETRY_MS[attempt]);continue;}
   throw Error('无法连接'+label+'：'+(error?.name==='TimeoutError'?'等了 '+Math.round(timeout/1000)+' 秒没有回应，可以稍后重试':(error?.message||'网络错误')));
  }
  if(r.ok)return r;
  const detail=await r.text().catch(()=> '');
  const retryable=r.status===429||r.status>=500;
  if(retryable&&attempt<UPSTREAM_RETRY_MS.length){
   const asked=Number(r.headers?.get?.('retry-after'));
   const wait=Math.min(60000,Number.isFinite(asked)&&asked>0?asked*1000:UPSTREAM_RETRY_MS[attempt]);
   if(onWait)onWait(wait,'HTTP '+r.status);
   await sleepMs(wait);continue;
  }
  throw Error(upstreamMessage(label,r.status,detail,profile));
 }
}
/* ── 知识库出题器：独立进程（默认 8900），主服务把 /kb/* 转发过去，并在需要时自动拉起 ──
   浏览器始终只访问主服务这一个地址，不用处理跨域，也不用记第二个端口。 */
const KB_PORT=Number(process.env.KB_PORT)||8900;
function kbDir(){return process.env.KB_DIR_OVERRIDE?path.resolve(process.env.KB_DIR_OVERRIDE):path.join(ROOT,'knowledge');}
const KB_TOKEN=require('node:crypto').randomBytes(24).toString('hex');
let kbChild=null,kbStartedAt=0,kbLastError='';
function kbPing(port=KB_PORT,timeout=800){
 return new Promise(resolve=>{const q=http.request({host:'127.0.0.1',port,path:'/api/types',method:'GET',timeout},r=>{let t='';r.on('data',c=>t+=c);r.on('end',()=>{try{resolve(r.statusCode===200&&Array.isArray(JSON.parse(t).types));}catch{resolve(false);}});});q.on('error',()=>resolve(false));q.on('timeout',()=>{q.destroy();resolve(false);});q.end();});
}
async function ensureKb(){
 if(await kbPing())return {ok:true};
 if(!fs.existsSync(path.join(kbDir(),'server.cjs')))return {ok:false,error:'找不到知识库出题器（dist/knowledge/server.cjs）。'};
 if(!kbChild||kbChild.exitCode!==null){
  try{
   const runtimeDir=path.join(PROJECT_ROOT,'artifacts','runtime');fs.mkdirSync(runtimeDir,{recursive:true});
   const log=fs.openSync(path.join(runtimeDir,'kb-server.log'),'a');
   kbChild=require('node:child_process').spawn(process.execPath,[path.join(kbDir(),'server.cjs'),String(KB_PORT)],{cwd:kbDir(),env:{...process.env,KB_INTERNAL_TOKEN:KB_TOKEN},stdio:['ignore',log,log],windowsHide:true});
   kbStartedAt=Date.now();kbLastError='';
   kbChild.on('error',e=>{kbLastError=e.message;});
   kbChild.on('exit',code=>{if(code)kbLastError='出题器退出了（代码 '+code+'），详情见 artifacts/runtime/kb-server.log';});
  }catch(error){return {ok:false,error:'无法启动出题器：'+error.message};}
 }
 for(let i=0;i<24;i++){await sleepMs(250);if(await kbPing())return {ok:true,started:true};if(kbChild&&kbChild.exitCode!==null)break;}
 return {ok:false,error:kbLastError||('出题器没有在 6 秒内启动。端口 '+KB_PORT+' 可能被别的程序占用；可以设置环境变量 KB_PORT 换一个端口。')};
}
/* 出题器自己的静态服务会把 .model-config.json 之类的文件直接发出去；经主服务转发时必须在这里拦住，
   只放行它的页面资源（html/css/js 前端文件）和 /api/*。 */
function kbPathAllowed(pathname){
 const rel=pathname.replace(/^\/kb/,'')||'/';
 if(rel.startsWith('/api/'))return true;
 if(rel.split('/').some(part=>part.startsWith('.')))return false;
 if(/^\/library(\/|$)/i.test(rel))return false;
 if(/\.(cjs|json|log|md)$/i.test(rel)&&!/^\/(learn|index)\.html$/i.test(rel))return false;
 return true;
}
async function proxyKb(req,res,url){
 if(!kbPathAllowed(url.pathname)){res.writeHead(404);res.end('Not found');return;}
 if(url.pathname==='/kb/api/generate'&&req.method==='POST'&&rateLimited(req,'kb-generate')){json(res,429,{error:'当前站点是公网演示，出题接口每 10 分钟最多 '+RATE_LIMIT_MAX()+' 次。请稍后再试。'});return;}
 const ready=await ensureKb();
 if(!ready.ok){json(res,503,{error:ready.error,kb:false});return;}
 const target=url.pathname.replace(/^\/kb/,'')+url.search;
 const headers={'content-type':req.headers['content-type']||'application/json'};
 const chunks=[];let size=0;for await(const part of req){size+=part.length;if(size>8*1024*1024){json(res,413,{error:'请求内容太大。'});return;}chunks.push(part);}
 let body=Buffer.concat(chunks);
 if(/^\/kb\/api\/generate$/.test(url.pathname)&&req.method==='POST'&&body.length){
  /* 浏览器只说“用哪条模型配置（profileId）”，密钥由主服务从 model-profiles 里取出再转给出题器，永远不经过浏览器。 */
  let parsed={};try{parsed=JSON.parse(body.toString('utf8'));}catch{}
  delete parsed.__modelProfile;
  if(parsed.profileId){
   const prof=readProfiles().find(x=>x.id===parsed.profileId);
   if(!prof){json(res,400,{error:'选中的模型配置不存在了，请回到第 1 步或模型中心重新选择。'});return;}
   parsed.__modelProfile={baseUrl:prof.baseUrl,model:prof.model,key:prof.key};
   headers['x-kb-internal']=KB_TOKEN;
  }
  delete parsed.profileId;
  body=Buffer.from(JSON.stringify(parsed));
 }
 if(body.length)headers['content-length']=body.length;
 await new Promise(resolve=>{
  const up=http.request({host:'127.0.0.1',port:KB_PORT,path:target,method:req.method,headers,timeout:200000},r=>{
   res.writeHead(r.statusCode||502,{'Content-Type':r.headers['content-type']||'application/json; charset=utf-8','Cache-Control':'no-store'});r.pipe(res);r.on('end',resolve);
  });
  up.on('timeout',()=>{up.destroy(new Error('出题器 200 秒没有回应'));});
  up.on('error',error=>{if(!res.headersSent)json(res,502,{error:'连接出题器失败：'+error.message});else res.end();resolve();});
  up.end(body);
 });
}
function stopKb(){try{if(kbChild&&kbChild.exitCode===null)kbChild.kill();}catch{}}
process.on('exit',stopKb);
async function generateImage(config,prompt,profileId,imageWait){const p=readProfiles().find(x=>x.id===profileId);if(!p)throw Error('请先在模型中心选择一个模型。');if((p.provider||'')==='deepseek')throw Error('当前选择的是 DeepSeek 文本模型。图片生成暂时需要 OpenAI 图片能力，请在模型中心选择 ChatGPT / OpenAI。');const endpoint=p.baseUrl.replace(/\/+$/,'').replace(/\/chat\/completions$/,'')+'/images/generations';const mapGuidance='场景必须采用正上方或高位俯视的等距地图视角，完整显示地面、道路、房间和区域边界，像可游玩的课程地图；为线索、任务点、宝箱和可点击物件预留多个清晰空地与独立区域，物件之间保持间距；禁止侧面视角、平视镜头、电影分镜、人物特写和文字。';const imageModel=String(p.imageModel||process.env.IMAGE_API_MODEL||'gpt-image-1').trim()||'gpt-image-1';const body={model:imageModel,prompt:(mapGuidance+' '+String(prompt||'')).slice(0,4000),size:'1024x576',n:1};let r;try{r=await callUpstream('图片 API',p,endpoint,()=>body,{timeout:Math.max(config.timeout,120000),onWait:imageWait});}catch(error){throw Error(error.message.includes('无法连接')?error.message+'（请确认 API 地址可访问，并使用平台 API Key，而不是 ChatGPT 网页订阅登录信息。）':error.message);}const data=await r.json();const item=data.data?.[0];if(!item?.url&&!item?.b64_json)throw Error('图片 API 没有返回图片地址或 base64 数据。');if(item.b64_json){fs.mkdirSync(SCENE_DIR,{recursive:true});const id=crypto.randomUUID(),file=path.join(SCENE_DIR,id+'.png');fs.writeFileSync(file,Buffer.from(item.b64_json,'base64'));return '/generated-scenes/'+id+'.png';}return item.url;}
async function designScene(config,prompt,material,profileId,sceneWait){
 const p=readProfiles().find(x=>x.id===profileId);if(!p)throw Error('请先在模型中心选择一个模型。');
 const endpoint=p.baseUrl.replace(/\/+$/,'').replace(/\/chat\/completions$/,'')+'/chat/completions';
 const system='你是课程游戏场景设计师。只返回严格JSON，不要Markdown。根据课程资料和视觉风格，把一张俯视地图设计成可玩的学习场景。坐标使用0到100的百分比。必须包含3到6个区域和3到8个任务点；每个任务点包含id、name、x、y、kind、prompt、options（2到4项）、answer（正确选项下标）、correctFeedback、wrongFeedback。任务要基于资料，不得编造资料外事实。返回格式：{"title":"","regions":[{"id":"","name":"","x":0,"y":0,"w":20,"h":20}],"tasks":[{"id":"","name":"","x":0,"y":0,"kind":"clue|quiz|apply","prompt":"","options":[],"answer":0,"correctFeedback":"","wrongFeedback":""}],"completion":{"title":"","message":""}}';
 /* 推理模型会先“思考”，思考也计入输出额度；上限给小了会出现 JSON 被截断或正文为空。
    第一次给 12000，被截断（finish_reason=length）或没内容时自动加码再来一次。 */
 const budgets=[12000,24000];
 const makeBody=attempt=>({model:p.model,messages:[{role:'system',content:system},{role:'user',content:JSON.stringify({style:prompt,materials:String(material||'').slice(0,12000)})}],response_format:{type:'json_object'},max_tokens:budgets[Math.min(attempt,budgets.length-1)]});
 let data=null,lastReason='';
 for(let round=0;round<budgets.length;round++){
  let r;try{r=await callUpstream('场景设计 API',p,endpoint,()=>makeBody(round),{timeout:Math.max(config.timeout,120000),onWait:sceneWait});}catch(error){throw error;}
  data=await r.json();
  const choice=data.choices?.[0],text=choice?.message?.content;
  if(choice?.finish_reason==='length'||typeof text!=='string'||!text.trim()){lastReason=choice?.finish_reason==='length'?'模型的“思考”用光了输出额度，正文被截断':'模型没有返回正文';if(round<budgets.length-1)continue;throw Error('场景设计失败：'+lastReason+'（已用 '+budgets[round]+' 的输出上限重试仍不够）。请换一个非推理模型，或减少资料长度。');}
  break;
 }
 const content=data.choices?.[0]?.message?.content;if(typeof content!=='string')throw Error('场景设计 API 没有返回 JSON。');let out;try{out=JSON.parse(content.trim().replace(/^```json\s*/,'').replace(/\s*```$/,''));}catch{throw Error('场景设计 API 返回的内容不是有效 JSON。');}if(!Array.isArray(out.tasks)||out.tasks.length<3)throw Error('场景设计至少需要3个任务点。');return out;
}function createApp(config=configuration()){
 const identity=require('./identity.cjs').gameIdentity();
 const jobs=new Map();return http.createServer(async(req,res)=>{try{
 const hostname=(req.headers.host||'').split(':')[0];if(!hostAllowed(hostname)){json(res,403,{error:'仅接受本机访问。要放到公网，请设置 TOWN_PUBLIC=1 后重启服务。'});return;}
 const url=new URL(req.url,'http://'+req.headers.host);
 if(url.pathname==='/healthz'){json(res,200,{ok:true,public:publicMode()});return;}
 /* 主界面“知识库出题器”入口打开的是 /knowledge/index.html，页面里的接口写的是 /api/library、/api/generate 等。
    这些路径在主服务上没有，所以把出题器自己的那一小组接口转给它；其余 /api/* 仍归主服务。
    /api/config 在主服务上已有同名接口（游戏里的课程导入在用），不能抢：出题器页面要读写自己的配置，
    请求时带上 Referer 来自 /knowledge/ 或 /kb/ 的才转给出题器，游戏页面的请求不受影响。 */
 const KB_API=/^\/api\/(types|search-config|audit|research|job|jobs|job\/control|generate|library(\/[a-z0-9-]+)?)$/i;
 const fromKbPage=/\/(knowledge|kb)\//.test(req.headers.referer||'');
 if(KB_API.test(url.pathname)||(url.pathname==='/api/config'&&fromKbPage)){await proxyKb(req,res,{pathname:'/kb'+url.pathname,search:url.search});return;}
  if(url.pathname==='/kb'||url.pathname.startsWith('/kb/')){
  if(url.pathname==='/kb/status'){json(res,200,{running:await kbPing(),port:KB_PORT,error:kbLastError});return;}
  await proxyKb(req,res,url);return;
 }
 if(url.pathname.startsWith('/api/')){
  if(!sameOrigin(req)){json(res,403,{error:'不允许跨站请求。'});return;}
  /* 公网模式下这些接口会消耗你自己的模型额度，按 IP 限额；本机模式不受影响。 */
  if(['/api/course-jobs','/api/image-generation','/api/scene-design'].includes(url.pathname)&&rateLimited(req,url.pathname)){json(res,429,{error:'当前站点是公网演示，生成接口每 10 分钟最多 '+RATE_LIMIT_MAX()+' 次。请稍后再试，或在本机运行完整版。'});return;}
  if(req.method==='GET'&&url.pathname==='/api/game-info'){json(res,200,identity);return;}
  if(req.method==='GET'&&url.pathname==='/api/config'){json(res,200,{configured:config.configured,imageConfigured:config.imageConfigured,model:config.model,imageModel:config.imageModel,profiles:publicProfiles(),service:config.endpoint?new URL(config.endpoint).origin:'',imageService:config.imageEndpoint?new URL(config.imageEndpoint).origin:'',chunkChars:config.chunkChars,maxChunks:config.maxChunks});return;}
  if(req.method==='GET'&&url.pathname==='/api/kb-packs'){json(res,200,{packs:kbPackList()});return;}
  if(req.method==='GET'&&url.pathname.startsWith('/api/kb-packs/')){const pack=kbPackRead(decodeURIComponent(url.pathname.slice('/api/kb-packs/'.length)));if(!pack){json(res,404,{error:'题库不存在或已被删除。'});return;}json(res,200,{pack});return;}
  if(req.method==='GET'&&url.pathname==='/api/model-providers'){json(res,200,{providers:PROVIDERS});return;}
  if(req.method==='GET'&&url.pathname==='/api/model-profiles'){json(res,200,{profiles:publicProfiles()});return;}
  if(req.method==='POST'&&url.pathname==='/api/model-profiles'){const body=await readBody(req),provider=PROVIDERS[body.provider]?body.provider:'custom',name=String(body.name||'').trim().slice(0,80),baseUrl=String(body.baseUrl||PROVIDERS[provider]?.baseUrl||'').trim(),model=String(body.model||'').trim().slice(0,160),key=String(body.key||'').replace(/[\u0000-\u001F\u007F\uFEFF\u200B-\u200D\u2060]/g,'').trim();if(!name||!baseUrl||!model||!key)throw Error('模型配置需要名称、服务商、模型和 Key。');if(!/^[\x20-\x7E]+$/.test(key))throw Error('API Key 中含有不可识别字符，请只粘贴 Key 本身。');let u;try{u=new URL(baseUrl);if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(u.hostname)))throw Error();}catch{throw Error('API 地址需要 HTTPS，或本机 HTTP 地址。');}const profiles=readProfiles(),id=String(body.id||crypto.randomUUID());const next={id,name,provider,baseUrl:u.toString().replace(/\/$/,''),model,key};const i=profiles.findIndex(x=>x.id===id);if(i>=0)profiles[i]=next;else profiles.push(next);writeProfiles(profiles);json(res,200,{profiles:publicProfiles()});return;}
  if(req.method==='DELETE'&&url.pathname.startsWith('/api/model-profiles/')){const id=decodeURIComponent(url.pathname.split('/').pop());if(id==='env'){json(res,400,{error:'这条来自服务器环境变量，请在部署平台修改 API_BASE_URL / API_MODEL / API_KEY。'});return;}const next=readProfiles().filter(x=>x.id!==id);writeProfiles(next);json(res,200,{profiles:publicProfiles()});return;}
  if(req.method==='POST'&&url.pathname==='/api/image-generation'){const body=await readBody(req);try{const image=await generateImage(config,body.prompt,body.profileId,(ms,why)=>console.log('[image] '+why+'，'+Math.round(ms/1000)+' 秒后自动重试'));json(res,200,{image});}catch(error){json(res,400,{error:error.message});}return;}
  if(req.method==='POST'&&url.pathname==='/api/scene-design'){const body=await readBody(req);try{const scene=await designScene(config,body.prompt,body.material,body.profileId,(ms,why)=>console.log('[scene] '+why+'，'+Math.round(ms/1000)+' 秒后自动重试'));json(res,200,{scene});}catch(error){json(res,400,{error:error.message});}return;}
  if(req.method==='GET'&&url.pathname==='/api/aib-course'){
   require('../../scripts/teaching-catalog-v5.cjs').catalog();
   const result=await require('./pipeline.cjs').compilePreparedCourse({...require('../../packages/course-compiler/enrich-aib.cjs').enrichedAib(),learningPlan:require('../../packages/learning-design/generated/aib-learning-plan.v5.json')});json(res,200,result);return;
  }
  if(req.method==='POST'&&url.pathname==='/api/compile-course'){
   if(!req.headers['content-type']?.startsWith('application/json')){json(res,415,{error:'需要JSON格式的资料包、知识包和学习方案。'});return;}
   try{const body=await readBody(req),result=await require('./pipeline.cjs').compilePreparedCourse(body);json(res,200,result);}catch(error){json(res,400,{error:error.message,diagnostics:error.diagnostics||[]});}return;
  }
  if(req.method==='POST'&&url.pathname==='/api/course-jobs'){
   if(!config.configured){json(res,503,{error:'尚未配置API。请在本机.env中填写API_BASE_URL、API_MODEL和API_KEY，再重启服务。'});return;}
   if(!req.headers['content-type']?.startsWith('application/json')){json(res,415,{error:'请使用JSON上传文字材料。'});return;}
   for(const[id,j]of jobs)if(Date.now()-j.created>3600000)jobs.delete(id);
   if([...jobs.values()].filter(j=>j.status==='running').length>=2||jobs.size>=20){json(res,429,{error:'已有生成任务，请等待完成或取消后再试。'});return;}
   const body=await readBody(req);if(!Array.isArray(body.materials)||!body.materials.length||body.materials.length>50||body.materials.some(m=>!m||typeof m.text!=='string'||!m.text.trim()||typeof m.name!=='string')){json(res,400,{error:'需要1至50份非空文字材料。'});return;}
   const id=crypto.randomUUID(),job={id,status:'running',created:Date.now(),done:0,total:0,controller:new AbortController()};jobs.set(id,job);
   generate(config,body.materials,String(body.title||'我的学习课程').slice(0,150),job).then(course=>{if(job.controller.signal.aborted)return;job.course=course;job.status='done';}).catch(error=>{job.error=error.message;job.status=job.controller.signal.aborted?'cancelled':'failed';});json(res,202,{id});return;
  }
  const match=url.pathname.match(/^\/api\/course-jobs\/([a-f0-9-]+)$/);
  if(match){const job=jobs.get(match[1]);if(!job){json(res,404,{error:'任务不存在或已过期，请重新生成。'});return;}if(req.method==='DELETE'){job.controller.abort();job.status='cancelled';delete job.course;json(res,200,{status:job.status});return;}if(req.method==='GET'){json(res,200,{id:job.id,status:job.status,phase:job.phase,done:job.done,total:job.total,error:job.error,course:job.course});return;}}
  json(res,404,{error:'接口不存在。'});return;
 }
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 const relative=decodeURIComponent(url.pathname==='/'?HOME_PAGE:url.pathname.slice(1)),file=path.resolve(ROOT,relative);
 /* 绝不通过静态服务发出密钥和内部文件：以点开头的文件/目录（.model-config.json、.search-config.json、.debug.log、.env 等），
    以及出题器的配置、服务端源码与题库缓存。出题器页面自己需要的接口走 /api/*，不需要这些文件。 */
 if(relative.split(/[\\/]/).some(part=>part.startsWith('.'))||/(^|[\\/])knowledge[\\/](server|policy|search|questions)\.cjs$/i.test(relative)||/(^|[\\/])knowledge[\\/]library[\\/]/i.test(relative)){res.writeHead(404);res.end('Not found');return;}if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}
 const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
 }catch(error){json(res,400,{error:error.message});}});
}
function start(){try{if(fs.existsSync(path.join(PROJECT_ROOT,'.env')))process.loadEnvFile(path.join(PROJECT_ROOT,'.env'));const app=createApp(),port=Number(process.env.PORT)||8766,host=listenHost();app.listen(port,host,()=>{const url=publicMode()?('http://'+host+':'+port+'（公网模式，实际地址以平台的 https 域名为准）'):('http://127.0.0.1:'+port);console.log('拾知小镇: '+url+' · API '+(configuration().configured?'已配置':'未配置，基础课程仍可离线游玩'));});return app;}catch(error){console.error(error.message);process.exitCode=1;}}
if(require.main===module)start();
module.exports={configuration,chunks,mergeOutputs,generate,createApp,start,stopKb,ensureKb,kbPing,callUpstream,upstreamMessage,generateImage,designScene,UPSTREAM_RETRY_MS,publicMode,publicHosts,listenHost,hostAllowed,sameOrigin,rateLimited};
