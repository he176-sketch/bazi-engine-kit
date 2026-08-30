// qizheng-limits.cjs — 童限、洞微大限、小限、月限与逐年时间轴。
const { Solar } = require('lunar-typescript');
const { yearGanZhi } = require('./qizheng-calendar.cjs');

const ZHIS = [...'子丑寅卯辰巳午未申酉戌亥'];
const PERIOD_NAMES = ['命', '相', '福', '官', '迁', '疾', '夫', '奴', '男', '田', '兄', '财'];
const PERIOD_DURATIONS = [null, 10, 11, 15, 8, 7, 11, 4.5, 4.5, 4.5, 5, 5];
const TROPICAL_YEAR_DAYS = 365.2425;
const norm = value => ((value % 360) + 360) % 360;
const round = (value, digits = 4) => Number(value.toFixed(digits));

function parseLocal(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(String(value));
  if (!match) throw new TypeError(`无效本地日期时间: ${value}`);
  const [, y, m, d, hh = '00', mm = '00', ss = '00'] = match;
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)));
}

function localFromSolar(solar) {
  return new Date(Date.UTC(solar.getYear(), solar.getMonth() - 1, solar.getDay(), solar.getHour(), solar.getMinute(), solar.getSecond()));
}

function liChun(year) {
  const lunar = Solar.fromYmd(year, 2, 6).getLunar();
  return localFromSolar(lunar.getJieQiTable()['立春']);
}

function yearsBetween(from, to) { return (to.getTime() - from.getTime()) / 86400000 / TROPICAL_YEAR_DAYS; }

function addYearsAsDays(date, years) { return new Date(date.getTime() + years * TROPICAL_YEAR_DAYS * 86400000); }

function formatDate(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function palaceNameByZhi(palaces, zhi) { return palaces.find(item => item.zhi === zhi)?.renshi || null; }

function buildXiaoxian(birthYear, mingGong, palaces, maxAge = 120) {
  const start = ZHIS.indexOf(mingGong);
  return Array.from({ length: maxAge }, (_, i) => {
    const age = i + 1, gong = ZHIS[(start - i + 120) % 12];
    return {
      liunian: birthYear + i,
      age_zhou: age,
      age_xu: age,
      gong,
      renshi: palaceNameByZhi(palaces, gong),
      liunian_ganzhi: yearGanZhi(birthYear + i)
    };
  });
}

function buildYuexian(xiaoxianEntry, birthMonth, palaces) {
  const anchor = ZHIS.indexOf(xiaoxianEntry.gong);
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1, gong = ZHIS[(anchor + birthMonth - month + 120) % 12];
    return { month, gong, renshi: palaceNameByZhi(palaces, gong) };
  });
}

function periodDefinitions(mingGong, childDuration) {
  const start = ZHIS.indexOf(mingGong);
  let cumulative = 0;
  return PERIOD_NAMES.map((renshi, i) => {
    const duration = i === 0 ? childDuration : PERIOD_DURATIONS[i];
    const item = { renshi, gong: ZHIS[(start + i) % 12], duration, startAge: cumulative, endAge: cumulative + duration };
    cumulative += duration;
    return item;
  });
}

function pointAtAge(age, periods, xiuAt) {
  const bounded = Math.max(0, Math.min(age, periods[periods.length - 1].endAge - 1e-9));
  const period = periods.find(item => bounded < item.endAge) || periods[periods.length - 1];
  const fraction = (bounded - period.startAge) / period.duration;
  const zodiacLon = norm(ZHIS.indexOf(period.gong) * 30 + fraction * 30);
  // 洞微尺由子宫起 0°，顺十二支；换回排盘黄经时方向相反，零点在 330°。
  const chartLon = norm(330 - zodiacLon);
  const xiu = xiuAt(chartLon);
  const remainder = zodiacLon % 30, gongDegree = remainder < 1e-9 ? 30 : 30 - remainder;
  return {
    period: period.renshi === '命' ? '童限' : '大限',
    renshi: period.renshi,
    gong: period.gong,
    gong_degree: round(gongDegree),
    xiu: xiu.name,
    xiu_degree: round(xiu.duInXiu),
    duzhu: xiu.wuxing,
    zodiac_lon: round(zodiacLon),
    chart_lon: round(chartLon)
  };
}

function currentNominalAge(birth, reference) {
  const year = reference.getUTCFullYear(), base = year - birth.getUTCFullYear() + 1;
  const lichun = liChun(year), fraction = Math.max(0, yearsBetween(lichun, reference));
  return base + fraction;
}

function buildDongwei({ birthDateTime, referenceDateTime, sunGongDegree, mingGong, xiuAt, childLimit = 9, planets = [] }) {
  const birth = parseLocal(birthDateTime), reference = parseLocal(referenceDateTime);
  const childDuration = childLimit + sunGongDegree / 3;
  const periods = periodDefinitions(mingGong, childDuration), totalYears = periods[periods.length - 1].endAge;
  const actualAge = Math.max(0, yearsBetween(birth, reference));
  const current = pointAtAge(actualAge, periods, xiuAt);
  current.age = round(currentNominalAge(birth, reference), 2);
  const sameElement = planets.filter(item => item.xiuWuxing === current.duzhu).map(item => item.name);
  current.chandu = { xiu: current.xiu, xingxing: current.duzhu, stars: sameElement };

  const yearLines = [];
  const lastAge = Math.ceil(totalYears);
  for (let nominalAge = 1; nominalAge <= lastAge; nominalAge++) {
    const target = nominalAge === 1 ? birth : liChun(birth.getUTCFullYear() + nominalAge - 1);
    const state = pointAtAge(Math.max(0, yearsBetween(birth, target)), periods, xiuAt);
    yearLines.push({ age: nominalAge, ...state, period: undefined, chart_lon: undefined });
  }

  const chuxianDate = addYearsAsDays(birth, childDuration);
  const palaceYears = Object.fromEntries(periods.map(item => [item.renshi, round(item.duration)]));
  const boundaryYears = [birth.getUTCFullYear(), ...periods.slice(0, -1).map(item => Math.floor(birth.getUTCFullYear() + item.endAge))];
  return {
    current,
    year_lines: yearLines,
    chuxian_year: birth.getUTCFullYear() + Math.ceil(childDuration),
    chuxian_date: formatDate(chuxianDate),
    chuxian_age: round(childDuration),
    chuxian_age_years: Math.floor(childDuration),
    chuxian_age_months: Math.floor((childDuration % 1) * 12),
    palace_years: palaceYears,
    boundary_years: boundaryYears,
    total_years: round(totalYears),
    method: `洞微百六限/童限基数${childLimit}+太阳宫度÷3`,
    dingxing: [], natal_dingxing: [], liunian_dingxing: []
  };
}

function buildFlowYears(xiaoxian, dongwei, dayun) {
  return xiaoxian.map((small, i) => {
    const age = i + 1, year = small.liunian;
    const major = dayun?.list?.find(item => year >= item.year && year < item.year + 10) || null;
    const limit = dongwei.year_lines.find(item => item.age === age) || null;
    return {
      year,
      age_xu: age,
      ganzhi: small.liunian_ganzhi,
      xiaoxian: { gong: small.gong, renshi: small.renshi },
      dongwei: limit ? { period: limit.renshi === '命' ? '童限' : '大限', gong: limit.gong, renshi: limit.renshi, xiu: limit.xiu, xiu_degree: limit.xiu_degree, duzhu: limit.duzhu } : null,
      dayun: major ? { ganzhi: major.ganzhi, start_age: major.start_age, end_age: major.end_age } : null
    };
  });
}

module.exports = {
  PERIOD_NAMES, PERIOD_DURATIONS, parseLocal, liChun, yearsBetween,
  buildXiaoxian, buildYuexian, buildDongwei, buildFlowYears
};
