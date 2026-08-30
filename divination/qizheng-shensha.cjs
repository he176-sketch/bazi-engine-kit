// qizheng-shensha.cjs — 果老十一曜化曜、年/月神煞、长生与星曜庙旺规则层。
//
// 规则表与天文计算彻底分离。表内只保存传统对应关系，不包含外部程序代码；
// “垣/殿/互垣/互躔/失地/断躔”由宫主、度主的五行生克实时推导。

const GANS = [...'甲乙丙丁戊己庚辛壬癸'];
const ZHIS = [...'子丑寅卯辰巳午未申酉戌亥'];
const STAR_NAMES = { 火: '火星', 孛: '月孛', 木: '木星', 金: '金星', 土: '土星', 月: '月', 水: '水星', 炁: '紫炁', 计: '计都', 罗: '罗睺', 日: '日' };

const SHIYI_NAMES = ['天禄', '天暗', '天福', '天耗', '天荫', '天贵', '天刑', '天印', '天囚', '天权'];
const SHIYI_BASE = [...'火孛木金土月水炁计罗'];

// 天官十神化曜。每一行依次为：正财、偏财、天官、七杀、印绶、枭神、比肩、劫财、食神、伤官。
const TIANGUAN_NAMES = ['正财', '偏财', '天官', '七杀', '印绶', '枭神', '比肩', '劫财', '食神', '伤官'];
const TIANGUAN_ROWS = {
  甲: ['月', '土', '炁', '水', '罗', '计', '火', '孛', '木', '金'],
  乙: ['土', '月', '水', '炁', '计', '罗', '孛', '火', '金', '木'],
  丙: ['炁', '水', '罗', '计', '孛', '火', '木', '金', '土', '月'],
  丁: ['水', '炁', '计', '罗', '火', '孛', '金', '木', '月', '土'],
  戊: ['罗', '计', '孛', '火', '金', '木', '土', '月', '水', '炁'],
  己: ['计', '罗', '火', '孛', '木', '金', '月', '土', '炁', '水'],
  庚: ['孛', '火', '金', '木', '月', '土', '水', '炁', '计', '罗'],
  辛: ['火', '孛', '木', '金', '土', '月', '炁', '水', '罗', '计'],
  壬: ['金', '木', '月', '土', '炁', '水', '计', '罗', '火', '孛'],
  癸: ['木', '金', '土', '月', '水', '炁', '罗', '计', '孛', '火']
};

// 以年干横取；字符串顺序均为甲乙丙丁戊己庚辛壬癸。
const NIANGAN = {
  禄勋: '寅卯巳午巳午申酉亥子', 羊刃: '卯辰午未午未酉戌子丑', 飞刃: '酉戌子丑子丑卯辰午未',
  唐符: '酉戌子丑子丑卯辰午未', 国印: '戌亥丑寅丑寅辰巳未申', 天贵: '未申酉亥丑子丑寅卯巳',
  天乙: '未申酉亥丑子丑寅卯巳', 玉贵: '丑子亥酉未申未午巳卯', 玉堂: '丑子亥酉未申未午巳卯',
  文昌: '巳午申酉申酉亥戌寅卯', 流霞: '酉戌未申巳午辰卯亥寅', 红艳: '午申寅未辰辰戌酉子申',
  天厨: '巳午子巳午申寅午酉亥', 官贵: '酉申子亥卯寅午巳午巳', 福贵: '寅丑子酉申未午巳辰卯',
  学堂: '亥午寅酉寅酉巳子申卯'
};

// 太岁十二神的固定顺行环。
const YEAR_RING = [
  ['太岁', '岁驾', '伏尸', '剑锋'],
  ['天空', '晦气', '太阳'],
  ['丧门', '地雌', '地丧'],
  ['贯索', '勾神', '太阴', '勾绞', '卒暴'],
  ['飞符', '官符', '五鬼', '三台', '年符'],
  ['月德', '死符', '小耗'],
  ['岁破', '大耗', '阑干', '月空'],
  ['天厄', '暴败', '紫微', '龙德'],
  ['白虎', '天雄'],
  ['天德', '卷舌', '绞杀', '福星', '福德'],
  ['天狗', '吊客'],
  ['病符', '蓦越']
];

// 以年支横取；字符串顺序均为子丑寅卯辰巳午未申酉戌亥。
const NIANZHI_SPECIAL = {
  飞廉: '申酉戌巳午未寅卯辰亥子丑', 大杀: '申酉戌巳午未寅卯辰亥子丑', 飞镰: '申酉戌巳午未寅卯辰亥子丑',
  破碎: '巳丑酉巳丑酉巳丑酉巳丑酉', 的杀: '巳丑酉巳丑酉巳丑酉巳丑酉', 桃花: '酉午卯子酉午卯子酉午卯子',
  咸池: '酉午卯子酉午卯子酉午卯子', 孤辰: '寅寅巳巳巳申申申亥亥亥寅', 寡宿: '戌戌丑丑丑辰辰辰未未未戌',
  三刑: '卯戌巳子辰申午丑寅酉未亥', 穿心: '未午巳辰卯寅丑子亥戌酉申', 红鸾: '卯寅丑子亥戌酉申未午巳辰',
  天喜: '酉申未午巳辰卯寅丑子亥戌', 浮沉: '戌酉申未午巳辰卯寅丑子亥', 血刃: '戌酉申未午巳辰卯寅丑子亥',
  天解: '戌酉申未午巳辰卯寅丑子亥', 解神: '戌酉申未午巳辰卯寅丑子亥', 地解: '未未申申酉酉戌戌亥亥午午',
  天哭: '午巳辰卯寅丑子寅戌酉申未', 披头: '辰卯寅丑子亥戌酉申未午巳', 黄幡: '辰丑未戌辰丑未戌辰丑未戌',
  豹尾: '戌未辰丑戌未辰丑戌未辰丑', 驿马: '寅亥申巳寅亥申巳寅亥申巳', 六害: '未午巳辰卯寅丑子亥戌酉申',
  斗杓: '卯子酉午卯子酉午卯子酉午', 华盖: '辰丑戌未辰丑戌未辰丑戌未', 劫杀: '巳寅亥申巳寅亥申巳寅亥申',
  灾杀: '午卯子酉午卯子酉午卯子酉', 囚狱: '午卯子酉午卯子酉午卯子酉', 天杀: '未辰丑戌未辰丑戌未辰丑戌',
  地杀: '申巳寅亥申巳寅亥申巳寅亥', 指背: '申巳寅亥申巳寅亥申巳寅亥', 年煞: '酉午卯子酉午卯子酉午卯子',
  月煞: '戌未辰丑戌未辰丑戌未辰丑', 吞陷: '戌寅丑戌辰卯寅寅戌戌寅戌', 亡神: '亥申巳寅亥申巳寅亥申巳寅',
  七煞: '亥申巳寅亥申巳寅亥申巳寅', 将星: '子酉午卯子酉午卯子酉午卯', 板鞍: '丑戌未辰丑戌未辰丑戌未辰',
  擎天: '申午辰卯子酉未巳卯子戌申', 游奕: '巳午未申酉戌亥子丑寅卯辰', 岁合: '丑子亥戌酉申未午巳辰卯寅',
  披麻: '酉戌亥子丑寅卯辰巳午未申', 卦气: '寅寅午午午巳寅午亥亥寅寅'
};

const YUEZHI = {
  月廉: '午未申酉戌亥子丑寅卯辰巳', 月杀: '申酉戌巳午未寅卯辰亥子丑', 天耗: '申戌子寅辰午申戌子寅辰午',
  地耗: '巳未酉亥丑卯巳未酉亥丑卯', 月符: '辰巳午未申酉戌亥子丑寅卯', 注受: '寅丑子亥戌酉戌亥子丑寅卯',
  值难: '金金日日月月火罗水孛木炁'
};

const CHANGSHENG = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
const CHANGSHENG_START = { 木: '亥', 火: '寅', 土: '寅', 金: '巳', 水: '申' };

const GAN_LU_STAR = { 甲: '火', 乙: '孛', 丙: '木', 丁: '金', 戊: '土', 己: '月', 庚: '水', 辛: '炁', 壬: '计', 癸: '罗' };
const GAN_LU_BRANCH = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
const GAN_ELEMENT = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const BRANCH_ELEMENT = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
const QIGUA_START = { 甲: '亥', 壬: '亥', 乙: '申', 癸: '申', 戊: '子', 丙: '寅', 庚: '卯', 辛: '巳', 己: '午', 丁: '酉' };
const GAN_EXTENDED = {
  生官: '月土炁水罗计孛火金木', 伤官: '金木月土炁水罗计火孛', 禄元: '木火水日水日水金木土',
  仁元: '木木火火土土金金水水', 文星: '罗计金火金炁木土日月', 魁星: '月日罗计火金水孛炁水',
  官星: '炁水罗计孛火金木月土', 印星: '木日火月土罗金计水孛', 催官: '金水日罗木炁孛土月计',
  禄神: '木水计罗土火金炁日月', 喜神: '罗计炁水月土金木孛火', 科名: '木木火火土土金金水水'
};
const BRANCH_STAR = {
  爵星: '土水木炁孛木水火火金金水', 天马: '火计水木火计水木火计水木', 地驿: '木水金火木水金火木水金火',
  血支: '木土土木火金水日月水金火', 血忌: '日土土月木水火金金火水木', 产星: '金水木火金水木火金水木火'
};

const GENERATES = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const CONTROLS = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const PLANET_ELEMENT = { 水星: '水', 金星: '金', 火星: '火', 木星: '木', 土星: '土' };

// 庙旺乐喜怒只列传统星宫特性；垣殿和五行关系另由算法添加。
const DIGNITY = {
  日: { 子: ['殿'], 寅: ['喜'], 巳: ['旺'], 午: ['垣', '乐'], 申: ['怒'], 戌: ['庙'] },
  月: { 寅: ['怒'], 未: ['垣', '乐'], 酉: ['旺'], 戌: ['庙'], 亥: ['喜'] },
  水星: { 辰: ['喜'], 巳: ['旺', '乐'], 申: ['乐'], 午: ['庙'], 戌: ['怒'] },
  金星: { 辰: ['庙', '乐'], 酉: ['乐'], 午: ['旺'], 亥: ['旺'], 寅: ['怒'] },
  火星: { 卯: ['庙', '乐'], 戌: ['乐'], 丑: ['旺'], 申: ['喜'], 酉: ['怒'] },
  木星: { 寅: ['乐'], 亥: ['庙', '旺', '乐'], 未: ['旺', '喜'], 子: ['怒'] },
  土星: { 子: ['乐'], 丑: ['庙', '乐'], 卯: ['旺'], 辰: ['旺'], 午: ['喜'], 巳: ['怒'] },
  罗睺: { 寅: ['庙'], 卯: ['旺'], 午: ['庙', '乐'], 申: ['怒'], 戌: ['喜'] },
  计都: { 子: ['乐'], 卯: ['旺'], 辰: ['怒'], 巳: ['庙'], 戌: ['旺'] },
  月孛: { 寅: ['旺'], 辰: ['乐'], 未: ['庙'], 戌: ['怒'] },
  紫炁: { 丑: ['旺'], 未: ['怒'], 申: ['庙'], 戌: ['乐'] }
};

const MOTION_LIMITS = {
  水星: { station: 0.01, slow: 0.5, fast: 1.5 }, 金星: { station: 0.01, slow: 0.5, fast: 1.3 },
  火星: { station: 0.008, slow: 0.3, fast: 0.65 }, 木星: { station: 0.003, slow: 0.04, fast: 0.22 },
  土星: { station: 0.002, slow: 0.015, fast: 0.13 }
};

function tableByIndex(table, index) {
  return Object.fromEntries(Object.entries(table).map(([name, values]) => [name, [...values][index]]));
}

function buildShiyi(yearGan) {
  const offset = GANS.indexOf(yearGan);
  if (offset < 0) throw new TypeError(`无效年干: ${yearGan}`);
  return Object.fromEntries(SHIYI_NAMES.map((name, i) => [name, STAR_NAMES[SHIYI_BASE[(i + offset) % 10]]]));
}

function buildTianguan(yearGan) {
  const row = TIANGUAN_ROWS[yearGan];
  if (!row) throw new TypeError(`无效年干: ${yearGan}`);
  return Object.fromEntries(TIANGUAN_NAMES.map((name, i) => [name, STAR_NAMES[row[i]]]));
}

function buildHuayao(shiyi, tianguan) {
  const result = {};
  for (const [label, star] of [...Object.entries(shiyi), ...Object.entries(tianguan)]) (result[star] ??= []).push(label);
  return result;
}

function fiveTigerGan(yearGan, targetZhi) {
  const first = { 甲: '丙', 己: '丙', 乙: '戊', 庚: '戊', 丙: '庚', 辛: '庚', 丁: '壬', 壬: '壬', 戊: '甲', 癸: '甲' }[yearGan];
  const steps = (ZHIS.indexOf(targetZhi) - ZHIS.indexOf('寅') + 12) % 12;
  return GANS[(GANS.indexOf(first) + steps) % 10];
}

function qiguaGanAt(yearGan, targetZhi, reverse = false) {
  const start = ZHIS.indexOf(QIGUA_START[yearGan]), target = ZHIS.indexOf(targetZhi);
  const steps = reverse ? (start - target + 12) % 12 : (target - start + 12) % 12;
  return GANS[(GANS.indexOf(yearGan) + steps) % 10];
}

function extendedHuayao(yearGan, yearZhi, nayin, context, nianzhi) {
  const gi = GANS.indexOf(yearGan), zi = ZHIS.indexOf(yearZhi), result = {};
  for (const [name, values] of Object.entries(GAN_EXTENDED)) result[name] = STAR_NAMES[[...values][gi]];
  for (const [name, values] of Object.entries(BRANCH_STAR)) result[name] = STAR_NAMES[[...values][zi]];
  const nayinElement = [...'木火土金水'].find(element => String(nayin).includes(element));
  if (nayinElement) result.寿元 = STAR_NAMES[nayinElement];
  if (context.mingGong) {
    const mingGan = fiveTigerGan(yearGan, context.mingGong);
    result.天元 = STAR_NAMES[GAN_LU_STAR[mingGan]];
    result.天经 = STAR_NAMES[GAN_ELEMENT[mingGan]];
    result.地纬 = STAR_NAMES[BRANCH_ELEMENT[context.mingGong]];
    result.职元 = STAR_NAMES[GAN_LU_STAR[qiguaGanAt(yearGan, context.mingGong)]];
    const zhiGan = qiguaGanAt(yearGan, context.mingGong);
    const paired = { 甲: '己', 己: '甲', 乙: '庚', 庚: '乙', 丙: '辛', 辛: '丙', 丁: '壬', 壬: '丁', 戊: '癸', 癸: '戊' }[zhiGan];
    result.局主 = STAR_NAMES[GAN_LU_STAR[paired]];
    result.地元 = STAR_NAMES[GAN_ELEMENT[qiguaGanAt(yearGan, context.mingGong, true)]];
    const officerGong = ZHIS[(ZHIS.indexOf(context.mingGong) + 3) % 12], officerGan = fiveTigerGan(yearGan, officerGong);
    const controlledElement = Object.entries(CONTROLS).find(([, value]) => value === GAN_ELEMENT[officerGan])?.[0];
    if (controlledElement) result.人元 = STAR_NAMES[controlledElement];
    const opposite = ZHIS[(ZHIS.indexOf(context.mingGong) + 6) % 12];
    if (context.gongZhu?.[opposite]) result.科甲 = STAR_NAMES[context.gongZhu[opposite]];
  }
  const horseGong = nianzhi.驿马;
  if (context.gongZhu?.[horseGong]) result.马元 = STAR_NAMES[context.gongZhu[horseGong]];
  return result;
}

function xunkong(yearGan, yearZhi) {
  const gi = GANS.indexOf(yearGan), zi = ZHIS.indexOf(yearZhi);
  const sexagenaryIndex = Array.from({ length: 60 }, (_, i) => i).find(i => i % 10 === gi && i % 12 === zi);
  if (sexagenaryIndex == null) throw new TypeError(`无效年柱: ${yearGan}${yearZhi}`);
  const xun = Math.floor(sexagenaryIndex / 10), start = (xun * 10) % 12;
  return ZHIS[(start + (gi % 2 === 0 ? 10 : 11)) % 12];
}

function buildNianzhi(yearGan, yearZhi) {
  const index = ZHIS.indexOf(yearZhi);
  if (index < 0) throw new TypeError(`无效年支: ${yearZhi}`);
  const result = { 岁殿: ZHIS[(index + GANS.indexOf(yearGan)) % 12], 空亡: xunkong(yearGan, yearZhi) };
  result.孤虚 = ZHIS[(ZHIS.indexOf(result.空亡) + 6) % 12];
  YEAR_RING.forEach((names, offset) => names.forEach(name => { result[name] = ZHIS[(index + offset) % 12]; }));
  result.八座 = ZHIS[(index + 10) % 12];
  for (const [name, values] of Object.entries(NIANZHI_SPECIAL)) result[name] = [...values][index];
  return result;
}

function buildChangsheng(nayin, yearGan) {
  const element = [...Object.keys(CHANGSHENG_START)].find(item => String(nayin).includes(item));
  if (!element) return {};
  const start = ZHIS.indexOf(CHANGSHENG_START[element]), forward = GANS.indexOf(yearGan) % 2 === 0;
  return Object.fromEntries(CHANGSHENG.map((name, i) => [name, ZHIS[(start + (forward ? i : -i) + 120) % 12]]));
}

function buildShensha(calendar, context = {}) {
  const yearGan = calendar.bazi.nian.gan, yearZhi = calendar.bazi.nian.zhi, monthZhi = calendar.bazi.yue.zhi;
  const shiyi = buildShiyi(yearGan), tianguan = buildTianguan(yearGan);
  const nianzhi = buildNianzhi(yearGan, yearZhi);
  if (context.dayNight && context.sunGong && context.moonGong) {
    const luminaryGong = context.dayNight === '昼生' ? context.sunGong : context.moonGong;
    nianzhi.卦气 = GAN_LU_BRANCH[qiguaGanAt(yearGan, luminaryGong, true)];
  }
  if (context.hourZhi) {
    const steps = (ZHIS.indexOf(context.hourZhi) - ZHIS.indexOf('戌') + 12) % 12;
    nianzhi.斗杓 = ZHIS[(ZHIS.indexOf(monthZhi) + steps) % 12];
  }
  const extended = extendedHuayao(yearGan, yearZhi, calendar.bazi.nian.nayin, context, nianzhi);
  // 天嗣为天贵的嗣续别名，二者同曜。
  extended.天嗣 = shiyi.天贵;
  const yuezhi = tableByIndex(YUEZHI, ZHIS.indexOf(monthZhi));
  // 月建值难落在十一曜之一，应同时出现在宫位神煞表和化曜汇总里。
  const combinedLabels = { ...shiyi, ...tianguan, ...extended, 值难: STAR_NAMES[yuezhi.值难] || yuezhi.值难 };
  return {
    shiyi_huayao: shiyi,
    tianguan_huayao: tianguan,
    huayao: buildHuayao(combinedLabels, {}),
    extended_huayao: extended,
    niangan_shensha: tableByIndex(NIANGAN, GANS.indexOf(yearGan)),
    nianzhi_shensha: nianzhi,
    yuezhi_shensha: yuezhi,
    changsheng: buildChangsheng(calendar.bazi.nian.nayin, yearGan)
  };
}

function motionStatus(name, speed) {
  const limits = MOTION_LIMITS[name];
  if (!limits) return [];
  const abs = Math.abs(speed);
  if (abs < limits.station) return ['留'];
  if (speed < 0) return ['逆'];
  if (speed < limits.slow) return ['迟'];
  if (speed > limits.fast) return ['速'];
  return [];
}

function planetStatus(planet, context = {}) {
  const statuses = [...(DIGNITY[planet.name]?.[planet.gong] || [])];
  const element = PLANET_ELEMENT[planet.name], gongElement = planet.gongZhu, xiuElement = planet.xiuWuxing;
  if (element) {
    if (gongElement === element) statuses.unshift('垣');
    else if (GENERATES[element] === gongElement || GENERATES[gongElement] === element) statuses.unshift('互垣');
    else if (CONTROLS[gongElement] === element) statuses.unshift('失地');

    if (xiuElement === element) statuses.splice(statuses.includes('垣') ? 1 : 0, 0, '殿');
    else if (GENERATES[element] === xiuElement || GENERATES[xiuElement] === element) statuses.push('互躔');
    else if (CONTROLS[xiuElement] === element) statuses.push('断躔');
  }
  const solarDistance = Number.isFinite(context.sunLon) ? Math.abs(((planet.lon - context.sunLon + 540) % 360) - 180) : Infinity;
  // 五星与太阳合度时光芒被掩，传统称“伏”。天官样本在约 2.4° 已判伏，
  // 取 3° 合度容许度；伏时不再叠加迟/速/逆等视运动标签。
  if (PLANET_ELEMENT[planet.name] && solarDistance <= 3) statuses.push('伏');
  else statuses.push(...motionStatus(planet.name, planet.speed));
  return [...new Set(statuses)];
}

function attachPalaceShensha(palaces, shensha) {
  const positionTables = [shensha.niangan_shensha, shensha.nianzhi_shensha, shensha.yuezhi_shensha, shensha.changsheng];
  return palaces.map(palace => ({
    ...palace,
    shensha: positionTables.flatMap(table => Object.entries(table).filter(([, value]) => value === palace.zhi).map(([name]) => name))
  }));
}

module.exports = {
  GANS, ZHIS, NIANGAN, NIANZHI_SPECIAL, YUEZHI, DIGNITY,
  buildShiyi, buildTianguan, buildNianzhi, buildChangsheng, buildShensha,
  planetStatus, attachPalaceShensha
};
