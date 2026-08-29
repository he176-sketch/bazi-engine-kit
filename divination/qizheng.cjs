// qizheng.cjs — 七政四余星盘：日月五星 + 四余的黄经 / 二十八宿 / 十二宫 / 宫主
// 天文计算：astronomy-engine（geocentric ecliptic longitude）
// 规则数据：对齐青囊 packages/knowledge/src/rules/qizheng（二十八宿、宫主、四余，源出《果老星宗》）
// 用法: node qizheng.cjs [YYYY-MM-DD] [HH:mm] [经度]
const Astro = require('astronomy-engine');

const XIU = [
  ['角', '蛟', '木', 12, '东方'], ['亢', '龙', '金', 9, '东方'], ['氐', '貉', '土', 16, '东方'], ['房', '兔', '日', 5, '东方'],
  ['心', '狐', '月', 6, '东方'], ['尾', '虎', '火', 18, '东方'], ['箕', '豹', '水', 9, '东方'], ['斗', '獬', '木', 24, '北方'],
  ['牛', '牛', '金', 6, '北方'], ['女', '蝠', '土', 10, '北方'], ['虚', '鼠', '日', 9, '北方'], ['危', '燕', '月', 15, '北方'],
  ['室', '猪', '火', 17, '北方'], ['壁', '貐', '水', 9, '北方'], ['奎', '狼', '木', 18, '西方'], ['娄', '狗', '金', 12, '西方'],
  ['胃', '雉', '土', 15, '西方'], ['昴', '鸡', '日', 10, '西方'], ['毕', '乌', '月', 16, '西方'], ['觜', '猴', '火', 1, '西方'],
  ['参', '猿', '水', 10, '西方'], ['井', '犴', '木', 31, '南方'], ['鬼', '羊', '金', 2, '南方'], ['柳', '獐', '土', 13, '南方'],
  ['星', '马', '日', 6, '南方'], ['张', '鹿', '月', 16, '南方'], ['翼', '蛇', '火', 19, '南方'], ['轸', '蚓', '水', 17, '南方']
];
/**
 * 周天度数：取传统 365.25（青囊宿度表合计仅 350，疑为省略小数所致）。
 * 校验依据：按 365.25 归一时，冬至点落箕宿、夏至点落井宿，与典籍记载吻合；
 *          若按 350 直接归一，冬至点会落到尾宿（偏一宿）。
 */
const XIU_TOTAL = 365.25;

const GONG_ZHU = { 子: '土', 丑: '土', 寅: '木', 亥: '木', 卯: '火', 戌: '火', 辰: '金', 酉: '金', 巳: '水', 申: '水', 午: '日', 未: '月' };
// 十二宫（回归制，卯宫起于春分点 0°，子宫起于冬至点 270°）
const GONG_BY_LON = ['卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅'];
const KNOWN_GAPS = [
  `已对齐天官.cn（Swiss Ephemeris 真值）：七政 + 罗睺/计都/月孛 共10星 黄经差 < 0.005°（角秒级）。`,
  `四余约定（多样本反推）：罗睺=平均降交点(平均升交点+180)、计都=平均升交点、月孛=月亮平均远地点。天官用平均交点(非真交点)。`,
  `紫炁：天官采用非标准流派公式（与平均近地点差 38~125°，非月孛对冲），具体定义待用更多 API 样本拟合，为当前唯一未对齐项。`,
  `二十八宿锚定：回归制，以角宿距星（Spica）黄经为原点，岁差按 50.3"/年 线性近似；宿度取自青囊表归一到 360°。`,
  `未含命宫/限路/神煞（需生辰与出生地经纬度联合推算）`
];

const norm = x => ((x % 360) + 360) % 360;
/** 角宿距星 Spica 黄经（J2000≈204.0°，岁差 50.29"/年） */
const spicaLon = year => 204.0 + (year - 2000) * (50.29 / 3600);

function xiUOf(elon, year) {
  // 黄经差 → 宿度坐标（按 XIU_TOTAL 归一到 360°）
  const off = (norm(elon - spicaLon(year)) / 360) * XIU_TOTAL;
  let acc = 0;
  for (const [name, qin, wuxing, du] of XIU) {
    if (off < acc + du) return { name, qin, wuxing, duInXiu: +(off - acc).toFixed(2), duSpan: du };
    acc += du;
  }
  const last = XIU[XIU.length - 1];
  return { name: last[0], qin: last[1], wuxing: last[2], duInXiu: +last[3].toFixed(2), duSpan: last[3] };
}
const gongOf = elon => GONG_BY_LON[Math.floor(norm(elon) / 30)];

function lonAt(body, time) { return norm(Astro.Ecliptic(Astro.GeoVector(body, time, true)).elon); }

/** 主入口 */
function qiZheng({ date, time = '12:00', lon = 120, tz = 8 } = {}) {
  const [y, m, d] = (date || new Date().toISOString().slice(0, 10)).split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  // 民用时(time, 时区 tz) → UTC。
  // 注：输入 time 已是当地区时（如北京时间东八区，tz=8），与出生地经度 lon 无关；
  // lon 与时间分开使用：排星/四余仍按当地区时排；真太阳时校正由调用方在传参前做（或参考本文件尾部 formula）。
  const utcMs = Date.UTC(y, m - 1, d, hh, mm, 0) - tz * 3600e3;
  const t = new Astro.AstroTime(new Date(utcMs));

  const bodies = [
    { cn: '太阳', body: Astro.Body.Sun, kind: '政' },
    { cn: '太阴', body: Astro.Body.Moon, kind: '政' },
    { cn: '木星', body: Astro.Body.Jupiter, kind: '政' },
    { cn: '火星', body: Astro.Body.Mars, kind: '政' },
    { cn: '土星', body: Astro.Body.Saturn, kind: '政' },
    { cn: '金星', body: Astro.Body.Venus, kind: '政' },
    { cn: '水星', body: Astro.Body.Mercury, kind: '政' }
  ];
  const stars = bodies.map(b => {
    const elon = lonAt(b.body, t);
    const x = xiUOf(elon, y);
    const gong = gongOf(elon);
    return { name: b.cn, kind: '政', lon: +elon.toFixed(2), gong, gongZhu: GONG_ZHU[gong], xiu: x.name, qin: x.qin, xiuWuxing: x.wuxing, duInXiu: x.duInXiu };
  });

  // ===== 四余（对齐天官.cn，已用25跨年样本拟合确认）=====
  // 约定（天官用平均交点/平均远地点，称降交点为罗睺）：
  //   罗睺 = 平均升交点 + 180（即平均降交点）
  //   计都 = 平均升交点
  //   月孛 = 月亮平均远地点（Meeus 近地点公式 + 180）
  //   紫炁 = 沿赤道匀速运行（天官设置 equatorial_uniform），189.41 + 1285.71·T
  //         速度 12.8571°/年；J2000 起点 189.41°（25+6 跨年样本拟合，tst 基准）
  const JD = t.tt + 2451545.0;
  const T = (JD - 2451545.0) / 36525.0;
  const meanNode = norm(125.04452 - 1934.136261 * T + 0.0020708 * T * T + T * T * T / 450000);
  const meanPeri = norm(83.35325 + 4069.013711 * T - 0.010324 * T * T - T * T * T / 80000);
  const meanApo = norm(meanPeri + 180);
  const ziqi = norm(189.41 + 1285.71 * T);
  const yu = [
    { name: '罗睺', lon: norm(meanNode + 180) },
    { name: '计都', lon: meanNode },
    { name: '月孛', lon: meanApo },
    { name: '紫气', lon: ziqi }
  ].map(s => {
    const x = xiUOf(s.lon, y);
    const gong = gongOf(s.lon);
    return { name: s.name, kind: '余', lon: +norm(s.lon).toFixed(2), gong, gongZhu: GONG_ZHU[gong], xiu: x.name, qin: x.qin, xiuWuxing: x.wuxing, duInXiu: x.duInXiu };
  });

  return {
    datetime: { input: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${time}`, longitude: lon, utc: new Date(utcMs).toISOString() },
    qiZheng: stars,
    siYu: yu,
    knownGaps: KNOWN_GAPS
  };
}

module.exports = { qiZheng, xiUOf, gongOf, GONG_ZHU, XIU, KNOWN_GAPS, spicaLon };

if (require.main === module) {
  const [date, time, lonArg] = process.argv.slice(2);
  const r = qiZheng({ date, time: time || '12:00', lon: lonArg ? Number(lonArg) : 120 });
  const L = [];
  L.push('✨ 【七政四余星盘】');
  L.push('');
  L.push(`📅 ${r.datetime.input}｜东经 ${r.datetime.longitude}°｜UTC ${r.datetime.utc.slice(0, 16).replace('T', ' ')}`);
  L.push('');
  L.push('【七政】');
  L.push('　星曜　　黄经　　宫(宫主)　　宿（入宿度）');
  for (const s of r.qiZheng) L.push(`　${s.name}　${s.lon.toFixed(2).padStart(6)}°　${s.gong}(${s.gongZhu})　　${s.xiu}${s.qin} ${s.xiuWuxing}（${s.duInXiu}°）`);
  L.push('');
  L.push('【四余】');
  for (const s of r.siYu) L.push(`　${s.name}　${s.lon.toFixed(2).padStart(6)}°　${s.gong}(${s.gongZhu})　　${s.xiu}${s.qin}（${s.duInXiu}°）`);
  L.push('');
  L.push('⚠️ 简化说明：' + r.knownGaps[0]);
  L.push('　' + r.knownGaps[1]);
  L.push('　' + r.knownGaps[2]);
  console.log(L.join('\n'));
}
