// analyze.mjs — 规则分析层：十神 / 五行 / 简化强弱 / 格局 / 调候（节选）
// 说明：强弱与调候为简化实现，生产环境可按自家评测集调参替换
const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const STEM_WX = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];
const BRANCH_WX = ['水', '土', '木', '木', '土', '火', '火', '土', '金', '金', '土', '水'];
const HIDE = {
  子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'],
  辰: ['戊', '乙', '癸'], 巳: ['丙', '庚', '戊'], 午: ['丁', '己'],
  未: ['己', '丁', '乙'], 申: ['庚', '壬', '戊'], 酉: ['辛'],
  戌: ['戊', '辛', '丁'], 亥: ['壬', '甲']
};
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
// 调候速查表（金日主节选，据《穷通宝鉴》通行速查表录入；接入生产前请对照原文校订，其余日主请自行扩展）
const TIAOHOU = {
  庚: { 寅: ['丁', '甲'], 卯: ['丁', '甲'], 辰: ['甲', '丁', '壬'], 巳: ['壬', '戊', '丙'], 午: ['壬', '癸'], 未: ['丁', '甲'], 申: ['丁', '甲'], 酉: ['丁', '甲', '丙'], 戌: ['甲', '壬'], 亥: ['丁', '丙'], 子: ['丁', '甲', '丙'], 丑: ['丙', '丁', '甲'] },
  辛: { 寅: ['己', '壬', '庚'], 卯: ['壬', '甲'], 辰: ['壬', '甲'], 巳: ['壬', '甲', '癸'], 午: ['壬', '己', '癸'], 未: ['壬', '庚', '甲'], 申: ['壬', '甲', '戊'], 酉: ['壬', '甲'], 戌: ['壬', '甲'], 亥: ['壬', '丙'], 子: ['丙', '戊', '壬', '甲'], 丑: ['丙', '壬', '戊', '己'] }
};

export function shiShen(dayStem, other) {
  const di = STEMS.indexOf(dayStem), oi = STEMS.indexOf(other);
  const dw = STEM_WX[di], ow = STEM_WX[oi];
  const sameP = di % 2 === oi % 2;
  if (ow === dw) return sameP ? '比肩' : '劫财';
  if (SHENG[dw] === ow) return sameP ? '食神' : '伤官';
  if (SHENG[ow] === dw) return sameP ? '偏印' : '正印';
  if (KE[dw] === ow) return sameP ? '偏财' : '正财';
  if (KE[ow] === dw) return sameP ? '七杀' : '正官';
  return null;
}

const pad = v => (typeof v === 'string' ? v : v?.['天干'] || v?.['地支']);
export function analyze(chart) {
  const pillars = [chart['年柱'], chart['月柱'], chart['日柱'], chart['时柱']];
  const names = ['年', '月', '日', '时'];
  const day = chart['日主'];
  const dw = STEM_WX[STEMS.indexOf(day)];

  // 十神标注（优先用库自带的十神，缺了再算）
  const shiShenMap = {};
  names.forEach((n, i) => {
    const p = pillars[i];
    const st = pad(p['天干']);
    shiShenMap[n + '干'] = n === '日' ? '日主' : (p['天干']?.['十神'] || shiShen(day, st));
    const hides = HIDE[pad(p['地支'])] || [];
    shiShenMap[n + '支藏'] = hides.map(hd => `${hd}(${shiShen(day, hd)})`).join('·');
  });

  // 五行计数（天干 + 地支本气）
  const wuxing = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  pillars.forEach(p => {
    wuxing[STEM_WX[STEMS.indexOf(pad(p['天干']))]]++;
    wuxing[BRANCH_WX[BRANCHES.indexOf(pad(p['地支']))]]++;
  });

  // 简化强弱评分（可按评测集调参）
  let score = 0;
  const monthWx = BRANCH_WX[BRANCHES.indexOf(pad(pillars[1]['地支']))];
  if (monthWx === dw) score += 30;               // 得令（月支同五行）
  else if (SHENG[monthWx] === dw) score += 25;   // 月支生我
  let genRoot = 0, yinRoot = 0;
  pillars.forEach(p => {
    (HIDE[pad(p['地支'])] || []).forEach(hd => {
      const w = STEM_WX[STEMS.indexOf(hd)];
      if (w === dw && genRoot < 40) genRoot += 14;
      if (SHENG[w] === dw && yinRoot < 25) yinRoot += 10;
    });
  });
  let stemBi = 0, stemYin = 0;
  [0, 1, 3].forEach(idx => {
    const rel = shiShen(day, pad(pillars[idx]['天干']));
    if (rel === '比肩' || rel === '劫财') stemBi++;
    if (rel === '正印' || rel === '偏印') stemYin++;
  });
  score += genRoot + yinRoot + Math.min(stemBi, 1) * 15 + Math.min(stemYin, 2) * 8;
  const strength = score >= 200 ? '强' : score >= 120 ? '中和' : '弱';
  const favor = strength === '强' ? { 喜: '克泄耗（官杀/食伤/财）', 忌: '生扶（印/比劫）' } : { 喜: '生扶（印/比劫，土金类）', 忌: '克泄耗过重（财官食伤）' };

  // 格局：月支藏干透出天干者优先（比劫不取格），否则取月支本气
  const monthHides = HIDE[pad(pillars[1]['地支'])] || [];
  const stems = pillars.map(p => pad(p['天干']));
  let ge = null;
  for (const hd of monthHides) {
    const rel = shiShen(day, hd);
    if (stems.includes(hd) && !['比肩', '劫财'].includes(rel)) { ge = rel + '格'; break; }
  }
  if (!ge) {
    const rel = shiShen(day, monthHides[0]);
    ge = ['比肩', '劫财'].includes(rel) ? '正格（月劫，取食伤财官为用）' : rel + '格';
  }

  // 调候
  const tiaohou = TIAOHOU[day]?.[pillars[1]['地支']] || null;

  return {
    dayMaster: { stem: day, wuxing: dw, yinYang: STEMS.indexOf(day) % 2 === 0 ? '阳' : '阴' },
    shiShen: shiShenMap,
    wuxing,
    strength: { score, level: strength, favor },
    geju: ge,
    tiaohou: tiaohou ? { yong: tiaohou, note: '穷通宝鉴速查表节选，请对照原文校订' } : '未收录该日主，请扩展 TIAOHOU 表'
  };
}
