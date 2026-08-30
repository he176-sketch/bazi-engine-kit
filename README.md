# bazi-engine-kit — 命理引擎迁移包（Windows → Mac Codex）

规则引擎做"算"，LLM 做"读"。包含：八字排盘引擎 + 九大术数工具（六爻/梅花/奇门/紫微/合婚/择吉/日运/大六壬/七政四余）、MCP Server、Codex 项目指令、回归测试。

## 目录结构

```
bazi-engine-kit/
├── AGENTS.md              ← Codex 项目指令（工作流/质检/红线），Codex 打开本目录自动读取
├── CONTEXT.md             ← 项目上下文快照（青囊/benchmark/偏好/锚点用例）
├── package.json
├── engine/
│   ├── paipan.mjs         ← 排盘入口：公历/农历 + 真太阳时(含夏令时) + 早晚子时 sect 开关
│   └── analyze.mjs        ← 十神/五行/强弱/格局/调候（节选）规则层
├── divination/            ← 七大占卜引擎（CommonJS，目录内 package.json 已声明）
│   ├── liuyao.js          ← 六爻：node liuyao.js [爻码6位] [问题]
│   ├── meihua.js          ← 梅花易数：报数/时间/方位起卦
│   ├── qimen.js           ← 奇门遁甲：node qimen.js [YYYY-MM-DD] [时辰]
│   ├── ziwei.js           ← 紫微斗数（知识库增强）：node ziwei.js YYYY-MM-DD 男|女 [HH:mm]
│   ├── marriage.js        ← 合婚：node marriage.js 名1 "四柱" 名2 "四柱"
│   ├── zhuanshi.js        ← 择吉：node zhuanshi.js [best] YYYY-MM 活动类型 [八字]
│   ├── daily-fortune.js   ← 每日运程
│   ├── daliuren.cjs       ← 大六壬：四课、三传、天地盘、天将
│   ├── qizheng.cjs        ← 七政四余本命/流年专业计算与兼容型 JSON 输出
│   ├── qizheng-stars.cjs  ← Hipparcos 二十八宿距星坐标与自行数据
│   ├── qizheng-traditions.cjs ← 今古宿、岁差、郑案与果老量天尺
│   ├── qizheng-calendar.cjs   ← 真太阳时四柱、节气与大运
│   ├── qizheng-shensha.cjs    ← 庙旺垣殿、十干化曜与神煞规则
│   ├── qizheng-limits.cjs     ← 童限、洞微、小限、月限与 120 年时间轴
│   └── qizheng-relations.cjs  ← 守照、同络、同经、余奴、恩难仇用与顶星
├── rag/                   ← 古籍引文检索（citations.json 5070 条 + retrieve.mjs + build-index.mjs）
├── mcp/server.mjs         ← MCP stdio Server（12 个工具，含七政本命/流年专业入口）
├── prompts/system-prompt.md  ← LLM 解读层模板（接云雾/任意 OpenAI 兼容 API）
└── tests/regression.mjs   ← 回归锚点：李鹤本命盘 3 组用例 + 夏令时/真太阳时校验
```

## 一、传到 Mac

```bash
# 方式A（推荐，SSH 已配通）：Mac 上先本机生成钥匙并加到 GitHub
ssh-keygen -t ed25519 -N "" -C "he176-sketch-mac"
cat ~/.ssh/id_ed25519.pub   # 粘贴到 github.com/settings/keys → New SSH key
# 中国网络建议 ~/.ssh/config 加：Host github.com / HostName ssh.github.com / Port 443 / User git
git clone git@github.com:he176-sketch/bazi-engine-kit.git && cd bazi-engine-kit

# 方式B：仓库是 public，直接 https clone 或下 zip 也行
git clone https://github.com/he176-sketch/bazi-engine-kit.git
```

## 二、Mac 环境准备

```bash
brew install node@22          # 或 nvm install 22
cd bazi-engine-kit && npm i
npm test                      # 必须全绿
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
node engine/paipan.mjs --cal solar --date 2000-02-05 --time 14:00 --gender 1 --sect 2 --city 北京
```

七政四余可直接输出专业结构化 JSON：

```bash
node divination/qizheng.cjs 2026-08-29 18:00 112.59 31.17 --json
```

MCP 的 `div_qizheng` 接受 `birth_date`、`birth_time`、`birth_lon`、`birth_lat`、`timezone`、`gender`、`time_type`、`xiu_method`、`coord_system`、`node_arrangement`、`node_calculation`、`apogee_calculation`、`ziqi_calculation`、`ming_gong_method`、`shen_gong_method`、`day_night_method`、`dingxing_tolerance`、`tongluo_tolerance`、`distinguish_zi_hour`、`child_limit` 等专业字段。输出包括 11 星、12 宫、命身宫、庙旺状态、守照/同络/同经/余奴/顶星/恩难仇用、四柱节气、化曜神煞、童限、洞微大限、小限、月限和 120 年流年时间轴。旧版 `args` 位置参数仍可使用。

`date_type` 支持公历 `solar` 和农历 `lunar`。农历仍以 `YYYY-MM-DD` 传入农历年月日，引擎先转换为公历时刻，再计算真太阳时和星体位置。

专业流年使用单独的 `div_qizheng_liunian`。`liunian_year` 必填；`liuyue`、`liuri`、`liushi` 可选，未传时采用本命月、日、时。它返回 11 个流曜、流年四柱、流年化曜神煞、小限、12 月限、当时洞微限和对应时间轴节点。

支持的九种宿制：

- 黄道：`huangdaohuigui`、`huigui_gusu`、`gusu_suicha`、`zhengan`
- 赤道：`chidao_jinxiu`、`chidao_gusu_suicha`、`chidao_zhengan`、`chidao_huigui_gusu`、`guolao`

`node_calculation` 与 `apogee_calculation` 均支持 `mean` / `fitted`。其中 fitted 罗计由月球瞬时轨道面求真交点；fitted 月孛以相邻真实远地点事件插值，避免引入需要购买许可的 Swiss Ephemeris。

`ziqi_calculation` 支持 `equatorial_uniform`（赤道匀行）和 `ecliptic_projection`（沿黄道运行后投影赤道）。`time_type` 支持墙上时 `wallclock` 和已换算真太阳时 `solar_time`；日月出没结果按真太阳时显示。`jieqi_method` 支持定气 `true` 与以真冬至起算、均分 365.2422 日回归年的平气 `mean`。`day_night_method` 支持日出没时刻、日出没时辰、卯昼酉夜三种口径；`distinguish_zi_hour` 控制是否区分早晚子时。

`ming_gong_method` 支持 `sun_to_mao`、`sun_to_sunrise`、`horizon_rising`、`rising_with_sun`；`shen_gong_method` 支持 `moon_is_shen`、`moon_to_you`、`moon_to_moonrise`、`moon_to_sunset`。地平东升点使用当地视恒星时和真黄赤交角求黄道交点，赤道盘再投影到当日真赤道。

需要联网复查兼容性时可运行 `npm run validate:qizheng:external`。它会少量调用天官公开接口，对照 11 星经度、宿宫、命身度、fitted 四余、核心规则表、小限和洞微位置；不会把外部结果写入仓库。

**AGENTS.md 放置**：仓库根目录已带（项目级）；若想全局生效（任何目录都懂命理规范），复制到 `~/.codex/AGENTS.md`。

## 五、网页端接入（后续）

- 后端 import：`import { paipan } from './engine/paipan.mjs'` → 返回 JSON 给前端画盘
- LLM 解读：命盘 JSON + `prompts/system-prompt.md` → 发给你的 deepseek 接口
- MCP Server 也可挂到任意 MCP 客户端（Claude Desktop / WorkBuddy 等）

## 六、验证清单（迁移完成后依次确认）

- [ ] `npm test` 全绿
- [ ] `node engine/paipan.mjs --cal solar --date 2000-02-05 --time 14:00 --city 北京` → 四柱「庚辰 戊寅 癸巳 己未」
- [ ] Codex 里问"2000年2月5日下午2点生于北京的男命"→ 它会先调 bazi_paipan / 跑脚本再解读，而不是直接编干支
- [ ] `~/.codex/config.toml` 的 MCP 配置生效（codex 启动无报错）

## 已知边界

- 真太阳时由太阳赤经与格林尼治视恒星时计算；即便如此，落在子时边界 ±3 分钟的临界盘仍应提示用户复核出生时间与历史时制
- 七政四余不购买也不依赖 Swiss Ephemeris；天文层使用 MIT 许可的 Astronomy Engine，二十八宿距星使用公开 Hipparcos 坐标/自行数据
- 七政支持九种今宿/古宿/郑案/果老盘制；传统量天尺是规则口径，不能与现代回归黄道混作同一种绝对坐标解释
- fitted 罗计与天官/Swiss 真交点样本通常在百分之一度内；fitted 月孛为自然远地点插值，摄动较强日期与 Swiss fitted 口径可能相差约 1°，输出会保留方法说明
- 庙旺、十干化曜、年干/月支/年支神煞、童限与洞微限已接入。不同古籍和师承存在异表，本仓库以 `qizheng-shensha.cjs`、`qizheng-limits.cjs` 中的可审计规则为准
- 命宫四种起法与身宫四种起法已接入；依赖日出、日没或月出的起法在极昼极夜无对应事件时会返回明确错误
- 紫炁已实现 `equatorial_uniform` 与 `ecliptic_projection`，两者是不同的传统口径，不应混作同一坐标直接比较
- 节气支持太阳真实黄经定气 `true` 与冬至起算均分回归年的平气 `mean`；为与专业接口兼容，平气只改变 `jieqi` 显示，四柱和起运仍按定气口径
- 农历 `lunar` 输入按文档的数字 `YYYY-MM-DD` 口径支持普通农历月；公开文档没有定义闰月编码，不自行猜测额外格式
- 守照、同络、同经、余奴、恩难仇用与顶星已根据多样本外部差分和公开传统定义实现；关系层固定在黄道回归今宿底盘计算，不随盘面显示制式改变
- 调候表（analyze.mjs TIAOHOU）仅收录金日主节选，扩展时对照《穷通宝鉴》原文
- knowledge/ 为 6 篇格局种子数据（标注待校订），补齐格局库请按 knowledge/README.md 的 contract 扩展
- 青囊 `packages/knowledge`（你自己的 TS 规则库，含 bazi/ziwei/liuyao/qimen rules）属独立项目，未并入本包
