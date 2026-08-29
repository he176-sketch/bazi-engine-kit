// daliuren.mjs — 大六壬起课（基础版）：月将 / 天地盘 / 四课 / 九宗门三传 / 天将 / 六亲 / 遁干
// 规则来源：《六壬大全》卷一·入手法九宗门、卷二·十二天将月将（对齐青囊 packages/knowledge/src/rules/daliuren）
// 用法: node daliuren.mjs [YYYY-MM-DD] [时辰(地支或0-23)] [月将(可选，默认按中气自动取)]
// ⚠️ 九宗门为「基础版」：完整实现贼克(元首/重审)、比用(知一)、遥克(蒿矢/弹射)、昴星；
//    涉害取孟仲季简化、别责/八专/伏吟/返吟未完整实现（见 KNOWN_GAPS）

const ZHI12 = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GAN10 = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const KNOWN_GAPS = [
  '涉害（取孟仲季简化，未数涉害深浅）',
  '别责 / 八专 / 伏吟 / 返吟（未独立实现）',
  '天将起例：采用通行简化法「贵人加临占时、昼顺夜逆」，各书流派不一'
];

const zhiIdx = z => ZHI12.indexOf(z);
const zhiAt = i => ZHI12[((i % 12) + 12) % 12];

/** 十干寄宫 */
const GAN_JI_GONG = { 甲: '寅', 乙: '辰', 丙: '巳', 丁: '未', 戊: '巳', 己: '未', 庚: '申', 辛: '戌', 壬: '亥', 癸: '丑' };
/** 十二天将（起例顺序：贵人起，顺布为阳、逆布为阴） */
const TIAN_JIANG = ['贵人', '腾蛇', '朱雀', '六合', '勾陈', '青龙', '天空', '白虎', '太常', '玄武', '太阴', '天后'];
/** 贵人起例：甲戊庚牛羊，乙己鼠猴乡，丙丁猪鸡位，壬癸兔蛇藏，六辛逢马虎 */
const GUI_REN = {
  甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'],
  乙: ['子', '申'], 己: ['子', '申'],
  丙: ['亥', '酉'], 丁: ['亥', '酉'],
  壬: ['卯', '巳'], 癸: ['卯', '巳'],
  辛: ['午', '寅']
};
const ZHI_WUXING = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
const GAN_WUXING = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const WUXING_KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const WUXING_SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };

/** 节气序列（自冬至起）→ 月将（太阳过宫，每两个节气一组） */
const JIEQI_ORDER = ['冬至', '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪'];
const JIANG_ORDER = ['丑', '子', '亥', '戌', '酉', '申', '未', '午', '巳', '辰', '卯', '寅'];

function yueJiangByJieQi(jieQi) {
  const idx = JIEQI_ORDER.indexOf(jieQi);
  if (idx < 0) return '丑';
  return JIANG_ORDER[Math.floor(idx / 2)];
}

/** 天地盘：月将加时 */
function tianDiPan(yueJiang, shiZhi) {
  const m = zhiIdx(yueJiang), t = zhiIdx(shiZhi);
  return Array.from({ length: 12 }, (_, p) => ((m + p - t) % 12 + 12) % 12);
}

/** 四课 */
function siKe(dayGan, dayZhi, tianPan) {
  const ganGong = zhiIdx(GAN_JI_GONG[dayGan]);
  const zhiPos = zhiIdx(dayZhi);
  const g1 = tianPan[ganGong];      // 干上神
  const g2 = tianPan[g1];           // 干阴神
  const z1 = tianPan[zhiPos];       // 支上神
  const z2 = tianPan[z1];           // 支阴神
  return [g1, g2, z1, z2];
}

/** 九宗门发用 → 三传 */
function sanChuan(dayGan, dayZhi, tianPan) {
  const [g1, g2, z1, z2] = siKe(dayGan, dayZhi, tianPan);
  const ganGong = zhiIdx(GAN_JI_GONG[dayGan]);
  const zhiPos = zhiIdx(dayZhi);
  const courses = [
    { xia: ganGong, shang: g1, name: '第一课' },
    { xia: g1, shang: g2, name: '第二课' },
    { xia: zhiPos, shang: z1, name: '第三课' },
    { xia: z1, shang: z2, name: '第四课' }
  ];
  const xiaKeShang = [], shangKeXia = [];
  for (const c of courses) {
    const xw = ZHI_WUXING[zhiAt(c.xia)], sw = ZHI_WUXING[zhiAt(c.shang)];
    if (WUXING_KE[xw] === sw) xiaKeShang.push(c.shang);
    if (WUXING_KE[sw] === xw) shangKeXia.push(c.shang);
  }
  let chu;
  if (xiaKeShang.length === 1) chu = xiaKeShang[0];
  else if (xiaKeShang.length > 1) chu = biYong(xiaKeShang, dayGan) ?? sheHai(xiaKeShang);
  else if (shangKeXia.length === 1) chu = shangKeXia[0];
  else if (shangKeXia.length > 1) chu = biYong(shangKeXia, dayGan) ?? sheHai(shangKeXia);
  else {
    const yk = yaoKeFa(dayGan, [g1, g2, z1, z2]);
    if (yk.chu >= 0) chu = yk.chu;
    else {
      // 昴星：阳日取酉上神，阴日取酉下神
      chu = '甲丙戊庚壬'.includes(dayGan) ? tianPan[zhiIdx('酉')] : zhiIdx('酉');
    }
  }
  const zhong = tianPan[chu];
  const mo = tianPan[zhong];
  let method = '贼克';
  if (xiaKeShang.length === 1) method = '重审（下贼上）';
  else if (shangKeXia.length === 1) method = '元首（上克下）';
  else if (xiaKeShang.length > 1 || shangKeXia.length > 1) method = '知一/涉害（比用或涉害）';
  else if (yaoKeFa(dayGan, [g1, g2, z1, z2]).chu >= 0) method = '遥克（蒿矢/弹射）';
  else method = '昴星';
  return { chu, zhong, mo, method, courses };
}

function biYong(candidates, dayGan) {
  const isYangGan = '甲丙戊庚壬'.includes(dayGan);
  const yangZhi = new Set([0, 2, 4, 6, 8, 10]);
  for (const c of candidates) if (isYangGan === yangZhi.has(c % 12)) return c;
  return null;
}
/** 涉害（简化）：孟(寅申巳亥) > 仲(子午卯酉) > 季(辰戌丑未) */
function sheHai(candidates) {
  const rank = c => ([5, 9, 3, 11].includes(c % 12) ? 3 : [0, 6, 2, 8].includes(c % 12) ? 2 : 1);
  return [...candidates].sort((a, b) => rank(b) - rank(a))[0];
}
function yaoKeFa(dayGan, ke) {
  const ganWx = ZHI_WUXING[zhiAt(zhiIdx(GAN_JI_GONG[dayGan]))];
  for (const k of ke) if (WUXING_KE[ZHI_WUXING[zhiAt(k)]] === ganWx) return { chu: k, kind: '蒿矢（神遥克日）' };
  for (const k of ke) if (WUXING_KE[ganWx] === ZHI_WUXING[zhiAt(k)]) return { chu: k, kind: '弹射（日遥克神）' };
  return { chu: -1 };
}

/**
 * 天将起例：贵人加临占时（天盘贵人落在地盘时支），再顺/逆布十二天将。
 * ⚠️ 流派差异：贵人加临与顺逆之法各书不一，本实现采用通行简化法「昼顺夜逆」。
 *    起例所得贵支（甲戊庚牛羊…）仅用于选取昼贵/夜贵。
 */
function tianJiang(dayGan, shiZhi, isDay = true) {
  const pair = GUI_REN[dayGan] || ['丑', '未'];
  const guiBenJia = isDay ? pair[0] : pair[1];   // 贵人本家支（昼贵/夜贵）
  const start = zhiIdx(shiZhi);                   // 贵人加临占时位
  const forward = isDay;                          // 昼顺布、夜逆布（简化法）
  const arr = [];
  for (let p = 0; p < 12; p++) {
    const idx = forward ? (start + p) % 12 : ((start - p) % 12 + 12) % 12;
    arr[zhiAt(idx)] = TIAN_JIANG[p];
  }
  return { guiBenJia, guiAt: zhiAt(start), dir: forward ? '顺布' : '逆布', jiang: arr };
}

/** 六亲：以日干五行为「我」，天盘地支五行对日干的关系 */
function liuQin(dayGan, zhiSeq) {
  const me = GAN_WUXING[dayGan];
  const w = ZHI_WUXING[zhiAt(zhiSeq)];
  if (w === me) return '比肩(兄弟)';
  if (WUXING_SHENG[me] === w) return '子孙(泄气)';
  if (WUXING_KE[me] === w) return '妻财';
  if (WUXING_KE[w] === me) return '官鬼';
  if (WUXING_SHENG[w] === me) return '父母(生气)';
  return '—';
}

/** 遁干（五鼠遁：日干起子时） */
function dunGan(dayGan, zhiSeq) {
  const base = { 甲: '甲', 己: '甲', 乙: '丙', 庚: '丙', 丙: '戊', 辛: '戊', 丁: '庚', 壬: '庚', 戊: '壬', 癸: '壬' }[dayGan] || '甲';
  return GAN10[(GAN10.indexOf(base) + (zhiSeq % 12)) % 10];
}

/** 主入口：起课 */
async function qiKe({ date, shiZhi, yueJiang: forcedJiang } = {}) {
  const ct = await import('cantian-tymext');
  const { paipan } = await import('../engine/paipan.mjs');

  const [y, m, d] = (date || new Date().toISOString().slice(0, 10)).split('-').map(Number);
  const solarDay = ct.SolarDay.fromYmd(y, m, d);
  const jieQi = solarDay.getTerm()?.getName?.() || solarDay.getTerm() || '';
  const yueJiang = forcedJiang || yueJiangByJieQi(jieQi);

  // 日干支：用排盘引擎（北京时间，正午避免子时争议）
  const chart = paipan({ cal: 'solar', date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, time: '12:00', gender: 1, sect: 2, lon: 120 });
  const dayGanZhi = chart.fourPillars.split(' ')[2];
  const dayGan = dayGanZhi[0], dayZhi = dayGanZhi[1];

  const tianPan = tianDiPan(yueJiang, shiZhi);
  const ke = siKe(dayGan, dayZhi, tianPan);
  const chuan = sanChuan(dayGan, dayZhi, tianPan);
  const isDay = [3, 4, 5, 6, 7, 8].includes(zhiIdx(shiZhi)); // 卯~酉为昼
  const jiang = tianJiang(dayGan, shiZhi, isDay);

  const z = i => zhiAt(i);
  return {
    date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    jieQi, yueJiang, shiZhi,
    dayGanZhi, dayGan, dayZhi,
    tianPan: tianPan.map((v, i) => `${z(i)}:${z(v)}`),
    siKe: [
      { name: '第一课 干上神', zhi: z(ke[0]), dun: dunGan(dayGan, ke[0]), liuQin: liuQin(dayGan, ke[0]), jiang: jiang.jiang[z(ke[0])] },
      { name: '第二课 干阴神', zhi: z(ke[1]), dun: dunGan(dayGan, ke[1]), liuQin: liuQin(dayGan, ke[1]), jiang: jiang.jiang[z(ke[1])] },
      { name: '第三课 支上神', zhi: z(ke[2]), dun: dunGan(dayGan, ke[2]), liuQin: liuQin(dayGan, ke[2]), jiang: jiang.jiang[z(ke[2])] },
      { name: '第四课 支阴神', zhi: z(ke[3]), dun: dunGan(dayGan, ke[3]), liuQin: liuQin(dayGan, ke[3]), jiang: jiang.jiang[z(ke[3])] }
    ],
    sanChuan: {
      method: chuan.method,
      chu: { zhi: z(chuan.chu), dun: dunGan(dayGan, chuan.chu), liuQin: liuQin(dayGan, chuan.chu), jiang: jiang.jiang[z(chuan.chu)] },
      zhong: { zhi: z(chuan.zhong), dun: dunGan(dayGan, chuan.zhong), liuQin: liuQin(dayGan, chuan.zhong), jiang: jiang.jiang[z(chuan.zhong)] },
      mo: { zhi: z(chuan.mo), dun: dunGan(dayGan, chuan.mo), liuQin: liuQin(dayGan, chuan.mo), jiang: jiang.jiang[z(chuan.mo)] }
    },
    tianJiang: { guiRenBenJia: jiang.guiBenJia, guiRenAt: jiang.guiAt, direction: jiang.dir, dayNight: isDay ? '昼' : '夜', pan: ZHI12.map(zz => `${zz}:${jiang.jiang[zz]}`) },
    knownGaps: KNOWN_GAPS
  };
}

module.exports = { qiKe, tianDiPan, siKe, sanChuan, yueJiangByJieQi, zhiIdx, zhiAt, GAN_JI_GONG, GUI_REN, TIAN_JIANG, KNOWN_GAPS };

if (require.main === module) {
  (async () => {
    const [date, shi, jiang] = process.argv.slice(2);
    let shiZhi = shi;
    if (shi && /^\d+$/.test(shi)) {
      const h = +shi;
      shiZhi = ZHI12[Math.floor(((h + 1) % 24) / 2)];
    }
    if (!shiZhi) shiZhi = ZHI12[Math.floor(((new Date().getHours() + 1) % 24) / 2)];
    const r = await qiKe({ date, shiZhi, yueJiang: jiang });
    const L = [];
    L.push('🎴 【大六壬课式】（基础版）');
    L.push('');
    L.push(`📅 占日：${r.date}｜节气：${r.jieQi}｜日干支：${r.dayGanZhi}`);
    L.push(`🌙 月将：${r.yueJiang}（太阳过宫）｜占时：${r.shiZhi}时`);
    L.push('');
    L.push('【天地盘】月将加时');
    L.push('　' + r.tianPan.join(' '));
    L.push('');
    L.push('【四课】');
    for (const k of r.siKe) L.push(`　${k.name}：${k.zhi}（遁${k.dun}）${k.liuQin}·${k.jiang}`);
    L.push('');
    L.push(`【三传】${r.sanChuan.method}`);
    L.push(`　初传 ${r.sanChuan.chu.zhi}（遁${r.sanChuan.chu.dun}）${r.sanChuan.chu.liuQin}·${r.sanChuan.chu.jiang}`);
    L.push(`　中传 ${r.sanChuan.zhong.zhi}（遁${r.sanChuan.zhong.dun}）${r.sanChuan.zhong.liuQin}·${r.sanChuan.zhong.jiang}`);
    L.push(`　末传 ${r.sanChuan.mo.zhi}（遁${r.sanChuan.mo.dun}）${r.sanChuan.mo.liuQin}·${r.sanChuan.mo.jiang}`);
    L.push('');
    L.push(`【天将】贵人加临${r.tianJiang.guiRenAt}位·${r.tianJiang.direction}（${r.tianJiang.dayNight}占，贵人本家${r.tianJiang.guiRenBenJia}）`);
    L.push('　' + r.tianJiang.pan.join(' '));
    L.push('');
    L.push('⚠️ 未完整实现：' + r.knownGaps.join('｜'));
    L.push('　课象仅供参考，重大决策请以现实判断为准。');
    console.log(L.join('\n'));
  })();
}
