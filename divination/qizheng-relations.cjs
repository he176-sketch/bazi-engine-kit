// qizheng-relations.cjs — 守照、同络、同经、余奴、恩难仇用与顶星关系层。
//
// 规则由公开接口多样本差分与传统经络定义交叉验证：
// - 同络：十二宫相同宫内度，容许度由 tongluo_tolerance 控制；
// - 同经：角斗奎井等四宿同经，即二十八宿序号 mod 7 相同；
// - 守照：九个固定角距，命身点取 3°，星曜两两取 6°；
// - 余奴：水孛、木炁、火罗、土计，仅在同度/同经/三方/对照时列出。

const GONG_CYCLE = [...'戌酉申未午巳辰卯寅丑子亥'];
const PLANET_ORDER = ['日', '月', '水', '金', '火', '木', '土', '罗', '计', '孛', '炁'];
const SHOU_ORDER = ['金', '木', '水', '火', '土', '炁', '孛', '罗', '计'];
const POINT_SHOU_ORDER = ['土', '日', '月', '木', '水', '火', '金', '炁', '孛', '罗', '计'];
const FIVE_PLANETS = new Set(['金', '木', '水', '火', '土']);
const SHORT_NAME = {
  '日': '日', '月': '月', '水星': '水', '金星': '金', '火星': '火', '木星': '木', '土星': '土',
  '罗睺': '罗', '计都': '计', '月孛': '孛', '紫炁': '炁'
};
const ASPECTS = [
  [0, '守'], [30, '夹'], [45, '刑'], [60, '辅'], [90, '关'],
  [120, '拱'], [135, '对刑'], [150, '对夹'], [180, '照']
];
const YUNU_PAIRS = { '水': '孛', '木': '炁', '火': '罗', '土': '计' };
const EN_NAN_YONG = {
  '木': [['水', '金', '土', '火'], ['孛', '', '计', '罗']],
  '火': [['木', '水', '金', '土'], ['炁', '孛', '', '计']],
  '土': [['火', '木', '水', '金'], ['罗', '炁', '孛', '']],
  '金': [['土', '火', '木', '水'], ['计', '罗', '炁', '孛']],
  '水': [['金', '土', '火', '木'], ['', '计', '罗', '炁']],
  '日': [['金', '木', '土', '火'], ['水', '炁', '计', '罗']],
  '月': [['金', '土', '火', '木'], ['水', '计', '罗', '炁']]
};

const norm = value => ((value % 360) + 360) % 360;
const separation = (a, b) => Math.abs(((b - a + 540) % 360) - 180);
const degreeLineDistance = (a, b) => {
  const raw = Math.abs(norm(a) % 30 - norm(b) % 30);
  return Math.min(raw, 30 - raw);
};

function shortName(name) {
  const value = SHORT_NAME[name];
  if (!value) throw new TypeError(`未知七政四余星名: ${name}`);
  return value;
}

function ordered(planets) {
  const byName = Object.fromEntries(planets.map(planet => [shortName(planet.name), planet]));
  return PLANET_ORDER.filter(name => byName[name]).map(name => ({ ...byName[name], short: name }));
}

function relationTag(a, b) {
  if (a.gong === b.gong) return '同宫';
  const ai = GONG_CYCLE.indexOf(a.gong), bi = GONG_CYCLE.indexOf(b.gong);
  const gap = (bi - ai + 12) % 12;
  if (gap === 4 || gap === 8) return '三方';
  if (gap === 6) return '对照';
  return '';
}

function relationToken(name, tag, prefix = '') {
  return `${prefix}${name}${tag ? `（${tag}）` : ''}`;
}

function aspectLabel(a, b, orb) {
  const distance = separation(a, b);
  let best = null;
  for (const [angle, label] of ASPECTS) {
    const error = Math.abs(distance - angle);
    if (!best || error < best.error) best = { label, error };
  }
  return best.error <= orb ? best.label : null;
}

function pairAspectOrb(a, b) {
  if (FIVE_PLANETS.has(a) && FIVE_PLANETS.has(b)) return 6;
  if (FIVE_PLANETS.has(a) || FIVE_PLANETS.has(b)) return 4.5;
  return 2;
}

function buildShouzhao(planets, mingLon, shenLon, prefix = '') {
  const rows = ordered(planets), byShort = Object.fromEntries(rows.map(item => [item.short, item]));
  const pointText = point => POINT_SHOU_ORDER.flatMap(name => {
    const planet = byShort[name], label = planet && aspectLabel(point, planet.lon, 3);
    return label ? [`${prefix}${name}${label}`] : [];
  }).join('、');
  const relations = {};
  for (const name of SHOU_ORDER) {
    const source = byShort[name];
    if (!source) continue;
    const tokens = SHOU_ORDER.flatMap(targetName => {
      if (targetName === name || !byShort[targetName]) return [];
      const label = aspectLabel(source.lon, byShort[targetName].lon, pairAspectOrb(name, targetName));
      return label ? [`${prefix}${targetName}${label}`] : [];
    });
    if (tokens.length) relations[`${prefix}${name}`] = tokens.join('、');
  }
  return { mingdu: pointText(mingLon), shendu: pointText(shenLon), relations };
}

function pointTongluo(rows, point, tolerance, prefix) {
  if (tolerance <= 0) return [];
  const pointPlanet = { lon: point.lon, gong: point.gong };
  const limit = tolerance;
  return rows.flatMap(planet => degreeLineDistance(point.lon, planet.lon) <= limit
    ? [relationToken(planet.short, relationTag(pointPlanet, planet), prefix)] : []);
}

function buildTongluo(planets, mingPoint, shenPoint, tolerance = 2, prefix = '') {
  const rows = ordered(planets), relations = {};
  for (const source of rows) {
    const tokens = rows.flatMap(target => {
      if (target.short === source.short || degreeLineDistance(source.lon, target.lon) > tolerance) return [];
      return [relationToken(target.short, relationTag(source, target), prefix)];
    });
    if (tokens.length) relations[`${prefix}${source.short}`] = tokens;
  }
  return {
    mingdu: pointTongluo(rows, mingPoint, tolerance, prefix),
    shendu: pointTongluo(rows, shenPoint, tolerance, prefix),
    relations
  };
}

function buildTongjing(planets, jingGroups, prefix = '') {
  const rows = ordered(planets), relations = {};
  for (const source of rows) {
    const tokens = rows.flatMap(target => {
      if (target.short === source.short || jingGroups[source.short] == null || jingGroups[source.short] !== jingGroups[target.short]) return [];
      return [relationToken(target.short, relationTag(source, target), prefix)];
    });
    if (tokens.length) relations[`${prefix}${source.short}`] = tokens;
  }
  return { relations };
}

function tokenTag(relations, source, target, prefix) {
  const token = relations[`${prefix}${source}`]?.find(value => value.startsWith(`${prefix}${target}`));
  return token?.match(/（(.+)）$/)?.[1] || (token ? '同度' : null);
}

function buildYunu(tongluo, tongjing, prefix = '') {
  const result = {};
  for (const [source, target] of Object.entries(YUNU_PAIRS)) {
    const tags = [];
    const luoTag = tokenTag(tongluo.relations, source, target, prefix);
    const jingTag = tokenTag(tongjing.relations, source, target, prefix);
    if (luoTag) tags.push(luoTag);
    if (jingTag != null) tags.push('同经');
    if (tags.length) result[`${prefix}${source}`] = [`${prefix}${target}（${[...new Set(tags)].join('、')}）`];
  }
  return result;
}

function buildEnNanYong(mingGongZhu, mingZhu) {
  const make = master => {
    const rows = EN_NAN_YONG[master];
    return rows ? { row1: [...rows[0]], row2: [...rows[1]] } : { row1: [], row2: [] };
  };
  return { ming_gong_en_nan_yong: make(mingGongZhu), ming_du_en_nan_yong: make(mingZhu) };
}

function gongAt(lon) { return GONG_CYCLE[Math.floor(norm(lon) / 30)]; }

function buildDingxing(pointLon, planets, tolerance = 1.5, prefix = '') {
  if (tolerance <= 0) return [];
  const pointGong = gongAt(pointLon);
  return ordered(planets).flatMap(planet => {
    if (degreeLineDistance(pointLon, planet.lon) > tolerance) return [];
    return [`${prefix}${planet.short}（${planet.gong === pointGong ? '明' : '暗'}）`];
  });
}

function buildRelations({ planets, jingGroups, mingPoint, shenPoint, tongluoTolerance = 2, prefix = '' }) {
  const shouzhao = buildShouzhao(planets, mingPoint.lon, shenPoint.lon, prefix);
  const tongluo = buildTongluo(planets, mingPoint, shenPoint, tongluoTolerance, prefix);
  const tongjing = buildTongjing(planets, jingGroups, prefix);
  const yunu = buildYunu(tongluo, tongjing, prefix);
  return { shouzhao, tongluo, tongjing, yunu };
}

module.exports = {
  PLANET_ORDER, SHORT_NAME, shortName, separation, degreeLineDistance, relationTag,
  buildShouzhao, buildTongluo, buildTongjing, buildYunu, buildEnNanYong, buildDingxing, buildRelations
};
