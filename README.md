# ecommtabil-flow (EcommFlow)

Gestão de tarefas e rotinas para o escritório **Ecommtabil**.  
Repositório de trabalho da FábricaIA (implantação EasyPanel). Origem do produto: cliente / vibe coding.

## Stack

Next.js 14 + TypeScript + PostgreSQL (`pgcrypto`) + Docker.

## Setup local

```bash
cp .env.example .env   # DATABASE_URL, SESSION_SECRET (≥32 chars), CRON_SECRET
npm install
npm run db:setup       # estrutura + bootstrap (escritório, departamentos, user admin)
npm run bootstrap:admin -- SenhaForte123
npm run dev            # http://localhost:3000
```

Login inicial: usuário `admin` (gestor). Cadastre os demais em Cadastros → Usuários.

## Produção (EasyPanel)

Projeto sugerido: `ecommflow` — serviços `postgres` + `app` (Dockerfile).  
Env: `DATABASE_URL`, `SESSION_SECRET`, `CRON_SECRET`, `NODE_ENV=production`, `TZ=America/Sao_Paulo`.  
Health: `GET /api/saude`. Cron diário: `GET /api/cron/diario` com Bearer `CRON_SECRET`.

## Scripts

| Script | Função |
|---|---|
| `db:setup` | Aplica `banco/01_estrutura.sql` + `banco/dados/*.sql` |
| `bootstrap:admin` | Define senha do `admin` |
| `senha -- <usuario>` | Define senha de qualquer usuário |
| `cron` | Gera tarefas / marca atrasadas (CLI) |
