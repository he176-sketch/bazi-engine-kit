// validate_vs_tianguan.cjs — 可选联网兼容性对照；天官仅作外部参照，不被定义为绝对真值
// 用法: node validate_vs_tianguan.cjs
const Q = require('./qizheng.cjs');
const norm = x => ((x % 360) + 360) % 360;
const diff = (a, b) => Math.abs(norm(a - b + 180) - 180);
const clockSeconds = value => {
  const parts = String(value).split(':').map(Number);
  if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60;
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
};
const clockDiff = (a, b) => {
  const raw = Math.abs(clockSeconds(a) - clockSeconds(b));
  return Math.min(raw, 86400 - raw);
};
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const RELATION_FIELDS = ['en_nan_yong', 'shouzhao', 'tongluo', 'tongjing', 'yunu'];
const normalizeTokenText = value => String(value || '').split('、').filter(Boolean).sort().join('、');
const sameRelationField = (name, outside, local) => {
  if (name !== 'shouzhao') return sameJson(outside, local);
  const normalize = value => ({
    mingdu: normalizeTokenText(value?.mingdu), shendu: normalizeTokenText(value?.shendu),
    relations: Object.fromEntries(Object.entries(value?.relations || {}).sort().map(([key, text]) => [key, normalizeTokenText(text)]))
  });
  return sameJson(normalize(outside), normalize(local));
};

const CASES = [
  ['2026-08-29', '18:00', 112.59, 31.17],
  ['1995-05-20', '12:00', 116.40, 39.90],
  ['1988-03-08', '08:00', 121.47, 31.23],
  ['2012-11-11', '23:30', 113.26, 23.13],
  ['2000-01-01', '06:15', 114.06, 22.54],
  ['1976-07-28', '15:42', 118.18, 39.63],
];

async function tgApi(date, time, lon, lat, overrides = {}) {
  const r = await fetch('https://xn--rsso0d.cn/api/v1/public/chart/calculate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      birth_date: date, birth_time: time, birth_lon: lon, birth_lat: lat, timezone: 8, gender: 'male',
      xiu_method: 'huangdaohuigui', coord_system: 'huangdao', node_arrangement: 'south_north',
      node_calculation: 'mean', apogee_calculation: 'mean', ziqi_calculation: 'equatorial_uniform', dst_adjust: false,
      ...overrides
    })
  });
  const payload = await r.json();
  if (!r.ok || !Array.isArray(payload.planets)) throw new Error(`天官 API 对照失败: HTTP ${r.status} ${JSON.stringify(payload).slice(0, 200)}`);
  return payload;
}

async function tgFlowApi(request) {
  const r = await fetch('https://xn--rsso0d.cn/api/v1/public/chart/liunian', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request)
  });
  const payload = await r.json();
  if (!r.ok || !Array.isArray(payload.liunian_planets)) throw new Error(`天官流年 API 对照失败: HTTP ${r.status} ${JSON.stringify(payload).slice(0, 200)}`);
  return payload;
}

// 本地引擎名 → 天官API返回名（天官用 日/月/紫炁）
const NAME = { '太阳': '日', '太阴': '月', '水星': '水星', '金星': '金星', '火星': '火星', '木星': '木星', '土星': '土星', '罗睺': '罗睺', '计都': '计都', '月孛': '月孛', '紫气': '紫炁' };

(async () => {
  const order = ['太阳', '太阴', '水星', '金星', '火星', '木星', '土星', '罗睺', '计都', '月孛', '紫气'];
  const acc = {}; order.forEach(n => acc[n] = []);
  let gongMatches = 0, xiuMatches = 0, comparisons = 0;
  let mingGongMatches = 0, shenGongMatches = 0;
  const relationMatches = Object.fromEntries(RELATION_FIELDS.map(name => [name, 0]));
  const solarTimeErrors = [], mingLonErrors = [], shenLonErrors = [];
  console.log('样本'.padEnd(22), order.map(n => n.padStart(7)).join(''));
  console.log('-'.repeat(22 + 8 * 11));
  for (const [date, time, lon, lat] of CASES) {
    const d = await tgApi(date, time, lon, lat);
    const r = Q.qiZheng({ date, time, lon, tz: 8 });
    const chart = Q.calculateChart({ birth_date: date, birth_time: time, birth_lon: lon, birth_lat: lat, timezone: 8, gender: 'male', xiu_method: 'huangdaohuigui' });
    const tgP = {}; d.planets.forEach(p => tgP[p.name] = p);
    const mine = {}; [...r.qiZheng, ...r.siYu].forEach(s => mine[s.name] = s);
    const row = order.map(n => {
      const tgn = NAME[n], tv = tgP[tgn].lon, mv = mine[n].lon;
      const dd = diff(tv, mv); acc[n].push(dd);
      comparisons++;
      if (tgP[tgn].gong === mine[n].gong) gongMatches++;
      if (tgP[tgn].xiu === mine[n].xiu) xiuMatches++;
      return dd.toFixed(3).padStart(7);
    });
    console.log(`${date} ${time}`.padEnd(22), row.join(''));
    solarTimeErrors.push(clockDiff(d.basic.true_solar_time, chart.basic.true_solar_time));
    mingLonErrors.push(diff(d.liming.ming_du_lon, chart.liming.ming_du_lon));
    shenLonErrors.push(diff(d.liming.shen_du_lon, chart.liming.shen_du_lon));
    if (d.liming.ming_gong === chart.liming.ming_gong) mingGongMatches++;
    if (d.liming.shen_gong === chart.liming.shen_gong) shenGongMatches++;
    for (const name of RELATION_FIELDS) if (sameRelationField(name, d[name], chart[name])) relationMatches[name]++;
  }
  console.log('-'.repeat(22 + 8 * 11));
  console.log('最大'.padEnd(22), order.map(n => Math.max(...acc[n]).toFixed(3).padStart(7)).join(''));
  console.log('平均'.padEnd(22), order.map(n => (acc[n].reduce((a, b) => a + b, 0) / acc[n].length).toFixed(3).padStart(7)).join(''));
  const worst = order.reduce((m, n) => Math.max(m, Math.max(...acc[n])), 0);
  console.log(`\n全 11 星最大偏差 = ${worst.toFixed(4)}° = ${(worst * 3600).toFixed(1)} 角秒`);
  console.log(`宫位一致 = ${gongMatches}/${comparisons} (${(gongMatches / comparisons * 100).toFixed(1)}%)`);
  console.log(`宿名一致 = ${xiuMatches}/${comparisons} (${(xiuMatches / comparisons * 100).toFixed(1)}%)`);
  console.log(`真太阳时最大差 = ${Math.max(...solarTimeErrors).toFixed(0)} 秒`);
  console.log(`命宫/身宫一致 = ${mingGongMatches}/${CASES.length} / ${shenGongMatches}/${CASES.length}`);
  console.log(`命度/身度最大差 = ${Math.max(...mingLonErrors).toFixed(4)}° / ${Math.max(...shenLonErrors).toFixed(4)}°`);
  console.log(`关系层逐字段语义一致 = ${RELATION_FIELDS.map(name => `${name} ${relationMatches[name]}/${CASES.length}`).join(' | ')}`);

  // 代表样本补验拟合四余与规则层。斗杓刻意不计入一致率：本地采用《果老星宗》
  // “以戌加月建，顺数至生时”的公开起法，外部服务在部分样本使用不同口径。
  const fittedRequest = {
    birth_date: '1993-03-03', birth_time: '06:00', birth_lon: 112.59, birth_lat: 31.17,
    timezone: 8, gender: 'male', xiu_method: 'huangdaohuigui', coord_system: 'huangdao',
    node_arrangement: 'south_north', node_calculation: 'fitted', apogee_calculation: 'fitted',
    ziqi_calculation: 'equatorial_uniform', dst_adjust: false
  };
  const fittedTg = await tgApi('1993-03-03', '06:00', 112.59, 31.17, { node_calculation: 'fitted', apogee_calculation: 'fitted' });
  const fittedMine = Q.calculateChart(fittedRequest);
  const fittedNames = ['罗睺', '计都', '月孛'];
  const fittedTgPlanets = Object.fromEntries(fittedTg.planets.map(item => [item.name, item]));
  const fittedMinePlanets = Object.fromEntries(fittedMine.planets.map(item => [item.name, item]));
  console.log('\n拟合四余代表样本（1993-03-03 06:00）');
  for (const name of fittedNames) console.log(`${name}: ${diff(fittedTgPlanets[name].lon, fittedMinePlanets[name].lon).toFixed(4)}°`);

  const ruleTables = ['shiyi_huayao', 'tianguan_huayao', 'niangan_shensha', 'yuezhi_shensha', 'changsheng'];
  let ruleTotal = 0, ruleMatches = 0;
  for (const tableName of ruleTables) {
    const outside = fittedTg.shensha[tableName] || {}, local = fittedMine.shensha[tableName] || {};
    for (const [key, value] of Object.entries(outside)) {
      ruleTotal++;
      if (local[key] === value) ruleMatches++;
    }
  }
  const localSmall = Object.fromEntries(fittedMine.xiaoxian.map(item => [item.liunian, item]));
  const smallMatches = fittedTg.xiaoxian.filter(item => {
    const local = localSmall[item.liunian];
    return local && local.gong === item.gong && local.renshi === item.renshi && local.liunian_ganzhi === item.liunian_ganzhi;
  }).length;
  console.log(`核心规则表一致 = ${ruleMatches}/${ruleTotal}`);
  console.log(`外部返回小限一致 = ${smallMatches}/${fittedTg.xiaoxian.length}`);
  console.log(`洞微当前黄道位置差 = ${diff(fittedTg.dongwei.current.zodiac_lon, fittedMine.dongwei.current.zodiac_lon).toFixed(4)}°`);

  // 文档专业调用样例：补验赤道紫炁口径与日月出没的真太阳时显示。
  const docsRequest = {
    birth_date: '1995-06-15', birth_time: '14:30', birth_lon: 116.407, birth_lat: 39.904,
    timezone: 8, gender: 'male', city: '北京', xiu_method: 'chidao_jinxiu', coord_system: 'chidao',
    node_arrangement: 'south_north', node_calculation: 'mean', apogee_calculation: 'mean',
    ziqi_calculation: 'equatorial_uniform', time_type: 'wallclock', day_night_method: 'sunrise_sunset',
    dst_adjust: false
  };
  const docsTg = await tgApi('1995-06-15', '14:30', 116.407, 39.904, docsRequest);
  const docsMine = Q.calculateChart(docsRequest);
  const docsTgQi = docsTg.planets.find(item => item.name === '紫炁');
  const docsMineQi = docsMine.planets.find(item => item.name === '紫炁');
  console.log('\n文档专业样例（1995-06-15 14:30 北京）');
  console.log(`赤道匀行紫炁位置差 = ${diff(docsTgQi.lon, docsMineQi.lon).toFixed(4)}°`);
  for (const key of ['sunrise', 'sunset', 'moonrise', 'moonset']) {
    const outside = docsTg.bottom_right[key], local = docsMine.bottom_right[key];
    console.log(`${key} 时刻差 = ${clockDiff(outside, local).toFixed(0)} 秒 (${outside} / ${local})`);
  }
  const methodPairs = [
    ['sun_to_sunrise', 'moon_to_you'],
    ['horizon_rising', 'moon_to_moonrise'],
    ['rising_with_sun', 'moon_to_sunset']
  ];
  console.log('\n命身宫专业起法对照');
  for (const [ming_gong_method, shen_gong_method] of methodPairs) {
    const methodRequest = { ...docsRequest, ming_gong_method, shen_gong_method };
    const outside = await tgApi('1995-06-15', '14:30', 116.407, 39.904, methodRequest);
    const local = Q.calculateChart(methodRequest);
    console.log(`${ming_gong_method}/${shen_gong_method}: 宫 ${outside.liming.ming_gong === local.liming.ming_gong && outside.liming.shen_gong === local.liming.shen_gong ? '一致' : '不一致'}，命度 ${diff(outside.liming.ming_du_lon, local.liming.ming_du_lon).toFixed(4)}°，身度 ${diff(outside.liming.shen_du_lon, local.liming.shen_du_lon).toFixed(4)}°`);
  }
  const meanRequest = { ...docsRequest, jieqi_method: 'mean' };
  const meanOutside = await tgApi('1995-06-15', '14:30', 116.407, 39.904, meanRequest);
  const meanLocal = Q.calculateChart(meanRequest);
  console.log(`平气节气一致 = ${sameJson(meanOutside.jieqi, meanLocal.jieqi) ? '是' : '否'} (${JSON.stringify(meanOutside.jieqi)} / ${JSON.stringify(meanLocal.jieqi)})`);
  const lunarRequest = { ...docsRequest, birth_date: '2000-01-01', birth_time: '14:00', date_type: 'lunar' };
  const lunarOutside = await tgApi('2000-01-01', '14:00', 116.407, 39.904, lunarRequest);
  const lunarLocal = Q.calculateChart(lunarRequest);
  console.log(`农历输入转公历一致 = ${lunarOutside.basic.solar_date === lunarLocal.basic.solar_date ? '是' : '否'} (${lunarOutside.basic.solar_date} / ${lunarLocal.basic.solar_date})`);
  const flowRequest = { ...docsRequest, liunian_year: 2026, liuyue: 6, liuri: 15, liushi: '14:30' };
  const flowOutside = await tgFlowApi(flowRequest), flowLocal = Q.calculateLiunian(flowRequest);
  const bottomKeys = ['tai_sui', 'xiaoxian', 'yuexian', 'feixian', 'dingxing', 'chandu'];
  console.log(`流年底栏一致 = ${bottomKeys.every(key => flowOutside.bottom_left[key] === flowLocal.bottom_left[key]) ? '是' : '否'}`);
  console.log(`流年关系层一致 = ${['liunian_shouzhao', 'liunian_tongluo', 'liunian_tongjing', 'liunian_yunu'].every(name => sameRelationField(name === 'liunian_shouzhao' ? 'shouzhao' : name, flowOutside[name], flowLocal[name])) ? '是' : '否'}`);
  console.log(`本命/流年顶星一致 = ${sameJson(flowOutside.dongwei.natal_dingxing, flowLocal.dongwei.natal_dingxing) && sameJson(flowOutside.dongwei.liunian_dingxing, flowLocal.dongwei.liunian_dingxing) ? '是' : '否'}`);
})().catch(error => {
  const cause = error?.cause || error;
  if (cause?.code === 'CERT_HAS_EXPIRED') {
    console.error('天官 HTTPS 证书已过期，Node 已拒绝不安全连接；请等对方续期后重试。');
  } else {
    console.error(error?.stack || error);
  }
  process.exitCode = 1;
});
