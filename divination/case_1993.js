// case_1993.js — 单命例对比：湖北钟祥 阳历1993-03-10 23:45 男
// 同时调用天官API(真值) 与 本地 qizheng 引擎，输出完整对比
const Q = require('./qizheng.cjs');
const norm = x => ((x % 360) + 360) % 360;
const diff = (a, b) => Math.abs(norm(a - b + 180) - 180);

async function tgApi(date, time, lon, lat) {
  const r = await fetch('https://xn--rsso0d.cn/api/v1/public/chart/calculate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ birth_date: date, birth_time: time, birth_lon: lon, birth_lat: lat, timezone: 8, gender: 'male', xiu_method: 'huangdaohuigui' })
  });
  return r.json();
}

const NAME = { '太阳': '日', '太阴': '月', '水星': '水星', '金星': '金星', '火星': '火星', '木星': '木星', '土星': '土星', '罗睺': '罗睺', '计都': '计都', '月孛': '月孛', '紫气': '紫炁' };
const ORDER = ['太阳', '太阴', '水星', '金星', '火星', '木星', '土星', '罗睺', '计都', '月孛', '紫气'];

(async () => {
  const date = '1993-03-10', time = '23:45', lon = 112.58, lat = 31.17;
  console.log(`\n========== 命例：阳历 ${date} ${time} 男 湖北钟祥(东经${lon}°, 北纬${lat}°) ==========\n`);

  const d = await tgApi(date, time, lon, lat);

  // ---- 天官 API 全量结构 ----
  console.log('【天官 API 顶层字段】', Object.keys(d).join(', '));
  console.log('【basic】', JSON.stringify(d.basic));
  console.log('【planets 单条字段】', Object.keys(d.planets[0]).join(', '));
  if (d.palaces) console.log('【palaces】', JSON.stringify(d.palaces).slice(0, 400));
  if (d.mingong) console.log('【mingong】', JSON.stringify(d.mingong));
  console.log('');

  const tgP = {}; d.planets.forEach(p => tgP[p.name] = p);

  // ---- 本地引擎：口径A=原始钟表时 23:45 ----
  const rA = Q.qiZheng({ date, time, lon, tz: 8 });
  const myA = {}; [...rA.qiZheng, ...rA.siYu].forEach(s => myA[s.name] = s);

  // ---- 本地引擎：口径B=用天官返回的真太阳时 ----
  const tst = d.basic.true_solar_time;  // 形如 "1993-03-10 23:xx:xx" 或仅时间
  let rB = null, myB = null;
  try {
    let tstDate = date, tstTime = time;
    const m = String(tst).match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}|\d{2}:\d{2})/);
    if (m) { tstDate = m[1]; tstTime = m[2].slice(0, 5); }
    rB = Q.qiZheng({ date: tstDate, time: tstTime, lon, tz: 8 });
    myB = {}; [...rB.qiZheng, ...rB.siYu].forEach(s => myB[s.name] = s);
  } catch (e) { console.log('真太阳时对照解析失败:', e.message); }

  // ---- 输出对比表 ----
  console.log('=== 七政四余 黄经对比（度）===');
  console.log('星曜'.padEnd(5), '天官API'.padStart(10), '我们(A钟表时)'.padStart(12), '差(A)'.padStart(8), '我们(B真太阳)'.padStart(12), '差(B)'.padStart(8));
  console.log('-'.repeat(62));
  let maxA = 0, maxB = 0;
  for (const n of ORDER) {
    const tgn = NAME[n];
    const tv = tgP[tgn] ? tgP[tgn].lon : null;
    const av = myA[n].lon, bv = myB ? myB[n].lon : null;
    const dA = diff(tv, av), dB = bv != null ? diff(tv, bv) : NaN;
    maxA = Math.max(maxA, dA); if (bv != null) maxB = Math.max(maxB, dB);
    console.log(
      n.padEnd(5),
      (tv != null ? tv.toFixed(4) : '—').padStart(10),
      av.toFixed(4).padStart(12),
      dA.toFixed(4).padStart(8),
      (bv != null ? bv.toFixed(4) : '—').padStart(12),
      (bv != null ? dB.toFixed(4) : '—').padStart(8)
    );
  }
  console.log('-'.repeat(62));
  console.log(`口径A(我们都用钟表时): 最大偏差 ${maxA.toFixed(4)}° = ${(maxA * 3600).toFixed(1)} 角秒`);
  if (rB) console.log(`口径B(我们改用天官真太阳时 ${tst}): 最大偏差 ${maxB.toFixed(4)}° = ${(maxB * 3600).toFixed(1)} 角秒`);

  // ---- 宫/宿对比 ----
  console.log('\n=== 宫 / 宿(入宿度) 对比（口径A：我们都用钟表时）===');
  console.log('星曜'.padEnd(5), '天官 宫'.padStart(8), '我们 宫'.padStart(8), '天官 宿'.padStart(10), '我们 宿'.padStart(10));
  for (const n of ORDER) {
    const tgn = NAME[n];
    const tgGong = tgP[tgn].gong, tgXiu = (tgP[tgn].xiu || '') + (tgP[tgn].xiu_du != null ? tgP[tgn].xiu_du : '');
    const myGong = myA[n].gong, myXiu = myA[n].xiu + '(' + myA[n].duInXiu + ')';
    console.log(n.padEnd(5), String(tgGong).padStart(8), String(myGong).padStart(8), String(tgXiu).padStart(10), String(myXiu).padStart(10));
  }

  // ---- 本地引擎完整文本 ----
  console.log('\n=== 本地引擎完整输出（钟表时口径）===');
  const L = [];
  L.push(`📅 ${rA.datetime.input}｜东经 ${rA.datetime.longitude}°｜UTC ${rA.datetime.utc.slice(0, 16).replace('T', ' ')}`);
  L.push('【七政】');
  for (const s of rA.qiZheng) L.push(`　${s.name}　${s.lon.toFixed(2).padStart(6)}°　${s.gong}(${s.gongZhu})　　${s.xiu}${s.qin} ${s.xiuWuxing}（${s.duInXiu}°）`);
  L.push('【四余】');
  for (const s of rA.siYu) L.push(`　${s.name}　${s.lon.toFixed(2).padStart(6)}°　${s.gong}(${s.gongZhu})　　${s.xiu}${s.qin}（${s.duInXiu}°）`);
  console.log(L.join('\n'));
})();
