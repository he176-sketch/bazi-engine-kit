// rag.mjs — 古籍引文检索测试：索引质量、门派路由、出处完整性、格式化
import { retrieve, format, detectDomain } from '../rag/retrieve.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function report(name, ok, detail = '') {
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (ok ? '' : ' | ' + detail));
  ok ? pass++ : fail++;
}

// 1. 引文库质量
const idxPath = path.join(ROOT, 'rag', 'citations.json');
const idx = JSON.parse(fs.readFileSync(idxPath, 'utf-8'));
report('引文库条目 ≥3000', idx.count >= 3000, '实际 ' + idx.count);
report('引文库体积 < 2MB', fs.statSync(idxPath).size < 2 * 1024 * 1024, (fs.statSync(idxPath).size / 1048576).toFixed(2) + 'MB');
report('每条含 quote 与 source', idx.items.slice(0, 100).every(i => i.q && i.s), '');
report('引用长度均在 24–72 字', idx.items.every(i => i.q.length >= 24 && i.q.length <= 72), '');

// 2. 门派自动路由
report('域判定: 六爻 → liuyao', detectDomain('六爻 动爻 世应') === 'liuyao', detectDomain('六爻 动爻 世应'));
report('域判定: 奇门 → qimen', detectDomain('奇门 遁甲 值符') === 'qimen', detectDomain('奇门 遁甲 值符'));
report('域判定: 紫微 → ziwei', detectDomain('紫微 命宫 四化') === 'ziwei', detectDomain('紫微 命宫 四化'));
report('域判定: 八字 → bazi', detectDomain('日主 月令 正财 身弱') === 'bazi', detectDomain('日主 月令 正财 身弱'));

// 3. 检索命中、出处完整、门派书目优先
const BOOKS = {
  bazi: ['滴天髓', '滴天髓阐微', '子平真诠', '穷通宝鉴', '渊海子平', '三命通会', '神峰通考'],
  liuyao: ['卜筮正宗', '增删卜易'],
  qimen: ['奇门遁甲统宗', '烟波钓叟歌'],
  ziwei: ['紫微斗数全书', '果老星宗', '果老星宗（张果星宗）']
};
const cases = [
  { q: '庚金 卯月 正财 身弱 用神' },
  { q: '伤官 配印 聪明 学问' },
  { q: '大运 流年 吉凶' },
  { q: '六爻 动爻 世应 吉凶' },
  { q: '奇门 八门 值符' },
  { q: '紫微 命宫 三方四正' }
];
for (const c of cases) {
  const rs = retrieve(c.q, { top: 3 });
  report(`检索有结果: ${c.q}`, rs.length > 0, '无命中');
  if (!rs.length) continue;
  report(`出处完整(书名+引文): ${c.q}`, rs.every(r => r.source && r.quote && r.quote.length >= 20), JSON.stringify(rs[0]));
  const dom = detectDomain(c.q);
  const hit = rs.filter(r => BOOKS[dom].includes(r.source)).length;
  report(`门派书目命中 ≥1: ${c.q}`, hit >= 1, `命中 ${hit}/3，首条来自 ${rs[0].source}`);
}

// 4. 格式化与参数
const fmt = format(retrieve('伤官 配印', { top: 2 }));
report('format 输出含书名号与引文', /《[^》]+》/.test(fmt) && fmt.includes('　'), fmt.slice(0, 60));
report('空结果 format 返回空串', format([]) === '', '');
report('top=1 只返回 1 条', retrieve('正财 身弱', { top: 1 }).length === 1, '');
report('top=5 最多返回 5 条', retrieve('正财 身弱', { top: 5 }).length <= 5, '');

// 5. 显式 domain 覆盖
const forced = retrieve('用神 吉凶', { top: 3, domain: 'liuyao' });
report('显式 domain=liuyao 生效', forced.length > 0 && BOOKS.liuyao.includes(forced[0].source), forced[0]?.source);

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
