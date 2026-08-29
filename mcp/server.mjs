// server.mjs — 极简 MCP stdio Server：暴露 bazi_paipan 工具给 Codex / Claude / 任意 MCP 客户端
// Codex 接入：~/.codex/config.toml 里加 [mcp_servers.bazi] command="node" args=["<绝对路径>/mcp/server.mjs"]
import { createInterface } from 'node:readline';
import { paipan } from '../engine/paipan.mjs';
import { analyze } from '../engine/analyze.mjs';

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

const rl = createInterface({ input: process.stdin });
rl.on('line', line => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  const { id, method } = msg;
  switch (method) {
    case 'initialize':
      send({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'bazi-engine', version: '0.1.0' } } });
      break;
    case 'tools/list':
      send({ jsonrpc: '2.0', id, result: { tools: [TOOL] } });
      break;
    case 'tools/call': {
      const a = msg.params?.arguments || {};
      try {
        const r = paipan(a);
        const an = analyze(r.chart);
        send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({ ...r, analysis: an }, null, 2) }] } });
      } catch (e) {
        send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: '排盘失败: ' + e.message }], isError: true } });
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
