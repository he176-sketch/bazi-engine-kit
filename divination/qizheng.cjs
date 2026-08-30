// qizheng.cjs — 七政四余星盘核心
// 天文层采用 MIT 许可的 astronomy-engine，不依赖 Swiss Ephemeris。
// 支持黄道/赤道今宿、古宿岁差、郑案与果老量天尺等传统盘制。
const Astro = require('astronomy-engine');
const { DETERMINATIVE_STARS } = require('./qizheng-stars.cjs');
const { traditionalXiuTable, palaceAnchor } = require('./qizheng-traditions.cjs');
const { buildCalendar, lunarToSolarDate } = require('./qizheng-calendar.cjs');
const { buildShensha, planetStatus, attachPalaceShensha } = require('./qizheng-shensha.cjs');
const { buildXiaoxian, buildYuexian, buildDongwei, buildFlowYears } = require('./qizheng-limits.cjs');
const { PLANET_ORDER, shortName, buildRelations, buildEnNanYong, buildDingxing } = require('./qizheng-relations.cjs');

const MAS_PER_DEGREE = 3600000;
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
// 0°春分点起戌宫，沿黄经递增逆排地支。
const GONG_BY_LON = ['戌', '酉', '申', '未', '午', '巳', '辰', '卯', '寅', '丑', '子', '亥'];
const GONG_ZHU = { 子: '土', 丑: '土', 寅: '木', 亥: '木', 卯: '火', 戌: '火', 辰: '金', 酉: '金', 巳: '水', 申: '水', 午: '日', 未: '月' };
const PALACE_NAMES = ['命宫', '财帛宫', '兄弟宫', '田宅宫', '男女宫', '奴仆宫', '妻妾宫', '疾厄宫', '迁移宫', '官禄宫', '福德宫', '相貌宫'];
const PALACE_SHORT = ['命', '财', '兄', '田', '男', '奴', '夫', '疾', '迁', '官', '福', '相'];
const X_METHODS = {
  huangdaohuigui: ['huangdao', '黄道回归今宿', true],
  chidao_jinxiu: ['chidao', '赤道回归今宿', true],
  huigui_gusu: ['huangdao', '黄道回归古宿', true],
  gusu_suicha: ['huangdao', '黄道古宿岁差', true],
  zhengan: ['huangdao', '黄道郑案恒星', true],
  chidao_gusu_suicha: ['chidao', '赤道古宿岁差', true],
  chidao_zhengan: ['chidao', '赤道郑案今宿', true],
  chidao_huigui_gusu: ['chidao', '赤道回归古宿', true],
  guolao: ['chidao', '赤道果老星宗', true]
};
const MING_GONG_METHODS = ['sun_to_mao', 'sun_to_sunrise', 'horizon_rising', 'rising_with_sun'];
const SHEN_GONG_METHODS = ['moon_is_shen', 'moon_to_you', 'moon_to_moonrise', 'moon_to_sunset'];
const COMPAT_NAME = { 太阳: '日', 太阴: '月', 木星: '木星', 火星: '火星', 土星: '土星', 金星: '金星', 水星: '水星', 罗睺: '罗睺', 计都: '计都', 月孛: '月孛', 紫气: '紫炁' };
const CHANDU_NAME = { 太阳: '日', 太阴: '月', 木星: '木', 火星: '火', 土星: '土', 金星: '金', 水星: '水', 罗睺: '罗', 计都: '计', 月孛: '孛', 紫气: '炁' };
const BODIES = [
  ['太阳', Astro.Body.Sun], ['太阴', Astro.Body.Moon], ['木星', Astro.Body.Jupiter],
  ['火星', Astro.Body.Mars], ['土星', Astro.Body.Saturn], ['金星', Astro.Body.Venus], ['水星', Astro.Body.Mercury]
];
const DST_WINDOWS = [
  [1986, 5, 4, 9, 14], [1987, 4, 12, 9, 13], [1988, 4, 10, 9, 11],
  [1989, 4, 16, 9, 10], [1990, 4, 15, 9, 16], [1991, 4, 14, 9, 15]
];
const KNOWN_GAPS = [
  '七政采用 Astronomy Engine，通常可达角分以内，但不承诺 Swiss Ephemeris 的角秒级精度。',
  'fitted 月孛采用相邻真实远地点插值，属于无 Swiss 条件下的自然远地点近似，不等同于 Swiss osculating/fitted 口径。',
  '庙旺、神煞与洞微限采用本引擎注明的果老规则表；异派表法应作为可选规则另行校订。'
];

const norm = value => ((value % 360) + 360) % 360;
const signedAngle = value => ((value + 540) % 360) - 180;
const round = (value, digits = 6) => Number(value.toFixed(digits));
const pad2 = value => String(value).padStart(2, '0');

function assertRange(name, value, min, max) {
  if (!Number.isFinite(value) || value < min || value > max) throw new RangeError(`${name} 必须在 ${min}~${max} 之间`);
}

function inChineseDST(year, month, day) {
  return DST_WINDOWS.some(([yy, sm, sd, em, ed]) => year === yy
    && (month > sm || (month === sm && day >= sd))
    && (month < em || (month === em && day <= ed)));
}

function parseDateTime(date, time, timezone = 8, dstAdjust = false) {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
  const tm = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(time || ''));
  if (!dm || !tm) throw new TypeError('日期时间格式应为 YYYY-MM-DD 与 HH:mm[:ss]');
  const [year, month, day] = dm.slice(1).map(Number);
  const hour = Number(tm[1]), minute = Number(tm[2]), second = Number(tm[3] || 0);
  assertRange('timezone', timezone, -14, 14);
  assertRange('hour', hour, 0, 23); assertRange('minute', minute, 0, 59); assertRange('second', second, 0, 59);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) throw new RangeError('无效公历日期');
  const dstApplied = Boolean(dstAdjust && inChineseDST(year, month, day));
  const utcMs = Date.UTC(year, month - 1, day, hour - (dstApplied ? 1 : 0), minute, second) - timezone * 3600000;
  return { year, month, day, hour, minute, second, utcMs, dstApplied };
}

function localStamp(parts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

function parseSolarStamp(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new TypeError(`无效真太阳时结果: ${value}`);
  return Date.UTC(...match.slice(1).map((value, index) => Number(value) - (index === 1 ? 1 : 0)));
}

function trueSolarTime(parts, longitude) {
  // 当地真太阳时 = 12h + 当地太阳时角。太阳赤经与 GAST 均由天文引擎计算，
  // 避免旧版日序近似公式在部分日期产生约半分钟误差。
  const astroTime = new Astro.AstroTime(new Date(parts.utcMs));
  const sun = Astro.GeoVector(Astro.Body.Sun, astroTime, true);
  const equatorial = Astro.SphereFromVector(Astro.RotateVector(Astro.Rotation_EQJ_EQD(astroTime), sun));
  const apparentSeconds = norm((12 + Astro.SiderealTime(astroTime) + longitude / 15 - equatorial.lon / 15) * 15) / 15 * 3600;
  const standardSeconds = parts.hour * 3600 + parts.minute * 60 + parts.second - (parts.dstApplied ? 3600 : 0);
  let correction = apparentSeconds - standardSeconds;
  if (correction > 43200) correction -= 86400;
  if (correction < -43200) correction += 86400;
  let total = Math.round(standardSeconds + correction), shift = 0;
  while (total < 0) { total += 86400; shift--; }
  while (total >= 86400) { total -= 86400; shift++; }
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + shift));
  const hh = Math.floor(total / 3600), mm = Math.floor(total % 3600 / 60), ss = total % 60;
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())} ${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
}

function solveSolarTime(parts, longitude) {
  // time_type=solar_time 时，用户输入已经是当地真太阳时。反解对应 UTC，
  // 使天文位置与等价 wallclock 输入保持一致；两轮迭代已远小于 1 秒。
  const solved = { ...parts, dstApplied: false };
  const desired = localStamp(solved);
  for (let i = 0; i < 3; i++) {
    const apparent = parseSolarStamp(trueSolarTime(solved, longitude));
    solved.utcMs += desired - apparent;
  }
  return solved;
}

function toAstroTime(value) {
  if (value instanceof Astro.AstroTime) return value;
  if (value instanceof Date) return new Astro.AstroTime(value);
  if (typeof value === 'number') return new Astro.AstroTime(new Date(Date.UTC(value, 6, 1)));
  return new Astro.AstroTime(value || new Date());
}

function propagatedStar(star, time) {
  // Hipparcos ICRS 坐标历元 J1991.25，pmRa 已包含 cos(dec)。
  const years = time.ut / 365.2425 + 8.75;
  const dec = star.dec + star.pmDec * years / MAS_PER_DEGREE;
  const ra = star.ra + star.pmRa * years / (MAS_PER_DEGREE * Math.cos(star.dec * Astro.DEG2RAD));
  return { ra, dec };
}

const STAR_BY_NAME = Object.fromEntries(DETERMINATIVE_STARS.map(item => [item.name, item]));

function buildCurrentXiuTable(timeLike, coordSystem = 'huangdao') {
  if (!['huangdao', 'chidao'].includes(coordSystem)) throw new TypeError(`无效 coord_system: ${coordSystem}`);
  const time = toAstroTime(timeLike);
  const rotation = coordSystem === 'chidao' ? Astro.Rotation_EQJ_EQD(time) : Astro.Rotation_EQJ_ECT(time);
  return DETERMINATIVE_STARS.map(star => {
    const p = propagatedStar(star, time);
    const vector = Astro.VectorFromSphere(new Astro.Spherical(p.dec, p.ra, 1), time);
    const lon = norm(Astro.SphereFromVector(Astro.RotateVector(rotation, vector)).lon);
    return { ...star, lon };
  }).sort((a, b) => a.lon - b.lon);
}

function buildXiuTable(timeLike, coordSystem = 'huangdao', xiuMethod = coordSystem === 'chidao' ? 'chidao_jinxiu' : 'huangdaohuigui') {
  const time = toAstroTime(timeLike), current = buildCurrentXiuTable(time, coordSystem);
  return traditionalXiuTable(xiuMethod, time, STAR_BY_NAME, current);
}

function xiuOf(longitude, timeLike, coordSystem = 'huangdao', xiuMethod) {
  const lon = norm(longitude), table = buildXiuTable(timeLike, coordSystem, xiuMethod);
  let start = table[table.length - 1];
  for (const item of table) { if (item.lon <= lon) start = item; else break; }
  const index = table.indexOf(start), next = table[(index + 1) % table.length];
  return {
    name: start.name, qin: start.qin, wuxing: start.wuxing, hip: start.hip,
    duInXiu: round(norm(lon - start.lon)), duSpan: round(norm(next.lon - start.lon)), boundary: round(start.lon)
  };
}

function spicaLon(timeLike) { return buildXiuTable(timeLike, 'huangdao', 'huangdaohuigui').find(item => item.name === '角').lon; }
function gongOf(longitude, anchor = 0) { return GONG_BY_LON[Math.floor(norm(longitude - anchor) / 30)]; }
function gongDegree(longitude, anchor = 0) { return norm(longitude - anchor) % 30; }

function coordinateFromVector(vector, time, coordSystem) {
  if (coordSystem === 'huangdao') {
    const e = Astro.Ecliptic(vector);
    return { lon: norm(e.elon), lat: e.elat, dist: vector.Length() };
  }
  const e = Astro.SphereFromVector(Astro.RotateVector(Astro.Rotation_EQJ_EQD(time), vector));
  return { lon: norm(e.lon), lat: e.lat, dist: e.dist };
}

function bodyCoordinate(body, time, coordSystem) { return coordinateFromVector(Astro.GeoVector(body, time, true), time, coordSystem); }
function bodySpeed(body, time, coordSystem) {
  const step = 0.02;
  return signedAngle(bodyCoordinate(body, time.AddDays(step), coordSystem).lon - bodyCoordinate(body, time.AddDays(-step), coordSystem).lon) / (2 * step);
}

function meanPoints(time) {
  const t = time.tt / 36525;
  // 罗计平交点加标准章动经度修正；月孛和紫炁保留各自的平黄道公式。
  const omega = (125.04452 - 1934.136261 * t) * Astro.DEG2RAD;
  const sunMeanLon = (280.4665 + 36000.7698 * t) * Astro.DEG2RAD;
  const moonMeanLon = (218.3165 + 481267.8813 * t) * Astro.DEG2RAD;
  const nutationLon = (-17.20 * Math.sin(omega) - 1.32 * Math.sin(2 * sunMeanLon)
    - 0.23 * Math.sin(2 * moonMeanLon) + 0.21 * Math.sin(2 * omega)) / 3600;
  const node = norm(125.04452 - 1934.136261 * t + 0.0020708 * t * t + t * t * t / 450000 + nutationLon);
  const peri = norm(83.35325 + 4069.013711 * t - 0.010324 * t * t - t * t * t / 80000);
  return { node, apogee: norm(peri + 180), ziqi: norm(189.41 + 1285.71 * t) };
}

function fittedNode(time) {
  // 月球瞬时轨道面与真黄道面的交线：n = z × (r × v)。
  const step = 0.05, rotation = Astro.Rotation_EQJ_ECT(time);
  const vector = value => Astro.RotateVector(rotation, Astro.GeoVector(Astro.Body.Moon, value, true));
  const before = vector(time.AddDays(-step)), current = vector(time), after = vector(time.AddDays(step));
  const vx = (after.x - before.x) / (2 * step), vy = (after.y - before.y) / (2 * step), vz = (after.z - before.z) / (2 * step);
  const hx = current.y * vz - current.z * vy, hy = current.z * vx - current.x * vz;
  return norm(Math.atan2(hx, -hy) / Astro.DEG2RAD);
}

function moonLongitude(time) { return Astro.Ecliptic(Astro.GeoVector(Astro.Body.Moon, time, true)).elon; }
function fittedApogee(time) {
  // 用实际月球距离极大事件夹逼，并在相邻远地点方向间插值，得到连续的自然月孛。
  // 这会滤掉瞬时二体椭圆约 ±30° 的伪振荡，不需要 Swiss 星历文件。
  let event = Astro.SearchLunarApsis(time.AddDays(-40)), previous = null, next = null;
  for (let i = 0; i < 10 && !next; i++) {
    if (event.kind === Astro.ApsisKind.Apocenter) {
      const point = { ut: event.time.ut, lon: moonLongitude(event.time) };
      if (point.ut <= time.ut) previous = point; else next = point;
    }
    event = Astro.NextLunarApsis(event);
  }
  if (!previous || !next) throw new Error('无法夹逼月球远地点');
  const fraction = (time.ut - previous.ut) / (next.ut - previous.ut);
  return norm(previous.lon + fraction * signedAngle(next.lon - previous.lon));
}

function pointSet(time, options) {
  const mean = meanPoints(time);
  return {
    node: options.nodeCalculation === 'fitted' ? fittedNode(time) : mean.node,
    apogee: options.apogeeCalculation === 'fitted' ? fittedApogee(time) : mean.apogee,
    ziqi: mean.ziqi
  };
}

function projectEcliptic(longitude, time, coordSystem) {
  if (coordSystem === 'huangdao') return { lon: norm(longitude), lat: 0, dist: 1 };
  const vector = Astro.VectorFromSphere(new Astro.Spherical(0, norm(longitude), 1), time);
  const e = Astro.SphereFromVector(Astro.RotateVector(Astro.Rotation_ECT_EQD(time), vector));
  return { lon: norm(e.lon), lat: e.lat, dist: 1 };
}

function ziqiCoordinate(longitude, time, coordSystem, calculation) {
  // 天官文档区分两种口径：赤道匀行直接沿当前坐标轴取度；黄道投影赤道
  // 才把黄道上的紫炁位置转换到赤道。黄道盘下两者落在同一黄经。
  if (calculation === 'equatorial_uniform') return { lon: norm(longitude), lat: 0, dist: 1 };
  return projectEcliptic(longitude, time, coordSystem);
}

function decorate(raw, time, options) {
  const xiu = xiuOf(raw.lon, time, options.coordSystem, options.xiuMethod);
  const gong = gongOf(raw.lon, options.palaceAnchor), speed = raw.speed || 0;
  return {
    name: raw.name, kind: raw.kind, lon: round(raw.lon), lat: round(raw.lat || 0), dist: round(raw.dist || 1, 9), speed: round(speed),
    status: Math.abs(speed) < 0.02 ? '留' : speed < 0 ? '逆' : '顺', gong, gongDu: round(gongDegree(raw.lon, options.palaceAnchor)), gongZhu: GONG_ZHU[gong],
    xiu: xiu.name, qin: xiu.qin, xiuWuxing: xiu.wuxing, duInXiu: xiu.duInXiu
  };
}

function normalizeRequest(request = {}) {
  const xiuMethod = request.xiu_method || request.xiuMethod || 'huangdaohuigui';
  const method = X_METHODS[xiuMethod];
  if (!method) throw new TypeError(`无效的星宿制式: ${xiuMethod}`);
  const coordSystem = request.coord_system || request.coordSystem || method[0];
  if (coordSystem !== method[0]) throw new TypeError(`星宿制式 ${xiuMethod} 属于 ${method[0]}，不能使用 ${coordSystem}`);
  const dateType = request.date_type || request.dateType || 'solar';
  if (!['solar', 'lunar'].includes(dateType)) throw new Error(`无效日期类型: ${dateType}`);
  const nodeCalculation = request.node_calculation || request.nodeCalculation || 'mean';
  const apogeeCalculation = request.apogee_calculation || request.apogeeCalculation || 'mean';
  const ziqiCalculation = request.ziqi_calculation || request.ziqiCalculation || 'equatorial_uniform';
  if (!['mean', 'fitted'].includes(nodeCalculation)) throw new Error(`无效罗计算法: ${nodeCalculation}`);
  if (!['mean', 'fitted'].includes(apogeeCalculation)) throw new Error(`无效月孛算法: ${apogeeCalculation}`);
  if (!['equatorial_uniform', 'ecliptic_projection'].includes(ziqiCalculation)) throw new Error(`无效紫炁算法: ${ziqiCalculation}`);
  const timeType = request.time_type || request.timeType || 'wallclock';
  if (!['wallclock', 'solar_time'].includes(timeType)) throw new Error(`无效时间类型: ${timeType}`);
  const jieqiMethod = request.jieqi_method || request.jieqiMethod || 'true';
  if (!['true', 'mean'].includes(jieqiMethod)) throw new Error(`无效节气算法: ${jieqiMethod}`);
  const dayNightMethod = request.day_night_method || request.dayNightMethod || 'sunrise_sunset';
  if (!['sunrise_sunset', 'sunrise_sunset_shichen', 'mao_day_you_night'].includes(dayNightMethod)) throw new Error(`无效昼夜算法: ${dayNightMethod}`);
  const dingxingTolerance = Number(request.dingxing_tolerance ?? request.dingxingTolerance ?? 1.5);
  const tongluoTolerance = Number(request.tongluo_tolerance ?? request.tongluoTolerance ?? 2);
  assertRange('dingxing_tolerance', dingxingTolerance, 0, 30);
  assertRange('tongluo_tolerance', tongluoTolerance, 0, 10);
  const distinguishZiHour = request.distinguish_zi_hour ?? request.distinguishZiHour ?? true;
  if (typeof distinguishZiHour !== 'boolean') throw new TypeError('distinguish_zi_hour 必须为 boolean');
  const mingGongMethod = request.ming_gong_method || request.mingGongMethod || 'sun_to_mao';
  const shenGongMethod = request.shen_gong_method || request.shenGongMethod || 'moon_is_shen';
  if (!MING_GONG_METHODS.includes(mingGongMethod)) throw new Error(`无效命宫起法: ${mingGongMethod}`);
  if (!SHEN_GONG_METHODS.includes(shenGongMethod)) throw new Error(`无效身宫起法: ${shenGongMethod}`);
  const inputDate = request.birth_date || request.date;
  const date = dateType === 'lunar' ? lunarToSolarDate(inputDate) : inputDate;
  const time = request.birth_time || request.time || '12:00';
  const longitude = Number(request.birth_lon ?? request.lon ?? 120), latitude = Number(request.birth_lat ?? request.lat ?? 0), timezone = Number(request.timezone ?? request.tz ?? 8);
  const childLimit = Number(request.child_limit ?? request.childLimit ?? 9);
  if (![9, 10].includes(childLimit)) throw new RangeError('child_limit 必须为 9 或 10');
  assertRange('birth_lon', longitude, -180, 180); assertRange('birth_lat', latitude, -90, 90);
  const dstAdjust = Boolean(request.dst_adjust ?? request.dstAdjust);
  let parts = parseDateTime(date, time, timezone, timeType === 'wallclock' && dstAdjust);
  if (timeType === 'solar_time') parts = solveSolarTime(parts, longitude);
  return {
    date, inputDate, dateType, time, longitude, latitude, timezone,
    parts,
    xiuMethod, coordSystem, nodeCalculation, apogeeCalculation, mingGongMethod, shenGongMethod,
    nodeArrangement: request.node_arrangement || request.nodeArrangement || 'south_north',
    ziqiCalculation, childLimit, timeType, jieqiMethod, dayNightMethod,
    dingxingTolerance, tongluoTolerance, distinguishZiHour, dstAdjust,
    gender: request.gender || 'male', city: request.city || null, name: request.name || null
  };
}

function computeObjects(options, time) {
  const qiZheng = BODIES.map(([name, body]) => decorate({ name, kind: '政', ...bodyCoordinate(body, time, options.coordSystem), speed: bodySpeed(body, time, options.coordSystem) }, time, options));
  if (!['north_south', 'south_north'].includes(options.nodeArrangement)) throw new TypeError(`无效 node_arrangement: ${options.nodeArrangement}`);
  const p = pointSet(time, options), before = pointSet(time.AddDays(-0.02), options), after = pointSet(time.AddDays(0.02), options);
  const north = p.node, south = norm(p.node + 180), reverse = options.nodeArrangement === 'north_south';
  const raw = [
    ['罗睺', reverse ? north : south, before.node, after.node, projectEcliptic],
    ['计都', reverse ? south : north, before.node, after.node, projectEcliptic],
    ['月孛', p.apogee, before.apogee, after.apogee, projectEcliptic],
    ['紫气', p.ziqi, before.ziqi, after.ziqi, (lon, at, coord) => ziqiCoordinate(lon, at, coord, options.ziqiCalculation)]
  ];
  const siYu = raw.map(([name, lon, a, b, coordinate]) => {
    const current = coordinate(lon, time, options.coordSystem);
    const earlier = coordinate(a, time.AddDays(-0.02), options.coordSystem);
    const later = coordinate(b, time.AddDays(0.02), options.coordSystem);
    return decorate({ name, kind: '余', ...current, speed: signedAngle(later.lon - earlier.lon) / 0.04 }, time, options);
  });
  return { qiZheng, siYu };
}

function qiZheng(input = {}) {
  const options = normalizeRequest(input), time = new Astro.AstroTime(new Date(options.parts.utcMs));
  const xiuTable = buildXiuTable(time, options.coordSystem, options.xiuMethod);
  options.palaceAnchor = palaceAnchor(options.xiuMethod, time, xiuTable);
  const objects = computeObjects(options, time);
  return {
    datetime: {
      input: `${options.date} ${options.time}`, longitude: options.longitude, latitude: options.latitude, timezone: options.timezone,
      utc: new Date(options.parts.utcMs).toISOString(), trueSolarTime: trueSolarTime(options.parts, options.longitude), dstApplied: options.parts.dstApplied
    },
    settings: {
      xiuMethod: options.xiuMethod, coordSystem: options.coordSystem, nodeArrangement: options.nodeArrangement,
      nodeCalculation: options.nodeCalculation, apogeeCalculation: options.apogeeCalculation, ziqiCalculation: options.ziqiCalculation,
      mingGongMethod: options.mingGongMethod, shenGongMethod: options.shenGongMethod, childLimit: options.childLimit,
      timeType: options.timeType, jieqiMethod: options.jieqiMethod, dayNightMethod: options.dayNightMethod,
      dateType: options.dateType,
      dingxingTolerance: options.dingxingTolerance, tongluoTolerance: options.tongluoTolerance,
      distinguishZiHour: options.distinguishZiHour
    },
    ...objects,
    xiuTable: xiuTable.map(item => [round(item.lon, 9), item.name]), palaceAnchor: round(options.palaceAnchor, 9), knownGaps: KNOWN_GAPS
  };
}

function hourBranch(hour) { return BRANCHES[Math.floor((hour + 1) / 2) % 12]; }
function nextBranch(branch) { return BRANCHES[(BRANCHES.indexOf(branch) + 1) % 12]; }
function hourFromClock(clock) {
  const match = /^(\d{1,2}):\d{2}/.exec(String(clock || ''));
  if (!match) throw new TypeError(`无效时刻: ${clock}`);
  return Number(match[1]);
}
function targetGong(sourceGong, birthClock, targetClock, direction = 1) {
  const source = BRANCHES.indexOf(sourceGong);
  const birth = BRANCHES.indexOf(hourBranch(hourFromClock(birthClock)));
  const target = BRANCHES.indexOf(hourBranch(hourFromClock(targetClock)));
  const distance = (target - birth + 12) % 12;
  return BRANCHES[(source + direction * distance + 120) % 12];
}
function positionAtGongDegree(gong, degree, anchor) {
  const lon = norm(anchor + GONG_BY_LON.indexOf(gong) * 30 + degree);
  return { lon, gong, gongDu: gongDegree(lon, anchor) };
}
function ascendantCoordinate(options, time) {
  // 东方地平与黄道的交点。先求真黄经，赤道盘再投影到当日真赤道。
  const theta = norm(Astro.SiderealTime(time) * 15 + options.longitude) * Astro.DEG2RAD;
  const phi = options.latitude * Astro.DEG2RAD;
  const epsilon = Astro.e_tilt(time).tobl * Astro.DEG2RAD;
  const eclipticLon = norm(Math.atan2(
    Math.cos(theta),
    -Math.sin(epsilon) * Math.tan(phi) - Math.cos(epsilon) * Math.sin(theta)
  ) / Astro.DEG2RAD);
  if (!Number.isFinite(eclipticLon)) throw new RangeError('当前纬度无法稳定求东升点');
  const projected = projectEcliptic(eclipticLon, time, options.coordSystem);
  return { ...projected, gong: gongOf(projected.lon, options.palaceAnchor), gongDu: gongDegree(projected.lon, options.palaceAnchor) };
}
function resolveLiming(options, chart, sun, moon, time, birthSky) {
  const birthClock = chart.datetime.trueSolarTime.slice(11);
  const anchor = chart.palaceAnchor;
  let ming;
  if (options.mingGongMethod === 'horizon_rising') ming = ascendantCoordinate(options, time);
  else if (options.mingGongMethod === 'rising_with_sun') {
    const rising = ascendantCoordinate(options, time);
    ming = positionAtGongDegree(rising.gong, sun.gongDu, anchor);
  } else {
    const targetClock = options.mingGongMethod === 'sun_to_mao' ? '05:00' : birthSky.sunrise;
    if (!targetClock) throw new Error('当日无可用日出时刻，不能使用 sun_to_sunrise');
    ming = positionAtGongDegree(targetGong(sun.gong, birthClock, targetClock, 1), sun.gongDu, anchor);
  }

  let shen;
  if (options.shenGongMethod === 'moon_is_shen') shen = { lon: moon.lon, gong: moon.gong, gongDu: moon.gongDu };
  else {
    const targetClock = options.shenGongMethod === 'moon_to_you' ? '17:00'
      : options.shenGongMethod === 'moon_to_moonrise' ? birthSky.moonrise : birthSky.sunset;
    if (!targetClock) throw new Error(`当日无可用${options.shenGongMethod === 'moon_to_moonrise' ? '月出' : '日没'}时刻，不能使用 ${options.shenGongMethod}`);
    shen = positionAtGongDegree(targetGong(moon.gong, birthClock, targetClock, -1), moon.gongDu, anchor);
  }
  return { ming, shen };
}
function buildPalaces(mingGong, objects, anchor = 0) {
  const start = BRANCHES.indexOf(mingGong);
  return PALACE_NAMES.map((name, index) => {
    const zhi = BRANCHES[(start - index + 12) % 12];
    return { index: index + 1, name, zhi, renshi: PALACE_SHORT[index], gong_head: round(norm(anchor + GONG_BY_LON.indexOf(zhi) * 30)), gong_zhu: GONG_ZHU[zhi], stars: objects.filter(item => item.gong === zhi).map(item => COMPAT_NAME[item.name]), shensha: [] };
  });
}

function referenceLocalDateTime(request, timezone) {
  if (request.reference_date || request.referenceDate) {
    const date = request.reference_date || request.referenceDate;
    const time = request.reference_time || request.referenceTime || '12:00:00';
    return `${date} ${/^\d{1,2}:\d{2}:\d{2}$/.test(time) ? time : `${time}:00`}`;
  }
  const local = new Date(Date.now() + timezone * 3600000);
  return `${local.getUTCFullYear()}-${pad2(local.getUTCMonth() + 1)}-${pad2(local.getUTCDate())} ${pad2(local.getUTCHours())}:${pad2(local.getUTCMinutes())}:${pad2(local.getUTCSeconds())}`;
}

function eventSolarClock(event, options, localDate) {
  if (!event) return null;
  const offsetHours = options.timezone + (options.parts.dstApplied ? 1 : 0);
  const date = new Date(event.date.getTime() + offsetHours * 3600000);
  const key = `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
  if (key !== localDate) return null;
  const eventParts = {
    year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(),
    hour: date.getUTCHours(), minute: date.getUTCMinutes(), second: date.getUTCSeconds(),
    utcMs: event.date.getTime(), dstApplied: options.parts.dstApplied
  };
  return trueSolarTime(eventParts, options.longitude).slice(11, 16);
}

function clockSeconds(value) {
  if (!value) return null;
  return String(value).split(':').reduce((total, part) => total * 60 + Number(part), 0);
}

function shichenStart(seconds) {
  const hour = Math.floor(seconds / 3600), startHour = hour === 0 ? 23 : (hour % 2 === 0 ? hour - 1 : hour);
  return startHour * 3600;
}

function inClockRange(value, start, end) {
  return start <= end ? value >= start && value < end : value >= start || value < end;
}

function riseSetSummary(options) {
  const p = options.parts, offset = options.timezone + (p.dstApplied ? 1 : 0);
  const localDate = `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
  const localMidnightUtc = new Date(Date.UTC(p.year, p.month - 1, p.day) - offset * 3600000);
  const observer = new Astro.Observer(options.latitude, options.longitude, 0);
  const event = (body, direction) => Astro.SearchRiseSet(body, observer, direction, localMidnightUtc, 1);
  const sunriseEvent = event(Astro.Body.Sun, +1), sunsetEvent = event(Astro.Body.Sun, -1);
  const moonriseEvent = event(Astro.Body.Moon, +1), moonsetEvent = event(Astro.Body.Moon, -1);
  const sunrise = eventSolarClock(sunriseEvent, options, localDate), sunset = eventSolarClock(sunsetEvent, options, localDate);
  const moonrise = eventSolarClock(moonriseEvent, options, localDate), moonset = eventSolarClock(moonsetEvent, options, localDate);
  const trueClock = trueSolarTime(p, options.longitude).slice(11), currentSeconds = clockSeconds(trueClock);
  let isDay;
  if (options.dayNightMethod === 'mao_day_you_night') isDay = inClockRange(currentSeconds, 5 * 3600, 17 * 3600);
  else if (options.dayNightMethod === 'sunrise_sunset_shichen' && sunrise && sunset) {
    isDay = inClockRange(currentSeconds, shichenStart(clockSeconds(sunrise)), shichenStart(clockSeconds(sunset)));
  } else isDay = Boolean(sunriseEvent && sunsetEvent && p.utcMs >= sunriseEvent.date.getTime() && p.utcMs < sunsetEvent.date.getTime());
  return {
    day_night: isDay ? '昼生' : '夜生',
    day_night_method: options.dayNightMethod,
    sunrise, sunset, moonrise, moonset,
    longitude: `${Math.round(options.longitude)}°`, latitude: `${Math.round(options.latitude)}°`, location: options.city || ''
  };
}

function compatiblePlanets(objects) {
  const sunLon = objects.find(item => item.name === '太阳')?.lon;
  return objects.map(item => {
    const planet = { ...item, name: COMPAT_NAME[item.name] };
    return {
      name: planet.name, lon: item.lon, gong: item.gong, gong_du: item.gongDu, xiu: item.xiu, xiu_du: item.duInXiu,
      lat: item.lat, dist: item.dist, speed: item.speed, motion: item.status, status: planetStatus(planet, { sunLon })
    };
  }).sort((a, b) => PLANET_ORDER.indexOf(shortName(a.name)) - PLANET_ORDER.indexOf(shortName(b.name)));
}

function relationContext(request) {
  // 天官的关系层始终在黄道回归今宿底盘上计算：赤道/郑案/果老
  // 只改变盘面显示坐标，不改变守照、同络、同经与余奴的判定底盘。
  const hiddenRequest = { ...request, xiu_method: 'huangdaohuigui', xiuMethod: undefined, coord_system: 'huangdao', coordSystem: undefined };
  const options = normalizeRequest(hiddenRequest), hidden = qiZheng(hiddenRequest);
  const objects = [...hidden.qiZheng, ...hidden.siYu], planets = compatiblePlanets(objects);
  const groups = Object.fromEntries(objects.map(item => [
    shortName(COMPAT_NAME[item.name]),
    DETERMINATIVE_STARS.findIndex(star => star.name === item.xiu) % 7
  ]));
  const time = new Astro.AstroTime(new Date(options.parts.utcMs));
  options.palaceAnchor = hidden.palaceAnchor;
  const sun = hidden.qiZheng.find(item => item.name === '太阳'), moon = hidden.qiZheng.find(item => item.name === '太阴');
  const { ming, shen } = resolveLiming(options, hidden, sun, moon, time, riseSetSummary(options));
  return { planets, groups, mingPoint: { lon: ming.lon, gong: ming.gong }, shenPoint: { lon: shen.lon, gong: shen.gong } };
}

function calculateChart(request = {}) {
  const options = normalizeRequest(request), chart = qiZheng(request), objects = [...chart.qiZheng, ...chart.siYu];
  const sun = chart.qiZheng.find(item => item.name === '太阳'), moon = chart.qiZheng.find(item => item.name === '太阴');
  const calendar = buildCalendar(chart.datetime.trueSolarTime, options.gender, { distinguishZiHour: options.distinguishZiHour, jieqiMethod: options.jieqiMethod, timezone: options.timezone });
  const time = new Astro.AstroTime(new Date(options.parts.utcMs));
  options.palaceAnchor = chart.palaceAnchor;
  const anchor = chart.palaceAnchor, birthSky = riseSetSummary(options);
  const { ming, shen } = resolveLiming(options, chart, sun, moon, time, birthSky);
  const mingGong = ming.gong, shenGong = shen.gong, mingLon = ming.lon, shenLon = shen.lon;
  const mingXiu = xiuOf(mingLon, time, options.coordSystem, options.xiuMethod);
  const shenXiu = xiuOf(shenLon, time, options.coordSystem, options.xiuMethod);
  const shensha = buildShensha(calendar, { mingGong, gongZhu: GONG_ZHU, dayNight: birthSky.day_night, sunGong: sun.gong, moonGong: moon.gong, hourZhi: calendar.bazi.shi.zhi });
  const rawPalaces = buildPalaces(mingGong, objects, anchor), palaces = attachPalaceShensha(rawPalaces, shensha);
  const xiaoxian = buildXiaoxian(options.parts.year, mingGong, palaces, 120);
  const referenceDateTime = referenceLocalDateTime(request, options.timezone);
  const dongwei = buildDongwei({
    birthDateTime: chart.datetime.trueSolarTime, referenceDateTime,
    sunGongDegree: sun.gongDu, mingGong, childLimit: options.childLimit,
    xiuAt: lon => xiuOf(lon, time, options.coordSystem, options.xiuMethod),
    planets: objects.map(item => ({ ...item, name: CHANDU_NAME[item.name] }))
  });
  const flowYears = buildFlowYears(xiaoxian, dongwei, calendar.dayun);
  const referenceYear = Number(referenceDateTime.slice(0, 4));
  const currentSmall = xiaoxian.find(item => item.liunian === referenceYear) || xiaoxian[0];
  const yuexian = buildYuexian(currentSmall, options.parts.month, palaces);
  const currentMonthLimit = yuexian.find(item => item.month === options.parts.month) || yuexian[0];
  const bottomRight = { ...birthSky, true_solar_time: chart.datetime.trueSolarTime.split(' ')[1] };
  const planets = compatiblePlanets(objects);
  const relationBase = relationContext(request);
  const relationLayers = buildRelations({
    planets: relationBase.planets, jingGroups: relationBase.groups,
    mingPoint: { lon: mingLon, gong: mingGong }, shenPoint: { lon: shenLon, gong: shenGong },
    tongluoTolerance: options.tongluoTolerance
  });
  return {
    basic: {
      solar_date: options.date, solar_time: chart.datetime.trueSolarTime.split(' ')[1], true_solar_time: chart.datetime.trueSolarTime.split(' ')[1],
      lunar_date: calendar.lunarDate, lunar_display: calendar.lunarDisplay,
      location: `${options.longitude}°, ${options.latitude}°`, timezone: options.timezone, xiu_method: options.xiuMethod,
      coord_system: options.coordSystem, chart_type: 'tropical', gender: options.gender, name: options.name, city: options.city,
      date_type: options.dateType, time_type: options.timeType, jieqi_method: options.jieqiMethod, day_night_method: options.dayNightMethod,
      ming_gong: mingGong, shen_gong: shenGong,
      xu_gong_anchor_lon: ['chidao_zhengan', 'guolao'].includes(options.xiuMethod) ? anchor : 0,
      sidereal_base_lon: options.xiuMethod === 'zhengan' ? anchor : 0
    },
    liming: {
      ming_gong: mingGong, ming_gong_zhu: GONG_ZHU[mingGong], ming_du: round(ming.gongDu), ming_du_lon: round(mingLon),
      ming_xiu: mingXiu.name, ming_xiu_du: mingXiu.duInXiu, ming_zhu: mingXiu.wuxing,
      shen_gong: shenGong, shen_gong_zhu: GONG_ZHU[shenGong], shen_du: round(shen.gongDu), shen_du_lon: round(shenLon),
      shen_xiu: shenXiu.name, shen_xiu_du: shenXiu.duInXiu, shen_zhu: shenXiu.wuxing,
      ming_gong_method: options.mingGongMethod, shen_gong_method: options.shenGongMethod
    },
    bazi: calendar.bazi, jieqi: calendar.jieqi,
    planets,
    palaces, shensha, xiaoxian, xiu_table: chart.xiuTable,
    dongwei, liunian_timeline: flowYears, yuexian,
    en_nan_yong: buildEnNanYong(GONG_ZHU[mingGong], mingXiu.wuxing),
    bottom_left: {
      daxian: `${dongwei.current.xiu}${dongwei.current.xiu_degree}`,
      tai_sui: currentSmall.liunian_ganzhi, xiaoxian: currentSmall.gong,
      yuexian: currentMonthLimit.gong, feixian: nextBranch(currentSmall.gong),
      dingxing: '', chandu: `躔${dongwei.current.duzhu}：${dongwei.current.chandu.stars.join('、')}`
    },
    bottom_right: bottomRight, dayun: calendar.dayun, shouzhao: relationLayers.shouzhao,
    tongluo: relationLayers.tongluo, tongjing: relationLayers.tongjing, yunu: relationLayers.yunu, lingfan: null, lingfan_gong: null,
    engine: {
      name: 'bazi-engine-kit', ephemeris: 'astronomy-engine', license: 'MIT', precision_note: KNOWN_GAPS[0],
      calendar: `lunar-typescript/sect${calendar.sect}`,
      implemented: ['七政四余位置', '平均/拟合罗计月孛', '赤道匀行/黄道投影紫炁', '黄道/赤道回归今宿', '黄道/赤道古宿岁差', '郑案宫尺', '果老量天尺', '十二宫', '二十八宿距星', '庙旺垣殿与五行经纬', '守照同络同经余奴与恩难仇用', '果老年干/月支/年支神煞', '公历/农历输入', '四柱定气/平气节气大运', '墙上时/真太阳时输入', '三种昼夜判定', '早晚子时开关', '童限', '洞微大限', '小限月限', '120 年流年时间轴', '四种命宫起法', '四种身宫起法'], limitations: KNOWN_GAPS.slice(1)
    }
  };
}

function calculateLiunian(request = {}) {
  const natalOptions = normalizeRequest(request);
  const year = Number(request.liunian_year ?? request.liunianYear);
  if (!Number.isInteger(year) || year < 1600 || year > 2600) throw new RangeError('liunian_year 必须为 1600~2600 的整数');
  const month = Number(request.liuyue ?? natalOptions.parts.month);
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError('liuyue 必须为 1~12 的整数');
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const requestedDay = Number(request.liuri ?? natalOptions.parts.day);
  if (!Number.isInteger(requestedDay) || requestedDay < 1 || requestedDay > 31) throw new RangeError('liuri 必须为 1~31 的整数');
  const day = Math.min(requestedDay, maxDay);
  const timeText = String(request.liushi || natalOptions.time);
  const targetDate = `${year}-${pad2(month)}-${pad2(day)}`;
  const transitRequest = {
    ...request, birth_date: targetDate, birth_time: timeText,
    date: undefined, time: undefined, date_type: 'solar', dateType: undefined,
    reference_date: targetDate, reference_time: timeText
  };
  const transitOptions = normalizeRequest(transitRequest), transit = qiZheng(transitRequest);
  const transitObjects = [...transit.qiZheng, ...transit.siYu], transitCalendar = buildCalendar(transit.datetime.trueSolarTime, natalOptions.gender, { distinguishZiHour: transitOptions.distinguishZiHour, jieqiMethod: transitOptions.jieqiMethod, timezone: transitOptions.timezone });
  const transitSky = riseSetSummary(transitOptions), transitSun = transit.qiZheng.find(item => item.name === '太阳'), transitMoon = transit.qiZheng.find(item => item.name === '太阴');
  const natal = calculateChart({ ...request, reference_date: targetDate, reference_time: timeText });
  const transitShensha = buildShensha(transitCalendar, { mingGong: natal.liming.ming_gong, gongZhu: GONG_ZHU, dayNight: transitSky.day_night, sunGong: transitSun.gong, moonGong: transitMoon.gong, hourZhi: transitCalendar.bazi.shi.zhi });
  const birthdayPassed = month > natalOptions.parts.month || (month === natalOptions.parts.month && day >= natalOptions.parts.day);
  const annualSmall = natal.xiaoxian.find(item => item.liunian === year);
  const small = natal.xiaoxian.find(item => item.liunian === year - (birthdayPassed ? 0 : 1));
  if (!annualSmall || !small) throw new RangeError(`流年 ${year} 超出本命 120 年时间轴`);
  const yuexian = buildYuexian(small, natalOptions.parts.month, natal.palaces);
  const selectedMonthLimit = yuexian.find(item => item.month === month);
  const transitPlanets = compatiblePlanets(transitObjects);
  const transitRelationBase = relationContext(transitRequest), natalRelationBase = relationContext(request);
  const flowRelations = buildRelations({
    planets: transitRelationBase.planets, jingGroups: transitRelationBase.groups,
    // 流年关系层沿用盘面命度，但身度回到黄道底盘；这是外部专业输出在赤道盘上的实际口径。
    mingPoint: { lon: natal.liming.ming_du_lon, gong: natal.liming.ming_gong }, shenPoint: natalRelationBase.shenPoint,
    tongluoTolerance: transitOptions.tongluoTolerance, prefix: '流'
  });
  const natalDingxing = buildDingxing(natal.dongwei.current.chart_lon, natal.planets, natalOptions.dingxingTolerance);
  const flowDingxing = buildDingxing(natal.dongwei.current.chart_lon, transitPlanets, transitOptions.dingxingTolerance);
  const dongwei = {
    ...natal.dongwei,
    natal_dingxing: natalDingxing,
    liunian_dingxing: flowDingxing
  };
  return {
    liunian_basic: {
      solar_date: targetDate, solar_time: timeText, lunar_display: transitCalendar.lunarDisplay,
      true_solar_time: transit.datetime.trueSolarTime.split(' ')[1], location: `${natalOptions.longitude}°, ${natalOptions.latitude}°`,
      timezone: natalOptions.timezone, xiu_method: natalOptions.xiuMethod, coord_system: natalOptions.coordSystem,
      chart_type: 'tropical', time_type: natalOptions.timeType, jieqi_method: natalOptions.jieqiMethod,
      day_night_method: natalOptions.dayNightMethod, tai_sui: `${transitCalendar.bazi.nian.gan}${transitCalendar.bazi.nian.zhi}`,
      xu_gong_anchor_lon: transit.palaceAnchor
    },
    liunian_bazi: { ...transitCalendar.bazi, yue_zhi: transitCalendar.bazi.yue.zhi },
    liunian_planets: transitPlanets,
    liunian_xiaoxian: { gong: small.gong, renshi: small.renshi, liuyue_ganzhi: annualSmall.liunian_ganzhi, age_zhou: small.age_zhou, birthday_passed: birthdayPassed },
    liunian_yuexian: yuexian,
    liunian_shensha: transitShensha,
    liunian_huayao: transitShensha.shiyi_huayao,
    liunian_tianguan_huayao: transitShensha.tianguan_huayao,
    liunian_combined_huayao: transitShensha.huayao,
    liunian_timeline_entry: natal.liunian_timeline.find(item => item.year === year),
    liunian_shouzhao: flowRelations.shouzhao,
    liunian_tongluo: flowRelations.tongluo,
    liunian_tongjing: flowRelations.tongjing,
    liunian_yunu: flowRelations.yunu,
    dongwei,
    bottom_left: {
      daxian: `${natal.dongwei.current.xiu}${natal.dongwei.current.xiu_degree}`,
      tai_sui: `${transitCalendar.bazi.nian.gan}${transitCalendar.bazi.nian.zhi}`, xiaoxian: small.gong, yuexian: selectedMonthLimit.gong,
      feixian: nextBranch(small.gong), dingxing: natalDingxing.join(' '), chandu: `躔${natal.dongwei.current.duzhu}：${natal.dongwei.current.chandu.stars.join('、')}`
    },
    bottom_right: { ...transitSky, true_solar_time: transit.datetime.trueSolarTime.split(' ')[1] },
    engine: natal.engine
  };
}

const XIU = DETERMINATIVE_STARS.map(item => [item.name, item.qin, item.wuxing, item.hip]);
module.exports = { qiZheng, calculateChart, calculateLiunian, normalizeRequest, buildXiuTable, xiuOf, spicaLon, gongOf, gongDegree, GONG_BY_LON, GONG_ZHU, XIU, XIU_METHODS: X_METHODS, MING_GONG_METHODS, SHEN_GONG_METHODS, KNOWN_GAPS };

if (require.main === module) {
  const args = process.argv.slice(2), json = args.includes('--json'), p = args.filter(arg => arg !== '--json');
  const [date = new Date().toISOString().slice(0, 10), time = '12:00', lon = '120', lat = '0'] = p;
  const request = { birth_date: date, birth_time: time, birth_lon: Number(lon), birth_lat: Number(lat), timezone: 8, gender: 'male', xiu_method: 'huangdaohuigui', coord_system: 'huangdao' };
  try {
    if (json) console.log(JSON.stringify(calculateChart(request), null, 2));
    else {
      const result = qiZheng(request), lines = ['✨ 【七政四余星盘】', '', `📅 ${result.datetime.input}｜东经 ${result.datetime.longitude}°｜北纬 ${result.datetime.latitude}°｜UTC ${result.datetime.utc.slice(0, 16).replace('T', ' ')}`, `盘制：${result.settings.xiuMethod} / ${result.settings.coordSystem}`, '', '【七政】'];
      for (const s of result.qiZheng) lines.push(`　${s.name}　${s.lon.toFixed(4).padStart(9)}°　${s.gong}(${s.gongZhu}) ${s.gongDu.toFixed(2).padStart(5)}°　${s.xiu}${s.qin} ${s.xiuWuxing}（${s.duInXiu.toFixed(2)}°）`);
      lines.push('', '【四余】');
      for (const s of result.siYu) lines.push(`　${s.name}　${s.lon.toFixed(4).padStart(9)}°　${s.gong}(${s.gongZhu}) ${s.gongDu.toFixed(2).padStart(5)}°　${s.xiu}${s.qin}（${s.duInXiu.toFixed(2)}°）`);
      lines.push('', `⚠️ ${KNOWN_GAPS[0]}`, `　${KNOWN_GAPS[1]}`, `　${KNOWN_GAPS[2]}`);
      console.log(lines.join('\n'));
    }
  } catch (error) { console.error('排盘失败:', error.message); process.exitCode = 1; }
}
