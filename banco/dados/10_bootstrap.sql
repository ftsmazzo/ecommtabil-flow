-- Bootstrap limpo (sem dados de clientes reais).
-- Escritório + departamentos + admin gestor. Senha: usar npm run senha -- admin
-- ou definir BOOTSTRAP_ADMIN_PASSWORD no script scripts/bootstrap-admin.ts

INSERT INTO escritorios (nome, slug, cnpj)
VALUES ('Ecommtabil', 'ecommtabil', NULL)
ON CONFLICT (slug) DO NOTHING;

SELECT set_config('app.escritorio_id', (SELECT id::text FROM escritorios WHERE slug = 'ecommtabil'), false);

INSERT INTO departamentos (nome, restrito_gestor) VALUES
    ('RECURSOS HUMANOS', FALSE),
    ('CONSULTORIA EMPRESARIAL', FALSE),
    ('SOCIETARIO', FALSE),
    ('DEPARTAMENTO PESSOAL', FALSE),
    ('FISCAL', FALSE),
    ('CONTABIL', FALSE),
    ('TRIAGEM DE DOCUMENTOS', FALSE),
    ('FINANCEIRO', TRUE)
ON CONFLICT (escritorio_id, nome) DO NOTHING;

INSERT INTO operadores (nome, usuario, email, perfil)
SELECT 'Administrador', 'admin', NULL, 'gestor'
WHERE NOT EXISTS (SELECT 1 FROM operadores WHERE lower(usuario) = 'admin');
