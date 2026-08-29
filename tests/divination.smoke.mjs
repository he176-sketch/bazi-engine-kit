// divination.smoke.mjs — 七大占卜引擎 smoke 测试：每个引擎必须能跑通并输出预期标志
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIV = path.join(ROOT, 'divination');

let pass = 0, fail = 0;

function run(script, args = []) {
  return new Promise(resolve => {
    execFile(process.execPath, [path.join(DIV, script), ...args], { cwd: DIV, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ code: err ? 1 : 0, out: stdout || stderr || '' });
    });
  });
}

function report(name, ok, detail = '') {
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (ok ? '' : ' | ' + detail));
  ok ? pass++ : fail++;
}

// 1. 六爻（指定爻码 + 问题）与（模拟摇卦）
const ly1 = await run('liuyao.js', ['010203', '婚姻']);
report('六爻·指定爻码', ly1.code === 0 && ly1.out.includes('六爻') && ly1.out.includes('婚姻'), ly1.out.slice(0, 80));
const ly2 = await run('liuyao.js', []);
report('六爻·模拟摇卦', ly2.code === 0 && ly2.out.includes('六爻'), ly2.out.slice(0, 80));

// 2. 梅花：报数 / 时间 / 方位三种起卦
const mh1 = await run('meihua.js', ['3', '5', '8']);
report('梅花·报数起卦', mh1.code === 0 && mh1.out.includes('梅花'), mh1.out.slice(0, 80));
const mh2 = await run('meihua.js', []);
report('梅花·时间起卦', mh2.code === 0 && mh2.out.includes('梅花'), mh2.out.slice(0, 80));
const mh3 = await run('meihua.js', ['东', '南']);
report('梅花·方位起卦', mh3.code === 0 && mh3.out.includes('梅花'), mh3.out.slice(0, 80));

// 3. 奇门：指定日期时辰 + 默认
const qm1 = await run('qimen.js', ['2026-08-29', '16']);
report('奇门·指定日期时辰', qm1.code === 0 && qm1.out.includes('奇门'), qm1.out.slice(0, 80));
const qm2 = await run('qimen.js', []);
report('奇门·当前时间起局', qm2.code === 0 && qm2.out.includes('奇门'), qm2.out.slice(0, 80));

// 4. 紫微：带时间 + 缺省时间；并校验 knowledge 已加载（命中格局数 > 0）
const zw1 = await run('ziwei.js', ['1993-03-10', '男', '23:45']);
report('紫微·带时辰', zw1.code === 0 && zw1.out.includes('紫微斗数命盘'), zw1.out.slice(0, 80));
const zw2 = await run('ziwei.js', ['1993-03-10', '男']);
report('紫微·缺省时辰', zw2.code === 0 && zw2.out.includes('紫微斗数命盘'), zw2.out.slice(0, 80));
const knowledgeFiles = fs.readdirSync(path.join(ROOT, 'knowledge')).filter(f => f.endsWith('.md') && f !== 'README.md');
report('知识库文件 ≥5', knowledgeFiles.length >= 5, '实际 ' + knowledgeFiles.length);
const zwMatch = zw1.out.match(/命盘格局（共(\d+)个）/);
report('紫微·知识库格局已加载(>0)', !!zwMatch && +zwMatch[1] > 0, zw1.out.match(/命盘格局[^\n]*/)?.[0] || '未找到格局行');

// 5. 合婚：直传八字 + userId（有 sample 档案）
const mg1 = await run('marriage.js', ['张三', '癸酉 乙卯 庚寅 戊子', '李四', '壬申 丙午 甲子 辛未']);
report('合婚·直传四柱', mg1.code === 0 && mg1.out.includes('合婚'), mg1.out.slice(0, 80));

// 6. 择吉：普通模式 + best 模式
const zs1 = await run('zhuanshi.js', ['2026-09', '开业']);
report('择吉·按月分析', zs1.code === 0 && zs1.out.length > 50, zs1.out.slice(0, 80));
const zs2 = await run('zhuanshi.js', ['best', '2026-09', '搬家']);
report('择吉·best 推荐', zs2.code === 0 && zs2.out.length > 50, zs2.out.slice(0, 80));

// 7. 每日运程
const df1 = await run('daily-fortune.js', []);
report('每日运程', df1.code === 0 && df1.out.includes('综合指数'), df1.out.slice(0, 80));

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
