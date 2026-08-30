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
// 7. 十二宫映射（回归制：春分戌、夏至未、秋分辰、冬至丑）
report('宫: 0°→戌', Q.gongOf(0) === '戌', Q.gongOf(0));
report('宫: 90°→未', Q.gongOf(90) === '未', Q.gongOf(90));
report('宫: 180°→辰', Q.gongOf(180) === '辰', Q.gongOf(180));
report('宫: 270°→丑', Q.gongOf(270) === '丑', Q.gongOf(270));
// 8. 宫主
report('宫主: 子→土', Q.GONG_ZHU['子'] === '土');
report('宫主: 午→日', Q.GONG_ZHU['午'] === '日');
report('宫主: 未→月', Q.GONG_ZHU['未'] === '月');
// 9. 宿映射：Hipparcos 距星边界覆盖完整周天
report('宿: 角宿黄经处→角', Q.xiuOf(Q.spicaLon(2026), 2026).name === '角', Q.xiuOf(Q.spicaLon(2026), 2026).name);
report('宿: 全周天不落空洞', Array.from({ length: 72 }, (_, i) => Q.xiuOf(i * 5, 2026).name).every(Boolean), '');
{
  const names = new Set(Array.from({ length: 360 }, (_, i) => Q.xiuOf(i, 2026).name));
  report('宿: 一周天覆盖二十八宿', names.size === 28, String(names.size));
}
{
  const table = Q.buildXiuTable(2026, 'huangdao');
  report('宿: 距星表恰好 28 个边界', table.length === 28, String(table.length));
  report('宿: 每个距星边界后仍归本宿', table.every(x => Q.xiuOf(x.lon + 1e-6, 2026).name === x.name), '');
}
{
  const epochs = [1900, 1950, 2000, 2050, 2100];
  const valid = epochs.every(year => {
    const table = Q.buildXiuTable(year, 'huangdao');
    return table.length === 28 && new Set(table.map(x => x.name)).size === 28
      && table.every((x, i) => i === 0 || table[i - 1].lon < x.lon);
  });
  report('宿: 1900—2100 跨年代边界完整且有序', valid, '');
}

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
  report('星盘: 2026-08-29 太阳在巳宫', r.qiZheng[0].gong === '巳', r.qiZheng[0].gong);
  report('星盘: 黄经保留到小数点后六位', r.qiZheng.some(s => Math.round(s.lon * 100) !== s.lon * 100), String(r.qiZheng[0].lon));
  report('星盘: knownGaps 非空', r.knownGaps.length > 0);
  report('真太阳时: 公开样本约为 17:29', r.datetime.trueSolarTime.startsWith('2026-08-29 17:29:'), r.datetime.trueSolarTime);
  const dst = Q.qiZheng({ date: '1988-05-20', time: '12:00', lon: 120, tz: 8, dstAdjust: true });
  report('真太阳时: 中国夏令时扣回一小时', dst.datetime.dstApplied && dst.datetime.trueSolarTime.startsWith('1988-05-20 11:03:'), dst.datetime.trueSolarTime);
}
// 11.5 专业 JSON、九种盘制、传统规则与运限
{
  const request = { birth_date: '1993-03-10', birth_time: '23:45', birth_lon: 112.58, birth_lat: 31.17, timezone: 8, gender: 'male', xiu_method: 'huangdaohuigui', reference_date: '2026-06-15', reference_time: '12:00' };
  const chart = Q.calculateChart(request);
  report('兼容输出: 11 星与 12 宫', chart.planets.length === 11 && chart.palaces.length === 12, `${chart.planets.length}/${chart.palaces.length}`);
  report('兼容输出: 星曜字段完整', chart.planets.every(p => ['name', 'lon', 'gong', 'gong_du', 'xiu', 'xiu_du', 'lat', 'dist', 'speed', 'motion', 'status'].every(k => k in p) && Array.isArray(p.status)), '');
  report('兼容输出: 命身宫含宫度、宿度与主星', ['ming_du_lon', 'ming_xiu', 'ming_xiu_du', 'ming_zhu', 'shen_du_lon', 'shen_xiu', 'shen_xiu_du', 'shen_zhu'].every(k => k in chart.liming), '');
  const modes = Object.entries(Q.XIU_METHODS);
  report('九种今古宿/郑案/果老盘制全部可计算', modes.length === 9 && modes.every(([method, [coord]]) => {
    const result = Q.qiZheng({ ...request, xiu_method: method, coord_system: coord });
    return result.qiZheng.length + result.siYu.length === 11 && result.xiuTable.length === 28;
  }), modes.map(([name]) => name).join(','));
  const fitted = Q.qiZheng({ ...request, node_calculation: 'fitted', apogee_calculation: 'fitted' });
  report('fitted 罗计保持精确对冲且月孛有连续结果', Math.abs(Math.abs(fitted.siYu[0].lon - fitted.siYu[1].lon) - 180) < 1e-6 && Number.isFinite(fitted.siYu[2].lon), '');
  report('四柱/节气接入真太阳时历法', chart.basic.lunar_date === '癸酉年 乙卯月 庚寅日 戊子时' && chart.jieqi.prev.name === '惊蛰', chart.basic.lunar_date);
  report('十干化曜与年/月神煞已生成', chart.shensha.shiyi_huayao.天禄 === '罗睺' && chart.shensha.niangan_shensha.禄勋 === '子' && chart.shensha.nianzhi_shensha.太岁 === '酉' && chart.shensha.yuezhi_shensha.月廉 === '酉' && Object.values(chart.shensha.huayao).flat().includes('值难'), '');
  report('庙旺垣殿与经纬五行状态已生成', chart.planets.some(p => p.name === '土星' && p.status.includes('垣')) && chart.planets.some(p => p.name === '木星' && p.status.includes('互躔')), '');
  const conjunction = Q.calculateChart({ ...request, birth_date: '2026-01-17', birth_time: '12:00', birth_lon: 116.407, birth_lat: 39.904 });
  const conjunctionMercury = conjunction.planets.find(p => p.name === '水星');
  report('五星与日距 3° 内标记伏并抑制速度标签', conjunctionMercury.status.includes('伏') && !conjunctionMercury.status.some(s => ['迟', '留', '逆', '速'].includes(s)), JSON.stringify(conjunctionMercury));
  report('小限覆盖完整 120 年且 2026 在巳宫', chart.xiaoxian.length === 120 && chart.xiaoxian.find(x => x.liunian === 2026)?.gong === '巳', '');
  report('洞微童限与大限逐年线连续', Math.abs(chart.dongwei.chuxian_age - 15.6945) < 0.01 && chart.dongwei.year_lines.length >= 100 && chart.dongwei.current.renshi === '福', JSON.stringify(chart.dongwei.current));
  report('洞微躔度星名使用专业短名', chart.dongwei.current.chandu.stars.every(name => ['日', '月', '金', '木', '水', '火', '土', '罗', '计', '孛', '炁'].includes(name)), JSON.stringify(chart.dongwei.current.chandu));
  report('完整流年时间轴含小限/洞微/大运', chart.liunian_timeline.length === 120 && ['xiaoxian', 'dongwei', 'dayun'].every(k => k in chart.liunian_timeline.find(x => x.year === 2026)), '');
  const flow = Q.calculateLiunian({ ...request, liunian_year: 2026, liuyue: 6, liuri: 15, liushi: '12:00', node_calculation: 'fitted', apogee_calculation: 'fitted' });
  report('完整流年盘含 11 流曜、月限、神煞与当前洞微限', flow.liunian_planets.length === 11 && flow.liunian_yuexian.length === 12 && flow.liunian_shensha.nianzhi_shensha.太岁 === '午' && flow.dongwei.current.renshi === '福', '');
  let invalidFlowDateRejected = false;
  try { Q.calculateLiunian({ ...request, liunian_year: 2026, liuyue: 13 }); } catch { invalidFlowDateRejected = true; }
  report('流年年月日参数越界会明确拒绝', invalidFlowDateRejected, '');
  const docsSample = { birth_date: '1995-06-15', birth_time: '14:30', birth_lon: 116.407, birth_lat: 39.904, timezone: 8, gender: 'male', city: '北京', xiu_method: 'chidao_jinxiu', coord_system: 'chidao' };
  const uniform = Q.calculateChart({ ...docsSample, ziqi_calculation: 'equatorial_uniform' });
  const projected = Q.calculateChart({ ...docsSample, ziqi_calculation: 'ecliptic_projection' });
  const uniformQi = uniform.planets.find(p => p.name === '紫炁'), projectedQi = projected.planets.find(p => p.name === '紫炁');
  report('紫炁赤道匀行与黄道投影为两种独立口径', Math.abs(uniformQi.lon - 130.9334) < 0.01 && Math.abs(projectedQi.lon - uniformQi.lon) > 2, `${uniformQi.lon}/${projectedQi.lon}`);
  report('日月出没显示使用真太阳时口径', uniform.bottom_right.sunrise === '04:30' && uniform.bottom_right.sunset === '19:29', JSON.stringify(uniform.bottom_right));
  const huangdaoSample = { ...docsSample, xiu_method: 'huangdaohuigui', coord_system: 'huangdao' };
  const mingExpected = {
    sun_to_mao: ['辰', 203.713466], sun_to_sunrise: ['卯', 233.713466],
    horizon_rising: ['辰', 201.528157], rising_with_sun: ['辰', 203.713466]
  };
  report('四种命宫起法与天官专业样例对齐', Object.entries(mingExpected).every(([ming_gong_method, [gong, lon]]) => {
    const value = Q.calculateChart({ ...huangdaoSample, ming_gong_method }).liming;
    return value.ming_gong === gong && Math.abs(value.ming_du_lon - lon) < 0.00001;
  }), '');
  const shenExpected = {
    moon_is_shen: ['丑', 293.588443], moon_to_you: ['亥', 353.588443],
    moon_to_moonrise: ['酉', 53.588443], moon_to_sunset: ['戌', 23.588443]
  };
  report('四种身宫起法与天官专业样例对齐', Object.entries(shenExpected).every(([shen_gong_method, [gong, lon]]) => {
    const value = Q.calculateChart({ ...huangdaoSample, shen_gong_method }).liming;
    return value.shen_gong === gong && Math.abs(value.shen_du_lon - lon) < 0.00001;
  }), '');
  const equatorialRising = Q.calculateChart({ ...docsSample, ming_gong_method: 'horizon_rising' });
  report('地平东升点在赤道盘执行真赤道投影', Math.abs(equatorialRising.liming.ming_du_lon - 199.896788) < 0.00001, equatorialRising.liming.ming_du_lon);
  report('恩难仇用与守照/同络/同经/余奴关系层已生成',
    uniform.en_nan_yong.ming_gong_en_nan_yong.row1.join('') === '土火木水'
      && uniform.shouzhao.mingdu === '土对夹、日拱、月关、木刑、水对刑、火刑、金对刑'
      && uniform.tongluo.relations['罗']?.includes('计（对照）')
      && uniform.tongjing.relations['水']?.includes('孛（同宫）')
      && uniform.yunu['水']?.[0] === '孛（同经）', '');
  const relationFlow = Q.calculateLiunian({ ...docsSample, liunian_year: 2026, liuyue: 6, liuri: 15, liushi: '14:30' });
  report('流年守照/同络/同经/余奴与本命流年顶星已生成',
    relationFlow.liunian_shouzhao.mingdu === '流日拱、流火对夹'
      && relationFlow.liunian_yunu['流水']?.[0] === '流孛（同度）'
      && relationFlow.dongwei.natal_dingxing.join('') === '孛（暗）'
      && relationFlow.dongwei.liunian_dingxing.length === 3, '');
  report('流年底栏的太岁/小限/月限/飞限与天官语义对齐', relationFlow.bottom_left.tai_sui === '丙午'
    && relationFlow.bottom_left.xiaoxian === '酉' && relationFlow.bottom_left.yuexian === '酉'
    && relationFlow.bottom_left.feixian === '戌' && relationFlow.liunian_xiaoxian.liuyue_ganzhi === '丙午', JSON.stringify(relationFlow.bottom_left));
  const beforeLichunFlow = Q.calculateLiunian({ ...docsSample, liunian_year: 2024, liuyue: 1, liuri: 10, liushi: '12:00' });
  report('立春前流年同时保留当时太岁与所选公历流年', beforeLichunFlow.bottom_left.tai_sui === '癸卯'
    && beforeLichunFlow.liunian_xiaoxian.liuyue_ganzhi === '甲辰'
    && beforeLichunFlow.bottom_left.xiaoxian === '子' && beforeLichunFlow.bottom_left.feixian === '丑', JSON.stringify(beforeLichunFlow.bottom_left));
  const solarInput = Q.qiZheng({ ...docsSample, birth_time: uniform.basic.true_solar_time, time_type: 'solar_time' });
  const wallInput = Q.qiZheng(docsSample);
  report('真太阳时输入可反解到等价 UTC', solarInput.datetime.utc === wallInput.datetime.utc, `${solarInput.datetime.utc}/${wallInput.datetime.utc}`);
  report('三种昼夜判定参数均可用', ['sunrise_sunset', 'sunrise_sunset_shichen', 'mao_day_you_night'].every(day_night_method => Q.calculateChart({ ...docsSample, day_night_method }).bottom_right.day_night_method === day_night_method), '');
  const ziBase = { ...docsSample, birth_date: '2000-02-05', birth_time: '23:30', birth_lon: 120, birth_lat: 30, xiu_method: 'huangdaohuigui', coord_system: 'huangdao' };
  const ziSect2 = Q.calculateChart({ ...ziBase, distinguish_zi_hour: true }), ziSect1 = Q.calculateChart({ ...ziBase, distinguish_zi_hour: false });
  report('早晚子时开关切换 sect2/sect1 日柱', ziSect2.bazi.ri.zhi !== ziSect1.bazi.ri.zhi && ziSect2.engine.calendar.endsWith('sect2') && ziSect1.engine.calendar.endsWith('sect1'), `${ziSect2.bazi.ri.gan}${ziSect2.bazi.ri.zhi}/${ziSect1.bazi.ri.gan}${ziSect1.bazi.ri.zhi}`);
  const meanJieqi = Q.calculateChart({ ...docsSample, jieqi_method: 'mean' });
  report('平气按真冬至起算并均分回归年', meanJieqi.jieqi.prev.name === '芒种' && meanJieqi.jieqi.prev.date === '06-07 20:02'
    && meanJieqi.jieqi.next.name === '夏至' && meanJieqi.jieqi.next.date === '06-23 01:17', JSON.stringify(meanJieqi.jieqi));
  const lunarInput = Q.calculateChart({ ...docsSample, birth_date: '2000-01-01', birth_time: '14:00', date_type: 'lunar' });
  const solarEquivalent = Q.calculateChart({ ...docsSample, birth_date: '2000-02-05', birth_time: '14:00', date_type: 'solar' });
  report('农历输入转换到等价公历后再进行天文计算', lunarInput.basic.solar_date === '2000-02-05'
    && lunarInput.basic.lunar_date === '庚辰年 戊寅月 癸巳日 己未时'
    && Math.abs(lunarInput.planets[0].lon - solarEquivalent.planets[0].lon) < 1e-9, lunarInput.basic.solar_date);
  let toleranceRejected = false;
  try { Q.calculateChart({ ...request, tongluo_tolerance: 11 }); } catch { toleranceRejected = true; }
  report('越界容许度会明确拒绝', toleranceRejected, '');
}
// 12. CLI
{
  const r = await run('qizheng.cjs', ['2026-08-29', '18:00', '112.59']);
  report('CLI 七政可运行', r.code === 0 && r.out.includes('七政') && r.out.includes('四余'), r.out.slice(0, 80));
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
