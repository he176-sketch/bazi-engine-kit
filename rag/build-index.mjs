// build-index.mjs — 从青囊 outputs/citations 抽取「可引用句段」生成仓库自带引文库
// 用法: CITATIONS_DIR=<青囊>/outputs/citations node rag/build-index.mjs
// 策略：优先保留 20-100 字的天然短句；长篇按句切分，保留含命理关键词的句子
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const SRC = process.env.CITATIONS_DIR || path.join(process.env.HOME || '', 'WorkBuddy/国学/qingnang/outputs/citations');
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'citations.json');

const MIN = 24, MAX = 72;   // 黄金引用长度：够有信息量，又短到能读完
const CAP_PER_BOOK = 500;   // 每本上限，控制体积（目标 < 1.5MB）
// 强信号词：命中一个即可收录
const STRONG = /(用神|调候|格局|身弱|身强|月令|日主|大运|流年|纳音|神煞|格局|通关|扶抑|从格|化气)/;
// 弱信号词：需命中两个及以上
const WEAK = /(财|官|印|食|伤|杀|劫|比|旺|衰|冲|合|刑|害|桃花|贵人|五行|金|木|水|火|土|吉|凶|富贵|贫|寿|婚姻|子息|父母|兄弟|文|武|清|浊|寒|暖|燥|湿)/;

function splitSentences(text) {
  return text.split(/(?<=[。！？；])/).map(s => s.trim()).filter(Boolean);
}

function loadEntries(dir) {
  const file = path.join(dir, '_all.json');
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
  const out = [];
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json'))) {
    out.push(...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));
  }
  return out;
}

const raw = loadEntries(SRC);
const seen = new Set();
const items = [];
const perBookCount = {};

for (const e of raw) {
  const src = e.sourceEdition || '';
  const author = e.author || '';
  const chapter = (e.chapter || '').replace(/[:：]\s*$/, '');
  const anchor = e.passageAnchor || '';
  const content = (e.content || '').replace(/\s+/g, ' ').trim();

  const push = (text) => {
    const t = text.trim();
    if (t.length < MIN || t.length > MAX) return;
    const weakHits = new Set(t.match(new RegExp(WEAK, 'g')) || []).size;
    if (!STRONG.test(t) && weakHits < 2) return;
    const cnt = perBookCount[src] || 0;
    if (cnt >= CAP_PER_BOOK) return;
    const hash = crypto.createHash('md5').update(t).digest('hex').slice(0, 12);
    if (seen.has(hash)) return;
    seen.add(hash);
    perBookCount[src] = cnt + 1;
    items.push({ q: t, s: src, a: author, c: chapter, p: anchor });
  };

  if (content.length <= MAX) { push(content); continue; }
  for (const sent of splitSentences(content)) push(sent);
}

items.sort((a, b) => (a.s === b.s ? a.q.localeCompare(b.q) : a.s.localeCompare(b.s)));
fs.writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), count: items.length, items }, null, 2), 'utf-8');

const byBook = items.reduce((m, i) => (m[i.s] = (m[i.s] || 0) + 1, m), {});
console.log('已生成:', OUT);
console.log('可引用句段:', items.length);
console.log('按书目:', Object.entries(byBook).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '));
