# 拾知小镇 · 在线版镜像（Node 22，无第三方依赖，构建后直接 node server.cjs）
# 本地构建：docker build -t knowledge-town .
# 本地运行：docker run -p 8080:8080 -e API_BASE_URL=... -e API_MODEL=... -e API_KEY=... knowledge-town
# 线上（Render / Railway / Fly / 自有服务器）用法见 docs/DEPLOY.md
FROM node:22-alpine

ENV NODE_ENV=production \
    TOWN_PUBLIC=1 \
    HOST=0.0.0.0 \
    PORT=8080

WORKDIR /app

COPY . .

# 运行时会写日志、模型配置、生成的场景图和题库；先建好目录，避免首次调用失败
RUN mkdir -p artifacts/runtime dist/generated-scenes dist/knowledge/library

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.cjs"]
