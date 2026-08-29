# WorkBuddy → Codex 全量迁移审计

审计时间：2026-08-29 · 版本：v0.2.0

## 一、依赖审计结果（逐项扫描 divination/ engine/ mcp/）

| 类别 | 依赖 | 审计前状态 | 处理 |
|---|---|---|---|
| 环境变量 | `OPENCLAW_KNOWLEDGE_DIR` | ⚠️ ziwei.js 唯一知识库来源，未设置 | ✅ 改为项目内优先（见下） |
| 环境变量 | `HOME` | ⚠️ 拼 `~/.openclaw/workspace/knowledge`，**该目录本机不存在** | ✅ 降级为兜底路径 |
| 知识库 | 紫微格局 md 库 | ❌ **完全缺失** — 格局匹配实际加载 0 条规则 | ✅ 新建 `knowledge/`（6 篇种子 + contract） |
| 数据目录 | `data/profiles/{userId}.json` | ❌ 缺失（合婚 userId 模式不可用） | ✅ 建目录 + sample.json + README |
| 第三方库 | `cantian-tymext` | ✅ 已声明 | — |
| 第三方库 | `iztro` | ⚠️ ziwei.js 需要但未声明 | ✅ 加入 package.json |
| 模块系统 | CommonJS vs ESM | ⚠️ ziwei/marriage 因根 `type:module` 报错 | ✅ divination/package.json 声明 commonjs |
| Prompts | 解读层 system prompt | ✅ prompts/system-prompt.md | — |
| 上下文 | CONTEXT.md | ✅ 已在库 | ✅ AGENTS.md 加 bootstrap 强制读取 |
| 会话记忆 | WorkBuddy `.workbuddy/memory/*.md` | ⚠️ 会话级日志属 WorkBuddy 本地，不可移植 | ℹ️ 精华已提炼入 CONTEXT.md（本仓库即可移植记忆） |
| 外部 LLM | `YUNWU_API_KEY`(云雾 deepseek-v4-pro) | ℹ️ 外部服务，非代码依赖 | ✅ README config.toml 已说明 |
| 独立项目 | 青囊 `packages/knowledge`（TS 规则库：bazi/ziwei/liuyao/qimen/daliuren/qizheng） | ⚠️ 你自己的另一个项目，未并入 | ℹ️ 建议后续从此生成 knowledge/*.md |

## 二、知识库迁移（本次核心修复）

**问题**：`ziwei.js` 号称"知识库增强版"，但 `OPENCLAW_KNOWLEDGE_DIR` 未设、`~/.openclaw/workspace/knowledge` 不存在 → `buildPatternRules()` 直接 `return []`，格局匹配**从未真正生效**。

**修复**：

1. 新建 repository-local `knowledge/`：
   - `README.md` 写明解析 contract（主星 / 吉星加会 / 等级 的关键词命中规则）
   - 6 篇格局种子：紫府同宫、日照雷门、阳梁昌禄、极向离明、机月同梁、杀破狼
   - 全部标注"种子数据，待校订"
2. `ziwei.js` 加载优先级改为：
   ```
   1. <repo>/knowledge/          ← 项目内，优先
   2. process.env.KNOWLEDGE_DIR
   3. process.env.OPENCLAW_KNOWLEDGE_DIR
   4. ~/.openclaw/workspace/knowledge   ← 仅兜底
   ```
3. 验证：格局命中数由 0 → >0（测试 `紫微·知识库格局已加载` 守护该行为）

## 三、测试体系（53 项，全绿）

| 套件 | 文件 | 项数 | 覆盖 |
|---|---|---|---|
| 引擎回归 | `tests/regression.mjs` | 23 | 农历↔公历桥接(6) / sect边界(2) / 真太阳时方向(3) / 夏令时(2) / 分析层(6) / 起运年龄(3) / 私密锚点(可选) |
| 占卜 smoke | `tests/divination.smoke.mjs` | 15 | 六爻(2) 梅花(3) 奇门(2) 紫微(3，含知识库断言) 合婚 择吉(2) 日运 |
| MCP 协议 | `tests/mcp.mjs` | 15 | initialize / tools/list(**断言恰好 8 工具**) / tools/call 八字+七占卜 / 未知工具报错 |

## 四、隐私处理（v0.2.1）

审计发现原测试与文档写有个人出生信息（出生日期/时间/地点），而仓库为 public。已全部清理：

- `tests/regression.mjs` 锚点改为公开数据（春节日期）：农历↔公历桥接 / sect 边界 / 真太阳时方向 / 夏令时 / 起运年龄区间
- `tests/mcp.mjs`、`README.md` 示例改为 2000-02-05 中性盘
- `CONTEXT.md` 移除本命盘，改为说明"私密锚点走 tests/fixtures.local.json（已 gitignore）"
- 新增 `tests/fixtures.local.example.json`：本地私密锚点模板，复制为 `tests/fixtures.local.json` 后测试套件自动加载（不进 git）
- 个人命盘与咨询历史保留在 WorkBuddy 本地记忆（`.workbuddy/memory/`），不随公开仓库分发

回归价值未降低：新锚点覆盖的 bug 类与旧锚点一致（sect 分歧、农历/公历混淆、真太阳时方向、夏令时漏扣），且项数由 10 增至 23。

## 五、未迁移 / 后续项

- knowledge 仅 6 篇种子，完整格局库（30–50 篇）待补
- 青囊 TS 规则库未并入（可写生成脚本 → knowledge/*.md）
- 调候表仅金日主节选
- 推送类能力（每日定时）需要外部调度，未入包
