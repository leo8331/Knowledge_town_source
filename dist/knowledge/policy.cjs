'use strict';
/* 知识库自带的最小合规筛查：只挡明确不该进题库的领域。
   词表启发式，不做"内容审核保证"；命中 error 的材料不提交给模型。 */

const SEXUAL = ['色情', '成人视频', '裸照', '性行为', '做爱', '约炮', 'porn', 'nsfw', 'sexual content'];
const VIOLENT = ['制作炸弹', '炸药配方', '爆炸物制作', '造枪', '枪支改装', '制毒', '毒品配方', '冰毒', '自杀方法', '自残方法', 'how to make a bomb', 'pipe bomb'];
const POLITICAL = ['政治人物', '政党', '执政党', '选举', '示威', '游行', '政变', '独裁', '意识形态', '领导人', '政府机构', 'propaganda'];

function scan(text) {
  const body = String(text || '').toLowerCase();
  const findings = [];
  const hit = (list, severity, message) => {
    let count = 0;
    for (const word of list) {
      if (!word) continue;
      const re = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const m = body.match(re);
      if (m) count += m.length;
    }
    if (count) findings.push({ severity, message: message + '（命中 ' + count + ' 处）', count });
  };
  hit(SEXUAL, 'error', '疑似色情或性内容');
  hit(VIOLENT, 'error', '疑似暴力或违法制作内容');
  hit(POLITICAL, 'warning', '政治类话题');
  const political = findings.find(f => f.message.startsWith('政治类话题'));
  if (political && political.count >= 8) political.severity = 'error';
  return { ok: !findings.some(f => f.severity === 'error'), findings };
}

function screenMaterials(materials) {
  const joined = (materials || []).map(m => String(m?.text || '')).join('\n');
  return scan(joined);
}

module.exports = { scan, screenMaterials };
