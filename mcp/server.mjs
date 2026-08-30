// server.mjs — MCP stdio Server：暴露排盘、引文检索与专业术数工具给 Codex / Claude / 任意 MCP 客户端
// Codex 接入：~/.codex/config.toml 里加 [mcp_servers.bazi] command="node" args=["<绝对路径>/mcp/server.mjs"]
import { createInterface } from 'node:readline';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { paipan } from '../engine/paipan.mjs';
import { analyze } from '../engine/analyze.mjs';
import { retrieve, format } from '../rag/retrieve.mjs';

const DIV_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'divination');
const require = createRequire(import.meta.url);
const { calculateChart: calculateQiZhengChart, calculateLiunian: calculateQiZhengLiunian } = require('../divination/qizheng.cjs');

function send(obj) { process.stdout.write(JSON.stringify(obj) + '\n'); }

const TOOL = {
  name: 'bazi_paipan',
  description: '八字排盘引擎：输入出生信息（公历或农历 + 时间 + 城市/经度），返回真太阳时校正后的四柱、大运、神煞、刑冲合会，以及十神/五行/强弱/格局/调候的结构化 JSON。任何命理回答都必须基于本工具输出，禁止 LLM 自行生成干支。',
  inputSchema: {
    type: 'object',
    properties: {
      cal: { type: 'string', enum: ['solar', 'lunar'], description: '日期类型，默认 solar' },
      date: { type: 'string', description: '出生日期 YYYY-MM-DD（按 cal 解释）' },
      time: { type: 'string', description: '出生钟表时间 HH:mm（北京时间，24h 制）' },
      gender: { type: 'number', enum: [1, 0], description: '1=男 0=女，默认 1' },
      sect: { type: 'number', enum: [1, 2], description: '晚子时流派：1=23:00 后日柱归次日（多数网站默认），2=日柱归当天，默认 2' },
      city: { type: 'string', description: '出生城市中文名（内置 40 城经度表）' },
      lon: { type: 'number', description: '或直接给东经经度，优先于 city' }
    },
    required: ['date', 'time']
  }
};

const CITE_TOOL = {
  name: 'cite_lookup',
  description: '古籍引文检索：按命盘特征关键词（如「庚金 卯月 正财 身弱」「伤官 配印」「六爻 动爻」）返回可引用的古籍原句（含出处）。用于给解读加一处点到为止的经典引用，提升质感与说服力。自动按术数门派路由书目（八字→滴天髓/子平真诠/穷通宝鉴；六爻→卜筮正宗；奇门→奇门遁甲统宗；紫微→紫微斗数全书）。',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '关键词，空格分隔，建议含日主+月令+格局+强弱，或卦爻术语' },
      top: { type: 'number', description: '返回条数，默认 3（解读里实际只引 1-2 处）' },
      domain: { type: 'string', enum: ['bazi', 'ziwei', 'qizheng', 'liuyao', 'qimen', 'daliuren'], description: '可选，强制指定门派' }
    },
    required: ['query']
  }
};

const QIZHENG_SCHEMA = {
  type: 'object',
  properties: {
    birth_date: { type: 'string', description: '公历出生日期 YYYY-MM-DD' },
    birth_time: { type: 'string', description: '当地钟表时间 HH:mm[:ss]' },
    birth_lon: { type: 'number', minimum: -180, maximum: 180, description: '出生地经度，东经为正' },
    birth_lat: { type: 'number', minimum: -90, maximum: 90, description: '出生地纬度，北纬为正' },
    timezone: { type: 'number', minimum: -14, maximum: 14, description: '当地时区；中国通常为 8' },
    date_type: { type: 'string', enum: ['solar', 'lunar'], description: '日期类型：公历 solar 或农历 lunar；农历日期仍用 YYYY-MM-DD 表示农历年月日' },
    time_type: { type: 'string', enum: ['wallclock', 'solar_time'], description: '墙上标准时，或已经换算好的真太阳时输入' },
    gender: { type: 'string', enum: ['male', 'female'], description: '性别' },
    name: { type: 'string', description: '可选姓名，仅回显在 basic' },
    city: { type: 'string', description: '可选城市名，仅回显在 basic' },
    xiu_method: { type: 'string', enum: ['huangdaohuigui', 'huigui_gusu', 'gusu_suicha', 'zhengan', 'chidao_jinxiu', 'chidao_gusu_suicha', 'chidao_zhengan', 'chidao_huigui_gusu', 'guolao'], description: '九种黄道/赤道今宿、古宿、郑案与果老盘制' },
    coord_system: { type: 'string', enum: ['huangdao', 'chidao'], description: '须与 xiu_method 匹配' },
    node_arrangement: { type: 'string', enum: ['south_north', 'north_south'], description: '罗睺/计都南北交点排列' },
    node_calculation: { type: 'string', enum: ['mean', 'fitted'], description: '罗计计算：平均交点或瞬时轨道面拟合交点' },
    apogee_calculation: { type: 'string', enum: ['mean', 'fitted'], description: '月孛计算：平均远地点或相邻真实远地点插值' },
    ziqi_calculation: { type: 'string', enum: ['equatorial_uniform', 'ecliptic_projection'], description: '紫炁沿赤道匀行，或沿黄道运行后投影赤道' },
    jieqi_method: { type: 'string', enum: ['true', 'mean'], description: '节气计算：太阳真实黄经定气，或冬至起算的回归年均分平气' },
    day_night_method: { type: 'string', enum: ['sunrise_sunset', 'sunrise_sunset_shichen', 'mao_day_you_night'], description: '昼夜判定：日出没时刻、日出没时辰或卯昼酉夜' },
    dingxing_tolerance: { type: 'number', minimum: 0, maximum: 30, description: '顶星容许度，默认 1.5°' },
    tongluo_tolerance: { type: 'number', minimum: 0, maximum: 10, description: '同络容许度，默认 2°' },
    ming_gong_method: { type: 'string', enum: ['sun_to_mao', 'sun_to_sunrise', 'horizon_rising', 'rising_with_sun'], description: '命宫起法：日到卯、日到日出、地平东升点、升点宫配太阳宫度' },
    shen_gong_method: { type: 'string', enum: ['moon_is_shen', 'moon_to_you', 'moon_to_moonrise', 'moon_to_sunset'], description: '身宫起法：月为身、月到酉、月到月出、月到日没' },
    child_limit: { type: 'number', enum: [9, 10], description: '童限基数，默认实岁制 9' },
    reference_date: { type: 'string', description: '本命盘限运定位参考日 YYYY-MM-DD；默认今日' },
    reference_time: { type: 'string', description: '限运定位参考时间 HH:mm[:ss]' },
    dst_adjust: { type: 'boolean', description: '是否按中国 1986—1991 夏令时表校正' },
    distinguish_zi_hour: { type: 'boolean', description: '区分早晚子时；默认 true，对应 sect2' },
    args: { type: 'array', items: { type: 'string' }, deprecated: true, description: '兼容旧调用：[YYYY-MM-DD, HH:mm, 经度, 纬度(可选)]' }
  },
  anyOf: [
    { required: ['birth_date', 'birth_time', 'birth_lon', 'birth_lat'] },
    { required: ['args'] }
  ]
};

const QIZHENG_LIUNIAN_SCHEMA = {
  ...QIZHENG_SCHEMA,
  properties: {
    ...QIZHENG_SCHEMA.properties,
    liunian_year: { type: 'integer', minimum: 1600, maximum: 2600, description: '要推演的明确流年' },
    liuyue: { type: 'integer', minimum: 1, maximum: 12, description: '公历月；默认出生月' },
    liuri: { type: 'integer', minimum: 1, maximum: 31, description: '公历日；默认出生日期并自动处理月末' },
    liushi: { type: 'string', description: '流时 HH:mm[:ss]；默认出生时间' }
  },
  required: ['liunian_year']
};

// 占卜类工具：node 子进程跑 divination/ 下对应脚本
const DIV_TOOLS = [
  { name: 'div_liuyao', script: 'liuyao.js', description: '六爻占卜：单事吉凶决断。args 可传 [爻码(6位数字,0=阳不动,1=阴不动,2=阳动,3=阴动), 问题]，不传则模拟摇卦。', example: ['010203', '婚姻'] },
  { name: 'div_meihua', script: 'meihua.js', description: '梅花易数起卦。args 三选一：[] 时间起卦 / [数1,数2,数3] 报数起卦 / [方位1,方位2] 方位起卦。', example: ['3', '5', '8'] },
  { name: 'div_qimen', script: 'qimen.js', description: '奇门遁甲排局。args 可传 [YYYY-MM-DD, 时辰(24h制,可选)]，不传用当前时间。', example: ['2026-08-29', '16'] },
  { name: 'div_ziwei', script: 'ziwei.js', description: '紫微斗数命盘（知识库增强版，12宫/四化/格局）。args: [YYYY-MM-DD, 性别(男/女), 时间HH:mm(可选)]。', example: ['1993-03-10', '男', '23:45'] },
  { name: 'div_marriage', script: 'marriage.js', description: '合婚分析（日主生克/纳音/干支合冲）。args: [名1, "四柱(空格分隔)", 名2, "四柱"]。', example: ['张三', '癸酉 乙卯 庚寅 戊子', '李四', '壬申 丙午 甲子 辛未'] },
  { name: 'div_zhuanshi', script: 'zhuanshi.js', description: '择吉选日（建除十二神+彭祖百忌+多因子评分）。args: ["best"(可选), YYYY-MM, 活动类型(开业/搬家/签约/订婚/装修/出行/结婚/祭祀/求财/上任), 可选八字]。', example: ['best', '2026-09', '开业'] },
  { name: 'div_daily', script: 'daily-fortune.js', description: '每日运程：综合指数、穿衣颜色、宜忌、吉时。args 可传 [八字]，不传为通用日运。', example: [] },
  { name: 'div_daliuren', script: 'daliuren.cjs', description: '大六壬起课（基础版）：月将/天地盘/四课/九宗门三传/天将/六亲/遁干。args: [YYYY-MM-DD(可选), 时辰(地支或0-23,可选), 月将(可选)]。', example: ['2026-08-29', '16'] },
  { name: 'div_qizheng', script: 'qizheng.cjs', description: '专业七政四余本命盘：九种今古宿/郑案/果老盘制、mean/fitted 四余、庙旺、化曜神煞、四柱节气、童限、洞微大限、小限及 120 年流年时间轴；不依赖 Swiss Ephemeris。', inputSchema: QIZHENG_SCHEMA, example: ['2026-08-29', '18:00', '112.59', '31.17'] },
  { name: 'div_qizheng_liunian', script: 'qizheng.cjs', description: '专业七政四余流年盘：必须给出明确 liunian_year，可选流月/流日/流时；返回流曜、流年化曜神煞、小限月限、洞微限和流年时间轴交点。', inputSchema: QIZHENG_LIUNIAN_SCHEMA }
];

function runDiv(script, args) {
  const argv = (args || []).map(String);
  return new Promise(resolve => {
    execFile(process.execPath, [path.join(DIV_DIR, script), ...argv], { cwd: DIV_DIR, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      resolve(stdout || stderr || (err ? String(err.message) : ''));
    });
  });
}

const rl = createInterface({ input: process.stdin });
rl.on('line', async line => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  const { id, method } = msg;
  switch (method) {
    case 'initialize':
      send({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'bazi-engine', version: '0.4.0' } } });
      break;
    case 'tools/list':
      send({
        jsonrpc: '2.0', id, result: {
          tools: [TOOL, CITE_TOOL, ...DIV_TOOLS.map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema || { type: 'object', properties: { args: { type: 'array', items: { type: 'string' }, description: '位置参数，按工具说明顺序传入' } } }
          }))]
        }
      });
      break;
    case 'tools/call': {
      const name = msg.params?.name;
      const a = msg.params?.arguments || {};
      if (name === 'bazi_paipan') {
        try {
          const r = paipan(a);
          const an = analyze(r.chart);
          send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({ ...r, analysis: an }, null, 2) }] } });
        } catch (e) {
          send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: '排盘失败: ' + e.message }], isError: true } });
        }
      } else if (name === 'cite_lookup') {
        try {
          const rs = retrieve(a.query || '', { top: a.top || 3, domain: a.domain || null });
          send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(rs, null, 2) + '\n\n格式化:\n' + (format(rs) || '（未命中引文）') }] } });
        } catch (e) {
          send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: '引文检索失败: ' + e.message }], isError: true } });
        }
      } else if (name === 'div_qizheng') {
        try {
          const legacy = Array.isArray(a.args) ? {
            birth_date: a.args[0], birth_time: a.args[1] || '12:00', birth_lon: Number(a.args[2] ?? 120),
            birth_lat: Number(a.args[3] ?? 0), timezone: 8, gender: 'male', xiu_method: 'huangdaohuigui', coord_system: 'huangdao'
          } : a;
          const result = calculateQiZhengChart(legacy);
          send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } });
        } catch (e) {
          send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: '七政四余排盘失败: ' + e.message }], isError: true } });
        }
      } else if (name === 'div_qizheng_liunian') {
        try {
          const result = calculateQiZhengLiunian(a);
          send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } });
        } catch (e) {
          send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: '七政四余流年排盘失败: ' + e.message }], isError: true } });
        }
      } else {
        const t = DIV_TOOLS.find(d => d.name === name);
        if (!t) {
          if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Unknown tool: ' + name } });
          break;
        }
        const out = await runDiv(t.script, a.args);
        send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: out }] } });
      }
      break;
    }
    case 'ping':
      send({ jsonrpc: '2.0', id, result: {} });
      break;
    default:
      if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found: ' + method } });
  }
});
