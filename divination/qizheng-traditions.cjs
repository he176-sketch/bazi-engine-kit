// 七政四余各家宿度与宫度锚点。
//
// 古宿表采用传统 360 度宿宽：角12.8、亢8.9、氐16.3……合计 360 度。
// 赤道古宿/果老量天尺为各自固定表；岁差盘只平移表的历元零点，不改变宿宽。
// 这里的常数是规则数据，不包含任何第三方程序代码。

const norm = value => ((value % 360) + 360) % 360;

const ECLIPTIC_ANCIENT = [
  ['壁', 349.4], ['奎', 358.3], ['娄', 15.9], ['胃', 26.3], ['昴', 41.1], ['毕', 53.2], ['觜', 69.0],
  ['参', 70.1], ['井', 81.8], ['鬼', 112.3], ['柳', 115.2], ['星', 130.5], ['张', 136.4], ['翼', 151.4],
  ['轸', 170.1], ['角', 187.2], ['亢', 200.0], ['氐', 208.9], ['房', 225.2], ['心', 230.6], ['尾', 237.0],
  ['箕', 255.6], ['斗', 266.3], ['牛', 290.1], ['女', 298.0], ['虚', 308.9], ['危', 318.3], ['室', 333.6]
];

const EQUATORIAL_ANCIENT = [
  ['壁', 349.9466626126773], ['奎', 358.4228746001109], ['娄', 14.783934947947728], ['胃', 26.414086279542516],
  ['昴', 41.789540582328925], ['毕', 52.92688889139856], ['觜', 70.0764340752757], ['参', 70.1257143775282],
  ['井', 81.06594147758778], ['鬼', 113.88662277776638], ['柳', 116.05495607687726], ['星', 129.16351647604773],
  ['张', 135.37283455986528], ['翼', 152.3745388369848], ['轸', 170.85465218168008], ['角', 187.90563676105216],
  ['亢', 199.83146990616206], ['氐', 208.8990455206258], ['房', 224.96442405494759], ['心', 230.48381790722988],
  ['尾', 236.89025720005748], ['箕', 255.7153326605203], ['斗', 265.96563552904456], ['牛', 290.8029078643149],
  ['女', 297.8992713886778], ['虚', 309.08590000000004], ['危', 317.9144661485391], ['室', 333.0927992423153]
];

const GUOLAO_RULER = [
  ['壁', 2.4230339918260597], ['奎', 10.899245979259605], ['娄', 27.26030632709641], ['胃', 38.89045765869125],
  ['昴', 54.265911961477634], ['毕', 65.40326027054726], ['觜', 82.55280545442439], ['参', 82.60208575667691],
  ['井', 93.54231285673646], ['鬼', 126.3629941569151], ['柳', 128.531327456026], ['星', 141.63988785519643],
  ['张', 147.849205939014], ['翼', 164.85091021613357], ['轸', 183.33102356082875], ['角', 200.38200814020084],
  ['亢', 212.3078412853108], ['氐', 221.37541689977456], ['房', 237.44079543409623], ['心', 242.96018928637852],
  ['尾', 249.36662857920618], ['箕', 268.191704039669], ['斗', 278.44200690819326], ['牛', 303.2792792434636],
  ['女', 310.37564276782655], ['虚', 321.5622713791487], ['危', 330.3908375276877], ['室', 345.569170621464]
];

function eclipticPrecession(year) {
  // 郑案古宿常用年步岁差：J2000 基值 13°45′23.28″，每公历年 50.3″。
  return 13.756466666666667 + (year - 2000) * 50.3 / 3600;
}

function equatorialPrecession(year) {
  // 赤道古宿岁差的长周期多项式，T 为距 J2000 的儒略世纪。
  const t = (year - 2000) / 100;
  return 13.411921505589268 + 1.3390557066360353 * t + 0.003623683662065673 * t * t
    + 0.00004779451948547633 * t * t * t;
}

function zhengEquatorialAnchor(year) {
  // 郑案以虚宿九度定子宫；T 为距 J2000 的儒略世纪。
  const t = (year - 2000) / 100;
  return 13.808206660657454 + 1.3136425709627273 * t - 0.0017385284680556917 * t * t;
}

function enrich(base, starByName, shift = 0) {
  return base.map(([name, longitude]) => ({ ...starByName[name], name, lon: norm(longitude + shift), sourceLon: longitude }))
    .sort((a, b) => a.lon - b.lon);
}

function traditionalXiuTable(method, time, starByName, currentTable) {
  const year = time.date.getUTCFullYear();
  switch (method) {
    case 'huangdaohuigui':
    case 'chidao_jinxiu':
    case 'chidao_zhengan':
      return currentTable;
    case 'huigui_gusu': return enrich(ECLIPTIC_ANCIENT, starByName);
    case 'gusu_suicha':
    case 'zhengan': return enrich(ECLIPTIC_ANCIENT, starByName, eclipticPrecession(year));
    case 'chidao_huigui_gusu': return enrich(EQUATORIAL_ANCIENT, starByName);
    case 'chidao_gusu_suicha': return enrich(EQUATORIAL_ANCIENT, starByName, equatorialPrecession(year));
    case 'guolao': return enrich(GUOLAO_RULER, starByName);
    default: throw new TypeError(`无效的星宿制式: ${method}`);
  }
}

function palaceAnchor(method, time, table) {
  const year = time.date.getUTCFullYear();
  if (method === 'zhengan') return eclipticPrecession(year);
  if (method === 'chidao_zhengan' || method === 'guolao') {
    return norm(zhengEquatorialAnchor(year) - (method === 'guolao' ? 1.7 : 0));
  }
  return 0;
}

module.exports = {
  ECLIPTIC_ANCIENT, EQUATORIAL_ANCIENT, GUOLAO_RULER,
  eclipticPrecession, equatorialPrecession, zhengEquatorialAnchor, traditionalXiuTable, palaceAnchor
};
