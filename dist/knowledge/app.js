'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const LABEL = { single: '单选', multi: '多选', order: '排序', sort: '分类', pair: '连线', numeric: '数值' };
const ORDER = ['single', 'multi', 'order', 'sort', 'pair', 'numeric'];
/* 默认配比（每 100 题的题数），和服务端 questions.cjs 的 TARGET_MIX 保持一致 */
const MIX = { single: 62, multi: 15, order: 5, sort: 5, pair: 5, numeric: 8 };
/* 重题型：数量大时输出容易截断，加题时按小批跑 */
const HEAVY = { order: 1, sort: 1, pair: 1, numeric: 1, multi: 1, single: 1 };

const state = { pack: null, filter: 'all', view: 'type', quota: null, materialsFrom: '' };

/* ── 示例题库：六种题型各一条，用来先看形态 ── */
function demoPack() {
  const pack = {
    id: 'demo', title: '需求预测怎么落地（示例题库）', topic: '需求预测怎么落地',
    summary: '示例数据：同一批知识被拆成六种题型，方便对照形态。',
    outline: [
      { point: '数据口径一致性', gist: '历史记录与业务目标对得上，才谈得上预测。' },
      { point: '节省要算全成本', gist: '人工复核、修订、返工都要计入，否则省下来的是假钱。' },
      { point: '自动复核的判定链', gist: '读金额 → 比阈值 → 记动作，顺序不能换。' },
      { point: '有依据 vs 无依据', gist: '阈值来自规则文档，结论不能凭感觉。' },
      { point: '算法与模型的分工', gist: '算法是步骤，模型是步骤跑数据后的产物。' }
    ],
    demo: true,
    cards: [
      {
        id: 'd1', type: 'single', q: '做需求预测，第一步最该确认什么？',
        options: [
          { text: '先挑一个看起来最先进的模型', correct: false },
          { text: '历史记录是否与业务目标相关、口径一致', correct: true },
          { text: '只观察一次数据就下结论', correct: false }
        ],
        answer: '历史记录是否与业务目标相关、口径一致',
        wrong: ['先挑一个看起来最先进的模型', '只观察一次数据就下结论'],
        quote: '先确认历史记录与业务目标相关、口径一致', explain: '口径对不上，后面算得再精细也是错的。'
      },
      {
        id: 'd2', type: 'multi', q: '下面哪些属于「评估节省时必须算进去」的项？',
        options: [
          { text: '人工复核耗时', correct: true },
          { text: '返工与修订', correct: true },
          { text: '服务器风扇的噪音', correct: false },
          { text: '无关业务的闲聊时间', correct: false }
        ],
        answers: ['人工复核耗时', '返工与修订'],
        quote: '评估时应计入人工检查、修订和返工'
      },
      {
        id: 'd3', type: 'order', q: '把一次「自动复核」按依赖关系排好顺序。',
        steps: ['读取本笔订单金额', '和阈值比一比', '记下这一笔要不要复核'],
        shuffled: ['记下这一笔要不要复核', '读取本笔订单金额', '和阈值比一比'],
        quote: '先读取金额，再比较阈值，最后记录动作'
      },
      {
        id: 'd4', type: 'sort', q: '把这几件事分进正确的桶里。',
        categories: [
          { label: '有资料支撑', items: ['阈值来自业务规则文档', '复核耗时来自工时记录'] },
          { label: '没有资料支撑', items: ['模型一定比人工准', '上线当周就能回本'] }
        ],
        quote: ''
      },
      {
        id: 'd5', type: 'pair', q: '把左边的概念和右边的解释连起来。',
        pairs: [
          { left: '算法', right: '写下来的做事步骤，像菜谱' },
          { left: '模型', right: '照着方法用数据练出来的产物' },
          { left: '参数', right: '训练过程中学到的数值' }
        ],
        rightOrder: ['照着方法用数据练出来的产物', '训练过程中学到的数值', '写下来的做事步骤，像菜谱'],
        quote: '算法是步骤，模型是训练出来的产物'
      },
      {
        id: 'd6', type: 'numeric', q: '本日实际需求 3 件，预测备货 5 件，无期初库存。多备了几件？',
        numeric: { value: 2, unit: '件' }, formula: '5 − 3 = 2',
        quote: '预测备货 5 件，实际需求 3 件'
      }
    ]
  };
  /* 示例题也标上知识点，让「按知识点」视图一打开就有结构 */
  const points = { d1: '数据口径一致性', d2: '节省要算全成本', d3: '自动复核的判定链', d4: '有依据 vs 无依据', d5: '算法与模型的分工', d6: '节省要算全成本' };
  for (const c of pack.cards) c.point = points[c.id] || '';
  return pack;
}

/* ── 渲染 ── */
function counts(pack) {
  const out = { all: 0, single: 0, multi: 0, order: 0, sort: 0, pair: 0, numeric: 0 };
  for (const c of pack?.cards || []) { out.all++; if (out[c.type] != null) out[c.type]++; }
  return out;
}

function renderAll() {
  const pack = state.pack;
  window.WorkbenchLink?.updatePack(pack);
  $('empty').hidden = !!pack;
  renderStats(pack);
  renderPackBar(pack);
  renderFilters(pack);
  renderOutline(pack);
  renderSources(pack);
  renderGaps(pack);
  renderCards(pack);
  renderMeta(pack);
  renderAudit(pack);
}

/* 题库体检：把「会出问题的地方」列出来，替代人工逐条检查 */
async function renderAudit(pack) {
  const el = $('audit');
  if (!pack) { el.hidden = true; return; }
  try {
    const r = await fetch('/api/audit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pack.id ? { id: pack.id } : { pack })
    });
    const a = await r.json();
    if (!r.ok) { el.hidden = true; return; }
    el.hidden = false;
    const cls = s => s.score >= 85 ? 'ok' : s.score >= 60 ? 'warn' : 'bad';
    el.innerHTML = `<b class="score ${cls(a)}">体检 ${a.score} 分</b>
      <span>${a.counts.total} 题 · 无依据 ${a.counts.noQuote} · 无知识点 ${a.counts.noPoint} · 重复 ${a.counts.dupes} · 长题干 ${a.counts.longStem ?? 0} · 凑数项 ${a.counts.filler ?? 0}${a.hasSnapshot ? ' · 材料快照已存' : ''}</span>
      <ul>${a.issues.map(i => `<li class="${i.level}">${esc(i.message)}</li>`).join('')}</ul>`;
  } catch { el.hidden = true; }
}

/* 来源必须能点开：否则「联网取材」和「模型编造」在页面上看不出区别 */
function renderSources(pack) {
  const list = (pack?.sources || []).filter(s => s && s.url);
  $('sources').hidden = !list.length;
  if (!list.length) return;
  $('sources').innerHTML = `<b>联网来源（${list.length} 篇）</b>
    <ul>${list.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noreferrer noopener">${esc(s.title || s.url)}</a><span>${s.chars || ''}${s.chars ? ' 字' : ''}</span></li>`).join('')}</ul>`;
}

/* 资料缺口必须能把原话看到，只显示「N 条」用户不知道问题出在哪 */
function renderGaps(pack) {
  const list = (pack?.gaps || []).filter(Boolean);
  $('gaps').hidden = !list.length;
  if (!list.length) return;
  $('gaps').innerHTML = `<b>资料缺口 / 出题受限（${list.length}）</b><ul>${list.map(g => `<li>${esc(g)}</li>`).join('')}</ul>`;
}

/* 统计块上加「＋ / －」：直接按题型补题、按题型删题，不用回左边重新生成整库 */
function renderStats(pack) {
  const n = counts(pack);
  $('stats').innerHTML = ORDER.map(k => `<div class="stat${n[k] ? '' : ' zero'}">
    <b>${n[k] || 0}</b><small>${LABEL[k]}</small>
    <span class="stat-ops">
      <button data-addtype="${k}" title="再补几道${LABEL[k]}">＋</button>
      <button data-cuttype="${k}" class="cut" title="删掉几道${LABEL[k]}">－</button>
    </span>
  </div>`).join('');
  document.querySelectorAll('[data-addtype]').forEach(el => el.onclick = () => addByType(el.dataset.addtype));
  document.querySelectorAll('[data-cuttype]').forEach(el => el.onclick = () => cutByType(el.dataset.cuttype));
}

function renderPackBar(pack) {
  $('packBar').hidden = !pack;
  if (!pack) return;
  $('packTitle').textContent = pack.title || '未命名题库';
  $('packSummary').textContent = pack.summary || '';
  $('packSummary').hidden = !pack.summary;
}

/* 知识骨架：把散题收成「知识点 → 题」两层，先看骨架再看题 */
function renderOutline(pack) {
  const groups = pack ? groupCards(pack) : [];
  if (!pack || !groups.filter(g => !g.loose).length) { $('outline').hidden = true; return; }
  $('outline').hidden = false;
  $('outline').innerHTML = `<div class="outline-head"><b>知识骨架</b><span>${groups.filter(g => !g.loose).length} 个知识点 / ${pack.cards.length} 道题</span></div>
    <ol class="outline-list">${groups.map(g => `<li${g.loose ? ' class="loose"' : ''}>
      <span class="p">${esc(g.point)}</span>
      ${g.gist ? `<em>${esc(g.gist)}</em>` : ''}
      <span class="n">${g.cards.length} 题</span>
    </li>`).join('')}</ol>`;
}

function renderFilters(pack) {
  const n = counts(pack);
  const items = [['all', '全部'], ...ORDER.map(k => [k, LABEL[k]])];
  $('filters').innerHTML = items.map(([k, label]) => `<button class="chip${state.filter === k ? ' on' : ''}" data-f="${k}">${label}<span class="n">${n[k] || 0}</span></button>`).join('');
  document.querySelectorAll('[data-f]').forEach(el => el.onclick = () => { state.filter = el.dataset.f; renderFilters(pack); renderCards(pack); });
}

function renderMeta(pack) {
  if (!pack) { $('meta').textContent = ''; $('savePack').hidden = true; return; }
  const parts = [`共 ${pack.cards.length} 题`];
  if (pack.demo) parts.push('示例数据');
  if (pack.gaps?.length) parts.push(`资料缺口 ${pack.gaps.length} 条`);
  if (pack.dropped?.length) parts.push(`丢弃 ${pack.dropped.length} 条`);
  $('meta').textContent = parts.join(' · ');
  $('savePack').hidden = !!pack.saved;
}

/* 按知识点分组：优先用题库自带的 outline 顺序，没有就用题干里出现的顺序 */
function groupCards(pack) {
  const order = (pack.outline || []).map(o => o.point).filter(Boolean);
  const gist = new Map((pack.outline || []).map(o => [o.point, o.gist || '']));
  const map = new Map();
  for (const p of order) map.set(p, { point: p, gist: gist.get(p) || '', cards: [] });
  const loose = [];
  for (const c of pack.cards || []) {
    const p = String(c.point || '').trim();
    if (!p) { loose.push(c); continue; }
    if (!map.has(p)) map.set(p, { point: p, gist: '', cards: [] });
    map.get(p).cards.push(c);
  }
  const list = [...map.values()].filter(g => g.cards.length);
  if (loose.length) list.push({ point: '未归类', gist: '模型没标知识点的题，建议补标或删掉', cards: loose, loose: true });
  return list;
}

$('savePack').onclick = async () => {
  const pack = state.pack;
  if (!pack) return;
  $('savePack').disabled = true;
  try {
    const r = await fetch('/api/library', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: pack.title, topic: pack.topic, summary: pack.summary, cards: pack.cards, outline: pack.outline, sources: pack.sources, gaps: pack.gaps })
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error || '保存失败');
    pack.saved = true;
    pack.id = d.pack.id;
    $('savePack').hidden = true;
    setStatus('已保存到 知识库/library/：' + d.pack.id, 'good');
    refreshLibrary();
  } catch (e) { setStatus(e.message, 'bad'); }
  finally { $('savePack').disabled = false; }
};

/* 已保存的题库改了就回写；没保存的只留在内存，等用户点「保存到题库」 */
async function persist(pack) {
  if (!pack?.saved || !pack.id) return;
  const r = await fetch('/api/library/' + encodeURIComponent(pack.id), {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: pack.title, summary: pack.summary, cards: pack.cards, outline: pack.outline })
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || '保存失败');
  pack.byType = d.pack.byType;
  pack.outline = d.pack.outline;
}

/* ── 重命名 ── */
async function renameCurrent() {
  const pack = state.pack;
  if (!pack) return;
  const next = prompt('新的题库名（最多 80 字）', pack.title || '');
  if (next == null) return;
  const title = next.trim();
  if (!title) { setStatus('题库名不能为空。', 'bad'); return; }
  pack.title = title.slice(0, 80);
  renderPackBar(pack);
  try { await persist(pack); setStatus('已改名为：' + pack.title, 'good'); refreshLibrary(); }
  catch (e) { setStatus(e.message, 'bad'); }
}
$('renamePack').onclick = renameCurrent;

/* 题库列表里的重命名：不用先打开，直接改盘上的名字 */
async function renameSaved(id) {
  const next = prompt('新的题库名（最多 80 字）');
  if (next == null) return;
  const title = next.trim();
  if (!title) { setStatus('题库名不能为空。', 'bad'); return; }
  try {
    const r = await fetch('/api/library/' + encodeURIComponent(id), {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error || '重命名失败');
    if (state.pack?.id === id) { state.pack.title = d.pack.title; renderPackBar(state.pack); }
    setStatus('已改名为：' + d.pack.title, 'good');
    refreshLibrary();
  } catch (e) { setStatus(e.message, 'bad'); }
}

/* ── 单题删除 ── */
async function deleteCard(id) {
  const pack = state.pack;
  if (!pack) return;
  const card = pack.cards.find(c => c.id === id);
  if (!card) return;
  if (pack.cards.length <= 1) { setStatus('只剩一道题了，要清空请删除整份题库。', 'bad'); return; }
  if (!confirm('删除这道题？\n\n' + String(card.q).slice(0, 60))) return;
  pack.cards = pack.cards.filter(c => c.id !== id);
  renderAll();
  try { await persist(pack); refreshLibrary(); setStatus('已删除 1 题，现共 ' + pack.cards.length + ' 题。', 'good'); }
  catch (e) { setStatus(e.message, 'bad'); }
}

function renderCards(pack) {
  if (!pack) { $('cards').innerHTML = ''; return; }
  const list = state.filter === 'all' ? pack.cards : pack.cards.filter(c => c.type === state.filter);
  if (!list.length) {
    $('cards').innerHTML = '<div class="empty"><p>这种题型还没有题。</p><p class="muted">点左侧统计块上对应题型的「＋」补几道。</p></div>';
    return;
  }
  if (state.view === 'point') {
    const groups = groupCards(pack).map(g => ({ ...g, cards: g.cards.filter(c => state.filter === 'all' || c.type === state.filter) })).filter(g => g.cards.length);
    $('cards').innerHTML = groups.map(g => `<section class="point-block${g.loose ? ' loose' : ''}">
      <header class="point-head"><span class="p">${esc(g.point)}</span>${g.gist ? `<em>${esc(g.gist)}</em>` : ''}<span class="n">${g.cards.length} 题</span></header>
      ${g.cards.map(cardHtml).join('')}
    </section>`).join('');
  } else {
    $('cards').innerHTML = list.map(cardHtml).join('');
  }
  bindPreviews();
  document.querySelectorAll('[data-delcard]').forEach(el => el.onclick = () => deleteCard(el.dataset.delcard));
}

function cardHtml(c) {
  const body = c.type === 'single' ? singleHtml(c)
    : c.type === 'multi' ? multiHtml(c)
      : c.type === 'order' ? orderHtml(c)
        : c.type === 'sort' ? sortHtml(c)
          : c.type === 'pair' ? pairHtml(c)
            : c.type === 'numeric' ? numericHtml(c) : '<p class="muted">未知题型</p>';
  const foot = [
    c.quote ? `<span>原文依据</span><em class="quote">${esc(c.quote)}</em>` : '',
    c.explain ? `<span>解释：${esc(c.explain)}</span>` : '',
    c.volatile ? '<span class="badge-warn">时效题 · 依赖时点数据</span>' : '',
    !c.quote ? '<span class="badge-warn">无资料依据</span>' : ''
  ].filter(Boolean).join('');
  return `<article class="card">
    <div class="card-head">
      <span class="tag ${c.type}">${LABEL[c.type] || c.type}</span>
      <div class="q">${esc(c.q)}</div>
      <button class="card-del" data-delcard="${esc(c.id)}" title="删除这道题">×</button>
    </div>
    ${c.point ? `<p class="card-point">知识点：${esc(c.point)}</p>` : ''}
    ${body}
    ${foot ? `<div class="card-foot">${foot}</div>` : ''}
  </article>`;
}

function singleHtml(c) {
  return `<div class="options">${(c.options || []).map((o, i) => `<div class="opt${o.correct ? ' correct' : ''}" data-pick="${i}">
    <span class="mark">${o.correct ? '✓' : ''}</span>${esc(o.text)}</div>`).join('')}</div>
    <p class="steps-note">游戏里：点一下立即判定，答错扣信任值并给一次重想。</p>`;
}

function multiHtml(c) {
  return `<div class="options">${(c.options || []).map((o, i) => `<div class="opt${o.correct ? ' correct' : ''}" data-pick="${i}">
    <span class="mark">${o.correct ? '✓' : ''}</span>${esc(o.text)}</div>`).join('')}</div>
    <p class="steps-note">游戏里：勾选后一起提交，漏选或多选都算错。</p>`;
}

function orderHtml(c) {
  return `<ol class="steps">${(c.steps || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    <p class="steps-note">游戏里会打乱成：${(c.shuffled || []).map(esc).join(' → ')}</p>`;
}

function sortHtml(c) {
  return `<div class="buckets">${(c.categories || []).map(b => `<div class="bucket">
    <h4>${esc(b.label)}</h4>
    <div class="items">${(b.items || []).map(i => `<span>${esc(i)}</span>`).join('')}</div>
  </div>`).join('')}</div>
  <p class="steps-note">游戏里：把条目拖进对应的桶。</p>`;
}

function pairHtml(c) {
  const pairs = c.pairs || [];
  return `<div class="pairs">
    <div class="col left">${pairs.map((p, i) => `<div class="cell"><i>${i + 1}</i>${esc(p.left)}</div>`).join('')}</div>
    <div class="col right">${pairs.map((p, i) => `<div class="cell"><i>${i + 1}</i>${esc(p.right)}</div>`).join('')}</div>
  </div><p class="steps-note">游戏里：右列会打乱，编号即正确配对。</p>`;
}

function numericHtml(c) {
  return `<div class="numeric">
    <input type="text" inputmode="decimal" placeholder="填数字" aria-label="答案">
    <span class="unit">${esc(c.numeric?.unit || '个')}</span>
    <span class="formula">${esc(c.formula || '')}</span>
    <span class="muted">（正确答案：${esc(c.numeric?.value)} ${esc(c.numeric?.unit || '')}）</span>
  </div>`;
}

/* 选项点击只做本地视觉反馈，不发请求 */
function bindPreviews() {
  document.querySelectorAll('[data-pick]').forEach(el => el.onclick = () => {
    const card = el.closest('.card');
    if (card?.querySelector('.tag')?.classList.contains('single')) card.querySelectorAll('[data-pick]').forEach(o => o.classList.remove('picked'));
    el.classList.toggle('picked');
  });
}

/* ── API 配置 ── */
async function refreshApi() {
  try {
    const r = await fetch('/api/config');
    const c = await r.json();
    const el = $('apiState');
    if (c.configured) { el.className = 'api-state ok'; el.textContent = '本页 API · ' + c.model; }
    else { el.className = 'api-state bad'; el.textContent = '未配置模型'; }
    if (c.model) $('apiModel').value = c.model;
    if (c.service && !$('apiBaseUrl').value) $('apiBaseUrl').value = c.service;
  } catch {
    const el = $('apiState'); el.className = 'api-state bad';
    el.textContent = '未连到本地服务';
  }
}

$('toggleApi').onclick = () => { $('apiPanel').hidden = !$('apiPanel').hidden; };
$('saveApi').onclick = async () => {
  const baseUrl = $('apiBaseUrl').value.trim(), model = $('apiModel').value.trim(), apiKey = $('apiKey').value.trim();
  if (!baseUrl || !model || !apiKey) { setStatus('接口地址、模型名称、密钥都要填。', 'bad'); return; }
  $('saveApi').disabled = true;
  try {
    const r = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl, model, apiKey }) });
    const d = await r.json();
    if (!r.ok) throw Error(d.error || '保存失败');
    $('apiKey').value = '';
    setStatus('已保存到本机，可以生成题库了。', 'good');
    refreshApi();
  } catch (e) { setStatus(e.message, 'bad'); }
  finally { $('saveApi').disabled = false; }
};
$('clearApi').onclick = async () => {
  try { await fetch('/api/config', { method: 'DELETE' }); setStatus('已清除模型配置。'); refreshApi(); }
  catch (e) { setStatus(e.message, 'bad'); }
};

/* ── 联网搜索配置 ── */
let searchMeta = { providers: [], provider: 'tavily', configured: false, needsKey: true };

async function refreshSearch() {
  try {
    const r = await fetch('/api/search-config');
    const d = await r.json();
    searchMeta = d;
    $('searchProvider').innerHTML = (d.providers || []).map(p =>
      `<option value="${p.key}"${p.key === d.provider ? ' selected' : ''}>${esc(p.label)}</option>`).join('');
    const meta = (d.providers || []).find(p => p.key === d.provider) || {};
    $('searchKey').disabled = !meta.needsKey;
    $('searchKey').placeholder = meta.needsKey ? '填这家服务的密钥' : '这个服务不需要密钥';
    const hint = $('searchHint');
    if (d.configured) {
      hint.className = 'hint';
      hint.textContent = `联网搜索已就绪 · ${meta.label || d.provider}` + (meta.needsKey ? '（密钥已存本机）' : '');
    } else {
      hint.className = 'hint bad';
      hint.textContent = '未配置搜索：没有材料时无法出题。Tavily / Serper 都有免费额度，填个 key 即可。';
    }
  } catch {
    $('searchHint').className = 'hint bad';
    $('searchHint').textContent = '未连到本地服务。';
  }
}

$('searchProvider').onchange = () => {
  const meta = (searchMeta.providers || []).find(p => p.key === $('searchProvider').value) || {};
  $('searchKey').disabled = !meta.needsKey;
  $('searchKey').placeholder = meta.needsKey ? '填这家服务的密钥' : '这个服务不需要密钥';
  if (meta.apply) $('searchHint').className = 'hint';
};

$('saveSearch').onclick = async () => {
  const provider = $('searchProvider').value;
  const apiKey = $('searchKey').value.trim();
  const meta = (searchMeta.providers || []).find(p => p.key === provider) || {};
  if (meta.needsKey && !apiKey) { setStatus('这家搜索服务需要密钥。', 'bad'); return; }
  $('saveSearch').disabled = true;
  try {
    const r = await fetch('/api/search-config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, apiKey })
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error || '保存失败');
    $('searchKey').value = '';
    setStatus('联网搜索已保存，可以不用粘贴材料直接出题了。', 'good');
    refreshSearch();
  } catch (e) { setStatus(e.message, 'bad'); }
  finally { $('saveSearch').disabled = false; }
};

$('clearSearch').onclick = async () => {
  try { await fetch('/api/search-config', { method: 'DELETE' }); setStatus('已清除搜索配置。'); refreshSearch(); }
  catch (e) { setStatus(e.message, 'bad'); }
};

/* 手动取材：搜一遍、抓正文、填进材料框（填了之后出题就按这份材料来，不再重复搜） */
$('research').onclick = async () => {
  const topic = $('topic').value.trim();
  const query = $('searchQuery').value.trim() || topic;
  if (!query) { setStatus('先写课题，或填一个检索词。', 'bad'); return; }
  $('research').disabled = true;
  $('sourceHint').textContent = '检索并抓取正文…（约 10–30 秒）';
  try {
    const r = await fetch('/api/research', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, query, count: 5 })
    });
    const d = await r.json();
    if (!r.ok) { $('sourceHint').textContent = ''; setStatus(d.error || '取材失败', 'bad'); if (d.needSearch) $('apiPanel').hidden = false; return; }
    $('materials').value = d.materials.map((m, i) => `【来源 ${i + 1}】${m.name}\n${m.url}\n${m.text}`).join('\n\n');
    state.materialsFrom = query;   /* 记住这批正文是为哪个检索词抓的，换题材时要提醒 */
    $('sourceHint').textContent = `已取材 ${d.sources.length} 篇 / ${d.total} 字（${d.provider}）· 换题材请重新取材`;
    setStatus('已把网页正文填进材料框，可以先生成，也可以手动删掉不相关的段落。', 'good');
  } catch (e) { $('sourceHint').textContent = ''; setStatus(e.message, 'bad'); }
  finally { $('research').disabled = false; }
};

/* ── 生成 ── */
function setStatus(text, kind) { const el = $('status'); el.textContent = text; el.className = 'status' + (kind ? ' ' + kind : ''); }

/* 任务化：提交拿 jobId，轮询进度；服务端串行，不会自己把自己顶成 429 */
async function pollJob(jobId, t0) {
  for (;;) {
    await new Promise(r => setTimeout(r, 400));
    let d;
    try {
      const r = await fetch('/api/job?id=' + encodeURIComponent(jobId));
      d = await r.json();
      if (!r.ok) throw Error(d.error || '任务丢失');
    } catch (e) { setStatus(e.message, 'bad'); return null; }
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    if (d.status === 'running') {
      const prog = d.target ? ` · ${d.done}/${d.target} 题` : '';
      setStatus(`${d.phase || '生成中'}${prog} · 已 ${secs}s` + (d.retryIn ? `（${d.retryIn}s 后重试）` : ''));
      continue;
    }
    if (d.status === 'failed') { setStatus(d.error || '生成失败', 'bad'); return null; }
    return d;
  }
}

$('generate').onclick = async () => {
  const topic = $('topic').value.trim();
  const text = $('materials').value.trim();
  if (!topic && text.length < 20) { setStatus('写个课题（联网取材要用它检索），或粘贴至少 20 字的材料。', 'bad'); return; }
  const quick = $('quick').checked;
  const target = Math.max(1, Math.min(300, Number($('target').value) || 100));
  /* 换题材最常见的坑：材料框里还留着上一个题材抓来的正文，不清掉就会拿旧材料出题 */
  const nowQuery = $('searchQuery').value.trim() || topic;
  if (text && state.materialsFrom && state.materialsFrom !== nowQuery) {
    if (!confirm(`材料框里是「${state.materialsFrom}」抓来的正文，现在的课题是「${topic}」。\n\n继续用旧材料出题，题目会跑到上一个题材上去。\n\n点「确定」= 清空材料、按新课题重新联网取材；点「取消」= 就用现在这些材料。`)) {
      /* 用户坚持用旧材料，什么都不做 */
    } else {
      $('materials').value = '';
      state.materialsFrom = '';
      return $('generate').click();
    }
  }
  /* 没材料时先说清楚要联网取材（不联网出题会被服务端直接拒绝） */
  if (!text && !confirm(`没填材料，系统会先用课题「${topic}」联网检索、抓取网页正文，再依据它出题。\n\n检索 + 抓正文约 10–30 秒，然后开始出题。继续？`)) return;
  $('generate').disabled = true;
  setStatus(`提交中…目标 ${target} 题`);
  try {
    const materials = text ? [{ name: '粘贴材料', text }] : [];
    const payload = { topic, materials, quick, target, ...audiencePayload(), searchQuery: $('searchQuery').value.trim() || undefined };
    /* 只有用户手动改过题型数量才带上，否则交给服务端按默认配比走（快速模式才不会退化成全是单选） */
    if (state.quota) { payload.typeQuota = state.quota; payload.target = Object.values(state.quota).reduce((a, b) => a + b, 0); }
    const r = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(WorkbenchLink.withModel(payload)) });
    const d = await r.json();

    /* 422 + needSearch：没材料也没配搜索 —— 直接把配置面板摊开，别让用户猜 */
    if (r.status === 422 && d.needSearch) {
      $('apiPanel').hidden = false;
      setStatus(d.error, 'bad');
      return;
    }
    if (!r.ok) throw Error(d.error || '生成失败');

    /* 立刻返回：进度交给任务面板，用户可以继续提交第二条链路 */
    state.autoOpen = d.jobId;
    setStatus(`已提交${d.parallel ? '（最多同时跑 ' + d.parallel + ' 条）' : ''}，进度见上方任务列表`, 'good');
    startJobsPoll();
  } catch (e) { setStatus(e.message, 'bad'); }
  finally { $('generate').disabled = false; }
};

/* 受众映射：专业档不带年龄，儿童档换算成年龄区间 */
function audiencePayload() {
  const v = $('audience').value;
  if (v === 'pro') return { audience: 'pro' };
  const age = v === 'kid6-9' ? '6-9' : v === 'teen13' ? '13+' : '10-12';
  return { audience: 'kids', age };
}

/* ── 任务面板：多链路并行 + 暂停/继续/取消 ── */
let jobsTimer = null;

async function startJobsPoll() {
  if (jobsTimer) return;
  const tick = async () => {
    jobsTimer = null;
    let d = null;
    try { d = await (await fetch('/api/jobs')).json(); } catch { }
    if (d) {
      const list = d.jobs || [];
      renderJobs(d, list);
      const pending = list.filter(j => j.status === 'running' || j.status === 'queued');
      if (pending.length) { jobsTimer = setTimeout(tick, 1200); return; }
      /* 全部结束：刷新列表，并自动打开本次最后提交的那份 */
      refreshLibrary();
      const mine = list.find(j => j.id === state.autoOpen);
      if (mine) {
        state.autoOpen = '';
        if (mine.status === 'done' && mine.packId) await openPackId(mine.packId);
        else if (mine.status === 'failed') setStatus(mine.error || '任务失败', 'bad');
      }
    } else {
      jobsTimer = setTimeout(tick, 2000);
    }
  };
  tick();
}

function renderJobs(d, list) {
  $('jobs').hidden = !list.length;
  if (!list.length) return;
  const rows = list.slice().reverse().map(j => {
    const running = j.status === 'running';
    return `<div class="job-row ${j.status}">
      <span class="jt">${esc(j.topic || '(未命名)')}${j.audience === 'pro' ? ' <i class="tag-pro">专业</i>' : ''}</span>
      <span class="jp">${esc(j.phase || '')}${j.target ? ` · ${j.done}/${j.target}` : ''}</span>
      <span class="jo">
        ${running && !j.paused ? `<button class="act" data-job="pause" data-id="${j.id}" title="批次之间暂停">暂停</button>` : ''}
        ${j.paused ? `<button class="act" data-job="resume" data-id="${j.id}">继续</button>` : ''}
        ${(running || j.status === 'queued') ? `<button class="act danger" data-job="cancel" data-id="${j.id}">取消</button>` : ''}
        ${j.status === 'done' && j.packId ? `<button class="act" data-openjob="${j.packId}">打开</button>` : ''}
      </span>
    </div>`;
  }).join('');
  $('jobs').innerHTML = `<div class="jobs-head"><b>任务</b><span>并行 ${d.parallel} · 运行 ${d.active} · 排队 ${d.queued}</span></div>${rows}`;
  document.querySelectorAll('[data-job]').forEach(el => el.onclick = () => controlJob(el.dataset.id, el.dataset.job));
  document.querySelectorAll('[data-openjob]').forEach(el => el.onclick = () => openPackId(el.dataset.openjob));
}

async function controlJob(id, action) {
  try {
    await fetch('/api/job/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) });
    startJobsPoll();
  } catch (e) { setStatus(e.message, 'bad'); }
}

async function openPackId(id) {
  try {
    const r = await fetch('/api/library/' + encodeURIComponent(id));
    const d = await r.json();
    if (!r.ok) throw Error(d.error || '打开失败');
    state.pack = d.pack;
    state.pack.saved = true;
    state.filter = 'all';
    renderAll();
    setStatus('已打开：' + d.pack.title, 'good');
  } catch (e) { setStatus(e.message, 'bad'); }
}

/* 往已有题库里补题：保留原题，只追加新题（服务端按题干去重） */
async function appendToPack(id) {
  const extra = Math.max(1, Math.min(100, Number(prompt('再补多少道？（同一课题，去重后追加；左侧「材料」里的内容会一起送进去）', '20')) || 20));
  $('generate').disabled = true;
  const t0 = Date.now();
  const text = $('materials').value.trim();
  setStatus(`给题库补 ${extra} 题…` + (text ? '（带上左侧材料）' : '（只用原课题，容易撞重复）'));
  try {
    const r = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(WorkbenchLink.withModel({ appendTo: id, target: extra, topic: $('topic').value.trim(), materials: text ? [{ name: '补充材料', text }] : [], audience: state.pack?.audience || audiencePayload().audience })) });
    const d = await r.json();
    if (!r.ok) throw Error(d.error || '补题失败');
    const done = await pollJob(d.jobId, t0);
    if (!done) return;
    done.pack.saved = true;
    state.pack = done.pack; state.filter = 'all';
    renderAll(); refreshLibrary();
    if (done.warning) { setStatus(done.warning, 'bad'); return; }
    setStatus(`补题完成 · 现共 ${done.pack.cards.length} 题 · ${((Date.now() - t0) / 1000).toFixed(1)}s`, 'good');
  } catch (e) { setStatus(e.message, 'bad'); }
  finally { $('generate').disabled = false; }
}

/* ── 按题型加题 / 减题 ── */
async function ensureSaved(pack) {
  if (pack.saved && pack.id) return pack;
  const r = await fetch('/api/library', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: pack.title, topic: pack.topic, summary: pack.summary, cards: pack.cards, outline: pack.outline, sources: pack.sources, gaps: pack.gaps })
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || '保存失败');
  pack.id = d.pack.id;
  pack.saved = true;
  $('savePack').hidden = true;
  return pack;
}

async function addByType(type) {
  const pack = state.pack;
  if (!pack) { setStatus('先点左侧「生成题库」，或右上「载入示例题库」看形态。', 'bad'); return; }
  const cur = counts(pack)[type] || 0;
  const raw = prompt(`再补几道「${LABEL[type]}」题？\n现在 ${cur} 道。左侧「材料」里的内容会一起送进去，不填容易撞重复。`, '5');
  if (raw == null) return;
  const n = Math.max(1, Math.min(50, Math.round(Number(raw) || 0)));
  if (!n) return;
  $('generate').disabled = true;
  const t0 = Date.now();
  const text = $('materials').value.trim();
  setStatus(`补 ${n} 道${LABEL[type]}…`);
  try {
    /* 示例题库要先落盘才能追加；示例标记一并去掉，免得存成一份「示例」 */
    if (pack.demo) { pack.demo = false; pack.title = String(pack.title).replace(/（示例题库）$/, ''); pack.saved = false; pack.id = ''; }
    await ensureSaved(pack);
    const r = await fetch('/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(WorkbenchLink.withModel({ appendTo: pack.id, onlyType: type, target: n, topic: $('topic').value.trim() || pack.topic, materials: text ? [{ name: '补充材料', text }] : [], audience: pack.audience || audiencePayload().audience }))
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error || '补题失败');
    const done = await pollJob(d.jobId, t0);
    if (!done) return;
    done.pack.saved = true;
    state.pack = done.pack;
    renderAll(); refreshLibrary();
    if (done.warning) { setStatus(done.warning, 'bad'); return; }
    const gained = (done.pack.byType?.[type] || 0) - cur;
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    setStatus(gained > 0
      ? `${LABEL[type]} +${gained} · 现共 ${done.pack.cards.length} 题 · ${secs}s`
      : `没有新增${LABEL[type]}题：这份材料能出的已经出完了，换份材料再试。`, gained > 0 ? 'good' : 'bad');
  } catch (e) { setStatus(e.message, 'bad'); }
  finally { $('generate').disabled = false; }
}

async function cutByType(type) {
  const pack = state.pack;
  if (!pack) { setStatus('先打开一份题库。', 'bad'); return; }
  const list = pack.cards.filter(c => c.type === type);
  if (!list.length) { setStatus(`这份题库里没有${LABEL[type]}题。`, 'bad'); return; }
  const raw = prompt(`删掉几道「${LABEL[type]}」题？\n现在 ${list.length} 道，从最后一道往回删。`, String(Math.min(5, list.length)));
  if (raw == null) return;
  const n = Math.max(1, Math.min(list.length, Math.round(Number(raw) || 0)));
  if (!n) return;
  if (pack.cards.length - n < 1) { setStatus('不能把题库删空，想清空请删整份题库。', 'bad'); return; }
  if (!confirm(`确认删除 ${n} 道${LABEL[type]}？\n\n` + list.slice(-n).map(c => '· ' + String(c.q).slice(0, 40)).join('\n'))) return;
  const doomed = new Set(list.slice(-n).map(c => c.id));
  pack.cards = pack.cards.filter(c => !doomed.has(c.id));
  renderAll();
  try { await persist(pack); refreshLibrary(); setStatus(`已删 ${n} 道${LABEL[type]}，现共 ${pack.cards.length} 题。`, 'good'); }
  catch (e) { setStatus(e.message, 'bad'); }
}

/* ── 题型数量 ── */
function planFromMix(total) {
  const weight = Object.values(MIX).reduce((a, b) => a + b, 0);
  const plan = {};
  let assigned = 0;
  for (const k of ORDER) { plan[k] = Math.floor(total * MIX[k] / weight); assigned += plan[k]; }
  plan.single += total - assigned;
  return plan;
}

function readQuota() {
  return ORDER.reduce((a, k) => a + Math.max(0, Math.round(Number(document.querySelector(`[data-q="${k}"]`)?.value) || 0)), 0);
}

function renderQuota() {
  const total = Math.max(1, Math.min(300, Number($('target').value) || 100));
  const plan = state.quota || planFromMix(total);
  $('quota').innerHTML = ORDER.map(k => `<label class="quota-row"><span>${LABEL[k]}</span>
    <input type="number" min="0" max="300" step="1" data-q="${k}" value="${plan[k] || 0}">
    <small>${state.quota ? '自定' : '默认'}</small></label>`).join('');
  $('quotaTotal').textContent = readQuota();
  document.querySelectorAll('[data-q]').forEach(el => el.onchange = () => {
    const next = {};
    document.querySelectorAll('[data-q]').forEach(x => { next[x.dataset.q] = Math.max(0, Math.min(300, Math.round(Number(x.value) || 0))); });
    if (!ORDER.reduce((a, k) => a + next[k], 0)) { setStatus('题型数量不能全是 0。', 'bad'); state.quota = null; renderQuota(); return; }
    state.quota = next;
    $('target').value = ORDER.reduce((a, k) => a + next[k], 0);
    renderQuota();
  });
}

$('target').onchange = () => { state.quota = null; renderQuota(); };
$('quotaReset').onclick = () => { state.quota = null; renderQuota(); setStatus('题型数量已回到默认配比。', 'good'); };

$('loadDemo').onclick = () => {
  state.pack = demoPack(); state.filter = 'all'; state.view = 'point';
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === 'point'));
  renderAll();
  setStatus('已载入示例题库：六种题型各一条，已切到「按知识点」视图。', 'good');
};

/* ── 题库列表 ── */
async function refreshLibrary() {
  try {
    const r = await fetch('/api/library');
    const d = await r.json();
    const packs = d.packs || [];
    $('library').innerHTML = packs.length
      ? packs.map(p => `<div class="lib-item"><span class="t"><b>${esc(p.title)}</b><small>${p.total} 题 · ${p.points || 0} 知识点 · ${Object.entries(p.byType || {}).map(([k, v]) => LABEL[k] + v).join(' ')} · ${new Date(p.createdAt).toLocaleDateString('zh-CN')}</small></span><button class="act" data-rename="${p.id}" title="重命名">✎</button><button class="act" data-append="${p.id}" title="补题">＋</button><button class="act" data-open="${p.id}" title="打开">↗</button><button class="act danger" data-del="${p.id}" title="删除">×</button></div>`).join('')
      : '<p class="muted" style="margin:0">还没有保存的题库。</p>';
    document.querySelectorAll('[data-open]').forEach(el => el.onclick = async () => {
      const r2 = await fetch('/api/library/' + el.dataset.open);
      const d2 = await r2.json();
      if (!r2.ok) return setStatus(d2.error, 'bad');
      state.pack = d2.pack; state.pack.saved = true; state.filter = 'all';
      renderAll();
      setStatus('已打开：' + d2.pack.title, 'good');
    });
    document.querySelectorAll('[data-rename]').forEach(el => el.onclick = () => renameSaved(el.dataset.rename));
    document.querySelectorAll('[data-append]').forEach(el => el.onclick = () => appendToPack(el.dataset.append));
    document.querySelectorAll('[data-del]').forEach(el => el.onclick = async () => {
      if (!confirm('删除这份题库？')) return;
      await fetch('/api/library/' + el.dataset.del, { method: 'DELETE' });
      refreshLibrary();
    });
  } catch { $('library').innerHTML = '<p class="muted" style="margin:0">未连到本地服务。</p>'; }
}

/* 视图切换：按题型 / 按知识点 */
document.querySelectorAll('[data-view]').forEach(el => el.onclick = () => {
  state.view = el.dataset.view;
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b === el));
  renderCards(state.pack);
});

WorkbenchLink.init();
refreshApi();
refreshSearch();
refreshLibrary();
renderQuota();
renderAll();
