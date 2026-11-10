# Imagem de produção (EasyPanel / Docker)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 TZ=America/Sao_Paulo PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules/pdfjs-dist ./node_modules/pdfjs-dist
COPY --from=build /app/banco ./banco
COPY --from=build /app/scripts/init-db.mjs ./scripts/init-db.mjs
COPY --from=build /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
# pg para init-db no boot (standalone já traz pg da app; reforço para o script)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && rm -rf package-lock.json \
  && chmod +x ./scripts/docker-entrypoint.sh \
  && chown -R app:app /app
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 CMD wget -qO- http://127.0.0.1:3000/api/saude || exit 1
CMD ["./scripts/docker-entrypoint.sh"]
