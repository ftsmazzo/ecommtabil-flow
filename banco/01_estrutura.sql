-- =====================================================================
-- EcommFlow - Gestão de tarefas e rotinas
-- Estrutura do banco de dados (PostgreSQL 14+)
--
-- Multi-escritório: cada licença (escritório) tem seus próprios usuários,
-- departamentos, clientes, rotinas, tarefas e boletos (coluna escritorio_id).
-- Scripts de carga definem o escritório da sessão com:
--     SELECT set_config('app.escritorio_id', '<id>', false);
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- 0. TIPOS E FUNÇÕES DE CONTEXTO
-- ---------------------------------------------------------------------
CREATE TYPE perfil_usuario AS ENUM ('gestor', 'operador');
CREATE TYPE status_tarefa  AS ENUM ('pendente', 'em_andamento', 'concluida', 'atrasada', 'cancelada');
CREATE TYPE periodicidade  AS ENUM ('diaria', 'semanal', 'mensal', 'trimestral', 'anual', 'unica');
CREATE TYPE acao_financeira AS ENUM ('gerar_boleto', 'enviar_boleto');

-- Escritório da sessão (usado como DEFAULT nas cargas). NULL quando não definido.
CREATE OR REPLACE FUNCTION esc() RETURNS INT AS $$
    SELECT NULLIF(current_setting('app.escritorio_id', TRUE), '')::INT;
$$ LANGUAGE sql STABLE;

-- Usuário que está fazendo a alteração (a aplicação define em cada transação).
CREATE OR REPLACE FUNCTION operador_atual() RETURNS INT AS $$
    SELECT NULLIF(current_setting('app.operador_id', TRUE), '')::INT;
$$ LANGUAGE sql STABLE;

-- ---------------------------------------------------------------------
-- 1. LICENÇAS / ESCRITÓRIOS
-- ---------------------------------------------------------------------
CREATE TABLE escritorios (
    id          SERIAL PRIMARY KEY,
    nome        VARCHAR(120) NOT NULL,
    slug        VARCHAR(60)  NOT NULL UNIQUE,
    cnpj        VARCHAR(18),
    ativo       BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 2. CADASTROS
-- ---------------------------------------------------------------------
CREATE TABLE operadores (
    id            SERIAL PRIMARY KEY,
    escritorio_id INT NOT NULL DEFAULT esc() REFERENCES escritorios(id),
    nome          VARCHAR(120) NOT NULL,
    email         VARCHAR(160),
    perfil        perfil_usuario NOT NULL DEFAULT 'operador',
    usuario       VARCHAR(40) NOT NULL UNIQUE,      -- login (único em toda a plataforma)
    senha_hash    TEXT,                             -- bcrypt; NULL = sem acesso até definir senha
    ativo         BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_acesso TIMESTAMPTZ,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE departamentos (
    id            SERIAL PRIMARY KEY,
    escritorio_id INT NOT NULL DEFAULT esc() REFERENCES escritorios(id),
    nome          VARCHAR(60) NOT NULL,
    restrito_gestor BOOLEAN NOT NULL DEFAULT FALSE,  -- ex.: FINANCEIRO (somente gestores)
    ativo         BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (escritorio_id, nome)
);

CREATE TABLE grupos (
    id            SERIAL PRIMARY KEY,
    escritorio_id INT NOT NULL DEFAULT esc() REFERENCES escritorios(id),
    nome          VARCHAR(80) NOT NULL,
    UNIQUE (escritorio_id, nome)
);

CREATE TABLE clientes (
    id                 SERIAL PRIMARY KEY,
    escritorio_id      INT NOT NULL DEFAULT esc() REFERENCES escritorios(id),
    razao_social       VARCHAR(200) NOT NULL,
    cnpj               VARCHAR(18),                 -- CNPJ ou CPF
    cod_alter          VARCHAR(20),
    grupo_id           INT REFERENCES grupos(id),
    ramo               VARCHAR(30) CHECK (ramo IN ('INDUSTRIA','COMERCIO','SERVICO','COMERCIO E SERVICO',
                                                   'INDUSTRIA E COMERCIO','TRANSPORTE','LOCACAO/ALUGUEL')),
    regime             VARCHAR(40),                 -- Simples Nacional, MEI, Lucro Presumido, Lucro Real
    entrada_escritorio DATE,
    contato_documentos VARCHAR(160),                -- e-mail ou WhatsApp
    operador_padrao    INT REFERENCES operadores(id),
    ativo              BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (escritorio_id, cnpj)
);

-- ---------------------------------------------------------------------
-- 3. ROTINAS RECORRENTES
-- ---------------------------------------------------------------------
CREATE TABLE rotinas (
    id                SERIAL PRIMARY KEY,
    escritorio_id     INT NOT NULL DEFAULT esc() REFERENCES escritorios(id),
    titulo            VARCHAR(160) NOT NULL,
    departamento_id   INT NOT NULL REFERENCES departamentos(id),
    descricao         TEXT,
    cliente_id        INT REFERENCES clientes(id),
    operador_id       INT REFERENCES operadores(id),  -- NULL = operador padrão do cliente
    periodicidade     periodicidade NOT NULL,
    dia_mes           SMALLINT CHECK (dia_mes BETWEEN 1 AND 31),
    dia_semana        SMALLINT CHECK (dia_semana BETWEEN 0 AND 6),
    mes_ano           SMALLINT CHECK (mes_ano BETWEEN 1 AND 12),
    data_unica        DATE,                            -- periodicidade 'unica' (boleto avulso)
    dias_antecedencia SMALLINT NOT NULL DEFAULT 5,     -- gera a tarefa X dias antes do prazo
    prioridade        VARCHAR(5) NOT NULL DEFAULT 'media' CHECK (prioridade IN ('alta','media','baixa')),
    exige_conferencia BOOLEAN NOT NULL DEFAULT FALSE,
    -- Financeiro
    acao_financeira   acao_financeira,
    cobranca_id       INT,                             -- agrupa GERAR + ENVIAR do mesmo cliente
    valor             NUMERIC(12,2),
    dia_vencimento_boleto SMALLINT CHECK (dia_vencimento_boleto BETWEEN 1 AND 31),
    data_vencimento_boleto DATE,                       -- boleto avulso
    observacao        TEXT,
    criado_por        INT REFERENCES operadores(id),
    ativa             BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE SEQUENCE cobranca_seq;

CREATE TABLE rotina_etapas (
    id        SERIAL PRIMARY KEY,
    rotina_id INT NOT NULL REFERENCES rotinas(id) ON DELETE CASCADE,
    ordem     SMALLINT NOT NULL,
    nome      VARCHAR(120) NOT NULL,
    UNIQUE (rotina_id, ordem)
);

-- ---------------------------------------------------------------------
-- 4. TAREFAS
-- ---------------------------------------------------------------------
CREATE TABLE tarefas (
    id                SERIAL PRIMARY KEY,
    escritorio_id     INT NOT NULL DEFAULT esc() REFERENCES escritorios(id),
    rotina_id         INT REFERENCES rotinas(id),
    departamento_id   INT NOT NULL REFERENCES departamentos(id),
    titulo            VARCHAR(160) NOT NULL,
    descricao         TEXT,
    cliente_id        INT REFERENCES clientes(id),
    operador_id       INT NOT NULL REFERENCES operadores(id),
    competencia       DATE,
    prazo             DATE NOT NULL,
    prioridade        VARCHAR(5) NOT NULL DEFAULT 'media' CHECK (prioridade IN ('alta','media','baixa')),
    status            status_tarefa NOT NULL DEFAULT 'pendente',
    exige_conferencia BOOLEAN NOT NULL DEFAULT FALSE,
    acao_financeira   acao_financeira,
    valor             NUMERIC(12,2),
    criado_por        INT REFERENCES operadores(id),   -- NULL = gerada por rotina
    iniciada_em       TIMESTAMPTZ,
    concluida_em      TIMESTAMPTZ,
    conferida_por     INT REFERENCES operadores(id),
    conferida_em      TIMESTAMPTZ,
    observacao        TEXT,
    criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (rotina_id, prazo)                          -- evita duplicar tarefas da mesma rotina
);
CREATE INDEX idx_tarefas_esc_status ON tarefas (escritorio_id, status);
CREATE INDEX idx_tarefas_operador   ON tarefas (operador_id, status);
CREATE INDEX idx_tarefas_prazo      ON tarefas (prazo);

CREATE TABLE tarefa_etapas (
    id            SERIAL PRIMARY KEY,
    tarefa_id     INT NOT NULL REFERENCES tarefas(id) ON DELETE CASCADE,
    ordem         SMALLINT NOT NULL,
    nome          VARCHAR(120) NOT NULL,
    concluida     BOOLEAN NOT NULL DEFAULT FALSE,
    concluida_por INT REFERENCES operadores(id),
    concluida_em  TIMESTAMPTZ,
    UNIQUE (tarefa_id, ordem)
);

CREATE TABLE historico_tarefas (
    id              BIGSERIAL PRIMARY KEY,
    tarefa_id       INT NOT NULL REFERENCES tarefas(id) ON DELETE CASCADE,
    operador_id     INT REFERENCES operadores(id),
    acao            VARCHAR(40) NOT NULL,
    status_anterior status_tarefa,
    status_novo     status_tarefa,
    detalhe         TEXT,
    registrado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_historico_tarefa ON historico_tarefas (tarefa_id);

-- ---------------------------------------------------------------------
-- 5. MÓDULO FINANCEIRO (boletos)
-- ---------------------------------------------------------------------
CREATE TABLE boletos (
    id               SERIAL PRIMARY KEY,
    escritorio_id    INT NOT NULL DEFAULT esc() REFERENCES escritorios(id),
    cliente_id       INT NOT NULL REFERENCES clientes(id),
    cobranca_id      INT,
    competencia      DATE NOT NULL,                   -- 1º dia do mês de vencimento
    valor            NUMERIC(12,2) NOT NULL,
    vencimento       DATE NOT NULL,
    nosso_numero     VARCHAR(30),
    tarefa_gerar_id  INT REFERENCES tarefas(id) ON DELETE SET NULL,
    tarefa_enviar_id INT REFERENCES tarefas(id) ON DELETE SET NULL,
    gerado_em        TIMESTAMPTZ,
    enviado_em       TIMESTAMPTZ,
    arquivo_pdf      VARCHAR(255),
    divergencia      TEXT,
    pago_em          DATE,
    valor_pago       NUMERIC(12,2),
    UNIQUE (escritorio_id, nosso_numero),
    UNIQUE (cobranca_id, competencia)
);

CREATE TABLE conciliacao_boletos (
    id             BIGSERIAL PRIMARY KEY,
    escritorio_id  INT NOT NULL REFERENCES escritorios(id),
    boleto_id      INT REFERENCES boletos(id),
    arquivo        VARCHAR(255) NOT NULL,
    pagador        VARCHAR(200),
    documento      VARCHAR(20),
    valor_pdf      NUMERIC(12,2),
    vencimento_pdf DATE,
    nosso_numero   VARCHAR(30),
    resultado      VARCHAR(20) NOT NULL CHECK (resultado IN ('confere','divergente','nao_encontrado','duplicado')),
    mensagens      TEXT,
    conciliado_por INT REFERENCES operadores(id),
    conciliado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 6. REGRAS DE NEGÓCIO (triggers)
-- =====================================================================

-- 6.1 Auditoria: datas automáticas + histórico
CREATE OR REPLACE FUNCTION trg_tarefas_auditoria() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO historico_tarefas (tarefa_id, operador_id, acao, status_novo)
        VALUES (NEW.id, operador_atual(), 'criada', NEW.status);
        RETURN NEW;
    END IF;

    NEW.atualizado_em := now();
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NEW.status = 'em_andamento' AND NEW.iniciada_em IS NULL THEN NEW.iniciada_em := now(); END IF;
        IF NEW.status = 'concluida' THEN
            NEW.concluida_em := now();
        ELSIF OLD.status = 'concluida' THEN          -- reaberta: zera conclusão e conferência
            NEW.concluida_em := NULL; NEW.conferida_por := NULL; NEW.conferida_em := NULL;
        END IF;
        INSERT INTO historico_tarefas (tarefa_id, operador_id, acao, status_anterior, status_novo)
        VALUES (NEW.id, operador_atual(), 'status', OLD.status, NEW.status);
    END IF;
    IF NEW.operador_id IS DISTINCT FROM OLD.operador_id THEN
        INSERT INTO historico_tarefas (tarefa_id, operador_id, acao, detalhe)
        VALUES (NEW.id, operador_atual(), 'transferida',
                (SELECT nome FROM operadores WHERE id = OLD.operador_id) || ' → ' ||
                (SELECT nome FROM operadores WHERE id = NEW.operador_id));
    END IF;
    IF NEW.conferida_por IS NOT NULL AND OLD.conferida_por IS NULL THEN
        INSERT INTO historico_tarefas (tarefa_id, operador_id, acao, detalhe)
        VALUES (NEW.id, operador_atual(), 'conferida', 'tarefa conferida pelo gestor');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER tarefas_audit_upd BEFORE UPDATE ON tarefas FOR EACH ROW EXECUTE FUNCTION trg_tarefas_auditoria();
CREATE TRIGGER tarefas_audit_ins AFTER INSERT ON tarefas FOR EACH ROW EXECUTE FUNCTION trg_tarefas_auditoria();

-- 6.2 Permissões: operador só transfere as próprias tarefas; só gestor confere;
--     departamentos restritos (FINANCEIRO) só com gestores; mesmo escritório.
CREATE OR REPLACE FUNCTION trg_tarefas_permissao() RETURNS TRIGGER AS $$
DECLARE u operadores; dest operadores; restrito BOOLEAN;
BEGIN
    SELECT * INTO dest FROM operadores WHERE id = NEW.operador_id;
    IF dest.escritorio_id <> NEW.escritorio_id THEN
        RAISE EXCEPTION 'Responsável não pertence a este escritório';
    END IF;
    SELECT restrito_gestor INTO restrito FROM departamentos WHERE id = NEW.departamento_id;
    IF restrito AND dest.perfil <> 'gestor' THEN
        RAISE EXCEPTION 'Tarefas deste departamento só podem ser atribuídas a gestores';
    END IF;

    IF operador_atual() IS NULL THEN RETURN NEW; END IF;   -- processos automáticos
    SELECT * INTO u FROM operadores WHERE id = operador_atual();
    IF TG_OP = 'INSERT' THEN
        NEW.criado_por := u.id;
        RETURN NEW;
    END IF;
    IF u.perfil <> 'gestor' THEN
        IF NEW.operador_id IS DISTINCT FROM OLD.operador_id AND OLD.operador_id <> u.id THEN
            RAISE EXCEPTION 'Operadores só podem transferir as próprias tarefas';
        END IF;
        IF NEW.conferida_por IS DISTINCT FROM OLD.conferida_por THEN
            RAISE EXCEPTION 'Somente gestores podem conferir tarefas';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER tarefas_permissao BEFORE INSERT OR UPDATE ON tarefas FOR EACH ROW EXECUTE FUNCTION trg_tarefas_permissao();

-- 6.3 Checklist: copia etapas da rotina, registra quem marcou, bloqueia conclusão incompleta
CREATE OR REPLACE FUNCTION trg_copiar_etapas() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.rotina_id IS NOT NULL THEN
        INSERT INTO tarefa_etapas (tarefa_id, ordem, nome)
        SELECT NEW.id, ordem, nome FROM rotina_etapas WHERE rotina_id = NEW.rotina_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER tarefas_copiar_etapas AFTER INSERT ON tarefas FOR EACH ROW EXECUTE FUNCTION trg_copiar_etapas();

CREATE OR REPLACE FUNCTION trg_etapa_marcada() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.concluida IS DISTINCT FROM OLD.concluida THEN
        NEW.concluida_por := CASE WHEN NEW.concluida THEN operador_atual() END;
        NEW.concluida_em  := CASE WHEN NEW.concluida THEN now() END;
        INSERT INTO historico_tarefas (tarefa_id, operador_id, acao, detalhe)
        VALUES (NEW.tarefa_id, operador_atual(), 'etapa',
                NEW.nome || CASE WHEN NEW.concluida THEN ' ✔ marcada' ELSE ' desmarcada' END);
        IF NEW.concluida THEN
            UPDATE tarefas SET status = 'em_andamento' WHERE id = NEW.tarefa_id AND status = 'pendente';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER etapas_marcada BEFORE UPDATE ON tarefa_etapas FOR EACH ROW EXECUTE FUNCTION trg_etapa_marcada();

CREATE OR REPLACE FUNCTION trg_valida_etapas() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'concluida' AND OLD.status <> 'concluida'
       AND EXISTS (SELECT 1 FROM tarefa_etapas WHERE tarefa_id = NEW.id AND NOT concluida) THEN
        RAISE EXCEPTION 'Conclua todas as etapas antes de finalizar a tarefa';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER tarefas_valida_etapas BEFORE UPDATE ON tarefas FOR EACH ROW EXECUTE FUNCTION trg_valida_etapas();

-- 6.4 Financeiro: cada tarefa GERAR/ENVIAR é vinculada ao boleto do ciclo;
--     concluir GERAR marca gerado, concluir ENVIAR marca enviado.
CREATE OR REPLACE FUNCTION vencimento_boleto(r rotinas, prazo DATE) RETURNS DATE AS $$
DECLARE base DATE := date_trunc('month', prazo)::DATE; ult INT; dia_ref INT;
BEGIN
    IF r.data_vencimento_boleto IS NOT NULL THEN RETURN r.data_vencimento_boleto; END IF;
    -- referência: dia de GERAR da mesma cobrança (garante o mesmo boleto para GERAR e ENVIAR)
    SELECT dia_mes INTO dia_ref FROM rotinas WHERE cobranca_id = r.cobranca_id AND acao_financeira = 'gerar_boleto' LIMIT 1;
    IF r.dia_vencimento_boleto < COALESCE(dia_ref, EXTRACT(DAY FROM prazo)::INT) THEN base := (base + INTERVAL '1 month')::DATE; END IF;
    ult := EXTRACT(DAY FROM (base + INTERVAL '1 month - 1 day'))::INT;
    RETURN base + LEAST(r.dia_vencimento_boleto, ult) - 1;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION trg_vincular_boleto() RETURNS TRIGGER AS $$
DECLARE r rotinas; v DATE; b_id INT;
BEGIN
    IF NEW.acao_financeira IS NULL OR NEW.rotina_id IS NULL THEN RETURN NEW; END IF;
    SELECT * INTO r FROM rotinas WHERE id = NEW.rotina_id;
    IF r.cobranca_id IS NULL THEN RETURN NEW; END IF;
    v := vencimento_boleto(r, NEW.prazo);
    INSERT INTO boletos (escritorio_id, cliente_id, cobranca_id, competencia, valor, vencimento)
    VALUES (NEW.escritorio_id, NEW.cliente_id, r.cobranca_id, date_trunc('month', v)::DATE, COALESCE(NEW.valor, r.valor), v)
    ON CONFLICT (cobranca_id, competencia) DO UPDATE SET valor = boletos.valor
    RETURNING id INTO b_id;
    IF NEW.acao_financeira = 'gerar_boleto' THEN
        UPDATE boletos SET tarefa_gerar_id = NEW.id WHERE id = b_id;
    ELSE
        UPDATE boletos SET tarefa_enviar_id = NEW.id WHERE id = b_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER tarefas_vincular_boleto AFTER INSERT ON tarefas FOR EACH ROW EXECUTE FUNCTION trg_vincular_boleto();

CREATE OR REPLACE FUNCTION trg_status_boleto() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.acao_financeira IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
    IF NEW.acao_financeira = 'gerar_boleto' THEN
        UPDATE boletos SET gerado_em = CASE WHEN NEW.status = 'concluida' THEN now() END
        WHERE tarefa_gerar_id = NEW.id AND (NEW.status = 'concluida' OR enviado_em IS NULL);
    ELSE
        UPDATE boletos SET enviado_em = CASE WHEN NEW.status = 'concluida' THEN now() END,
                           gerado_em  = COALESCE(gerado_em, CASE WHEN NEW.status = 'concluida' THEN now() END)
        WHERE tarefa_enviar_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER tarefas_status_boleto AFTER UPDATE ON tarefas FOR EACH ROW EXECUTE FUNCTION trg_status_boleto();

-- =====================================================================
-- 7. GERAÇÃO AUTOMÁTICA DE TAREFAS (rodar 1x por dia)
-- =====================================================================
CREATE OR REPLACE FUNCTION proximo_prazo(r rotinas, base DATE) RETURNS DATE AS $$
DECLARE d DATE; ult INT; i INT := 0;
BEGIN
    CASE r.periodicidade
    WHEN 'unica'  THEN RETURN r.data_unica;
    WHEN 'diaria' THEN
        d := base;
        WHILE EXTRACT(ISODOW FROM d) > 5 LOOP d := d + 1; END LOOP;   -- dias úteis
        RETURN d;
    WHEN 'semanal' THEN
        RETURN base + ((r.dia_semana - EXTRACT(DOW FROM base)::INT + 7) % 7);
    ELSE
        d := date_trunc('month', base)::DATE;
        LOOP
            i := i + 1; EXIT WHEN i > 30;
            IF (r.periodicidade = 'trimestral' AND (EXTRACT(MONTH FROM d)::INT - COALESCE(r.mes_ano, 1) + 12) % 3 <> 0)
               OR (r.periodicidade = 'anual' AND EXTRACT(MONTH FROM d)::INT <> r.mes_ano) THEN
                d := (d + INTERVAL '1 month')::DATE; CONTINUE;
            END IF;
            ult := EXTRACT(DAY FROM (d + INTERVAL '1 month - 1 day'))::INT;
            IF d + LEAST(r.dia_mes, ult) - 1 >= base THEN RETURN d + LEAST(r.dia_mes, ult) - 1; END IF;
            d := (d + INTERVAL '1 month')::DATE;
        END LOOP;
        RETURN NULL;
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Cria a tarefa do próximo ciclo de UMA rotina (usado pelo cron e ao cadastrar rotinas)
CREATE OR REPLACE FUNCTION gerar_tarefa_rotina(p_rotina INT, hoje DATE DEFAULT CURRENT_DATE, forcar BOOLEAN DEFAULT FALSE)
RETURNS INT AS $$
DECLARE r rotinas; p DATE; nova INT;
BEGIN
    SELECT * INTO r FROM rotinas WHERE id = p_rotina;
    IF NOT FOUND OR (NOT r.ativa AND r.periodicidade <> 'unica') THEN RETURN NULL; END IF;
    p := proximo_prazo(r, hoje);
    IF p IS NULL OR (NOT forcar AND p > hoje + r.dias_antecedencia) THEN RETURN NULL; END IF;
    INSERT INTO tarefas (escritorio_id, rotina_id, departamento_id, titulo, descricao, cliente_id, operador_id,
                         competencia, prazo, prioridade, exige_conferencia, acao_financeira, valor)
    SELECT r.escritorio_id, r.id, r.departamento_id, r.titulo, r.descricao, r.cliente_id,
           COALESCE(r.operador_id, c.operador_padrao),
           date_trunc('month', p - INTERVAL '1 month')::DATE, p, r.prioridade, r.exige_conferencia,
           r.acao_financeira, r.valor
    FROM (SELECT 1) x LEFT JOIN clientes c ON c.id = r.cliente_id
    WHERE COALESCE(r.operador_id, c.operador_padrao) IS NOT NULL
    ON CONFLICT (rotina_id, prazo) DO NOTHING
    RETURNING id INTO nova;
    IF r.periodicidade = 'unica' AND nova IS NOT NULL THEN UPDATE rotinas SET ativa = FALSE WHERE id = r.id; END IF;
    RETURN nova;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION gerar_tarefas(hoje DATE DEFAULT CURRENT_DATE) RETURNS INT AS $$
DECLARE r RECORD; qtd INT := 0;
BEGIN
    FOR r IN SELECT id FROM rotinas WHERE ativa LOOP
        IF gerar_tarefa_rotina(r.id, hoje) IS NOT NULL THEN qtd := qtd + 1; END IF;
    END LOOP;
    RETURN qtd;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION marcar_atrasadas(hoje DATE DEFAULT CURRENT_DATE) RETURNS INT AS $$
DECLARE qtd INT;
BEGIN
    UPDATE tarefas SET status = 'atrasada' WHERE prazo < hoje AND status IN ('pendente', 'em_andamento');
    GET DIAGNOSTICS qtd = ROW_COUNT;
    RETURN qtd;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 8. AUTENTICAÇÃO
-- =====================================================================
CREATE OR REPLACE FUNCTION autenticar(p_usuario TEXT, p_senha TEXT)
RETURNS TABLE (id INT, nome VARCHAR, perfil perfil_usuario, escritorio_id INT, escritorio VARCHAR) AS $$
    SELECT o.id, o.nome, o.perfil, o.escritorio_id, e.nome
    FROM operadores o JOIN escritorios e ON e.id = o.escritorio_id
    WHERE lower(o.usuario) = lower(p_usuario) AND o.ativo AND e.ativo
      AND o.senha_hash IS NOT NULL AND o.senha_hash = crypt(p_senha, o.senha_hash);
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION definir_senha(p_usuario TEXT, p_senha TEXT) RETURNS BOOLEAN AS $$
    UPDATE operadores SET senha_hash = crypt(p_senha, gen_salt('bf', 10))
    WHERE lower(usuario) = lower(p_usuario)
    RETURNING TRUE;
$$ LANGUAGE sql;

-- =====================================================================
-- 9. VIEWS
-- =====================================================================
CREATE OR REPLACE VIEW vw_boletos AS
SELECT b.*, c.razao_social, c.cnpj,
       CASE WHEN b.pago_em IS NOT NULL THEN 'recebido'
            WHEN b.gerado_em IS NULL THEN 'nao_gerado'
            WHEN b.vencimento < CURRENT_DATE THEN 'vencido'
            ELSE 'a_receber' END AS situacao
FROM boletos b JOIN clientes c ON c.id = b.cliente_id;

-- Agendamento (alternativa ao cron da aplicação), requer pg_cron:
-- SELECT cron.schedule('ecommflow-diario', '0 9 * * *', $$ SELECT gerar_tarefas(); SELECT marcar_atrasadas(); $$);
