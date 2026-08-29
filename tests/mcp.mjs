// mcp.mjs — MCP 协议测试：initialize / tools/list（断言恰好 8 个工具）/ tools/call（每个工具各调一次）
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = path.join(ROOT, 'mcp', 'server.mjs');

let pass = 0, fail = 0;
function report(name, ok, detail = '') {
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (ok ? '' : ' | ' + detail));
  ok ? pass++ : fail++;
}

const proc = spawn(process.execPath, [SERVER], { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] });
const byId = new Map();
let buf = '';
proc.stdout.on('data', d => {
  buf += d.toString();
  const lines = buf.split('\n');
  buf = lines.pop();
  for (const l of lines.filter(Boolean)) {
    try { const o = JSON.parse(l); if (o.id !== undefined) byId.set(o.id, o); } catch { /* ignore */ }
  }
});

function send(obj) { proc.stdin.write(JSON.stringify(obj) + '\n'); }
function waitFor(id, ms = 30000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = setInterval(() => {
      if (byId.has(id)) { clearInterval(tick); resolve(byId.get(id)); }
      else if (Date.now() - t0 > ms) { clearInterval(tick); reject(new Error('timeout waiting id=' + id)); }
    }, 50);
  });
}

// 1. initialize
send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
const init = await waitFor(1);
report('initialize 返回 protocolVersion/serverInfo',
  !!init?.result?.protocolVersion && init.result.serverInfo?.name === 'bazi-engine',
  JSON.stringify(init?.result || init).slice(0, 120));

// 2. tools/list — 断言恰好 8 个工具
send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
const list = await waitFor(2);
const tools = list?.result?.tools || [];
report('tools/list 恰好 9 个工具', tools.length === 9, '实际 ' + tools.length);
const expected = ['bazi_paipan', 'cite_lookup', 'div_liuyao', 'div_meihua', 'div_qimen', 'div_ziwei', 'div_marriage', 'div_zhuanshi', 'div_daily'];
const names = tools.map(t => t.name).sort();
report('工具名与预期一致', JSON.stringify(names) === JSON.stringify([...expected].sort()), names.join(','));
report('每个工具都有 description 与 inputSchema', tools.every(t => t.description && t.inputSchema), '');

// 3. tools/call — bazi_paipan 返回 JSON
// 使用公开锚点（2000 年春节），不写个人出生信息
send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'bazi_paipan', arguments: { cal: 'solar', date: '2000-02-05', time: '14:00', gender: 1, sect: 2, lon: 120 } } });
const c1 = await waitFor(3);
let parsed = null;
try { parsed = JSON.parse(c1?.result?.content?.[0]?.text); } catch { /* noop */ }
report('tools/call bazi_paipan 返回合法 JSON', !!parsed, JSON.stringify(c1).slice(0, 120));
report('bazi_paipan 四柱 = 庚辰 戊寅 癸巳 己未', parsed?.fourPillars === '庚辰 戊寅 癸巳 己未', parsed?.fourPillars);
report('bazi_paipan 含 analysis（强弱/格局）', !!parsed?.analysis?.strength?.level && !!parsed?.analysis?.geju, '');

// 4. tools/call — 七个占卜工具各调一次
const divCases = [
  { id: 10, name: 'div_liuyao', args: ['010203', '婚姻'], expect: '六爻' },
  { id: 11, name: 'div_meihua', args: ['3', '5', '8'], expect: '梅花' },
  { id: 12, name: 'div_qimen', args: ['2026-08-29', '16'], expect: '奇门' },
  { id: 13, name: 'div_ziwei', args: ['2000-02-05', '男', '14:00'], expect: '紫微' },
  { id: 14, name: 'div_marriage', args: ['甲', '庚辰 戊寅 癸巳 己未', '乙', '庚辰 甲申 丙子 乙未'], expect: '合婚' },
  { id: 15, name: 'div_zhuanshi', args: ['best', '2026-09', '开业'], expect: '' },
  { id: 16, name: 'div_daily', args: [], expect: '' }
];
for (const c of divCases) {
  send({ jsonrpc: '2.0', id: c.id, method: 'tools/call', params: { name: c.name, arguments: { args: c.args } } });
  const r = await waitFor(c.id, 40000);
  const text = r?.result?.content?.[0]?.text || '';
  const ok = !r?.error && text.length > 30 && (!c.expect || text.includes(c.expect));
  report(`tools/call ${c.name}`, ok, (text || JSON.stringify(r)).slice(0, 100));
}

// 4.5 tools/call — cite_lookup 古籍引文
send({ jsonrpc: '2.0', id: 30, method: 'tools/call', params: { name: 'cite_lookup', arguments: { query: '庚金 卯月 正财 身弱', top: 2 } } });
const cite = await waitFor(30);
const citeText = cite?.result?.content?.[0]?.text || '';
report('tools/call cite_lookup 返回引文', citeText.includes('《') && citeText.length > 50, citeText.slice(0, 100));
report('cite_lookup 含格式化块', citeText.includes('格式化:'), '');

// 5. 未知工具应报错
send({ jsonrpc: '2.0', id: 20, method: 'tools/call', params: { name: 'no_such_tool', arguments: {} } });
const bad = await waitFor(20);
report('未知工具返回 error', !!bad?.error, JSON.stringify(bad).slice(0, 100));

proc.kill();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
