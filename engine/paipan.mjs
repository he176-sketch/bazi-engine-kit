// paipan.mjs — 八字排盘入口：公历/农历 + 真太阳时校正 + 早晚子时流派
// 输出结构化 JSON：四柱/十神/藏干/纳音/神煞/大运/刑冲合会（由 cantian-tymext 保证正确性）
import { buildBaziFromSolar, buildBaziFromLunar } from 'cantian-tymext';

export const CITY_LON = {
  北京: 116.4, 上海: 121.43, 广州: 113.3, 深圳: 113.55, 杭州: 120.17, 南京: 118.77,
  武汉: 114.33, 长沙: 112.92, 成都: 104.07, 重庆: 106.55, 西安: 108.95, 郑州: 113.7,
  天津: 117.17, 苏州: 120.65, 合肥: 117.27, 福州: 119.32, 厦门: 118.07, 济南: 117.03,
  青岛: 120.32, 沈阳: 123.38, 哈尔滨: 126.63, 长春: 125.3, 石家庄: 114.43, 太原: 112.55,
  南昌: 115.88, 昆明: 102.7, 贵阳: 106.72, 南宁: 108.35, 海口: 110.32, 兰州: 103.83,
  乌鲁木齐: 87.6, 拉萨: 91.03, 呼和浩特: 111.63, 银川: 106.22, 西宁: 101.82,
  荆门: 112.2, 钟祥: 112.59, 宜昌: 111.25, 襄阳: 112.12, 沙市: 112.28
};

// 中国夏令时区间（1986-1991），期间钟表时间比标准时间快 1 小时，需扣回
const DST_WINDOWS = [
  [1986, 5, 4, 9, 14], [1987, 4, 12, 9, 13], [1988, 4, 10, 9, 11],
  [1989, 4, 16, 9, 10], [1990, 4, 15, 9, 16], [1991, 4, 14, 9, 15]
];

function inDST(y, mo, d) {
  for (const [yy, m1, d1, m2, d2] of DST_WINDOWS) {
    if (y !== yy) continue;
    if (mo > m1 && mo < m2) return true;
    if (mo === m1 && d >= d1) return true;
    if (mo === m2 && d <= d2) return true;
  }
  return false;
}

function dayOfYear(y, mo, d) {
  return Math.floor((Date.UTC(y, mo - 1, d) - Date.UTC(y, 0, 1)) / 86400000) + 1;
}

const pad2 = n => String(n).padStart(2, '0');

/**
 * 真太阳时换算：真太阳时 = 钟表时 − 夏令时(如有) + 经度差 + 均时差
 * 均时差用经典三 term 近似（精度约 ±30 秒）；临界案例（子时边界 ±3 分钟内）建议人工复核
 */
export function trueSolar(y, mo, d, h, mi, s = 0, lon = 120) {
  let total = h * 3600 + mi * 60 + s;
  const dstApplied = inDST(y, mo, d);
  if (dstApplied) total -= 3600;
  const meanOffSec = Math.round((lon - 120) * 240);
  const N = dayOfYear(y, mo, d);
  const B = (2 * Math.PI * (N - 81)) / 365;
  const eotMin = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  const eotSec = Math.round(eotMin * 60);
  let t = total + meanOffSec + eotSec;
  let dayShift = 0;
  while (t < 0) { t += 86400; dayShift--; }
  while (t >= 86400) { t -= 86400; dayShift++; }
  const base = new Date(Date.UTC(y, mo - 1, d));
  base.setUTCDate(base.getUTCDate() + dayShift);
  return {
    datetime: `${base.getUTCFullYear()}-${pad2(base.getUTCMonth() + 1)}-${pad2(base.getUTCDate())}T${pad2(Math.floor(t / 3600))}:${pad2(Math.floor((t % 3600) / 60))}:${pad2(t % 60)}`,
    corrections: { dstApplied, meanOffSec, eotSec, totalSec: meanOffSec + eotSec - (dstApplied ? 3600 : 0), dayShift }
  };
}

/**
 * 排盘主函数
 * @param {object} o { cal:'solar'|'lunar', date:'YYYY-MM-DD', time:'HH:mm[:ss]',
 *                     gender:1|0, sect:1|2(晚子时日柱归次日|当天), city 或 lon }
 */
export function paipan(o) {
  const { cal = 'solar', date, time, gender = 1, sect = 2 } = o;
  if (!date || !time) throw new Error('缺少 date / time');
  const lon = o.lon ?? (o.city && CITY_LON[o.city]) ?? 120;
  const [y, mo, d] = date.split('-').map(Number);
  const tp = time.split(':').map(Number);
  const h = tp[0], mi = tp[1] || 0, s = tp[2] || 0;

  let solarDate = { y, mo, d };
  if (cal === 'lunar') {
    // 先用原始钟表时把农历映射到阳历日期
    const raw = buildBaziFromLunar({ lunarTime: `${y}-${pad2(mo)}-${pad2(d)}T${pad2(h)}:${pad2(mi)}:${pad2(s)}`, gender, sect });
    const m = raw['阳历'].match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (!m) throw new Error('农历转阳历失败: ' + raw['阳历']);
    solarDate = { y: +m[1], mo: +m[2], d: +m[3] };
  }

  const ts = trueSolar(solarDate.y, solarDate.mo, solarDate.d, h, mi, s, lon);
  const chart = buildBaziFromSolar({ solarTime: ts.datetime, gender, sect });

  return {
    input: { calendar: cal, date, time, gender, sect, city: o.city || null, longitude: lon },
    trueSolar: ts,
    lunar: chart['农历'],
    fourPillars: chart['八字'],
    dayMaster: chart['日主'],
    chart
  };
}

// CLI 入口
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const k = process.argv[i].replace(/^--/, '');
    args[k] = process.argv[++i];
  }
  try {
    const r = paipan({
      cal: args.cal || 'solar', date: args.date, time: args.time,
      gender: args.gender ? Number(args.gender) : 1,
      sect: args.sect ? Number(args.sect) : 2,
      city: args.city, lon: args.lon ? Number(args.lon) : undefined
    });
    console.log(JSON.stringify(r, null, 2));
  } catch (e) {
    console.error('排盘失败:', e.message);
    process.exit(1);
  }
}
