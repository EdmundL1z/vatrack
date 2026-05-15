# 无畏契约战绩追踪系统 技术文档

---

## 1. 项目概述

部署在香港 Linux 服务器的个人 Web 仪表盘，自动拉取 WeGame 无畏契约对局数据，提供战绩回顾、趋势追踪和差异化数据分析。支持小范围多用户（朋友圈级别）。

---

## 2. 系统架构

```
本地 Windows 机器                         HK Linux 服务器
┌──────────────────────────────┐          ┌──────────────────────────┐
│ Chrome                       │          │                          │
│ WeGame 已登录                 │          │   Python FastAPI         │
│         ↓                    │          │         ↓                │
│ VaTrack Collector 扩展        │  对局数据 │   SQLite (SQLAlchemy)   │
│ 直接调用 WeGame API           │ ───────→ │                          │
│ (用浏览器 Cookie 认证)        │  /api/sync│   Web 仪表盘前端         │
└──────────────────────────────┘          └──────────────────────────┘
```

**备选方案（代码保留，未激活）：** Node.js CDP 脚本提取 HttpOnly Cookie → 推送到服务器 → 服务器定时拉取 WeGame API。

---

## 3. 数据来源

### 3.1 WeGame 战绩页面

**入口 URL：** `https://www.wegame.com.cn/helper/valorant/score`

**认证机制：** HttpOnly Cookie（浏览器自动携带，JS 不可读取）

**接入方式：** Chrome 扩展 content script 注入到 WeGame 页面，直接以 `credentials: "include"` 发起 `fetch`，借用已有登录态。无需提取 Cookie，无需 CDP。

### 3.2 可用接口

基础路径：`https://www.wegame.com.cn/api/v1/wegame.pallas.game.ValBattle/`

所有接口均为 **HTTP POST + JSON body**。

| 接口 | 请求参数 | 说明 |
|------|---------|------|
| `GetRoleInfo` | `{from_src: "valorant_web"}` | 玩家基本信息 |
| `GetBattleList` | `{from_src, size: N}` | 最近 N 场对局列表 |
| `GetBattleDetail` | `{apEventId: "..."}` | 单场完整数据（注意：用 `apEventId` 而非 `matchId`）|
| `GetBattleReport` | `{sid, queueID, from_src}` | 赛季总览统计 |
| `GetChampion` | `{from_src}` | 全英雄历史统计 |

### 3.3 GetBattleList 字段

每场对局包含：

```
时间、地图(mapId)、英雄(characterId)、游戏模式(queueId)
K / D / A、ACS(statsScore)、回合数、己方赢了几回合
胜负(wonMatch)、游戏时长
首杀次数、四杀/五杀/ACE 次数
是否 MVP / SVP
段位赛：赛前/赛后 tier、RR 变化(CompetitiveTierRankedRatingEarned)
apEventId（用于请求详情）
```

### 3.4 GetBattleDetail 字段

全场 10 名玩家各有：

```
基础：K/D/A、ACS、英雄、队伍、胜负
射击：totalDamage、totalHeadshots/Bodyshots/Legshots（可算爆头率）
综合：kast、economyScore、isMatchMvp、isTeamMvp
辅助：bombPlanterCount、bombDefuserCount
高光：tripleKill/quadraKill/pentaKill、clutchCount、firstKillCount
其他：thriftyCount、flawlessCount、game_plus
```

---

## 4. 技术栈

| 层级 | 技术选型 | 理由 |
|------|---------|------|
| 后端 | Python + FastAPI | AI 生成质量高，方便后续数据分析扩展 |
| 数据库 | SQLite + SQLAlchemy ORM | 单用户/小团队足够，迁移 PostgreSQL 只改一行连接字符串 |
| 数据同步 | Chrome 扩展（MV3）| 利用浏览器已有登录态，无需提取 Cookie，实现最简单 |
| 前端 | React + TypeScript + Vite | AI 生成为主 |

---

## 5. 数据同步方案

**核心思路：** 不提取 Cookie，直接用浏览器登录态。

**流程：**

1. 用户在 Chrome 中打开 `https://www.wegame.com.cn`（保持登录状态）
2. 点击 VaTrack Collector 扩展图标
3. 扩展调用 `GET /api/battles/ids` 获取服务器已有的全部 matchId
4. content script 在 WeGame 页面上下文中调用 `GetBattleList(size=100)`，再逐条调用 `GetBattleDetail`
5. 将新对局数据 POST 到 `POST /api/sync`，后端去重后写入 SQLite

**触发方式：** 手动点击扩展按钮（按需同步）。

**备选方案（代码已备，未激活）：** `cookie-extractor/scripts/sync_cookies.js` 通过 CDP 提取 Cookie 推送到服务器，配合后端定时任务自动拉取。若需要自动化同步可启用此路径。

---

## 6. 数据拉取策略

**当前方案（扩展手动同步）：**
- 每次同步拉取最近 100 场（`GetBattleList size=100`）
- 与服务器已有 matchId 对比，仅对新对局调用 `GetBattleDetail`
- 以 `matchId` 为唯一键去重写入

**全量历史导入：** 首次使用时手动点击同步即可，size=100 覆盖绝大多数情况。如需更多历史，可调大 content.js 中的 size 参数。

**自动化方向（未来可选）：** 启用 `scripts/sync_cookies.js` + 后端定时任务（`services/sync.py` 已有框架，逻辑待实现），可实现每小时无人值守拉取。

---

## 7. 前端页面结构

以**长期趋势追踪为主**，赛后复盘为辅。

### 首页（趋势看板）
- 核心指标折线图：KDA、爆头率、ACS（可切换 7天 / 30天 / 本赛季）
- RR 曲线（段位涨跌一目了然）
- 今日摘要：场次、净 RR 变化

### 对局列表页
- 最近对局列表：地图、英雄、K/D/A、ACS、胜负、RR 变化
- 可按模式筛选（排位 / 非排位 / 全部）
- 点击进入单场详情

### 单场详情页
- 全场 10 人数据表格
- 个人详细指标：爆头率、总伤害、KAST、经济分
- 与队友/对手横向对比

### 英雄统计页
- 全英雄历史数据：胜率、KDA、场次、平均 ACS
- 支持排序

---

## 8. 差异化分析功能

以下分析均为掌上无畏契约没有的功能，按优先级排序：

### P1 地图针对性分析
- 每张地图的胜率、平均 KDA、平均 ACS
- 识别强图和弱图

### P2 连败/连胜分析
- 连败 N 场后第 N+1 场的历史胜率
- "止损点"推荐（连输几场后胜率已跌破 XX%）
- 连胜状态下的发挥变化

### P3 疲劳检测
- 当天第 N 场的平均 ACS/KDA 趋势（是否随场次下滑）
- 凌晨场（0点后）vs 白天场数据对比

### P4 英雄认知校正
- 场次最多的英雄 vs 胜率/KDA 最高的英雄是否一致
- 各英雄随对局数增长的学习曲线

### P5 对局时长影响
- 长局（>25 回合）vs 短局的发挥差异
- 加时赛表现分析

---

## 9. 待验证项

| 项目 | 说明 |
|------|------|
| `GetBattleList` size 上限 | 当前设为 100，实测可用；更大值待验证 |

---

## 10. 已明确放弃的方向

- **华为运动健康数据接入**：官方导出不含睡眠/压力数据，Health Kit API 要求个人开发者上架应用市场，门槛过高
- **状态记录（心情/睡眠/精力）**：依赖健康数据，一并放弃
