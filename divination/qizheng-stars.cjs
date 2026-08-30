// 二十八宿距星（J1991.25 ICRS）
//
// 距星选择采用 Stellarium 中国星空文化的 28 个 HIP 编号；坐标与自行来自
// ESA Hipparcos Main Catalogue (VizieR I/239/hip_main)。运行时会先应用自行，
// 再由 Astronomy Engine 把 ICRS/J2000 方向旋转到观测时刻的真黄道或真赤道。
// 这些是公开的天文目录事实，不包含任何第三方排盘程序的私有算法或源码。
// 来源：https://github.com/Stellarium/stellarium/tree/master/skycultures/chinese
//       https://cdsarc.cds.unistra.fr/viz-bin/cat/I/239

const DETERMINATIVE_STARS = [
  { name: '角', qin: '蛟', wuxing: '木', hip: 65474, ra: 201.29835230, dec: -11.16124491, pmRa: -42.50, pmDec: -31.73 },
  { name: '亢', qin: '龙', wuxing: '金', hip: 69427, ra: 213.22392088, dec: -10.27404400, pmRa: 8.04, pmDec: 140.79 },
  { name: '氐', qin: '貉', wuxing: '土', hip: 72622, ra: 222.71990536, dec: -16.04161047, pmRa: -105.69, pmDec: -69.00 },
  { name: '房', qin: '兔', wuxing: '日', hip: 78265, ra: 239.71300283, dec: -26.11404280, pmRa: -12.00, pmDec: -25.71 },
  { name: '心', qin: '狐', wuxing: '月', hip: 80112, ra: 245.29717718, dec: -25.59275259, pmRa: -10.03, pmDec: -18.03 },
  { name: '尾', qin: '虎', wuxing: '火', hip: 82514, ra: 252.96766195, dec: -38.04732717, pmRa: -8.84, pmDec: -21.60 },
  { name: '箕', qin: '豹', wuxing: '水', hip: 88635, ra: 271.45218586, dec: -30.42365007, pmRa: -55.75, pmDec: -181.53 },
  { name: '斗', qin: '獬', wuxing: '木', hip: 92041, ra: 281.41397083, dec: -26.99077940, pmRa: 51.15, pmDec: 0.45 },
  { name: '牛', qin: '牛', wuxing: '金', hip: 100345, ra: 305.25269347, dec: -14.78140119, pmRa: 48.42, pmDec: 14.00 },
  { name: '女', qin: '蝠', wuxing: '土', hip: 102618, ra: 311.91888574, dec: -9.49568988, pmRa: 31.89, pmDec: -35.32 },
  { name: '虚', qin: '鼠', wuxing: '日', hip: 106278, ra: 322.88966951, dec: -5.57115593, pmRa: 22.79, pmDec: -6.70 },
  { name: '危', qin: '燕', wuxing: '月', hip: 109074, ra: 331.44593869, dec: -0.31982656, pmRa: 17.90, pmDec: -9.93 },
  { name: '室', qin: '猪', wuxing: '火', hip: 113963, ra: 346.19007020, dec: 15.20536786, pmRa: 61.10, pmDec: -42.56 },
  { name: '壁', qin: '貐', wuxing: '水', hip: 1067, ra: 3.30895828, dec: 15.18361593, pmRa: 4.70, pmDec: -8.24 },
  { name: '奎', qin: '狼', wuxing: '木', hip: 4463, ra: 14.30178237, dec: 23.41775997, pmRa: -43.72, pmDec: -46.06 },
  { name: '娄', qin: '狗', wuxing: '金', hip: 8903, ra: 28.65978771, dec: 20.80829949, pmRa: 96.32, pmDec: -108.80 },
  { name: '胃', qin: '雉', wuxing: '土', hip: 12719, ra: 40.86296031, dec: 27.70717078, pmRa: 3.51, pmDec: -9.97 },
  { name: '昴', qin: '鸡', wuxing: '日', hip: 17499, ra: 56.21884811, dec: 24.11344840, pmRa: 21.55, pmDec: -44.92 },
  { name: '毕', qin: '乌', wuxing: '月', hip: 20889, ra: 67.15388879, dec: 19.18052092, pmRa: 107.23, pmDec: -36.77 },
  { name: '觜', qin: '猴', wuxing: '火', hip: 26207, ra: 83.78449043, dec: 9.93416294, pmRa: -1.03, pmDec: -1.86 },
  { name: '参', qin: '猿', wuxing: '水', hip: 26727, ra: 85.18968672, dec: -1.94257841, pmRa: 3.99, pmDec: 2.54 },
  { name: '井', qin: '犴', wuxing: '木', hip: 30343, ra: 95.73996302, dec: 22.51385027, pmRa: 56.84, pmDec: -108.79 },
  { name: '鬼', qin: '羊', wuxing: '金', hip: 41822, ra: 127.89902880, dec: 18.09455771, pmRa: -60.05, pmDec: -56.50 },
  { name: '柳', qin: '獐', wuxing: '土', hip: 42313, ra: 129.41419739, dec: 5.70379868, pmRa: -70.27, pmDec: -6.99 },
  { name: '星', qin: '马', wuxing: '日', hip: 46390, ra: 141.89688260, dec: -8.65868335, pmRa: -14.49, pmDec: 33.25 },
  { name: '张', qin: '鹿', wuxing: '月', hip: 48356, ra: 147.86951033, dec: -14.84654997, pmRa: 18.68, pmDec: -21.88 },
  { name: '翼', qin: '蛇', wuxing: '火', hip: 53740, ra: 164.94478664, dec: -18.29909723, pmRa: -462.39, pmDec: 129.11 },
  { name: '轸', qin: '蚓', wuxing: '水', hip: 59803, ra: 183.95194937, dec: -17.54198370, pmRa: -159.58, pmDec: 22.31 }
];

module.exports = { DETERMINATIVE_STARS };
