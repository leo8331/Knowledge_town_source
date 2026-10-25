# 在线部署：网页访问 + 保留 API

本项目是「一个 Node 服务同时托管页面和接口」的形态：`server.cjs` 把 `dist/` 当静态目录发出去，同时提供 `/api/*`（课程生成、场景设计、图片生成、模型配置）和 `/kb/*`（知识库出题器转发）。所以只要把一个 Node 进程跑在公网上，网页和 API 就是同一个域名，前端不需要改地址。

- 页面：`https://你的域名/`
- 接口：`https://你的域名/api/...`、`/kb/...`
- 健康检查：`https://你的域名/healthz`

前端所有请求都是相对路径（`fetch('/api/config')` 这类），因此换域名、换平台都不用改代码。

## 上线前必须知道的 3 件事

1. **密钥只放平台的环境变量里**，不要写进仓库。仓库已忽略 `.env`、`dist/knowledge/.model-config.json`、`dist/knowledge/.search-config.json`（后两个是出题器页面自己保存的明文 Key）。
2. **默认只服务本机**。要让公网访问必须设 `TOWN_PUBLIC=1`，否则所有请求返回 `403 仅接受本机访问`。公网模式会自动监听 `0.0.0.0`，并接受平台分配的域名；如果固定了域名，用 `TOWN_PUBLIC_HOSTS=town.example.com` 收紧。
3. **免费实例的文件系统是临时的**。容器重启后，模型中心里手填的模型、生成的场景图、题库缓存会清空；游戏内置课程、玩家浏览器里的存档不受影响。要长期保留，见下文「数据持久化」。

## 方式一：Render（推荐，免费额度够演示）

仓库根目录已有 `render.yaml`，连上仓库就能按蓝图建服务。

1. 打开 <https://render.com> → 用 GitHub 登录 → **New** → **Blueprint**。
2. 选仓库 `Abigale365/Knowledge_town`（私有仓库也可以，Render 会请求授权）。
3. Render 读到 `render.yaml` 后点 **Apply**。首次部署约 1–3 分钟（无第三方依赖，不需要 `npm install` 之外的构建）。
4. 部署完成后拿到 `https://knowledge-town-xxxx.onrender.com`，直接打开就是游戏首页。
5. 回到服务页 **Environment**，填三项后 **Save**（会自动重启）：

   | 变量 | 例子 | 说明 |
   | --- | --- | --- |
   | `API_BASE_URL` | `https://api.deepseek.com/v1` | 兼容 Chat Completions 的地址，需要 HTTPS |
   | `API_MODEL` | `deepseek-chat` | 模型名 |
   | `API_KEY` | `sk-...` | 只存在平台侧，不进仓库、不回传浏览器 |

   可选：`IMAGE_API_BASE_URL` / `IMAGE_API_MODEL` / `IMAGE_API_KEY` 用于出场景图；不填则沿用文本接口。

6. 验证：
   - `https://你的域名/healthz` → `{"ok":true,"public":true}`
   - `https://你的域名/api/config` → `configured` 为 `true`
   - 首页 → 右上角「导入知识库」→ 预览课程，能看到生成服务已连接

> 免费实例 15 分钟无访问会休眠，下次打开要等十几秒唤醒，这是平台行为，不是服务出错。

## 方式二：任意 Docker 平台（Railway / Fly.io / Koyeb / 自己的服务器）

仓库根目录有 `Dockerfile`，配置全部走环境变量。

```sh
docker build -t knowledge-town .
docker run -d --name knowledge-town -p 8080:8080 \
  -e TOWN_PUBLIC=1 \
  -e API_BASE_URL=https://api.deepseek.com/v1 \
  -e API_MODEL=deepseek-chat \
  -e API_KEY=sk-... \
  knowledge-town
```

打开 `http://服务器IP:8080/`。走反向代理（Nginx / Caddy）时把 `Host` 和 `X-Forwarded-Proto` 透传，服务端靠 `X-Forwarded-Proto` 判断同源，https 站点不会因为协议不一致被判成跨站。

Railway / Fly.io 直接把仓库连上即可，平台会给 `PORT`，服务端已读取；记得照样设 `TOWN_PUBLIC=1`。

## 环境变量总表

| 变量 | 默认 | 作用 |
| --- | --- | --- |
| `TOWN_PUBLIC` | 空 | `1` 时接受公网域名；不设只服务本机 |
| `HOST` | 公网模式 `0.0.0.0`，否则 `127.0.0.1` | 监听地址 |
| `PORT` | `8766` | 监听端口，平台一般会注入 |
| `TOWN_PUBLIC_HOSTS` | 空 | 逗号分隔域名白名单，留空接受任意域名 |
| `TOWN_RATE_LIMIT` | `5` | 公网模式下 `course-jobs`、`scene-design`、`image-generation`、`kb/api/generate` 每 IP 每 10 分钟的调用上限；本机模式不限 |
| `API_BASE_URL` / `API_MODEL` / `API_KEY` | 空 | 课程生成用模型；填了就出现在模型中心「服务器环境变量」这一条里 |
| `IMAGE_API_BASE_URL` / `IMAGE_API_MODEL` / `IMAGE_API_KEY` | 空 | 出图用，留空沿用文本接口 |
| `API_CHUNK_CHARS` / `API_MAX_CHUNKS` / `API_MAX_OUTPUT_TOKENS` / `API_TIMEOUT_MS` | 12000 / 40 / 6000 / 90000 | 长资料分片与超时 |
| `TOWN_PROFILE_FILE` | `artifacts/runtime/model-profiles.json` | 模型中心保存的配置位置，挂盘时指向 `/data/...` |
| `KB_DATA_DIR` | `dist/knowledge` | 出题器题库与配置目录，挂盘时指向 `/data/kb` |

## 数据持久化（要长期在线上用才需要）

免费平台一般不给挂盘；付费实例加一个磁盘后，把它挂到 `/data`，再设：

```
TOWN_PROFILE_FILE=/data/model-profiles.json
KB_DATA_DIR=/data/kb
```

游戏存档本来就在玩家浏览器 `localStorage` 里，不占服务器空间；换域名等于换存档，让玩家用「成长手记 → 导出/导入备份」迁移。

## 安全边界

- 公网模式对所有花钱的接口按 IP 限额（默认每 10 分钟 5 次），避免陌生人拿你的 Key 刷额度。调大就改 `TOWN_RATE_LIMIT`。
- `/api/model-profiles` 允许访客填**自己的** Key，但 Key 只写入服务器本地文件、不回传浏览器；容器重启即清空。
- 静态服务拒绝以点开头的文件和出题器服务端源码：`/knowledge/.model-config.json`、`/kb/server.cjs` 等一律 404。
- 想彻底不让人用你的 Key 调接口：部署时**不填** `API_*`，线上就是纯离线版（内置课程照常可玩），只在本机跑带 Key 的完整版。

## 常见问题

| 现象 | 原因与处理 |
| --- | --- |
| 公网打开返回 `403 仅接受本机访问` | 没设 `TOWN_PUBLIC=1`，或设了 `TOWN_PUBLIC_HOSTS` 但域名不在白名单 |
| 页面能开，生成时提示「尚未配置 API」 | 只填了 `API_KEY` 没填 `API_BASE_URL` / `API_MODEL`，三项要齐 |
| 点「开始 AI 生成」返回 429 | 触发了公网限额；等 10 分钟或调大 `TOWN_RATE_LIMIT` |
| 图片/场景生成选不到模型 | 模型中心里选「服务器环境变量」这条，或在页面里自己加一条 |
| 重启后模型中心空了 | 临时文件系统；见「数据持久化」 |
| 出题器 503 / 找不到 `dist/knowledge/server.cjs` | 镜像里缺 `dist/knowledge`；用仓库自带的 `Dockerfile` 或确认 `dist/` 完整 |
| 页面打不开但 `/healthz` 正常 | 静态目录 `dist/` 没进镜像，检查 `.dockerignore` 是否误排除 |
