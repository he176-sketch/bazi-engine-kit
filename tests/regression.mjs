// regression.mjs — 回归测试：以「李鹤」本命盘为锚点用例（历史验证过），改引擎后必须全绿
// 用法: npm test（需先 npm i）
import { paipan } from '../engine/paipan.mjs';
import { analyze, shiShen } from '../engine/analyze.mjs';

let pass = 0, fail = 0;
function check(name, actual, expect) {
  const ok = JSON.stringify(actual) === JSON.stringify(expect);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (ok ? '' : ` | 实际=${JSON.stringify(actual)} 期望=${JSON.stringify(expect)}`));
  ok ? pass++ : fail++;
}

// 用例1：农历 1993-02-18 23:45 钟祥 男 sect=2 → 癸酉 乙卯 庚寅 戊子
const c1 = paipan({ cal: 'lunar', date: '1993-02-18', time: '23:45', gender: 1, sect: 2, lon: 112.59 });
check('农历二月十八·sect2 四柱', c1.fourPillars, '癸酉 乙卯 庚寅 戊子');

// 用例2：同一盘 sect=1（子时换日派）→ 日柱变辛卯
const c2 = paipan({ cal: 'lunar', date: '1993-02-18', time: '23:45', gender: 1, sect: 1, lon: 112.59 });
check('农历二月十八·sect1 四柱', c2.fourPillars, '癸酉 乙卯 辛卯 戊子');

// 用例3：若误按公历 1993-02-18 → 癸酉 甲寅 庚午 戊子（历史踩坑用例，防回归）
const c3 = paipan({ cal: 'solar', date: '1993-02-18', time: '23:45', gender: 1, sect: 2, lon: 112.59 });
check('公历1993-02-18·sect2 四柱', c3.fourPillars, '癸酉 甲寅 庚午 戊子');

// 用例4：真太阳时校正量级（3-10 钟祥 23:45 → 约 23:05±2min）
const c4 = paipan({ cal: 'solar', date: '1993-03-10', time: '23:45', gender: 1, sect: 2, lon: 112.59 });
const m4 = c4.trueSolar.datetime.match(/T23:(\d{2}):/);
check('真太阳时落在 23:03-23:07', m4 && +m4[1] >= 3 && +m4[1] <= 7, true);

// 用例5：夏令时扣回（1988-06-01 北京 12:00 → 应整体 −60min±均时差，出现在 10:5x-11:0x 区间）
const c5 = paipan({ cal: 'solar', date: '1988-06-01', time: '12:00', gender: 1, sect: 2, city: '北京' });
check('1988夏令时已扣回', c5.trueSolar.corrections.dstApplied, true);

// 用例6：分析层自检（用例1的盘：庚金日主、十神函数、五行计数合计=8）
const a1 = analyze(c1.chart);
check('日主为庚', a1.dayMaster.stem, '庚');
check('五行计数合计=8', Object.values(a1.wuxing).reduce((a, b) => a + b, 0), 8);
check('十神: 庚见乙=正财', shiShen('庚', '乙'), '正财');
check('十神: 庚见丙=七杀', shiShen('庚', '丙'), '七杀');
check('十神: 辛见癸=食神', shiShen('辛', '癸'), '食神');

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
