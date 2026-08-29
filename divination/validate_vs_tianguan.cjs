// validate_vs_tianguan.cjs — 用天官.cn 开放 API 作真值，校验本地 qizheng 引擎精度
// 用法: node validate_vs_tianguan.cjs
const Q = require('./qizheng.cjs');
const norm = x => ((x % 360) + 360) % 360;
const diff = (a, b) => Math.abs(norm(a - b + 180) - 180);

const CASES = [
  ['2026-08-29', '18:00', 112.59, 31.17],
  ['1995-05-20', '12:00', 116.40, 39.90],
  ['1988-03-08', '08:00', 121.47, 31.23],
  ['2012-11-11', '23:30', 113.26, 23.13],
  ['2000-01-01', '06:15', 114.06, 22.54],
  ['1976-07-28', '15:42', 118.18, 39.63],
];

async function tgApi(date, time, lon, lat) {
  const r = await fetch('https://xn--rsso0d.cn/api/v1/public/chart/calculate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ birth_date: date, birth_time: time, birth_lon: lon, birth_lat: lat, timezone: 8, gender: 'male', xiu_method: 'huangdaohuigui' })
  });
  return r.json();
}

// 左=本地引擎名, 右=天官API返回名（注意天官用 日/月/紫炁）
// 本地引擎名 → 天官API返回名（天官用 日/月/紫炁）
const NAME = { '太阳': '日', '太阴': '月', '水星': '水星', '金星': '金星', '火星': '火星', '木星': '木星', '土星': '土星', '罗睺': '罗睺', '计都': '计都', '月孛': '月孛', '紫气': '紫炁' };

(async () => {
  const order = ['太阳', '太阴', '水星', '金星', '火星', '木星', '土星', '罗睺', '计都', '月孛', '紫气'];
  const acc = {}; order.forEach(n => acc[n] = []);
  console.log('样本'.padEnd(22), order.map(n => n.padStart(7)).join(''));
  console.log('-'.repeat(22 + 8 * 11));
  for (const [date, time, lon, lat] of CASES) {
    const d = await tgApi(date, time, lon, lat);
    const r = Q.qiZheng({ date, time, lon, tz: 8 });
    const tgP = {}; d.planets.forEach(p => tgP[p.name] = p.lon);
    const mine = {}; [...r.qiZheng, ...r.siYu].forEach(s => mine[s.name] = s.lon);
    const row = order.map(n => {
      const tgn = NAME[n], tv = tgP[tgn], mv = mine[n];
      const dd = diff(tv, mv); acc[n].push(dd);
      return dd.toFixed(3).padStart(7);
    });
    console.log(`${date} ${time}`.padEnd(22), row.join(''));
  }
  console.log('-'.repeat(22 + 8 * 11));
  console.log('最大'.padEnd(22), order.map(n => Math.max(...acc[n]).toFixed(3).padStart(7)).join(''));
  console.log('平均'.padEnd(22), order.map(n => (acc[n].reduce((a, b) => a + b, 0) / acc[n].length).toFixed(3).padStart(7)).join(''));
  const worst = order.reduce((m, n) => Math.max(m, Math.max(...acc[n])), 0);
  console.log(`\n全 11 星最大偏差 = ${worst.toFixed(4)}° = ${(worst * 3600).toFixed(1)} 角秒`);
})();
