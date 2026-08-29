// server.mjs — MCP stdio Server：暴露排盘 + 七大占卜工具给 Codex / Claude / 任意 MCP 客户端
// Codex 接入：~/.codex/config.toml 里加 [mcp_servers.bazi] command="node" args=["<绝对路径>/mcp/server.mjs"]
import { createInterface } from 'node:readline';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { paipan } from '../engine/paipan.mjs';
import { analyze } from '../engine/analyze.mjs';
import { retrieve, format } from '../rag/retrieve.mjs';

const DIV_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'divination');

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

// 占卜类工具：node 子进程跑 divination/ 下对应脚本
const DIV_TOOLS = [
  { name: 'div_liuyao', script: 'liuyao.js', description: '六爻占卜：单事吉凶决断。args 可传 [爻码(6位数字,0=阳不动,1=阴不动,2=阳动,3=阴动), 问题]，不传则模拟摇卦。', example: ['010203', '婚姻'] },
  { name: 'div_meihua', script: 'meihua.js', description: '梅花易数起卦。args 三选一：[] 时间起卦 / [数1,数2,数3] 报数起卦 / [方位1,方位2] 方位起卦。', example: ['3', '5', '8'] },
  { name: 'div_qimen', script: 'qimen.js', description: '奇门遁甲排局。args 可传 [YYYY-MM-DD, 时辰(24h制,可选)]，不传用当前时间。', example: ['2026-08-29', '16'] },
  { name: 'div_ziwei', script: 'ziwei.js', description: '紫微斗数命盘（知识库增强版，12宫/四化/格局）。args: [YYYY-MM-DD, 性别(男/女), 时间HH:mm(可选)]。', example: ['1993-03-10', '男', '23:45'] },
  { name: 'div_marriage', script: 'marriage.js', description: '合婚分析（日主生克/纳音/干支合冲）。args: [名1, "四柱(空格分隔)", 名2, "四柱"]。', example: ['张三', '癸酉 乙卯 庚寅 戊子', '李四', '壬申 丙午 甲子 辛未'] },
  { name: 'div_zhuanshi', script: 'zhuanshi.js', description: '择吉选日（建除十二神+彭祖百忌+多因子评分）。args: ["best"(可选), YYYY-MM, 活动类型(开业/搬家/签约/订婚/装修/出行/结婚/祭祀/求财/上任), 可选八字]。', example: ['best', '2026-09', '开业'] },
  { name: 'div_daily', script: 'daily-fortune.js', description: '每日运程：综合指数、穿衣颜色、宜忌、吉时。args 可传 [八字]，不传为通用日运。', example: [] }
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
      send({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'bazi-engine', version: '0.3.0' } } });
      break;
    case 'tools/list':
      send({
        jsonrpc: '2.0', id, result: {
          tools: [TOOL, CITE_TOOL, ...DIV_TOOLS.map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: { type: 'object', properties: { args: { type: 'array', items: { type: 'string' }, description: '位置参数，按工具说明顺序传入' } } }
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
