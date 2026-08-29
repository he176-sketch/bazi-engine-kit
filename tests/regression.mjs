// regression.mjs — 引擎回归测试（隐私安全版）
// 设计原则：锚点全部使用公开/中性数据（春节日期等），不写入任何个人出生信息。
// 若需回归本人命盘，把锚点写进 tests/fixtures.local.json（已 gitignore，不进仓库），本套件会自动加载。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { paipan, trueSolar, CITY_LON } from '../engine/paipan.mjs';
import { analyze, shiShen } from '../engine/analyze.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function check(name, actual, expect) {
  const ok = JSON.stringify(actual) === JSON.stringify(expect);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (ok ? '' : ` | 实际=${JSON.stringify(actual)} 期望=${JSON.stringify(expect)}`));
  ok ? pass++ : fail++;
}
function checkTrue(name, cond, detail = '') {
  console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name + (cond ? '' : ' | ' + detail));
  cond ? pass++ : fail++;
}

// ===== 1. 农历↔公历桥接（公开春节日期，无个人信息）=====
const BRIDGE = [
  { lunar: '2000-01-01', solar: '2000-02-05', note: '2000年春节' },
  { lunar: '2020-01-01', solar: '2020-01-25', note: '2020年春节' },
  { lunar: '2024-01-01', solar: '2024-02-10', note: '2024年春节' }
];
for (const b of BRIDGE) {
  const viaLunar = paipan({ cal: 'lunar', date: b.lunar, time: '14:00', gender: 1, sect: 2, lon: 120 });
  const viaSolar = paipan({ cal: 'solar', date: b.solar, time: '14:00', gender: 1, sect: 2, lon: 120 });
  check(`农历↔公历桥接一致 (${b.note})`, viaLunar.fourPillars, viaSolar.fourPillars);
  checkTrue(`桥接盘非异常 (${b.note})`, /^[一-龥]{8}$/.test(viaLunar.fourPillars.replace(/\s/g, '')), viaLunar.fourPillars);
}

// ===== 2. 早晚子时 sect 边界（曾出过真实分歧的 bug 类）=====
const z1 = paipan({ cal: 'solar', date: '2000-02-05', time: '23:30', gender: 1, sect: 1, lon: 120 });
const z2 = paipan({ cal: 'solar', date: '2000-02-05', time: '23:30', gender: 1, sect: 2, lon: 120 });
const day1 = z1.fourPillars.split(' ')[2], day2 = z2.fourPillars.split(' ')[2];
const hour1 = z1.fourPillars.split(' ')[3], hour2 = z2.fourPillars.split(' ')[3];
checkTrue('sect1 与 sect2 日柱必须不同', day1 !== day2, `${day1} vs ${day2}`);
checkTrue('sect1 与 sect2 时柱必须相同', hour1 === hour2, `${hour1} vs ${hour2}`);

// ===== 3. 真太阳时方向与量级 =====
const uq = trueSolar(2000, 6, 1, 12, 0, 0, CITY_LON['乌鲁木齐']);
const sh = trueSolar(2000, 6, 1, 12, 0, 0, CITY_LON['上海']);
const bj = trueSolar(2000, 6, 1, 12, 0, 0, CITY_LON['北京']);
checkTrue('西经度城市真太阳时显著偏负（乌鲁木齐 < -110min）', uq.corrections.totalSec < -6600, String(uq.corrections.totalSec));
checkTrue('东经度城市真太阳时为正（上海 > 0）', sh.corrections.totalSec > 0, String(sh.corrections.totalSec));
checkTrue('北京真太阳时接近钟表时（|offset| < 20min）', Math.abs(bj.corrections.totalSec) < 1200, String(bj.corrections.totalSec));

// ===== 4. 夏令时（1986-1991 区间）=====
check('1988 夏令时扣回', paipan({ cal: 'solar', date: '1988-06-01', time: '12:00', gender: 1, sect: 2, city: '北京' }).trueSolar.corrections.dstApplied, true);
check('1993 非夏令时', paipan({ cal: 'solar', date: '1993-06-01', time: '12:00', gender: 1, sect: 2, city: '北京' }).trueSolar.corrections.dstApplied, false);

// ===== 5. 分析层规则（与具体命主无关）=====
const demo = paipan({ cal: 'solar', date: '2000-02-05', time: '14:00', gender: 1, sect: 2, lon: 120 });
const a = analyze(demo.chart);
check('日主为癸', a.dayMaster.stem, '癸');
check('五行计数合计=8', Object.values(a.wuxing).reduce((x, y) => x + y, 0), 8);
check('十神: 庚见乙=正财', shiShen('庚', '乙'), '正财');
check('十神: 庚见丙=七杀', shiShen('庚', '丙'), '七杀');
check('十神: 辛见癸=食神', shiShen('辛', '癸'), '食神');
checkTrue('格局字段有值', typeof a.geju === 'string' && a.geju.length > 0, String(a.geju));
checkTrue('强弱评分在 0-300 区间', a.strength.score >= 0 && a.strength.score <= 300, String(a.strength.score));

// ===== 6. 起运年龄合理性（多组抽查）=====
for (const d of ['2000-02-05', '2020-01-25', '2024-02-10']) {
  const r = paipan({ cal: 'solar', date: d, time: '14:00', gender: 1, sect: 2, lon: 120 });
  const age = r.chart['大运']?.['起运年龄'];
  checkTrue(`起运年龄 0-10 岁 (${d})`, typeof age === 'number' && age >= 0 && age <= 10, String(age));
}

// ===== 7. 私密锚点（可选，不进仓库）=====
const LOCAL = path.join(ROOT, 'tests', 'fixtures.local.json');
if (fs.existsSync(LOCAL)) {
  console.log('\n[私密锚点] 检测到 tests/fixtures.local.json，加载本地用例（不进 git）');
  const cases = JSON.parse(fs.readFileSync(LOCAL, 'utf-8'));
  for (const c of cases) {
    const r = paipan(c.input);
    check(`私密锚点: ${c.name}`, r.fourPillars, c.expect);
  }
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
