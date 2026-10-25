'use strict';
/* 联网取材：把课题丢给搜索服务，取回正文当「材料」再出题。
   为什么不用模型自带搜索：① 当前接口是 Chat Completions，模型不一定支持 tools；
   ② 出题需要 quote 可核对到原文，只有我们自己拿到网页正文才核得上。 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/* 五种搜索后端：前四种要密钥，最后一个是无密钥兜底（不稳定，能通就用） */
const PROVIDERS = {
  wsa: { label: '腾讯元宝搜索（WSA，国内可用，推荐）', needsKey: true, apply: 'https://console.cloud.tencent.com/wsa' },
  tavily: { label: 'Tavily（境外可用）', needsKey: true, apply: 'https://tavily.com' },
  serper: { label: 'Serper（Google 结果）', needsKey: true, apply: 'https://serper.dev' },
  brave: { label: 'Brave Search', needsKey: true, apply: 'https://brave.com/search/api/' },
  bing: { label: 'Bing Web Search（Azure）', needsKey: true, apply: 'https://www.microsoft.com/bing/apis/bing-web-search-api' },
  binghtml: { label: 'Bing 网页结果（无需密钥，可能被限流）', needsKey: false, apply: '' }
};

const DEFAULT_PROVIDER = 'wsa';

function timeout(ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => clearTimeout(t) };
}

/* ── 单次搜索：统一成 [{title,url,snippet,content?}] ── */
async function searchWeb(query, { provider = DEFAULT_PROVIDER, key = '', count = 5 } = {}) {
  const q = String(query || '').trim();
  if (!q) throw Error('搜索词是空的。');
  const n = Math.max(1, Math.min(10, Number(count) || 5));
  const meta = PROVIDERS[provider] || PROVIDERS[DEFAULT_PROVIDER];
  if (meta.needsKey && !key) throw Error(`搜索服务「${provider}」需要密钥，先在「API 配置」里填。`);

  const t = timeout(20000);
  try {
    if (provider === 'wsa') {
      /* 腾讯云元宝搜索：POST /SearchPro，Authorization: Bearer <key>
         坑：Response.Pages 是「字符串数组」，每个元素本身是一段 JSON，要再 parse 一次 */
      const r = await fetch('https://api.wsa.cloud.tencent.com/SearchPro', {
        method: 'POST', signal: t.signal,
        headers: { 'Content-Type': 'application/json; charset=UTF-8', Authorization: 'Bearer ' + key },
        body: JSON.stringify({ Query: q })
      });
      const raw = await r.text();
      let d = null;
      try { d = JSON.parse(raw); } catch { throw Error('WSA 返回不是 JSON：' + raw.slice(0, 160)); }
      const err = d?.Response?.Error;
      if (!r.ok || err) {
        const code = err?.Code || 'HTTP ' + r.status;
        const hint = code === 'UnauthorizedOperation' ? '（密钥不对）'
          : code === 'ResourceNotFound' ? '（服务未开通）'
            : code === 'ResourceUnavailable' ? '（账号欠费或资源不可用）'
              : code === 'RequestLimitExceeded' ? '（超出频率限制）' : '';
        throw Error('WSA ' + code + hint + (err?.Message ? '：' + err.Message : ''));
      }
      const pages = (d?.Response?.Pages || []).map(p => {
        if (typeof p !== 'string') return p;
        try { return JSON.parse(p); } catch { return null; }
      }).filter(Boolean);
      return pages.slice(0, n + 5).map(x => ({
        title: x.title || x.site || x.url,
        url: x.url,
        snippet: stripTags(x.passage || ''),
        content: stripTags(x.passage || ''),
        date: x.date || '',
        site: x.site || ''
      }));
    }
    if (provider === 'tavily') {
      /* include_raw_content：Tavily 自己带正文，省掉我们再抓一遍页面（国内站点大量 403，这一步很关键） */
      const r = await fetch('https://api.tavily.com/search', {
        method: 'POST', signal: t.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: key, query: q, max_results: n, search_depth: 'advanced', include_answer: false, include_raw_content: true })
      });
      if (!r.ok) throw Error('Tavily HTTP ' + r.status + '：' + (await r.text()).slice(0, 160));
      const d = await r.json();
      return (d.results || []).map(x => ({
        title: x.title || x.url,
        url: x.url,
        snippet: x.content || '',
        content: x.raw_content || x.content || ''
      }));
    }
    if (provider === 'serper') {
      const r = await fetch('https://google.serper.dev/search', {
        method: 'POST', signal: t.signal,
        headers: { 'Content-Type': 'application/json', 'X-API-KEY': key },
        body: JSON.stringify({ q, num: n, gl: 'cn', hl: 'zh-cn' })
      });
      if (!r.ok) throw Error('Serper HTTP ' + r.status + '：' + (await r.text()).slice(0, 160));
      const d = await r.json();
      return (d.organic || []).map(x => ({ title: x.title, url: x.link, snippet: x.snippet || '' }));
    }
    if (provider === 'brave') {
      const r = await fetch('https://api.search.brave.com/res/v1/web/search?q=' + encodeURIComponent(q) + '&count=' + n, {
        signal: t.signal, headers: { Accept: 'application/json', 'X-Subscription-Token': key }
      });
      if (!r.ok) throw Error('Brave HTTP ' + r.status + '：' + (await r.text()).slice(0, 160));
      const d = await r.json();
      return ((d.web && d.web.results) || []).map(x => ({ title: x.title, url: x.url, snippet: x.description || '' }));
    }
    if (provider === 'bing') {
      const r = await fetch('https://api.bing.microsoft.com/v7.0/search?q=' + encodeURIComponent(q) + '&count=' + n + '&mkt=zh-CN', {
        signal: t.signal, headers: { 'Ocp-Apim-Subscription-Key': key }
      });
      if (!r.ok) throw Error('Bing HTTP ' + r.status + '：' + (await r.text()).slice(0, 160));
      const d = await r.json();
      return (((d.webPages || {}).value) || []).map(x => ({ title: x.name, url: x.url, snippet: x.snippet || '' }));
    }
    /* binghtml：直接读搜索结果页，无需密钥。结构随时会变，解析失败就明确报错 */
    const r = await fetch('https://www.bing.com/search?q=' + encodeURIComponent(q) + '&setlang=zh-CN&count=' + n, {
      signal: t.signal, headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' }
    });
    if (!r.ok) throw Error('Bing 网页版 HTTP ' + r.status);
    const html = await r.text();
    const out = [];
    for (const block of html.split(/<li class="b_algo"/).slice(1, n + 1)) {
      const link = block.match(/<h2[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"/);
      if (!link) continue;
      const title = stripTags((block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [])[1] || '');
      const snippet = stripTags((block.match(/<p[^>]*>([\s\S]*?)<\/p>/) || [])[1] || '');
      out.push({ title: title || link[1], url: link[1], snippet });
    }
    if (!out.length) throw Error('Bing 网页版没解析到结果（页面结构可能变了），建议改用 Tavily 或 Serper 的密钥。');
    return out;
  } finally { t.done(); }
}

function stripTags(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

/* 内网/本机地址不允许抓，避免把服务端当代理用 */
function isPublicUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return false; }
  if (!/^https?:$/.test(u.protocol)) return false;
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h === '[::1]' || h === '0.0.0.0') return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const p = h.split('.').map(Number);
    if (p[0] === 10 || p[0] === 127 || (p[0] === 192 && p[1] === 168) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || p[0] === 0) return false;
  }
  return true;
}

/* HTML → 正文：去掉脚本/样式/导航，按块换行。够用就好，不做完整解析 */
function htmlToText(html) {
  return String(html || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|iframe|nav|footer|header|form)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&emsp;/g, ' ')
    .replace(/[ \t\u00a0]+/g, ' ')
    .split('\n').map(l => l.trim()).filter(l => l.length > 1).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchPageText(url, maxChar = 5000) {
  if (!isPublicUrl(url)) throw Error('不允许抓取这个地址：' + url);
  const t = timeout(15000);
  try {
    const r = await fetch(url, {
      signal: t.signal, redirect: 'follow',
      headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9', Accept: 'text/html,application/xhtml+xml' }
    });
    if (!r.ok) throw Error('HTTP ' + r.status);
    const type = r.headers.get('content-type') || '';
    if (!/text\/html|text\/plain|application\/xhtml/i.test(type)) throw Error('不是网页：' + type);
    const raw = (await r.text()).slice(0, 400000);
    const text = htmlToText(raw);
    if (text.length < 200) throw Error('正文太短（' + text.length + ' 字），可能是需要登录或被拦截');
    return text.slice(0, maxChar);
  } finally { t.done(); }
}

/* 并发抓取：串行时 10 篇最坏要 150 秒，并发 5 只要一轮 15 秒 */
async function mapLimit(list, limit, fn) {
  const out = new Array(list.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, list.length)) }, async () => {
    for (;;) {
      const idx = cursor++;
      if (idx >= list.length) return;
      out[idx] = await fn(list[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

/* ── 检索 + 抓正文，产出可直接当 materials 的数组 ── */
async function research(query, { provider, key, count = 5, perSourceChar = 4000, totalChar = 20000, job = null, concurrency = 5 } = {}) {
  if (job) job.phase = '联网检索中：' + query;
  const hits = await searchWeb(query, { provider, key, count });
  if (!hits.length) throw Error('搜索没有返回结果：' + query);

  const list = hits.filter(h => h.url && isPublicUrl(h.url)).slice(0, 12);
  if (!list.length) throw Error('搜到了 ' + hits.length + ' 条结果，但没有可抓取的地址。');

  const errors = [];
  let done = 0;
  if (job) job.phase = `并行抓取正文（${list.length} 篇）…`;
  const fetched = await mapLimit(list, concurrency, async hit => {
    const snip = String(hit.snippet || '').trim();
    let text = String(hit.content || snip || '').trim();
    /* 优先级：搜索服务自带正文 → 自己抓页面 → 退而用搜索摘要
       片段够长就不抓：国内站点大量 403，抓一次白等 15 秒 */
    if (text.length < 400 && snip.length < 600) {
      try { text = await fetchPageText(hit.url, perSourceChar); }
      catch (e) {
        done++;
        if (job) job.phase = `并行抓取正文（${done}/${list.length}）…`;
        if (snip.length >= 150) return { hit, text: snip, error: hit.url + ' → 页面抓不到（' + e.message + '），只用搜索摘要' };
        return { hit, error: hit.url + ' → ' + e.message };
      }
    }
    done++;
    if (job) job.phase = `并行抓取正文（${done}/${list.length}）…`;
    return { hit, text };
  });

  const materials = [];
  const sources = [];
  let total = 0;
  for (const r of fetched) {
    if (r.error) errors.push(r.error);
    if (!r.text || r.text.length < 150) { if (!r.error) errors.push(r.hit.url + ' → 正文太短'); continue; }
    if (total >= totalChar) break;
    const room = Math.min(perSourceChar, totalChar - total);
    const sliced = r.text.slice(0, room);
    total += sliced.length;
    materials.push({ name: r.hit.title || r.hit.url, url: r.hit.url, text: sliced });
    /* date：来源发布时间，供体检判断来源是否过旧（WSA 带，其它源可能空） */
    sources.push({ title: r.hit.title || r.hit.url, url: r.hit.url, date: r.hit.date || '', chars: sliced.length });
  }
  if (!materials.length) {
    throw Error('搜到了 ' + list.length + ' 条结果，但没有一篇抓得到正文。' + (errors.length ? '第一处失败：' + errors[0] : ''));
  }
  return { materials, sources, errors, total, provider };
}

module.exports = { PROVIDERS, DEFAULT_PROVIDER, searchWeb, fetchPageText, htmlToText, isPublicUrl, research };
