// retrieve.mjs — 古籍引文检索（为「引用原文」的差异化体验服务）
// 设计目标：给出 1-2 句读得懂、有出处、贴主题的原文，而不是大段堆砌
// CLI: node rag/retrieve.mjs "庚金 卯月 正财 身弱" [--top 3] [--json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INDEX = path.join(HERE, 'citations.json');

let cache = null;
function load() {
  if (cache) return cache;
  if (!fs.existsSync(INDEX)) throw new Error('引文库缺失，请先运行: CITATIONS_DIR=... node rag/build-index.mjs');
  cache = JSON.parse(fs.readFileSync(INDEX, 'utf-8'));
  return cache;
}

// 门派 → 优先书目（八字问题优先引八字典籍，避免串味）
const DOMAIN_BOOKS = {
  bazi: ['滴天髓', '滴天髓阐微', '子平真诠', '穷通宝鉴', '渊海子平', '三命通会', '神峰通考'],
  ziwei: ['紫微斗数全书', '果老星宗', '果老星宗（张果星宗）'],
  qizheng: ['果老星宗', '果老星宗（张果星宗）'],
  liuyao: ['卜筮正宗', '增删卜易'],
  qimen: ['奇门遁甲统宗', '烟波钓叟歌'],
  daliuren: ['六壬大全', '大六壬指南']
};
// 判定顺序：先判专有术数（特征词独有），八字放最后兜底（用神/身弱是通用词）
const DOMAIN_HINTS = [
  ['liuyao', /(六爻|纳甲|世应|用神爻|动爻|卦身|六亲|装卦|摇卦|本宫|变爻)/],
  ['qimen', /(奇门|遁甲|九宫|八门|九星|值符|值使|烟波)/],
  ['daliuren', /(大六壬|六壬|课式|四课|三传|天乙)/],
  ['ziwei', /(紫微|命宫|三方四正|四化|大限|星曜|天府|贪狼|天机|破军)/],
  ['qizheng', /(七政|四余|星宗|果老|命度|黄道)/],
  ['bazi', /(八字|四柱|日主|月令|格局|调候|身弱|身强|十神|大运|流年|纳音|神煞|正财|偏财|正官|七杀|伤官|食神|正印|偏印|比肩|劫财)/]
];

export function detectDomain(query) {
  let best = null, bestScore = 0;
  for (const [d, re] of DOMAIN_HINTS) {
    const n = (query.match(new RegExp(re.source, 'g')) || []).length;
    if (n > bestScore) { best = d; bestScore = n; }
  }
  return best || 'bazi';
}

function tokenize(query) {
  return query.split(/[\s,，、]+/).map(s => s.trim()).filter(s => s.length >= 1);
}

/** 检索：返回 top-K 引文，含出处与打分 */
export function retrieve(query, { top = 3, domain = null } = {}) {
  const { items } = load();
  const dom = domain || detectDomain(query) || 'bazi';
  const preferred = new Set(DOMAIN_BOOKS[dom] || []);
  const terms = tokenize(query);

  const scored = [];
  for (const it of items) {
    const text = it.q + ' ' + (it.c || '');
    let score = 0;
    for (const t of terms) {
      if (!t) continue;
      // 整词命中权重高，单字命中权重低（避免"金""木"这类泛词刷分）
      const exact = text.split(t).length - 1;
      if (exact > 0) score += (t.length >= 2 ? 6 : 1.5) * Math.min(exact, 2);
    }
    if (score === 0) continue;
    // 门派匹配加权；跨门派（如八字问题引到六壬书）降权，避免串味
    if (preferred.has(it.s)) score += 4;
    else score -= 3;
    score += (72 - Math.min(it.q.length, 72)) / 24; // 短句略优先（更易读）
    // 可读性门槛：句末完整 +2；含半角逗号（OCR 瑕疵）或数字堆砌（干支表）降权
    if (/[。！？]$/.test(it.q)) score += 2;
    if (it.q.includes(',')) score -= 3;
    const digits = (it.q.match(/[0-9]/g) || []).length;
    if (digits > 4) score -= 2;
    if ((it.q.match(/[，]/g) || []).length > 3) score -= 1;
    scored.push({ ...it, score: +score.toFixed(2), domain: dom });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, top).map(({ q, s, a, c, p, score }) => ({
    quote: q, source: s, author: a || '', chapter: c || '', anchor: p || '', score
  }));
}

/** 格式化为可直接嵌入 prompt / 回复的文本块 */
export function format(results) {
  if (!results.length) return '';
  return results.map(r => {
    const head = r.chapter ? `《${r.source}·${r.chapter}》` : `《${r.source}》`;
    return `— ${head}\n　${r.quote}`;
  }).join('\n\n');
}

// CLI
if (process.argv[1] && process.argv[1].endsWith('retrieve.mjs')) {
  const args = process.argv.slice(2);
  const query = args.filter(a => !a.startsWith('--')).join(' ');
  const topArg = args.find(a => a.startsWith('--top'));
  const top = topArg ? Number(args[args.indexOf(topArg) + 1]) || 3 : 3;
  const asJson = args.includes('--json');
  if (!query) { console.error('用法: node rag/retrieve.mjs "<关键词>" [--top 3] [--json]'); process.exit(1); }
  const rs = retrieve(query, { top });
  console.log(asJson ? JSON.stringify(rs, null, 2) : format(rs) || '（未命中引文）');
}
