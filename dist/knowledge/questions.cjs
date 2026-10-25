'use strict';
/* 题型规范：知识库这边只认这六种，每种都必须能被界面上「一眼看懂」，
   且都能一对一落到游戏里已有的交互（选择 / 多选 / 排序 / 分桶 / 连线 / 填数）。 */

const TYPES = [
  {
    key: 'single', label: '单选', pick: 'match',
    desc: '一句话问题 + 一个正确答案 + 两个同类干扰项。',
    when: '定义、辨析、单点事实。产量最高，兜底都用它。',
    fields: ['q', 'answer', 'wrong[]']
  },
  {
    key: 'multi', label: '多选', pick: 'multi',
    desc: '一个正确答案集合，漏选或多选都算错。',
    when: '并列条件、必做清单、组合要求。',
    fields: ['q', 'answers[]', 'wrong[]']
  },
  {
    key: 'order', label: '排序', pick: 'order',
    desc: '把打乱的步骤按依赖顺序排回去。',
    when: '流程、因果链、先后依赖。',
    fields: ['q', 'steps[]']
  },
  {
    key: 'sort', label: '分类', pick: 'sort',
    desc: '把若干条目丢进 2–3 个桶里。',
    when: '概念归属、适用与不适用、层级关系。',
    fields: ['q', 'categories[{label,items[]}]']
  },
  {
    key: 'pair', label: '连线', pick: 'pair',
    desc: '左右两列，一一配对。',
    when: '概念↔解释、工具↔用途、现象↔原因。',
    fields: ['q', 'pairs[{left,right}]']
  },
  {
    key: 'numeric', label: '数值', pick: 'roi',
    desc: '填一个数字（带单位）才能通过。',
    when: '公式、净收益、阈值、成本。',
    fields: ['q', 'numeric{value,unit}', 'formula']
  }
];

/* 配比按「每 100 题的题数」直接给权重，一眼能对上。
   重题型（order/sort/pair）结构复杂、生成最慢，压到各 5 道：
   实测它们的单题耗时约是单选的 3 倍，降配比是提速最直接的手段。 */
const TARGET_MIX = { single: 62, multi: 15, order: 5, sort: 5, pair: 5, numeric: 8 };

const typeLabel = key => (TYPES.find(t => t.key === key) || {}).label || key;

/* 把任意 {题型:数量} 收敛成六种题型的合法配额，负数和未知名一律丢掉。
   用户可以在页面上直接改每种题型要几道（加题 / 减题），所以这里必须能接外部配比。 */
function normalizeQuota(raw) {
  const plan = {};
  const keys = TYPES.map(t => t.key);
  for (const key of keys) plan[key] = 0;
  let total = 0;
  for (const key of keys) {
    const n = Math.round(Number(raw?.[key]));
    if (Number.isFinite(n) && n > 0) { plan[key] = Math.min(300, n); total += plan[key]; }
  }
  return { plan, total };
}

/* 按目标题量与配比算出每种题型要多少道（100 题时 single≈62）
   mix 可传外部配比（页面上的题型数量输入框），只认六种题型 */
function planQuota(target, mix = TARGET_MIX) {
  const clean = {};
  for (const t of TYPES) {
    const w = Number(mix?.[t.key]);
    clean[t.key] = Number.isFinite(w) && w > 0 ? w : 0;
  }
  const weight = Object.values(clean).reduce((a, b) => a + b, 0) || 1;
  const total = Math.max(1, Math.min(300, Number(target) || 100));
  const plan = {};
  let assigned = 0;
  for (const key of Object.keys(clean)) {
    plan[key] = Math.floor(total * clean[key] / weight);
    assigned += plan[key];
  }
  /* 余数补给「有配比且最不像重题型」的那个，通常就是单选，保证总数刚好 */
  const filler = Object.keys(clean).filter(k => clean[k] > 0)[0] || 'single';
  plan[filler] += total - assigned;
  return { total, plan };
}

/* 两个题算不算重复：去掉标点空白后比前 40 字 */
const dedupKey = card => String(card?.q || '').replace(/[\s\p{P}]/gu, '').slice(0, 40).toLowerCase();

function countTypes(cards) {
  const out = {};
  for (const c of cards || []) out[c.type] = (out[c.type] || 0) + 1;
  return out;
}

function buildSystemPrompt(quick = true, batch = null) {
  /* 没有材料是最容易被写坏的分支：把课题名当材料喂进去，模型会出「这份材料的课题叫什么」这类水题。
     这里明确改成「无材料模式」，允许通识出题但禁止假装引用，并禁掉必须有数据来源的数值题。 */
  const noMaterial = !!batch?.noMaterial;
  /* 受众分两档：儿童通识 vs 专业调查/认证。
     专业档不强制口语化，允许术语精确、题干承载条件与辨析——同一套流程服务两类用户。 */
  const pro = batch?.audience === 'pro';
  const audienceRules = pro ? [
    '3. 面向专业读者（岗位调查 / 认证 / 培训）：术语保持精确，不要为通俗改写专业概念；answer 不超过 120 字。',
    '   每道题要能判断"会不会做这件事"：定义与边界、分类归属、先后流程、条件判断、例外与取舍。',
    '   禁止把材料里的限定条件（比例、阈值、前置条件）省略掉，那会让题变成猜。',
    '4. 受众：专业/成人。题干 ≤ 60 字，选项可用专业术语，不要出现哄小孩的语气。',
  ] : [
    '3. 面向小朋友的通识学习题：用口语短句，多用"你"；一句只说一件事；answer 不超过 80 字。',
    '   禁止百科定义句（"是较广的领域，关注……"），禁止堆专业术语；术语要用生活比喻或"材料里叫它 X"的方式带出。',
    '   语气要像老师带着做练习，不是考试题库。',
    `4. 适合年龄：${batch?.age || '10-12'} 岁。`,
    batch?.age === '6-9'
      ? '   低龄段：题干 ≤ 25 字，一句只说一件事；选项都短（≤ 15 字）；不出现抽象词（口径、协同、迭代）；多用看得见摸得着的比喻。'
      : batch?.age === '13+'
        ? '   高龄段：可以出现因果链和简单推理，题干 ≤ 45 字；术语可用但仍要口语化。'
        : '   高年级段：题干 ≤ 35 字；可少量因果，但优先具体事实题。',
  ];
  const lines = [
    '你是题库编写员。把给定材料拆成知识点，并为每个知识点出题。',
    '',
    '【必须遵守】',
    '1. 只使用材料里的事实。不得补充材料以外的人名、数字、日期、结论。',
    noMaterial
      ? '2. 本次没有提供材料：可以依据公共常识与通行做法出题，但不要编造具体数字、人名、机构名、日期；quote 一律留空字符串，explain 里注明依据类型（通识/常识）。'
      : '2. 每道题必须带 quote：材料中的逐字片段（用于人工核对）。找不到合适原文就不要出这道题。',
    ...audienceRules,
    '5. 干扰项必须与正确答案同类同级，不能是"以上都不对""不知道"这类凑数项。',
    '6. 一道题只考一个点。不要为凑数把同一句话拆成两题。',
    '7. 每道题必须带 point：这道题考的知识点，4–12 字的名词短语（如"数据口径一致性"）。',
    '   同一批题里 point 必须复用：整批只允许 3–8 个 point，宁少不多。',
    '   同一句话换问法属于同一个 point；不要把一道题一个 point，那等于没有结构。',
    '8. 不得出现或讨论政治人物、政党、政府机构、选举、意识形态；不得包含色情、性暗示、暴力、武器或爆炸物制作、毒品。材料主体属于这些领域时，不要出题，在 gaps 里说明不适合收录。',
    ...(noMaterial ? ['9. 无材料时不要出 numeric 题型（数值必须有可核对的数据来源）；配额里若有 numeric，改用 order 或 single 顶替，并在 gaps 里说明。'] : []),
    '10. volatile 默认 false。只有当题目问"最新/当年/现在的数据"（如最新观测值、当年统计）才标 true；科学事实、历史事件、定义、原理一律 false，即使里面有年份或数字。',
    '',
    '【题型：只能用这六种，按 type 字段区分】',
    '- single：{"type":"single","point":"","q":"","answer":"","wrong":["",""]}',
    '- multi：{"type":"multi","point":"","q":"","answers":["",""],"wrong":[""]}',
    '- order：{"type":"order","point":"","q":"","steps":["第一步","第二步","第三步"]}  ← steps 按正确顺序给出',
    '- sort：{"type":"sort","point":"","q":"","categories":[{"label":"桶名","items":["条目"]}]}',
    '- pair：{"type":"pair","point":"","q":"","pairs":[{"left":"","right":""}]}',
    '- numeric：{"type":"numeric","point":"","q":"","numeric":{"value":3,"unit":"件"},"formula":"计算式说明"}',
    '',
    batch
      ? `【这一批的数量与题型】只出 ${batch.size} 道：` + Object.entries(batch.plan).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n} 道`).join('、') + '。严格按这个题型清单出，不要多出其它题型。材料确实支撑不了某个题型时，可以用 single 顶替，但要在 gaps 里说明原因。'
      : quick
        ? '【配比与数量】只出 3 道：2 道 single + 1 道最能体现流程的 order 或 multi。材料不够就少出，不要凑，宁可 2 道。'
        : '【配比与数量】出 6–8 道：以 single 为主；multi / order / sort / pair / numeric 按材料齐全程度各出 1 道。',
    '',
    '只输出 JSON，不要解释：',
    '{"title":"课题","summary":"一句话说明这批题回答了什么","outline":[{"point":"知识点","gist":"一句话说明"}],"cards":[{...}],"gaps":["材料不足的点"]}',
    'outline 是本批的骨架：按学习顺序列出这几个知识点，每点一句话，不要和 cards 里的 point 脱节。'
  ];
  if (batch?.avoid?.length) {
    lines.push('', '【已有题目，严禁重复出】下面这些题已经收录，不要用相同或近似的问法再出一遍：');
    /* 只带最近 15 条：全量带会让 prompt 过长、输出被截断 */
    for (const q of batch.avoid.slice(-15)) lines.push('- ' + q);
  }
  /* 绑死知识点：这一批只考一个点，point 一字不差地照抄 */
  if (batch?.point) {
    lines.push('', `【本批只考这一个知识点】${batch.point}`,
      `本批所有题的 point 必须一字不差填「${batch.point}」，不要改写成近义词，不要引入其它知识点。`);
  } else if (batch?.points?.length) {
    /* 兜底：没定出骨架时，至少把已有点带进去，压住各批乱起名 */
    lines.push('', '【已有知识点，必须优先复用】这份题库已经有下面这些 point：');
    for (const p of batch.points.slice(-24)) lines.push('- ' + p);
    lines.push('能归到上面任何一个点的题，point 必须用原来的词，不要换个说法另立新点。',
      '本批最多新增 2 个 point，用来装确实归不进去的新内容。');
  }
  return lines.join('\n');
}

/* ── 第一步：先拆骨架，再按骨架出题 ──
   实测：不先定骨架时，9 批会各自起一套 point 名，30 题散成 18–20 个点，
   骨架形同虚设。所以先让模型只做「拆知识点」这一件事，后续每批绑一个点。 */
function buildOutlineSystem(audience = 'kids') {
  const pro = audience === 'pro';
  return [
    `你是课程设计员。只做一件事：把材料拆成 ${pro ? '6–10' : '6–8'} 个知识点，按学习顺序排列。`,
    '',
    '【规则】',
    '1. 只拆材料里真实存在的内容，不补充材料以外的事实。',
    pro
      ? '2. 材料如果是能力框架/考纲（含"内容领域 / 任务 / 技能"层级），就按它自己的层级拆：一个知识点对应一组同类任务或技能，point 保留材料里的专业用词。'
      : '2. 每个 point 4–12 字，名词短语，能一眼核对（如「数据口径一致性」）。',
    `3. 必须 ${pro ? '6–10' : '6–8'} 个，少于 ${pro ? 6 : 6} 个视为不合格：材料里往往还有没被切出来的部分，再找。`,
    '   覆盖材料主要内容；近义词不要拆成两个点。',
    '4. 每个点给 gist（一句话说明）和 types（最适合考它的 1–3 种题型，取值 single/multi/order/sort/pair/numeric）。',
    '   材料里有数字、公式、阈值时，才允许出现 numeric。',
    '',
    '只输出 JSON，不要解释：',
    '{"outline":[{"point":"","gist":"","types":["single"]}]}'
  ].join('\n');
}

function buildUserPrompt(topic, materials, batch = null) {
  const blocks = (materials || []).map((m, i) => `[材料 ${i + 1}] ${m.name || ''}\n${String(m.text || '').slice(0, 12000)}`).join('\n\n');
  const focus = batch?.focus ? `\n\n本批侧重：${batch.focus}` : '';
  return `课题：${topic || '（未命名）'}${focus}\n\n${blocks || '（没有提供材料，只能依据课题本身出题，并在 gaps 里说明哪些点没有资料支撑）'}`;
}

const str = v => String(v ?? '').trim();
const clip = (v, n) => str(v).slice(0, n);

/* 把模型输出收敛成题库卡：类型不认识或字段不全的直接丢弃，并记录原因 */
function normalizeCards(raw) {
  const cards = [];
  const dropped = [];
  /* 模型偶尔把 cards 写成 questions／items／data，这里统一接住 */
  const list = Array.isArray(raw?.cards) ? raw.cards
    : Array.isArray(raw?.questions) ? raw.questions
      : Array.isArray(raw?.items) ? raw.items
        : Array.isArray(raw?.data) ? raw.data
          : Array.isArray(raw) ? raw : [];
  if (!list.length) dropped.push({ reason: '模型没给 cards 数组（顶层键：' + Object.keys(raw || {}).join(',') + '）', type: '' });
  for (const c of list) {
    const type = str(c?.type).toLowerCase();
    const q = clip(c?.q, 200);
    if (!q) { dropped.push({ reason: '缺题干', type }); continue; }
    const quote = clip(c?.quote, 400);
    /* 通识学习系统，小朋友题材：volatile 只认模型显式标注，不再用年份/价格正则猜。
       否则「1916 年史瓦西」「光速 30 万公里」这类科普事实会被误标成时效题。 */
    const volatile = c?.volatile === true;
    const base = { id: 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), type, point: clip(c?.point ?? c?.concept ?? c?.knowledge, 40), q, quote, explain: clip(c?.explain, 300), volatile };

    if (type === 'single') {
      const answer = clip(c?.answer, 300), wrong = (c?.wrong || []).map(x => clip(x, 300)).filter(Boolean).slice(0, 3);
      if (!answer) { dropped.push({ reason: '单选缺答案', q }); continue; }
      if (!wrong.length) { dropped.push({ reason: '单选缺干扰项', q }); continue; }
      const options = [{ text: answer, correct: true }, ...wrong.map(t => ({ text: t, correct: false }))];
      cards.push({ ...base, options: shuffle(options), answer, wrong });
      continue;
    }
    if (type === 'multi') {
      const answers = (c?.answers || []).map(x => clip(x, 300)).filter(Boolean);
      const wrong = (c?.wrong || []).map(x => clip(x, 300)).filter(Boolean).slice(0, 3);
      if (answers.length < 2) { dropped.push({ reason: '多选需要至少 2 个正确答案', q }); continue; }
      if (!wrong.length) { dropped.push({ reason: '多选缺干扰项', q }); continue; }
      const options = [...answers.map(t => ({ text: t, correct: true })), ...wrong.map(t => ({ text: t, correct: false }))];
      cards.push({ ...base, options: shuffle(options), answers });
      continue;
    }
    if (type === 'order') {
      const steps = (c?.steps || []).map(x => clip(x, 120)).filter(Boolean);
      if (steps.length < 3) { dropped.push({ reason: '排序需要至少 3 步', q }); continue; }
      cards.push({ ...base, steps, shuffled: shuffle(steps.slice()) });
      continue;
    }
    if (type === 'sort') {
      const categories = (c?.categories || []).map(x => ({ label: clip(x?.label, 40), items: (x?.items || []).map(i => clip(i, 120)).filter(Boolean) })).filter(x => x.label && x.items.length);
      if (categories.length < 2) { dropped.push({ reason: '分类需要至少 2 个桶', q }); continue; }
      cards.push({ ...base, categories });
      continue;
    }
    if (type === 'pair') {
      const pairs = (c?.pairs || []).map(x => ({ left: clip(x?.left, 120), right: clip(x?.right, 160) })).filter(x => x.left && x.right);
      if (pairs.length < 3) { dropped.push({ reason: '连线需要至少 3 组', q }); continue; }
      cards.push({ ...base, pairs, rightOrder: shuffle(pairs.map(p => p.right)) });
      continue;
    }
    if (type === 'numeric') {
      const value = Number(c?.numeric?.value);
      if (!Number.isFinite(value)) { dropped.push({ reason: '数值题缺数值', q }); continue; }
      cards.push({ ...base, numeric: { value, unit: clip(c?.numeric?.unit, 12) || '个' }, formula: clip(c?.formula, 200) });
      continue;
    }
    dropped.push({ reason: '未知题型：' + (type || '空'), q });
  }
  return { cards, dropped };
}

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* ── 知识骨架：把散落的题收进「知识点 → 题」两层结构 ── */

/* 模型给的 outline 只留 point + gist，脏数据丢掉 */
function normalizeOutline(list) {
  return (Array.isArray(list) ? list : []).map(x => ({
    point: clip(x?.point ?? x?.concept ?? x?.name, 40),
    gist: clip(x?.gist ?? x?.desc ?? x?.summary, 160)
  })).filter(x => x.point).slice(0, 60);
}

/* 合并骨架：已有顺序优先，新知识点追加在后面，同 point 的 gist 以新值为准 */
function mergeOutline(base, incoming) {
  const out = normalizeOutline(base);
  const index = new Map(out.map((x, i) => [x.point, i]));
  for (const item of normalizeOutline(incoming)) {
    if (index.has(item.point)) {
      if (item.gist) out[index.get(item.point)].gist = item.gist;
    } else {
      index.set(item.point, out.length);
      out.push(item);
    }
  }
  return out;
}

/* 兜底：模型没给 outline 时，用题干里出现最多的 point 顺序拼一个骨架。
   没有 point 的卡不算知识点，避免把「散」包装成「有结构」。 */
function outlineFromCards(cards) {
  const seen = new Map();
  for (const c of cards || []) {
    const point = clip(c?.point, 40);
    if (!point) continue;
    if (!seen.has(point)) seen.set(point, { point, gist: '' });
  }
  return [...seen.values()];
}

/* 按知识点分组：返回 [{point, gist, cards}]，保留出现顺序；
   point 为空的题归到「未归类」，显式暴露出来而不是藏起来 */
function groupByPoint(cards, outline = []) {
  const gistMap = new Map(normalizeOutline(outline).map(x => [x.point, x.gist]));
  const groups = new Map();
  for (const item of normalizeOutline(outline)) groups.set(item.point, { point: item.point, gist: gistMap.get(item.point) || '', cards: [] });
  const loose = [];
  for (const c of cards || []) {
    const point = clip(c?.point, 40);
    if (!point) { loose.push(c); continue; }
    if (!groups.has(point)) groups.set(point, { point, gist: '', cards: [] });
    groups.get(point).cards.push(c);
  }
  const list = [...groups.values()];
  if (loose.length) list.push({ point: '未归类', gist: '模型没标知识点的题，建议补标或删掉', cards: loose, loose: true });
  return list;
}

/* ── 按知识点节选材料（提速关键）──
   一次取材 10 篇 ≈ 8000 字，若每批都把全文塞给模型，prompt 5000+ tokens、
   推理时间翻倍。按当前批的知识点挑相关段落，通常压到 1/3，模型也更容易聚焦。 */
function splitChunks(materials) {
  const out = [];
  for (const m of materials || []) {
    for (const raw of String(m.text || '').split(/\n+/)) {
      const t = raw.trim();
      if (t.length < 20) continue;
      if (t.length <= 300) { out.push({ text: t, src: m.name || '' }); continue; }
      for (const s of t.split(/(?<=[。！？；])/)) {
        const x = s.trim();
        if (x.length >= 20) out.push({ text: x, src: m.name || '' });
      }
    }
  }
  return out;
}

/* 中文没有分词器，就用 2–4 字滑窗当关键词，命中即加分 */
function keywordsOf(point) {
  const p = String(point || '').replace(/[\s\p{P}]/gu, '');
  const keys = new Set();
  for (let n = 2; n <= 4; n++) {
    for (let i = 0; i + n <= p.length; i++) keys.add(p.slice(i, i + n));
  }
  return [...keys];
}

function pickExcerpt(materials, point, maxChar = 3500) {
  const list = (materials || []).filter(m => String(m.text || '').trim());
  if (!list.length) return list;
  const chunks = splitChunks(list);
  if (!chunks.length) return [{ name: '材料', text: list.map(m => m.text).join('\n\n').slice(0, maxChar) }];
  const keys = keywordsOf(point);
  if (!keys.length) {
    /* 没有知识点就按原顺序取，避免"随机挑几段" */
    let text = '';
    for (const c of chunks) { if (text.length >= maxChar) break; text += c.text + '\n'; }
    return [{ name: '材料', text: text.slice(0, maxChar) }];
  }
  const scored = chunks.map((c, i) => ({ ...c, i, score: keys.reduce((s, k) => s + (c.text.includes(k) ? 1 : 0), 0) }));
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  const picked = [];
  let len = 0;
  for (const c of scored) {
    if (len >= maxChar) break;
    picked.push(c); len += c.text.length;
  }
  picked.sort((a, b) => a.i - b.i);
  return [{ name: `材料节选（${point}）`, text: picked.map(c => c.text).join('\n').slice(0, maxChar) }];
}

/* ── 题库体检（借鉴产业区「验证台账」，但不做人工回填，只做可自动判的体检）──
   它那边的台账是等知识过期后回填「命中/偏差/反转」，我们这里直接把「会出问题的地方」
   立刻列出来：无依据 / 无知识点 / 重复 / 来源过旧 / 题型缺失 / 知识点未覆盖。 */
function auditPack(pack) {
  const cards = pack?.cards || [];
  const outline = normalizeOutline(pack?.outline);
  const issues = [];
  const seen = new Map();
  const dupes = [];
  cards.forEach((c, i) => {
    const k = dedupKey(c);
    if (seen.has(k)) dupes.push(i); else seen.set(k, i);
  });

  const noQuote = cards.filter(c => !c.quote).map((c, i) => cards.indexOf(c));
  const noQuoteIds = cards.filter(c => !c.quote).map(c => c.id);
  const noPointIds = cards.filter(c => !c.point).map(c => c.id);
  const covered = new Set(cards.map(c => c.point).filter(Boolean));
  const missPoints = outline.map(o => o.point).filter(p => !covered.has(p));
  const missTypes = TYPES.filter(t => !cards.some(c => c.type === t.key)).map(t => t.label);

  const year = new Date().getFullYear();
  const staleSources = (pack?.sources || []).filter(s => {
    const m = String(s.date || '').match(/(\d{4})/);
    if (!m) return false;
    const y = Number(m[1]);
    /* WSA 偶尔把缺日期的来源标成 1970，那不是"旧"，是"没日期"，别误报过时 */
    if (y <= 1970 || y > year + 1) return false;
    return year - y >= 2;
  });
  /* 可读性检查：儿童档 42 字上限，专业档放宽到 70 字（专业题要带条件与限定） */
  const proPack = pack?.audience === 'pro';
  const stemLimit = proPack ? 70 : 42;
  const longStem = cards.filter(c => String(c.q || '').replace(/\s/g, '').length > stemLimit).map(c => c.id);
  const fillerRe = /(以上都不对|以上都对|不知道|都不对|都是|全都|无法判断)/;
  const fillerIds = [];
  for (const c of cards) {
    const opts = (c.options || []).map(o => o.text).concat(c.answers || [], c.wrong || []);
    if (opts.some(t => fillerRe.test(String(t)))) fillerIds.push(c.id);
  }
  const volatileCount = cards.filter(c => c.volatile).length;

  const add = (level, message, ids) => issues.push({ level, message, ids: ids || [] });

  /* 通识学习场景：小题量本来就没法覆盖全部知识点/题型，那是数量限制不是质量问题。
     阈值：题数 < 知识点数×2（每点至少 2 题才算覆盖）→ 覆盖问题不扣分；题数 < 12 → 题型缺失不扣分。 */
  const thinPoints = cards.length < outline.length * 2;
  const thinTypes = cards.length < 12;

  if (noQuoteIds.length) add('bad', `${noQuoteIds.length} 道题没有原文依据（页面标「无资料依据」），建议删掉或补材料重出`, noQuoteIds);
  else add('ok', '全部题目都有原文依据');
  if (noPointIds.length) add('warn', `${noPointIds.length} 道题没有知识点，会落到「未归类」`, noPointIds);
  if (dupes.length) add('warn', `${dupes.length} 道题与前面的题干重复（去重键撞了）`);
  if (missPoints.length) add(thinPoints ? 'info' : 'warn', `骨架里 ${missPoints.length} 个知识点没出到题：${missPoints.slice(0, 5).join('、')}` + (thinPoints ? '（题量少于知识点数，加题数可补）' : ''));
  if (missTypes.length) add(thinTypes ? 'info' : 'warn', `这些题型没有题目：${missTypes.join('、')}` + (thinTypes ? '（题量少于 12，六种题型不必全出）' : ''));
  if (longStem.length) add('warn', proPack
    ? `${longStem.length} 道题题干超过 70 字，建议拆成两问`
    : `${longStem.length} 道题题干超过 42 字，小朋友读着累，建议缩短`, longStem);
  if (fillerIds.length) add('warn', `${fillerIds.length} 道题出现「以上都不对/不知道」这类凑数项，会把难度降到零`, fillerIds);
  /* 通识知识来源旧不等于知识过时（冥王星 2006 年定案至今没变），
     所以只有当题库里真有依赖"最新数据"的题时，来源旧才值得提醒 */
  if (staleSources.length && volatileCount) add('warn', `${staleSources.length} 篇来源较旧（${staleSources.map(s => s.date).join('、')}），而有 ${volatileCount} 道题依赖"最新数据"，建议复核`);
  if (volatileCount) add('info', `${volatileCount} 道题依赖"最新数据"，数据更新后需复核`);
  if (!noQuoteIds.length && !dupes.length && !longStem.length && !fillerIds.length) add('ok', `可读性正常（长题干 ${longStem.length}、凑数项 ${fillerIds.length}）`);

  /* 打分：满分 100，扣到 0 为止。用于一眼判断题库可用度，不是精确指标 */
  let score = 100
    - noQuoteIds.length * 6
    - noPointIds.length * 4
    - dupes.length * 5
    - (thinPoints ? 0 : missPoints.length * 5)
    - (thinTypes ? 0 : missTypes.length * 3)
    - longStem.length * 2
    - fillerIds.length * 4
    - (staleSources.length && volatileCount ? 2 : 0);
  score = Math.max(0, Math.min(100, Math.round(score)));

  return { score, issues, counts: { total: cards.length, noQuote: noQuoteIds.length, noPoint: noPointIds.length, dupes: dupes.length, staleSources: staleSources.length, volatile: volatileCount, longStem: longStem.length, filler: fillerIds.length } };
}

module.exports = {
  TYPES, TARGET_MIX, typeLabel, planQuota, normalizeQuota, dedupKey, countTypes,
  buildSystemPrompt, buildUserPrompt, buildOutlineSystem, normalizeCards, shuffle,
  normalizeOutline, mergeOutline, outlineFromCards, groupByPoint,
  pickExcerpt, keywordsOf, auditPack
};
