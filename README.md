# bazi-engine-kit — 命理引擎迁移包（Windows → Mac Codex）

规则引擎做"算"，LLM 做"读"。包含：排盘引擎、规则分析层、MCP Server、Codex 项目指令、回归测试。

## 目录结构

```
bazi-engine-kit/
├── AGENTS.md              ← Codex 项目指令（工作流/质检/红线），Codex 打开本目录自动读取
├── CONTEXT.md             ← 项目上下文快照（青囊/benchmark/偏好/锚点用例）
├── package.json
├── engine/
│   ├── paipan.mjs         ← 排盘入口：公历/农历 + 真太阳时(含夏令时) + 早晚子时 sect 开关
│   └── analyze.mjs        ← 十神/五行/强弱/格局/调候（节选）规则层
├── mcp/server.mjs         ← MCP stdio Server（工具 bazi_paipan），Codex 可直接调用
├── prompts/system-prompt.md  ← LLM 解读层模板（接云雾/任意 OpenAI 兼容 API）
└── tests/regression.mjs   ← 回归锚点：李鹤本命盘 3 组用例 + 夏令时/真太阳时校验
```

## 一、传到 Mac

```bash
# 方式A（推荐）：走 git
git init && git add -A && git commit -m "bazi-engine-kit"
git remote add origin <你的私有仓库> && git push -u origin main
# Mac 上 git clone

# 方式B：直接打包
# Windows: 压缩 bazi-engine-kit 文件夹 → AirDrop/网盘 → Mac 解压
```

## 二、Mac 环境准备

```bash
brew install node@22          # 或 nvm install 22
cd bazi-engine-kit && npm i
npm test                      # 必须全绿（PASS 11 / FAIL 0）
```

## 三、安装 Codex CLI（Mac）

```bash
npm install -g @openai/codex  # 或 brew install codex
codex login                   # ChatGPT 账号登录；或走下面自配模型
```

用云雾 deepseek-v4-pro（OpenAI 兼容）替代官方模型 —— `~/.codex/config.toml`：

```toml
model = "deepseek-v4-pro"
model_provider = "yunwu"

[model_providers.yunwu]
name = "yunwu"
base_url = "https://yunwu.ai/v1"
env_key = "YUNWU_API_KEY"     # export YUNWU_API_KEY=sk-xxx 写入 ~/.zshrc
```

## 四、接入本引擎（二选一或都用）

**方式A · MCP（推荐）**——Codex 可对话式调用排盘工具：

```toml
# ~/.codex/config.toml 追加
[mcp_servers.bazi]
command = "node"
args = ["/Users/你/bazi-engine-kit/mcp/server.mjs"]
```

**方式B · 直接跑脚本**——AGENTS.md 已教会 Codex 自己调：

```bash
node engine/paipan.mjs --cal lunar --date 1993-02-18 --time 23:45 --gender 1 --sect 2 --city 钟祥
```

**AGENTS.md 放置**：仓库根目录已带（项目级）；若想全局生效（任何目录都懂命理规范），复制到 `~/.codex/AGENTS.md`。

## 五、网页端接入（后续）

- 后端 import：`import { paipan } from './engine/paipan.mjs'` → 返回 JSON 给前端画盘
- LLM 解读：命盘 JSON + `prompts/system-prompt.md` → 发给你的 deepseek 接口
- MCP Server 也可挂到任意 MCP 客户端（Claude Desktop / WorkBuddy 等）

## 六、验证清单（迁移完成后依次确认）

- [ ] `npm test` 全绿
- [ ] `node engine/paipan.mjs --cal lunar --date 1993-02-18 --time 23:45 --city 钟祥` → 四柱「癸酉 乙卯 庚寅 戊子」
- [ ] Codex 里问"1993年农历二月十八晚上23:45生于钟祥的男命"→ 它会先调 bazi_paipan / 跑脚本再解读，而不是直接编干支
- [ ] `~/.codex/config.toml` 的 MCP 配置生效（codex 启动无报错）

## 已知边界

- 均时差用解析近似（±30 秒）：真太阳时落在子时边界 ±3 分钟的临界盘，解读前必须提示用户复核出生时间
- 调候表（analyze.mjs TIAOHOU）仅收录金日主节选，扩展时对照《穷通宝鉴》原文
- 六爻/梅花/奇门尚未入包（源脚本在 fortune-master 插件里），需要时再移植
