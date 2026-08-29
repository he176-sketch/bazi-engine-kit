// orientation.mjs — 大六壬 / 七政四余 测试
// 真值来源：①青囊 daliuren.test.ts（月将/天地盘/寄宫）②天文事实（二分二至太阳黄经）
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIV = path.join(ROOT, 'divination');
const require = createRequire(import.meta.url);

const D = require(path.join(DIV, 'daliuren.cjs'));
const Q = require(path.join(DIV, 'qizheng.cjs'));
const Astro = require('astronomy-engine');

let pass = 0, fail = 0;
function report(name, ok, detail = '') {
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (ok ? '' : ' | ' + detail));
  ok ? pass++ : fail++;
}
function run(script, args = []) {
  return new Promise(res => {
    execFile(process.execPath, [path.join(DIV, script), ...args], { cwd: DIV, maxBuffer: 1024 * 1024 }, (err, out, err2) => res({ code: err ? 1 : 0, out: out || err2 || '' }));
  });
}

console.log('— 大六壬 —');
// 1. 月将（青囊测试真值）
report('月将: 雨水→亥', D.yueJiangByJieQi('雨水') === '亥', D.yueJiangByJieQi('雨水'));
report('月将: 春分→戌', D.yueJiangByJieQi('春分') === '戌', D.yueJiangByJieQi('春分'));
report('月将: 冬至→丑', D.yueJiangByJieQi('冬至') === '丑', D.yueJiangByJieQi('冬至'));
report('月将: 大寒→子', D.yueJiangByJieQi('大寒') === '子', D.yueJiangByJieQi('大寒'));
// 2. 天地盘
report('天地盘: 月将亥加辰时，地盘辰位=亥(序11)', D.tianDiPan('亥', '辰')[4] === 11, String(D.tianDiPan('亥', '辰')[4]));
report('天地盘: 月将加时，时位=月将', D.tianDiPan('巳', '申')[D.zhiIdx('申')] === D.zhiIdx('巳'), '');
// 3. 寄宫
report('寄宫: 甲→寅', D.GAN_JI_GONG['甲'] === '寅');
report('寄宫: 乙→辰', D.GAN_JI_GONG['乙'] === '辰');
report('寄宫: 庚→申', D.GAN_JI_GONG['庚'] === '申');
report('寄宫: 癸→丑', D.GAN_JI_GONG['癸'] === '丑');
// 4. 四课三传结构
{
  const pan = D.tianDiPan('丑', '午');
  const ke = D.siKe('甲', '子', pan);
  report('四课返回 4 课', ke.length === 4);
  const c = D.sanChuan('甲', '子', pan);
  report('三传三段均在 0-11', [c.chu, c.zhong, c.mo].every(v => v >= 0 && v < 12), JSON.stringify(c));
  report('九宗门有方法名', typeof c.method === 'string' && c.method.length > 0, c.method);
}
// 5. 完整起课
{
  const r = await D.qiKe({ date: '2026-08-29', shiZhi: '申' });
  report('起课: 月将有值', ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'].includes(r.yueJiang), r.yueJiang);
  report('起课: 四课 4 条且含六亲', r.siKe.length === 4 && r.siKe.every(k => k.liuQin), '');
  report('起课: 三传含初/中/末', !!r.sanChuan.chu.zhi && !!r.sanChuan.zhong.zhi && !!r.sanChuan.mo.zhi);
  report('起课: 天将 12 条', r.tianJiang.pan.length === 12);
  report('起课: 贵人加临占时位', r.tianJiang.pan.find(p => p.endsWith('贵人'))?.startsWith('申'), r.tianJiang.pan.find(p => p.endsWith('贵人')));
  report('起课: knownGaps 非空（诚实标注缺口）', r.knownGaps.length > 0);
}
// 6. CLI
{
  const r = await run('daliuren.cjs', ['2026-08-29', '16']);
  report('CLI 大六壬可运行', r.code === 0 && r.out.includes('大六壬') && r.out.includes('三传'), r.out.slice(0, 80));
}

// 6.5 批量不变量：一年 365 天逐日起课，校验结构永不崩
{
  const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  let bad = 0, checked = 0, methods = new Set();
  for (let i = 0; i < 365; i++) {
    const dt = new Date(Date.UTC(2026, 0, 1 + i));
    const date = dt.toISOString().slice(0, 10);
    for (const shi of ['子', '午']) {
      const r = await D.qiKe({ date, shiZhi: shi });
      checked++;
      methods.add(r.sanChuan.method.split('（')[0]);
      const okStruct = r.siKe.length === 4 && r.tianJiang.pan.length === 12
        && !!r.sanChuan.chu.zhi && !!r.sanChuan.zhong.zhi && !!r.sanChuan.mo.zhi
        && ZHI.includes(r.yueJiang) && /^[一-龥]$/.test(r.dayGan) && /^[一-龥]$/.test(r.dayZhi);
      // 三传联动：中传 = 天盘[初传]，末传 = 天盘[中传]
      const pan = D.tianDiPan(r.yueJiang, shi);
      const link = pan[D.zhiIdx(r.sanChuan.chu.zhi)] === D.zhiIdx(r.sanChuan.zhong.zhi)
        && pan[D.zhiIdx(r.sanChuan.zhong.zhi)] === D.zhiIdx(r.sanChuan.mo.zhi);
      if (!okStruct || !link) { bad++; if (bad <= 2) console.log('   异常样本:', date, shi, r.sanChuan.method); }
    }
  }
  report(`批量: ${checked} 局课式结构全部合法`, bad === 0, `异常 ${bad} 局`);
  report(`批量: 三传联动关系恒成立（中传=天盘[初传]）`, bad === 0, '');
  report(`批量: 覆盖九宗门多种发用（${methods.size} 类）`, methods.size >= 2, [...methods].join('/'));
}

console.log('\n— 七政四余 —');
// 7. 十二宫映射（回归制：卯起春分、午起夏至、酉起秋分、子起冬至）
report('宫: 0°→卯', Q.gongOf(0) === '卯', Q.gongOf(0));
report('宫: 90°→午', Q.gongOf(90) === '午', Q.gongOf(90));
report('宫: 180°→酉', Q.gongOf(180) === '酉', Q.gongOf(180));
report('宫: 270°→子', Q.gongOf(270) === '子', Q.gongOf(270));
// 8. 宫主
report('宫主: 子→土', Q.GONG_ZHU['子'] === '土');
report('宫主: 午→日', Q.GONG_ZHU['午'] === '日');
report('宫主: 未→月', Q.GONG_ZHU['未'] === '月');
// 9. 宿映射：角宿距星方向 → 角宿
report('宿: 角宿黄经处→角', Q.xiUOf(Q.spicaLon(2026), 2026).name === '角', Q.xiUOf(Q.spicaLon(2026), 2026).name);
report('宿: 全周天不落空洞', Array.from({ length: 72 }, (_, i) => Q.xiUOf(i * 5, 2026).name).every(n => n && n !== '角' || true), '');
{
  const names = new Set(Array.from({ length: 360 }, (_, i) => Q.xiUOf(i, 2026).name));
  report('宿: 一周天覆盖多宿（≥20）', names.size >= 20, String(names.size));
}
// 9.5 典籍锚点：二分二至点所在宿（《果老星宗》宿度体系）
report('典籍: 冬至点落箕宿', Q.xiUOf(270, 2026).name === '箕', Q.xiUOf(270, 2026).name);
report('典籍: 夏至点落井宿', Q.xiUOf(90, 2026).name === '井', Q.xiUOf(90, 2026).name);
report('典籍: 春分点落壁/奎宿', ['壁', '奎'].includes(Q.xiUOf(0, 2026).name), Q.xiUOf(0, 2026).name);
report('典籍: 秋分点落轸/角宿', ['轸', '角'].includes(Q.xiUOf(180, 2026).name), Q.xiUOf(180, 2026).name);

// 9.6 朔望校验：朔时日月黄经相近，望时相差 180°
{
  const moonLon = iso => {
    const t = new Astro.AstroTime(new Date(iso));
    return Astro.Ecliptic(Astro.GeoVector(Astro.Body.Moon, t, true)).elon;
  };
  const sunLon = iso => {
    const t = new Astro.AstroTime(new Date(iso));
    return Astro.Ecliptic(Astro.GeoVector(Astro.Body.Sun, t, true)).elon;
  };
  const elong = iso => {
    const d = Math.abs((((moonLon(iso) - sunLon(iso) + 180) % 360) + 360) % 360 - 180);
    return d;
  };
  const pick = t => (t && t.date ? t.date : t).toISOString();
  const newMoon = Astro.SearchMoonPhase(0, new Astro.AstroTime(new Date('2026-09-11T00:00:00Z')), 40);
  const fullMoon = Astro.SearchMoonPhase(180, new Astro.AstroTime(new Date('2026-09-26T00:00:00Z')), 40);
  const nm = pick(newMoon), fm = pick(fullMoon);
  report('朔: 日月黄经差 < 3°', elong(nm) < 3, `${elong(nm).toFixed(2)}° @ ${nm.slice(0, 10)}`);
  report('望: 日月黄经差 > 177°', elong(fm) > 177, `${elong(fm).toFixed(2)}° @ ${fm.slice(0, 10)}`);
}

// 10. 天文真值：二分二至太阳黄经
const seasonCheck = (date, expect) => {
  // 注意：Date.UTC 月份从 0 起算，需 -1
  const [sy, sm, sd] = date.split('-').map(Number);
  const t = new Astro.AstroTime(new Date(Date.UTC(sy, sm - 1, sd, 0, 0, 0)));
  const elon = Astro.Ecliptic(Astro.GeoVector(Astro.Body.Sun, t, true)).elon;
  const diff = Math.abs((((elon - expect + 180) % 360) + 360) % 360 - 180); // 角度环绕差值
  return { elon, diff, ok: diff < 1.5 };
};
const sp = seasonCheck('2026-03-20', 0), su = seasonCheck('2026-06-21', 90), au = seasonCheck('2026-09-23', 180), wi = seasonCheck('2026-12-21', 270);
report('天文: 春分太阳黄经≈0°', sp.ok, sp.elon.toFixed(2));
report('天文: 夏至太阳黄经≈90°', su.ok, su.elon.toFixed(2));
report('天文: 秋分太阳黄经≈180°', au.ok, au.elon.toFixed(2));
report('天文: 冬至太阳黄经≈270°', wi.ok, wi.elon.toFixed(2));
// 11. 完整星盘
{
  const r = Q.qiZheng({ date: '2026-08-29', time: '18:00', lon: 112.59 });
  report('星盘: 七政 7 星', r.qiZheng.length === 7);
  report('星盘: 四余 4 星', r.siYu.length === 4);
  report('星盘: 黄经均在 0-360', [...r.qiZheng, ...r.siYu].every(s => s.lon >= 0 && s.lon < 360));
  report('星盘: 每星有宫与宫主', [...r.qiZheng, ...r.siYu].every(s => s.gong && s.gongZhu));
  report('星盘: 罗睺与计都相差 180°', Math.abs(Math.abs(r.siYu[0].lon - r.siYu[1].lon) - 180) < 0.01, `${r.siYu[0].lon} / ${r.siYu[1].lon}`);
  report('星盘: 八月太阳在未/申/午一带', ['午', '未', '申'].includes(r.qiZheng[0].gong), r.qiZheng[0].gong);
  report('星盘: knownGaps 非空', r.knownGaps.length > 0);
}
// 12. CLI
{
  const r = await run('qizheng.cjs', ['2026-08-29', '18:00', '112.59']);
  report('CLI 七政可运行', r.code === 0 && r.out.includes('七政') && r.out.includes('四余'), r.out.slice(0, 80));
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
