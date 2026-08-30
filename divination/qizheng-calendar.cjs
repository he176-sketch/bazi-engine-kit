// 七政规则层所需的农历、四柱、节气、大运与流年。
// lunar-typescript 为 MIT 许可；这里统一使用真太阳时与晚子时 sect=2。
const { Solar, Lunar } = require('lunar-typescript');
const Astro = require('astronomy-engine');

const pad2 = value => String(value).padStart(2, '0');
const TROPICAL_YEAR_DAYS = 365.2422;
const TERM_NAMES_FROM_WINTER = ['冬至', '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪'];

function parseLocalDateTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new TypeError(`无效真太阳时: ${value}`);
  return match.slice(1).map(Number);
}

function lunarToSolarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) throw new TypeError('农历日期格式应为 YYYY-MM-DD');
  const [year, month, day] = match.slice(1).map(Number);
  try {
    const solar = Lunar.fromYmd(year, month, day).getSolar();
    return `${solar.getYear()}-${pad2(solar.getMonth())}-${pad2(solar.getDay())}`;
  } catch (error) {
    throw new RangeError(`无效农历日期: ${value} (${error.message})`);
  }
}

function formatTerm(term) {
  const solar = term.getSolar();
  return { name: term.getName(), date: `${pad2(solar.getMonth())}-${pad2(solar.getDay())} ${pad2(solar.getHour())}:${pad2(solar.getMinute())}` };
}

function winterSolstice(year) {
  const result = Astro.SearchSunLongitude(270, new Date(Date.UTC(year, 11, 1)), 45);
  if (!result) throw new Error(`未找到 ${year} 年冬至`);
  return result.date.getTime();
}

function meanJieqi(year, month, day, hour, minute, second, timezone = 8) {
  // 平气口径：以真冬至为本轮起点，按回归年 365.2422 日均分 24 气。
  // 对方接口仅用它改变 jieqi 显示，四柱与起运仍沿用定气口径。
  const offsetMs = timezone * 3600000;
  const current = Date.UTC(year, month - 1, day, hour, minute, second);
  const currentWinter = winterSolstice(year) + offsetMs;
  const anchor = current >= currentWinter ? currentWinter : winterSolstice(year - 1) + offsetMs;
  const interval = TROPICAL_YEAR_DAYS * 86400000 / 24;
  const terms = Array.from({ length: 26 }, (_, index) => ({
    name: TERM_NAMES_FROM_WINTER[index % 24],
    stamp: anchor + interval * index
  }));
  let prev = terms[0], next = terms[1];
  for (let index = 1; index < terms.length; index++) {
    if (terms[index].stamp > current) { next = terms[index]; prev = terms[index - 1]; break; }
  }
  const format = term => {
    const date = new Date(term.stamp);
    return { name: term.name, date: `${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}` };
  };
  return { prev: format(prev), next: format(next) };
}

function pillar(gan, zhi, nayin) { return { gan, zhi, nayin }; }

function buildDayun(eightChar, gender, sect = 2) {
  const numericGender = gender === 'female' || gender === 0 ? 0 : 1;
  const yun = eightChar.getYun(numericGender, sect), start = yun.getStartSolar();
  const exactStartAge = yun.getStartYear() + yun.getStartMonth() / 12 + yun.getStartDay() / 365.2425 + yun.getStartHour() / 8765.82;
  const list = yun.getDaYun(9).filter(item => item.getIndex() > 0).map((item, index) => ({
    year: start.getYear() + index * 10,
    start_age: Number((exactStartAge + index * 10).toFixed(4)),
    end_age: Number((exactStartAge + (index + 1) * 10).toFixed(4)),
    ganzhi: item.getGanZhi()
  }));
  return {
    direction: yun.isForward() ? '顺排' : '逆排', start_age: list[0]?.start_age || 1, list,
    qiyun_date: start.toYmd(), qiyun_years: yun.getStartYear(), qiyun_months: yun.getStartMonth(),
    qiyun_days: yun.getStartDay(), qiyun_hours: yun.getStartHour(), method: `lunar-typescript/sect${sect}`
  };
}

function buildCalendar(trueSolarDateTime, gender, options = {}) {
  const [year, month, day, hour, minute, second] = parseLocalDateTime(trueSolarDateTime);
  const solar = Solar.fromYmdHms(year, month, day, hour, minute, second), lunar = solar.getLunar(), eightChar = lunar.getEightChar();
  const sect = options.distinguishZiHour === false ? 1 : 2;
  eightChar.setSect(sect);
  const bazi = {
    nian: pillar(eightChar.getYearGan(), eightChar.getYearZhi(), eightChar.getYearNaYin()),
    yue: pillar(eightChar.getMonthGan(), eightChar.getMonthZhi(), eightChar.getMonthNaYin()),
    ri: pillar(eightChar.getDayGan(), eightChar.getDayZhi(), eightChar.getDayNaYin()),
    shi: pillar(eightChar.getTimeGan(), eightChar.getTimeZhi(), eightChar.getTimeNaYin())
  };
  return {
    solar, lunar, eightChar, bazi,
    lunarDate: `${eightChar.getYear()}年 ${eightChar.getMonth()}月 ${eightChar.getDay()}日 ${eightChar.getTime()}时`,
    lunarDisplay: `${lunar.getYearInGanZhi()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()} ${lunar.getTimeZhi()}时`,
    jieqi: options.jieqiMethod === 'mean'
      ? meanJieqi(year, month, day, hour, minute, second, Number(options.timezone ?? 8))
      : { prev: formatTerm(lunar.getPrevJieQi()), next: formatTerm(lunar.getNextJieQi()) },
    dayun: buildDayun(eightChar, gender, sect), sect
  };
}

function yearGanZhi(year) { return Solar.fromYmd(year, 7, 1).getLunar().getYearInGanZhiByLiChun(); }

module.exports = { buildCalendar, buildDayun, lunarToSolarDate, meanJieqi, yearGanZhi };
