'use strict';
/* 知识库独立服务（不依赖游戏、不依赖 apps/）
   启动：node 知识库/server.cjs 8900
   打开：http://127.0.0.1:8900/
   职责：静态托管本目录 + 模型配置 + 出题 + 题库落盘
*/
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Q = require('./questions.cjs');
const Policy = require('./policy.cjs');
const Search = require('./search.cjs');

const ROOT = __dirname;
const DATA_ROOT=process.env.KB_DATA_DIR?path.resolve(process.env.KB_DATA_DIR):ROOT;
const LIBRARY = path.join(DATA_ROOT, 'library');
const CONFIG_FILE = path.join(DATA_ROOT, '.model-config.json');
const SEARCH_FILE = path.join(DATA_ROOT, '.search-config.json');
const PORT = Number(process.argv[2]) || 8900;
fs.mkdirSync(LIBRARY, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };

const json = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };

async function readBody(req) {
  let size = 0; const parts = [];
  for await (const part of req) { size += part.length; if (size > 10 * 1024 * 1024) throw Error('单次最多 10MB。'); parts.push(part); }
  if (!parts.length) return {};
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { throw Error('请求内容不是合法 JSON。'); }
}

/* ── 模型配置：只存本目录，key 不回传 ── */
function normalizeEndpoint(base) {
  const value = String(base || '').trim();
  if (!value) return '';
  const u = new URL(value);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname))) throw Error('接口地址需要 HTTPS，或本机 HTTP（127.0.0.1 / localhost）。');
  if (u.username || u.password || u.search || u.hash) throw Error('接口地址不能带用户名、密码或查询参数。');
  let endpoint = value.replace(/\/+$/, '');
  if (!endpoint.endsWith('/chat/completions')) endpoint += '/chat/completions';
  return endpoint;
}
function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    const stored = { baseUrl: String(raw.baseUrl || '').trim(), model: String(raw.model || '').trim(), apiKey: String(raw.apiKey || '').trim() };
    return (stored.baseUrl || stored.model || stored.apiKey) ? stored : null;
  } catch { return null; }
}
function currentConfig() {
  const stored = readConfig();
  if (!stored || !stored.baseUrl || !stored.model || !stored.apiKey) return { configured: false, model: '', service: '' };
  try { return { configured: true, endpoint: normalizeEndpoint(stored.baseUrl), model: stored.model, key: stored.apiKey, service: new URL(stored.baseUrl).origin }; }
  catch { return { configured: false, model: '', service: '' }; }
}

/* ── 联网搜索配置：单独一个文件，和模型密钥分开管 ── */
function readSearchConfig() {
  try {
    if (!fs.existsSync(SEARCH_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(SEARCH_FILE, 'utf8'));
    const provider = String(raw.provider || '').trim();
    const apiKey = String(raw.apiKey || '').trim();
    if (!Search.PROVIDERS[provider]) return null;
    return { provider, apiKey };
  } catch { return null; }
}
function currentSearchConfig() {
  const stored = readSearchConfig();
  /* 容器里页面写的配置会随实例重启消失，所以环境变量优先兜底：KB_SEARCH_PROVIDER / KB_SEARCH_KEY */
  const envProvider = String(process.env.KB_SEARCH_PROVIDER || '').trim();
  const provider = stored?.provider || (Search.PROVIDERS[envProvider] ? envProvider : Search.DEFAULT_PROVIDER);
  const meta = Search.PROVIDERS[provider] || Search.PROVIDERS[Search.DEFAULT_PROVIDER];
  const apiKey = stored?.apiKey || String(process.env.KB_SEARCH_KEY || '').trim();
  return { provider, key: apiKey, configured: meta.needsKey ? !!apiKey : true, needsKey: !!meta.needsKey, fromEnv: !stored?.apiKey && !!apiKey };
}

/* ── 调模型 ── */
const sleep = ms => new Promise(r => setTimeout(r, ms));

function debugLog(line) {
  try { fs.appendFileSync(path.join(LIBRARY, '.debug.log'), new Date().toISOString() + ' ' + line + '\n'); } catch {}
}

const MODEL_RETRY_DELAYS=[6000,15000];
function modelRequestError(status, detail, config){
 let text=String(detail||'');try{const parsed=JSON.parse(text);text=parsed.error?.message||parsed.message||text;}catch{}
 if(config.key)text=text.split(config.key).join('[REDACTED]');
 text=text.replace(/Bearer\s+[^\s"']+/gi,'Bearer [REDACTED]').slice(0,300);
 const why={401:'密钥无效或已过期',402:'服务商额度或余额不足',403:'所选模型无访问权限',404:'所选模型或接口不存在',429:'所选模型服务已限流，有限重试后仍未恢复；本次未更换模型，请稍后重试'}[status]||'模型服务暂时不可用';
 const error=new Error((status?'模型服务返回 HTTP '+status+'（'+why+'）':'模型连接失败')+' · '+config.model+' · '+config.service+(text?'：'+text:''));error.upstream=true;error.status=status;return error;
}
function checkCancelled(job){if(job?.cancelled)throw Object.assign(new Error('任务已取消'),{upstream:true,cancelled:true});}
async function retryWait(ms,job){const end=Date.now()+ms;while(Date.now()<end){checkCancelled(job);await sleep(Math.min(200,end-Date.now()));}checkCancelled(job);}
async function requestModelResponse(config,body,job,budget){
  /* 429（账号并发上限）/ 5xx 是临时性失败，退避重试两次再报错 */
  const RETRY_DELAYS = MODEL_RETRY_DELAYS;
  let response = null, lastDetail = '';
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    checkCancelled(job);
    if (job) job.attempt = attempt + 1;
    const controller = new AbortController();
    if(job)job.requestController=controller;
    const timer = setTimeout(() => controller.abort(), budget);
    try {
      response = await fetch(config.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + config.key }, body: JSON.stringify(body), signal: controller.signal, redirect: 'error' });
      const payload=await response.text();
      response=new Response([204,205,304].includes(response.status)?null:payload,{status:response.status,headers:response.headers});
    } catch (error) {
      clearTimeout(timer);
      if(job)job.requestController=null;
      checkCancelled(job);
      if (error.name === 'AbortError') throw modelRequestError(0, '模型在 ' + Math.round(budget / 1000) + ' 秒内没有返回。', config);
      if (attempt === RETRY_DELAYS.length) throw modelRequestError(0, '连接模型服务失败：' + error.message, config);
      if (job) job.phase = '连接失败，重试中';
      await retryWait(RETRY_DELAYS[attempt],job);
      continue;
    }
    clearTimeout(timer);
    if(job)job.requestController=null;
    checkCancelled(job);
    if (response.ok) { if (job) {job.retryIn = 0;job.retryAt=0;} break; }
    lastDetail = await response.text().catch(() => '');
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === RETRY_DELAYS.length) {
      throw modelRequestError(response.status, lastDetail, config);
    }
    const rawRetry=response.headers.get('retry-after');let retryAfter=Number(rawRetry);if(rawRetry&&!Number.isFinite(retryAfter))retryAfter=(Date.parse(rawRetry)-Date.now())/1000;
    const wait = Math.max(RETRY_DELAYS[attempt],Math.min(60000,Number.isFinite(retryAfter)&&retryAfter>0?retryAfter*1000:0));
    if (job) { job.phase = (response.status===429?'模型服务限流':'模型服务暂时故障')+'，' + Math.round(wait / 1000) + ' 秒后重试'; job.retryIn = Math.round(wait / 1000); job.retryAt=Date.now()+wait; }
    await retryWait(wait,job);
    if (job) {job.retryIn = 0;job.retryAt=0;}
  }
  return response;
}

async function callModel(config, topic, materials, quick = true, job = null, batch = null) {
  const t0 = Date.now();
  const body = {
    model: config.model,
    messages: [{ role: 'system', content: Q.buildSystemPrompt(quick, batch) }, { role: 'user', content: Q.buildUserPrompt(topic, materials, batch) }],
    /* 输出预算直接决定时长。注意：推理模型会先花 tokens 思考，
       预算给小了会出现 "JSON 合法但 cards 为空" 的截断形态，所以不能低于 3000；分批出 6 道给 4000。 */
    /* order/sort/pair 这类结构化题型输出更长，给足预算；否则会被截断成不合法 JSON。
       batch.maxTokens 用于「推理吃光预算」后的加码重试。 */
    /* 推理模型先花 1500–2500 tokens 思考，4000 经常剩不下输出预算（实测整批白跑）。
       宁可多给，同一批失败一次就得多等 30 秒 */
    max_tokens: batch?.maxTokens || (batch ? (batch.heavy ? 8000 : 6000) : (quick ? 4000 : 8000)),
    temperature: 0.3,
    response_format: { type: 'json_object' }
  };
  const response=await requestModelResponse(config,body,job,quick?75000:150000);
  const data = await response.json();
  checkCancelled(job);
  const content = data.choices?.[0]?.message?.content;
  debugLog(`callModel quick=${quick} ${((Date.now() - t0) / 1000).toFixed(1)}s finish=${data.choices?.[0]?.finish_reason} usage=${JSON.stringify(data.usage)} contentLen=${typeof content === 'string' ? content.length : 'none'} head=${typeof content === 'string' ? content.slice(0, 120).replace(/\n/g, ' ') : ''}`);
  if (typeof content !== 'string') throw Error('模型没有返回文字内容。');
  /* finish=length 且内容为空：推理把预算全吃掉，一个字都没写。加码重试才有效，直接报错会白白丢一批 */
  if (!content.trim() && data.choices?.[0]?.finish_reason === 'length') {
    throw Object.assign(Error('推理吃光了输出预算，一个字都没写'), { code: 'reasoning-exhausted' });
  }
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(cleaned); } catch {}
  /* 输出被 max_tokens 截断时 JSON 不闭合：把 cards 数组里已经完整的对象逐个捞出来 */
  const salvaged = salvageCards(cleaned);
  if (salvaged.length) { debugLog('salvage 截断恢复 ' + salvaged.length + ' 张卡'); return { title: '', summary: '', cards: salvaged, gaps: ['本批输出被截断，只保留完整题'] }; }
  throw Error('模型返回的不是有效 JSON（可能是输出被截断）。已重试仍失败，可减少目标题量或换模型。');
}

/* 从被截断的 JSON 文本里救出完整的卡片对象 */
function salvageCards(text) {
  const at = text.indexOf('"cards"');
  const start = at >= 0 ? text.indexOf('[', at) : text.indexOf('[');
  if (start < 0) return [];
  const out = [];
  let depth = 0, objStart = -1, inStr = false, esc = false;
  for (let i = start + 1; i < text.length; i++) {
    const ch = text[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') { if (depth === 0) objStart = i; depth++; }
    else if (ch === '}') {
      depth--;
      if (depth === 0 && objStart >= 0) {
        try { out.push(JSON.parse(text.slice(objStart, i + 1))); } catch {}
        objStart = -1;
      }
    } else if (ch === ']' && depth === 0) break;
  }
  return out;
}

/* 只花一次调用产出骨架：材料已经抓好，这里只要 6–8 个知识点+适合的题型。
   坑：推理模型会先吃掉输出预算，2000 tokens 实测两种失败——一个字没写 / JSON 被截断。
   所以给 4000 起，失败升到 8000 再试；仍截断就从文本里抢救 point。 */
function salvageOutline(text) {
  const out = [];
  const re = /"point"\s*:\s*"([^"]{2,40})"/g;
  let m;
  while ((m = re.exec(text))) {
    if (!out.some(x => x.point === m[1])) out.push({ point: m[1].trim(), gist: '' });
  }
  return out.slice(0, 8);
}

async function outlineOnce(config, topic, materials, maxTokens, job) {
  job.phase = '先拆知识点骨架…';
  const body = {
    model: config.model,
    messages: [
      { role: 'system', content: Q.buildOutlineSystem(job.audience) },
      { role: 'user', content: Q.buildUserPrompt(topic, materials) }
    ],
    max_tokens: maxTokens,
    temperature: 0.2,
    response_format: { type: 'json_object' }
  };
  const t0 = Date.now();
  {
    const r=await requestModelResponse(config,body,job,90000);
    const data = await r.json();
    checkCancelled(job);
    const content = data.choices?.[0]?.message?.content;
    const finish = data.choices?.[0]?.finish_reason;
    if (typeof content !== 'string' || !content.trim()) throw Error('骨架调用没返回内容（finish=' + finish + '）');
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    let list = [];
    try {
      const parsed = JSON.parse(cleaned);
      list = Q.normalizeOutline(parsed.outline || parsed.points || []);
    } catch { list = salvageOutline(cleaned); }
    if (!list.length) list = salvageOutline(cleaned);
    if (!list.length) throw Error('骨架里没有可用知识点（finish=' + finish + '）');
    debugLog(`planOutline ${((Date.now() - t0) / 1000).toFixed(1)}s max_tokens=${maxTokens} points=${list.length} ${list.map(x => x.point).join('|')}`);
    return list.slice(0, 8);
  }
}

async function planOutline(config, topic, materials, job) {
  let lastError = null;
  for (const maxTokens of [4000, 8000]) {
    try { return await outlineOnce(config, topic, materials, maxTokens, job); }
    catch (e) { if(e.upstream)throw e;lastError = e; debugLog('planOutline 失败(' + maxTokens + ')：' + e.message); }
  }
  throw lastError || Error('骨架调用失败');
}

/* ── 题库落盘 ── */
const jobs = new Map();
/* 多链路并行：默认同时跑 2 条，其余排队。用 KB_PARALLEL 可调（1–4）。
   注意模型账号本身有并发上限，跑太多会 429；2 条是实测比较稳的值。 */
const MAX_PARALLEL = Math.max(1, Math.min(4, Number(process.env.KB_PARALLEL) || 2));
let activeJobs = 0;
const jobQueue = [];

function enqueueJob(job, config, opts) {
  const run = async () => {
    if (job.cancelled) { job.status = 'failed'; job.error = '任务已取消'; return; }
    activeJobs++;
    job.status = 'running';
    if (job.phase === '排队中') job.phase = '开始生成';
    try { await runJob(job, config, opts); }
    catch (e) { job.status = 'failed'; job.retryIn=0;job.retryAt=0;job.error = e.message || String(e); }
    finally { activeJobs--; const next = jobQueue.shift(); if (next) next(); }
  };
  if (activeJobs < MAX_PARALLEL) run();
  else { job.status = 'queued'; job.phase = `排队中（前面还有 ${activeJobs + jobQueue.length} 个任务）`; jobQueue.push(run); }
}
let inflight = null;

/* 内容缓存写盘：重启后同一课题同材料仍然 1 秒返回，不再重复花额度 */
const CACHE_FILE = path.join(LIBRARY, '.cache.json');
const cache = new Map();
try {
  if (fs.existsSync(CACHE_FILE)) for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')))) cache.set(k, v);
} catch {}
let cacheDirty = false;
function cachePut(key, pack) { cache.set(key, pack); cacheDirty = true; if (cache.size > 50) { cache.delete(cache.keys().next().value); } }
setInterval(() => {
  if (!cacheDirty) return;
  cacheDirty = false;
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(cache))); } catch {}
}, 2000).unref();

const BATCH_MAX = 10;     /* 每批最多 10 道：批越大调用越少（100 题≈10 次调用），被截断有 salvage 兜底 */
const MAX_BATCHES = 40;   /* 安全上限，防止目标写错时跑飞 */

/* 每批换一个切入角度，减少「同一个点反复出题」；补题时尤其需要 */
const FOCUS = [
  '从常见误区与反例切入',
  '从指标与口径切入',
  '从流程步骤与先后依赖切入',
  '从成本与权衡切入',
  '从组织分工与责任人切入',
  '从数据质量与异常处理切入',
  '从上线顺序与风险控制切入'
];

function sample(list, n) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

/* 重试时把这一批的题型配额按比例缩小到新规模 */
function shrinkPlan(plan, size) {
  const out = {};
  let left = size;
  for (const [k, n] of Object.entries(plan)) {
    if (left <= 0) break;
    const take = Math.min(n, left);
    if (take > 0) { out[k] = take; left -= take; }
  }
  if (!Object.keys(out).length && size > 0) out.single = size;
  return out;
}

async function runJob(job, config, opts) {
  if (job.cancelled) { job.status = 'failed'; job.error = '任务已取消'; return; }
  const { topic, target, basePack, findings, cacheKey, audience = 'kids' } = opts;
  job.topic = topic;
  /* plan 由调用方给定（页面上按题型填的数量），没给才按默认配比换算 */
  const plan = opts.plan && Object.values(opts.plan).some(n => n > 0) ? opts.plan : Q.planQuota(target).plan;
  const cards = Array.isArray(basePack?.cards) ? basePack.cards.slice() : [];
  const seen = new Set(cards.map(Q.dedupKey));
  const want = { ...plan };
  let outline = Q.normalizeOutline(basePack?.outline);
  let summaryText = '';
  let added = 0, emptyRounds = 0, failRounds = 0, gaps = [];

  /* 联网取材：没有材料时先搜再出题。不允许模型「凭自身知识」硬出，那样既不能核对也没有来源 */
  let mats = (Array.isArray(opts.materials) ? opts.materials : []).filter(m => String(m?.text || '').trim());
  let sources = [];
  let searchErrors = [];
  if (!mats.length) {
    if (!opts.search) throw Error('没有材料，也没有开启联网搜索：无法出题。');
    job.phase = '联网取材中…';
    const found = await Search.research(opts.searchQuery || topic, {
      provider: opts.search?.provider, key: opts.search?.key,
      count: opts.searchCount || 5, job
    });
    mats = found.materials;
    sources = found.sources;
    searchErrors = found.errors || [];
    job.sources = sources;
    job.phase = `取材完成：${sources.length} 篇 / ${found.total} 字`;
  }
  const noMaterial = !mats.length;
  if (searchErrors.length) gaps.push('部分来源抓取失败：' + String(searchErrors[0]).slice(0, 120));

  /* 先定骨架：不先拆知识点，后面 9 批会各起一套名词，30 题能散成 20 个点 */
  if (!outline.length) {
    try {
      /* 骨架只要看主要内容，不必把 2 万字全塞进去 */
      const planned = await planOutline(config, topic, Q.pickExcerpt(mats, '', 12000), job);
      outline = planned;
      job.phase = `骨架就绪：${planned.length} 个知识点`;
    } catch (e) {
      if(e.upstream)throw e;
      debugLog('planOutline failed: ' + e.message);
      gaps.push('没能先拆知识点骨架（' + e.message.slice(0, 50) + '），本批知识点可能偏散');
    }
  }
  /* 每个知识点已出多少题：每批挑「覆盖最少」的那个，保证骨架被走完而不是只在头两个点上打转 */
  const cover = new Map(outline.map(o => [o.point, 0]));
  for (const c of cards) if (c.point) cover.set(c.point, (cover.get(c.point) || 0) + 1);
  job.target = cards.length + target;
  job.done = cards.length;
  job.cards = cards.length;

  const savePartial = () => {
    /* 一道题都没有就不落盘：否则跑失败的任务会在题库列表里留下「0 题」的空壳 */
    if (!cards.length) return null;
    const byType = Q.countTypes(cards);
    const pack = {
      id: basePack ? basePack.id : (job.packId ||= 'kb' + crypto.randomUUID().slice(0, 8)),
      topic, title: (basePack?.title || opts.title || topic || '未命名题库').slice(0, 80),
      summary: (basePack?.summary || summaryText || '').slice(0, 240),
      audience: basePack?.audience || audience,
      cards, byType,
      /* 骨架：模型给的 outline + 从题里兜底抽出来的知识点，合并成一份有序列表 */
      outline: Q.mergeOutline(outline, Q.outlineFromCards(cards)),
      /* 来源：联网取材时的网页清单，供人工回溯 quote 出自哪一篇 */
      sources: sources.length ? sources : (basePack?.sources || []),
      gaps, findings: findings || [],
      createdAt: basePack?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(packFile(pack.id), JSON.stringify(pack, null, 2));
    job.pack = pack;
    return pack;
  };

  for (let batchNo = 1; batchNo <= MAX_BATCHES && added < target; batchNo++) {
    /* 暂停：在批次之间挂起，不打断正在跑的模型调用（打断会浪费这次调用） */
    while (job.paused && !job.cancelled) {
      job.phase = `已暂停（已完成 ${cards.length} 题，点「继续」接着跑）`;
      await sleep(500);
    }
    if (job.cancelled) { job.status = 'failed'; job.error = '任务已取消'; return; }
    /* 组这一批：按缺口挑题型，每种每批最多 2 道。
       重点：题型顺序每批轮转，否则每批都被 single 填满，sort/pair/numeric 永远轮不到。 */
    /* 一批只出一种题型：调用次数最少、prompt 最干净。
       选剩余缺口最大的那种；重的题型（order/sort/pair）每批少出几道，避免输出被截断。 */
    const HEAVY = { order: 2, sort: 2, pair: 2, numeric: 2, multi: 1, single: 1 };
    const key = Object.keys(want).filter(k => want[k] > 0).sort((a, b) => (want[b] / HEAVY[b]) - (want[a] / HEAVY[a]))[0] || 'single';
    /* 这一批绑哪个知识点：先筛适合这种题型的，再挑已出题最少的，保证骨架每个点都被走到 */
    const fit = outline.filter(o => !o.types?.length || o.types.includes(key));
    const pool = (fit.length ? fit : outline).slice();
    pool.sort((a, b) => (cover.get(a.point) || 0) - (cover.get(b.point) || 0));
    const point = pool.length ? pool[0].point : '';
    /* 绑了点就能多出几道：材料被裁到该点相关段落，prompt 短、不容易截断。
       实测 8 道/批比 12 道/批更快（161s vs 142s），题多反而推理更久，别再往上加 */
    const perBatch = point ? (HEAVY[key] > 1 ? 3 : 8) : (HEAVY[key] > 1 ? 4 : BATCH_MAX);
    const size = Math.max(1, Math.min(want[key] || target - added, perBatch, target - added));
    const batchPlan = { [key]: size };
    job.batch = batchNo;
    job.phase = `第 ${batchNo} 批：出 ${size} 道（${key}）` + (point ? ` · 知识点「${point}」` : '') + ` · 已有 ${cards.length} 题`;

    /* 单批失败不拖死整个任务：重试阶梯 = 原样 → 减半 → 减半+加码预算（针对推理吃光预算） */
    let raw = null;
    const heavy = Object.keys(batchPlan).some(k => HEAVY[k] > 1);
    /* 重试阶梯：第二次就加码预算。实测「推理吃光预算」减半 size 没用，
       必须给更多 max_tokens，否则三轮白白耗掉 60 秒 */
    const ladder = [
      { size, maxTokens: 0 },
      { size: Math.max(1, Math.floor(size / 2)), maxTokens: 12000 },
      { size: Math.max(1, Math.floor(size / 2)), maxTokens: 16000 }
    ];
    for (const step of ladder) {
      try {
        /* 只送这个知识点相关的段落：prompt 从 5000+ tokens 压到 1500 左右 */
        const batchMats = Q.pickExcerpt(mats, point, point ? 3500 : 8000);
        raw = await callModel(config, topic, batchMats, true, job, {
          size: step.size,
          plan: shrinkPlan(batchPlan, step.size),
          /* 只随机抽 20 条已出题给模型看：全量带会撑爆 prompt，抽太少又会撞重复 */
          avoid: sample(cards.map(c => c.q), 20),
          focus: FOCUS[(batchNo - 1) % FOCUS.length],
          age: opts.age,
          audience,
          /* 绑死本批知识点；没骨架时退回「已有点复用」 */
          point,
          points: outline.map(o => o.point).filter(Boolean),
          noMaterial,
          heavy,
          maxTokens: step.maxTokens || undefined
        });
        break;
      } catch (error) {
        if(error.upstream)throw error;
        job.phase = `第 ${batchNo} 批失败（${error.message.slice(0, 30)}），换更小规模重试`;
        debugLog('batch ' + batchNo + ' step ' + step.size + '/' + (step.maxTokens || 'default') + ' failed: ' + error.message);
      }
    }
    checkCancelled(job);
    if (!raw) { failRounds++; if (failRounds >= 3) { job.phase = '连续多批失败，提前收尾'; break; } continue; }
    failRounds = 0;
    if (!summaryText && raw?.summary) summaryText = String(raw.summary).slice(0, 240);
    if (Array.isArray(raw?.gaps)) gaps = [...new Set([...gaps, ...raw.gaps.map(String)])].slice(0, 10);
    if (Array.isArray(raw?.outline)) outline = Q.mergeOutline(outline, raw.outline);

    let accepted = 0;
    for (const c of Q.normalizeCards(raw).cards) {
      if (added >= target) break;
      /* 强制归到本批绑定的知识点：模型爱自己改词，这里不让它改 */
      if (point) c.point = point;
      const key = Q.dedupKey(c);
      if (seen.has(key)) continue;
      seen.add(key); cards.push(c); accepted++; added++;
      if (c.point) cover.set(c.point, (cover.get(c.point) || 0) + 1);
      if (want[c.type] > 0) want[c.type]--;
    }
    /* 这种题型这批一道没出：清掉缺口，别在同一个题型上反复烧调用（实测尾部会白跑 1–2 批） */
    if (!accepted && want[key] > 0) {
      want[key] = 0;
      gaps = [...new Set([...gaps, `${key} 题型这批没出到题（材料撑不住或与已有题重复），已跳过`])].slice(0, 10);
    }
    job.done = cards.length; job.cards = cards.length;
    savePartial();
    emptyRounds = accepted ? 0 : emptyRounds + 1;
    if (emptyRounds >= 2) { job.phase = '模型连续没出新题，提前收尾'; break; }
  }

  checkCancelled(job);
  if (!cards.length) {
    throw Error(noMaterial
      ? '没出题：只给了课题、没有材料，模型判定没有可核对的内容。粘贴讲义或笔记正文再试。'
      : '一道题也没出出来：可能是材料太短或模型判定无可出题内容，看看 gaps。');
  }
  /* 收尾自检：把「没出到的」明明白白列进 gaps。
     实测 22 题看起来正常，其实缺 2 个题型、2 个知识点、2 道题没依据——用户不该靠自己去发现 */
  const selfCheck = [];
  const covered = new Set(cards.map(c => c.point).filter(Boolean));
  const missPoints = outline.map(o => o.point).filter(p => !covered.has(p));
  if (missPoints.length) selfCheck.push(`题量不够，${missPoints.length} 个知识点没出到题：${missPoints.slice(0, 6).join('、')}`);
  const noSource = cards.filter(c => !c.quote).length;
  if (noSource) selfCheck.push(`有 ${noSource} 道题模型没给原文依据（页面上标「无资料依据」），建议补材料重出或删掉`);
  const missTypes = Object.keys(plan).filter(k => plan[k] > 0 && !cards.some(c => c.type === k));
  if (missTypes.length) selfCheck.push(`这些题型没出到题：${missTypes.map(k => Q.typeLabel(k)).join('、')}（材料不适合或模型没给）`);
  /* 自检条目放最前：模型的自我说明常把 10 条名额占满，用户就看不到「缺了什么」 */
  gaps = [...new Set([...selfCheck, ...gaps])].slice(0, 14);

  /* 补题时如果一道没加上，必须明说，不能静默报成功 */
  if (!added) {
    job.warning = basePack
      ? '没有新增题目：这份材料能出的题已经出完了。补题请换新材料或补充新的章节内容。'
      : '没有新增题目：模型出的题与已有内容重复。';
    if (basePack) gaps = [...new Set([...gaps, job.warning])].slice(0, 10);
  } else if (added < Math.ceil(target * 0.3)) {
    /* 只出到零头也要明说原因：不然用户看到「完成 · 2 题」会以为工具坏了 */
    job.warning = `只出到 ${added}/${target} 题` + (noMaterial
      ? '：没有材料，只能依据课题本身出题，可出的点有限。粘贴讲义/笔记正文再生成，或用题型上的「＋」按题型补题。'
      : '：材料能支撑的点已经出完了。补充更多章节内容，或用题型上的「＋」补题。');
    gaps = [...new Set([...gaps, job.warning])].slice(0, 10);
  }
  const pack = savePartial();
  if (pack) saveMaterialsSnapshot(pack.id, topic, mats, pack.sources);
  if (!basePack) cachePut(cacheKey, pack);
  job.phase = job.warning ? '完成（没有新增）' : '完成';
  job.status = 'done';
}

const packFile = id => path.join(LIBRARY, String(id).replace(/[^a-z0-9-]/gi, '') + '.json');
/* 材料快照：出题用到的正文落盘，供回溯/重出，避免"题在材料没了" */
const materialsFile = id => path.join(LIBRARY, String(id).replace(/[^a-z0-9-]/gi, '') + '.materials.json');
function saveMaterialsSnapshot(packId, topic, mats, sources) {
  try {
    if (!packId || !mats?.length) return;
    fs.writeFileSync(materialsFile(packId), JSON.stringify({
      topic: String(topic || '').slice(0, 120),
      at: new Date().toISOString(),
      sources: (sources || []).map(s => ({ title: s.title, url: s.url, date: s.date || '', chars: s.chars })),
      materials: (mats || []).map(m => ({ name: m.name, url: m.url || '', text: m.text }))
    }, null, 2));
  } catch {}
}
function listLibrary() {
  return fs.readdirSync(LIBRARY).filter(n => n.endsWith('.json') && !n.startsWith('.') && !n.endsWith('.materials.json')).map(name => {
    try {
      const p = JSON.parse(fs.readFileSync(path.join(LIBRARY, name), 'utf8'));
      const byType = {};
      const points = new Set();
      for (const c of p.cards || []) {
        byType[c.type] = (byType[c.type] || 0) + 1;
        if (c.point) points.add(c.point);
      }
      return { id: p.id, title: p.title, summary: p.summary || '', topic: p.topic || '', total: (p.cards || []).length, byType, points: points.size, createdAt: p.createdAt, updatedAt: p.updatedAt };
    } catch { return null; }
  }).filter(Boolean).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

if(require.main===module){
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || '127.0.0.1'));
  try {
    if (url.pathname === '/api/types' && req.method === 'GET') { json(res, 200, { types: Q.TYPES, mix: Q.TARGET_MIX }); return; }

    if (url.pathname === '/api/config') {
      if (req.method === 'GET') { const c = currentConfig(); json(res, 200, { configured: c.configured, model: c.model, service: c.service }); return; }
      if (req.method === 'POST') {
        const body = await readBody(req);
        const baseUrl = String(body.baseUrl || '').trim(), model = String(body.model || '').trim(), apiKey = String(body.apiKey || '').trim();
        if (!baseUrl || !model || !apiKey) { json(res, 400, { error: '接口地址、模型名称、密钥都要填。' }); return; }
        normalizeEndpoint(baseUrl);
        fs.writeFileSync(CONFIG_FILE, JSON.stringify({ baseUrl, model, apiKey }, null, 2), { mode: 0o600 });
        try { fs.chmodSync(CONFIG_FILE, 0o600); } catch {}
        const c = currentConfig();
        json(res, 200, { configured: c.configured, model: c.model, service: c.service });
        return;
      }
      if (req.method === 'DELETE') { try { fs.rmSync(CONFIG_FILE, { force: true }); } catch {} json(res, 200, { configured: false }); return; }
    }

    /* 联网搜索配置：与模型配置分开存，密钥同样不回传 */
    if (url.pathname === '/api/search-config') {
      const providers = Object.entries(Search.PROVIDERS).map(([key, v]) => ({ key, label: v.label, needsKey: v.needsKey, apply: v.apply }));
      if (req.method === 'GET') {
        const c = currentSearchConfig();
        json(res, 200, { provider: c.provider, configured: c.configured, needsKey: c.needsKey, providers });
        return;
      }
      if (req.method === 'POST') {
        const body = await readBody(req);
        const provider = String(body.provider || '').trim();
        const apiKey = String(body.apiKey || '').trim();
        if (!Search.PROVIDERS[provider]) { json(res, 400, { error: '不认识的搜索服务：' + provider }); return; }
        if (Search.PROVIDERS[provider].needsKey && !apiKey) { json(res, 400, { error: '这个搜索服务需要密钥。' }); return; }
        fs.writeFileSync(SEARCH_FILE, JSON.stringify({ provider, apiKey }, null, 2), { mode: 0o600 });
        try { fs.chmodSync(SEARCH_FILE, 0o600); } catch {}
        const c = currentSearchConfig();
        json(res, 200, { provider: c.provider, configured: c.configured, needsKey: c.needsKey });
        return;
      }
      if (req.method === 'DELETE') { try { fs.rmSync(SEARCH_FILE, { force: true }); } catch {} json(res, 200, { configured: false }); return; }
    }

    /* 题库体检：无依据 / 无知识点 / 重复 / 来源过旧 / 缺题型，一眼看出库能不能用 */
    if (url.pathname === '/api/audit' && req.method === 'POST') {
      const body = await readBody(req);
      let pack = null;
      if (body.id) {
        const f = packFile(body.id);
        if (!fs.existsSync(f)) { json(res, 404, { error: '题库不存在。' }); return; }
        pack = JSON.parse(fs.readFileSync(f, 'utf8'));
      } else if (body.pack && typeof body.pack === 'object') pack = body.pack;
      if (!pack) { json(res, 400, { error: '传 id 或 pack。' }); return; }
      const audit = Q.auditPack(pack);
      const snapshot = pack.id ? fs.existsSync(materialsFile(pack.id)) : false;
      json(res, 200, { ...audit, hasSnapshot: snapshot });
      return;
    }

    /* 手动取材：拿课题（或自定义检索词）搜一遍，把正文返回给页面预览/编辑 */
    if (url.pathname === '/api/research' && req.method === 'POST') {
      const conf = currentSearchConfig();
      if (!conf.configured) { json(res, 422, { error: '还没配置联网搜索。展开「API 配置」选一个搜索服务并填密钥。' }); return; }
      const body = await readBody(req);
      const query = String(body.query || body.topic || '').trim();
      if (!query) { json(res, 400, { error: '写个检索词（一般就是课题）。' }); return; }
      const found = await Search.research(query, { provider: conf.provider, key: conf.key, count: Number(body.count) || 5 });
      const verdict = Policy.screenMaterials(found.materials);
      if (!verdict.ok) {
        json(res, 422, { error: '取回的内容触发拦截，未使用：' + verdict.findings.filter(f => f.severity === 'error').map(f => f.message).join('；') });
        return;
      }
      json(res, 200, { materials: found.materials, sources: found.sources, errors: found.errors, total: found.total, provider: found.provider });
      return;
    }

    /* 任务化生成：立刻返回 jobId，前端轮询；同一时刻只允许一个任务在跑（账号并发上限=1） */
    if (url.pathname === '/api/job' && req.method === 'GET') {
      const id = url.searchParams.get('id') || '';
      const job = jobs.get(id);
      if (!job) { json(res, 404, { error: '没有这个任务（服务可能重启过）。' }); return; }
      json(res, 200, {
        id: job.id, status: job.status, phase: job.phase, cached: !!job.cached,
        elapsed: Math.round((Date.now() - job.startedAt) / 1000),
        error: job.error || '', retryIn: job.retryAt?Math.max(0,Math.ceil((job.retryAt-Date.now())/1000)):0,
        done: job.done || 0, target: job.target || 0, batch: job.batch || 0,
        cards: job.cards || 0, warning: job.warning || '',
        sources: job.sources || null,
        pack: job.pack,
        attempt: job.attempt || 0
      });
      return;
    }

    if (url.pathname === '/api/generate' && req.method === 'POST') {
      let config = currentConfig();
      const body = await readBody(req);
      /* 工作台通过主服务带来一条“模型中心”里的配置：只有来自本机主服务（带内部令牌）的请求才采用，
         这样出题器自己独立使用时行为不变，浏览器也永远拿不到密钥。 */
      if (body.__modelProfile && !(process.env.KB_INTERNAL_TOKEN && req.headers['x-kb-internal'] === process.env.KB_INTERNAL_TOKEN)) {
        json(res, 409, { error: '这个出题器进程不是由游戏主服务启动的，不能使用工作台的模型配置。请关掉它（例如手动开的 8900 端口），让游戏主服务自动启动它；或者在出题器页面右上角「API 配置」里单独填一次。' }); return;
      }
      if (body.__modelProfile && process.env.KB_INTERNAL_TOKEN && req.headers['x-kb-internal'] === process.env.KB_INTERNAL_TOKEN) {
        const mp = body.__modelProfile;
        try { config = { configured: true, endpoint: normalizeEndpoint(mp.baseUrl), model: String(mp.model || '').trim(), key: String(mp.key || '').trim(), service: new URL(mp.baseUrl).origin }; } catch {}
        if (!config.model || !config.key) config = { configured: false };
      }
      if (!config.configured) { json(res, 503, { error: '还没配置模型接口。请在工作台的「模型中心」添加一个模型并选中，或在出题器页面右上角「API 配置」里填写。' }); return; }
      const topic = String(body.topic || '').trim();
      /* target：本次要出多少道（100 题会拆成多批串行跑）；appendTo：往已有题库里补题 */
      const quick = body.quick !== false;
      const targetRaw = Number(body.target);
      let target = Math.max(1, Math.min(300, Number.isFinite(targetRaw) && targetRaw > 0 ? Math.round(targetRaw) : (quick ? 3 : 8)));
      /* 题型数量：① onlyType 只补/只出某一种题型；② typeQuota 直接给每种题型要几道。
         两者都给了以 onlyType 为准，数量用 target。 */
      const onlyType = String(body.onlyType || '').trim();
      let plan = null;
      if (onlyType && Q.TYPES.some(t => t.key === onlyType)) {
        plan = {}; for (const t of Q.TYPES) plan[t.key] = 0;
        plan[onlyType] = target;
      } else if (body.typeQuota && typeof body.typeQuota === 'object') {
        const normalized = Q.normalizeQuota(body.typeQuota);
        if (normalized.total > 0) { plan = normalized.plan; target = normalized.total; }
      }
      /* 受众：kids（儿童通识）/ pro（专业调查、认证、培训）。影响提示词口吻、骨架拆法与体检阈值 */
      const audience = String(body.audience || '').trim() === 'pro' ? 'pro' : 'kids';
      const appendTo = String(body.appendTo || '').trim();
      const basePack = appendTo ? (() => { const f = packFile(appendTo); if (!fs.existsSync(f)) return null; try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } })() : null;
      if (appendTo && !basePack) { json(res, 404, { error: '要补题的题库不存在：' + appendTo }); return; }
      /* 材料长度随目标题量放大：100 题需要足够的内容支撑，否则模型只能重复出题 */
      const cap = quick ? Math.min(12000, Math.max(1800, target * 120)) : 12000;
      const materials = (Array.isArray(body.materials) ? body.materials : [])
        .map(m => ({ name: String(m?.name || ''), text: String(m?.text || '').slice(0, cap) }))
        .filter(m => m.text.trim());
      if (!topic && !materials.length && !basePack) { json(res, 400, { error: '写一个课题，或粘贴一份材料。' }); return; }

      /* 联网闸：没有材料就必须能搜。不允许退化成「模型凭自身知识出题」——那种题没有来源、核不了 */
      const searchConf = currentSearchConfig();
      if (!materials.length && !searchConf.configured) {
        json(res, 422, {
          error: '没有粘贴材料，联网搜索也还没配置。请在「API 配置」里选一个搜索服务并填密钥（Tavily / Serper 都有免费额度），或者直接粘贴讲义正文。',
          needSearch: true
        });
        return;
      }

      const verdict = Policy.screenMaterials(materials.length ? materials : [{ text: topic }]);
      if (!verdict.ok) {
        json(res, 422, { error: '内容触发拦截，未提交给模型：' + verdict.findings.filter(f => f.severity === 'error').map(f => f.message).join('；'), findings: verdict.findings });
        return;
      }

      /* ① 内容缓存：同课题同材料同题量，直接返回上次结果，不再花钱（补题不缓存） */
      /* 缓存键只看内容，不看材料名（同一段话换个名字不该重复付费） */
      const mixKey = plan ? JSON.stringify(plan) : 'auto';
      /* v7：收尾自检（未覆盖知识点/无依据题/缺题型）进 gaps，旧缓存里的库没有这些提示
         （联网取材的结果随时间变，但同一课题同一天复用缓存能省钱） */
      const cacheKey = crypto.createHash('sha1').update(['v8', topic, audience || 'kids', quick ? 'q' : 'f', target, mixKey, materials.length ? 'm' : 'w', materials.map(m => m.text).join('\u0001')].join('\u0002')).digest('hex');
      const hit = appendTo ? null : cache.get(cacheKey);
      if (hit && (hit.cards || []).length >= Math.min(target, 3)) {
        const job = { id: 'c' + cacheKey.slice(0, 8), status: 'done', phase: 'cached', cached: true, startedAt: Date.now(), pack: hit, done: hit.cards.length, target: hit.cards.length, cards: hit.cards.length };
        jobs.set(job.id, job);
        json(res, 202, { jobId: job.id, cached: true });
        return;
      }

      /* ② 起任务：立刻回 jobId，超出的进队列（可以同时开多条链路） */
      const job = {
        id: 'j' + crypto.randomUUID().slice(0, 8), status: 'running', phase: '提交给模型',
        startedAt: Date.now(), cached: false, attempt: 0,
        topic: topic || basePack?.topic || '未命名题库', audience, paused: false, cancelled: false
      };
      jobs.set(job.id, job);
      json(res, 202, { jobId: job.id, target, appendTo: appendTo || null, parallel: MAX_PARALLEL });

      enqueueJob(job, config, {
        topic: job.topic,
        /* 千万别再把课题名当材料塞进去：模型会把「课题叫什么」当成一道正式题 */
        materials,
        /* 没有材料时由 runJob 先联网取材；websearch:false 可强制关闭（仅在已给材料时才有意义） */
        search: body.websearch === false ? null : searchConf,
        searchCount: Number(body.searchCount) || 5,
        searchQuery: String(body.searchQuery || '').trim(),
        audience,
        age: String(body.age || '').trim() || '10-12',
        target, plan, basePack, findings: verdict.findings, cacheKey
      });
      return;
    }

    /* 任务列表：多条链路同时跑时，前端靠它渲染进度与暂停/取消按钮 */
    if (url.pathname === '/api/jobs' && req.method === 'GET') {
      json(res, 200, {
        parallel: MAX_PARALLEL,
        active: activeJobs,
        queued: jobQueue.length,
        jobs: [...jobs.values()].slice(-20).map(j => ({
          id: j.id, topic: j.topic || '', status: j.status, phase: j.phase || '',
          done: j.done || 0, target: j.target || 0, paused: !!j.paused, cancelled: !!j.cancelled,
          warning: j.warning || '', error: j.error || '', startedAt: j.startedAt,
          packId: j.pack?.id || '', cards: (j.pack?.cards || []).length, cached: !!j.cached,
          audience: j.audience || 'kids'
        }))
      });
      return;
    }

    /* 暂停 / 继续 / 取消：暂停只在批次之间生效，不打断正在跑的模型调用 */
    if (url.pathname === '/api/job/control' && req.method === 'POST') {
      const body = await readBody(req);
      const job = jobs.get(String(body.id || ''));
      if (!job) { json(res, 404, { error: '没有这个任务。' }); return; }
      const action = String(body.action || '');
      if (action === 'pause') {
        if (job.status === 'running' || job.status === 'queued') { job.paused = true; job.phase = '已暂停'; }
      } else if (action === 'resume') {
        job.paused = false;
        if (job.status === 'queued') job.phase = `排队中（前面还有 ${activeJobs + jobQueue.length} 个任务）`;
      } else if (action === 'cancel') {
        job.cancelled = true; job.paused = false;
        job.requestController?.abort();
        if (job.status === 'queued') { job.status = 'failed'; job.error = '任务已取消'; job.phase = '已取消'; }
      } else { json(res, 400, { error: 'action 只能是 pause / resume / cancel' }); return; }
      json(res, 200, { id: job.id, status: job.status, paused: !!job.paused, cancelled: !!job.cancelled });
      return;
    }

    if (url.pathname === '/api/library' && req.method === 'GET') { json(res, 200, { packs: listLibrary() }); return; }
    if (url.pathname === '/api/library' && req.method === 'POST') {
      const body = await readBody(req);
      const cards = Array.isArray(body.cards) ? body.cards : [];
      checkCancelled(job);
  if (!cards.length) { json(res, 400, { error: '题库是空的。' }); return; }
      const pack = {
        id: 'kb' + crypto.randomUUID().slice(0, 8),
        topic: String(body.topic || '').slice(0, 120),
        title: String(body.title || '未命名题库').slice(0, 80),
        summary: String(body.summary || '').slice(0, 240),
        audience: String(body.audience || '') === 'pro' ? 'pro' : 'kids',
        cards,
        byType: Q.countTypes(cards),
        outline: Q.mergeOutline(body.outline, Q.outlineFromCards(cards)),
        sources: Array.isArray(body.sources) ? body.sources.slice(0, 20) : [],
        gaps: body.gaps || [],
        createdAt: new Date().toISOString()
      };
      fs.writeFileSync(packFile(pack.id), JSON.stringify(pack, null, 2));
      json(res, 200, { pack });
      return;
    }
    const m = url.pathname.match(/^\/api\/library\/([a-z0-9-]+)$/i);
    if (m) {
      if (req.method === 'GET') {
        const file = packFile(m[1]);
        if (!fs.existsSync(file)) { json(res, 404, { error: '题库不存在。' }); return; }
        json(res, 200, { pack: JSON.parse(fs.readFileSync(file, 'utf8')) });
        return;
      }
      /* 重命名 / 改说明 / 增删题目后整体回写：只认 title、summary、cards、outline 四个字段 */
      if (req.method === 'PATCH') {
        const file = packFile(m[1]);
        if (!fs.existsSync(file)) { json(res, 404, { error: '题库不存在。' }); return; }
        const pack = JSON.parse(fs.readFileSync(file, 'utf8'));
        const body = await readBody(req);
        if (typeof body.title === 'string') {
          const title = body.title.trim().slice(0, 80);
          if (!title) { json(res, 400, { error: '题库名不能为空。' }); return; }
          pack.title = title;
        }
        if (typeof body.summary === 'string') pack.summary = body.summary.trim().slice(0, 240);
        if (Array.isArray(body.cards)) {
          if (!body.cards.length) { json(res, 400, { error: '题库至少要留一道题，想清空请直接删除这份题库。' }); return; }
          pack.cards = body.cards;
        }
        pack.byType = Q.countTypes(pack.cards || []);
        if (Array.isArray(body.outline)) pack.outline = Q.normalizeOutline(body.outline);
        if (!Array.isArray(pack.outline) || !pack.outline.length) pack.outline = Q.mergeOutline(pack.outline, Q.outlineFromCards(pack.cards || []));
        pack.updatedAt = new Date().toISOString();
        fs.writeFileSync(file, JSON.stringify(pack, null, 2));
        json(res, 200, { pack });
        return;
      }
      if (req.method === 'DELETE') { try { fs.rmSync(packFile(m[1]), { force: true }); } catch {} json(res, 200, { ok: true }); return; }
    }

    json(res, 404, { error: '没有这个接口：' + url.pathname });
  } catch (error) {
    json(res, 400, { error: error.message });
  }
});

/* 静态文件：只允许访问本目录 */
const staticServer = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  let file = path.resolve(ROOT, rel);
  if (file.startsWith(ROOT + path.sep) && fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});

/* 同一个端口：/api 交给 API，其余交给静态 */
const app = http.createServer((req, res) => { if (req.url.startsWith('/api/')) server.emit('request', req, res); else staticServer.emit('request', req, res); });
app.listen(PORT, '127.0.0.1', () => {
  const c = currentConfig();
  console.log('知识库: http://127.0.0.1:' + PORT + '/');
  console.log('模型: ' + (c.configured ? '已配置 · ' + c.model + '（' + c.service + '）' : '未配置——页面右上角「API 配置」'));
  console.log('题库目录: 知识库/library/');
});

}
module.exports={requestModelResponse,modelRequestError,MODEL_RETRY_DELAYS,planOutline,runJob};
