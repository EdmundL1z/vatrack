# 无畏契约战绩追踪系统 技术文档

---

## 1. 项目概述

部署在香港 Linux 服务器的个人 Web 仪表盘，自动拉取 WeGame 无畏契约对局数据，提供战绩回顾、趋势追踪和差异化数据分析。支持小范围多用户（朋友圈级别）。

---

## 2. 系统架构

```
本地 Windows 机器                    HK Linux 服务器
┌─────────────────────┐              ┌─────────────────────────┐
│ Chrome (调试模式)    │              │                         │
│ WeGame 已登录        │   Cookie     │   Python FastAPI        │
│         ↓           │ ──────────→  │         ↓               │
│ Node.js CDP脚本      │   同步       │   SQLite (SQLAlchemy)   │
│ 提取 HttpOnly Cookie │              │         ↓               │
└─────────────────────┘              │   定时任务 (每小时)      │
                                     │   拉取 WeGame API        │
                                     │         ↓               │
                                     │   Web 仪表盘前端         │
                                     └─────────────────────────┘
```

---

## 3. 数据来源

### 3.1 WeGame 战绩页面

**入口 URL：** `https://www.wegame.com.cn/helper/valorant/score`

**认证机制：** HttpOnly Cookie（浏览器自动携带，JS 不可读取）

**接入方式：** Chrome DevTools Protocol (CDP) — 在 WeGame 页面 JS 上下文中执行 `fetch`，借用已有登录态

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
| Cookie 抓取 | Node.js + chrome-remote-interface | 已验证可用，CDP 协议可读取 HttpOnly Cookie |
| 前端 | 待定（React / Vue 均可）| AI 生成为主 |

---

## 5. Cookie 同步方案

**问题：** WeGame 使用 HttpOnly Cookie 认证，服务器无法直接登录，需从本地 Chrome 提取。

**方案：**

1. 本地 Node.js 脚本通过 CDP `Network.getCookies()` 提取 WeGame 域名下的全部 Cookie
2. 通过 HTTPS 推送到服务器存储
3. 服务器发起 API 请求时携带这些 Cookie

**同步触发机制（双保险）：**

- Windows 计划任务每周自动运行一次同步脚本（覆盖日常情况）
- Cookie 失效时服务器 API 请求返回未授权，仪表盘顶部显示红色警告提示用户手动执行同步

**本地 Chrome 启动方式：**

```powershell
chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\Users\...\Chrome\User Data"
```

---

## 6. 数据拉取策略

**频率：** 每小时一次（保守策略，避免触发限流/封禁）

**首次运行（全量初始化）：**
- 以尽可能大的 `size` 参数调用 `GetBattleList` 拉取全部历史
- 对每场调用 `GetBattleDetail` 获取完整数据
- `size` 上限待开发时测试确认

**后续增量更新：**
- 每小时拉取最近 20 场
- 以 `matchId` 为唯一键去重，仅插入新对局
- 新对局自动触发 `GetBattleDetail` 拉取详情

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
| `GetBattleList` size 上限 | 开发时测试最大可拉取场次数 |
| Cookie 有效期 | 实际使用中观察，决定计划任务频率是否需要调整 |

---

## 10. 已明确放弃的方向

- **华为运动健康数据接入**：官方导出不含睡眠/压力数据，Health Kit API 要求个人开发者上架应用市场，门槛过高
- **状态记录（心情/睡眠/精力）**：依赖健康数据，一并放弃
