-- ============================================================================
-- MVP Navegação Indoor da Prefeitura - Carga Inicial de Demonstração
-- ============================================================================

-- 1. Prédio de Demonstração: Prefeitura Municipal de Três Corações - MG
INSERT INTO buildings (id, name, address, description, latitude, longitude, footprint)
VALUES (
    1,
    'Prefeitura Municipal de Três Corações',
    'Av. Brasil, 225 - Jardim América, Três Corações - MG',
    'Centro Administrativo Dr. Astolpho Gazzola — Sede administrativa e central de atendimento ao cidadão da Prefeitura Municipal de Três Corações.',
    -21.670830,
    -45.269030,
    ST_GeomFromText('POLYGON((-45.26933 -21.67103, -45.26873 -21.67103, -45.26873 -21.67063, -45.26933 -21.67063, -45.26933 -21.67103))', 4326)
) ON CONFLICT (id) DO NOTHING;

-- 2. Andares: Térreo (level 0) e 1º Andar (level 1)
INSERT INTO floors (id, building_id, name, level, outline, corridor_geometry)
VALUES
(
    1,
    1,
    'Térreo',
    0,
    ST_GeomFromText('POLYGON((-45.26933 -21.67103, -45.26873 -21.67103, -45.26873 -21.67063, -45.26933 -21.67063, -45.26933 -21.67103))', 4326),
    ST_GeomFromText('POLYGON((-45.26910 -21.67095, -45.26896 -21.67095, -45.26896 -21.67072, -45.26910 -21.67072, -45.26910 -21.67095))', 4326)
),
(
    2,
    1,
    '1º Andar',
    1,
    ST_GeomFromText('POLYGON((-45.26933 -21.67103, -45.26873 -21.67103, -45.26873 -21.67063, -45.26933 -21.67063, -45.26933 -21.67103))', 4326),
    ST_GeomFromText('POLYGON((-45.26910 -21.67095, -45.26896 -21.67095, -45.26896 -21.67072, -45.26910 -21.67072, -45.26910 -21.67095))', 4326)
) ON CONFLICT (id) DO NOTHING;

-- 3. Nós de Navegação (Térreo: IDs 1..11 | 1º Andar: IDs 12..22)
INSERT INTO routing_nodes (id, floor_id, code, name, node_type, geometry)
VALUES
-- Térreo
(1,  1, 'N0_REC',  'Recepção Principal',                'entrance', ST_SetSRID(ST_MakePoint(-45.26903, -21.67068), 4326)),
(2,  1, 'N0_C1',   'Corredor Norte (Térreo)',           'corridor', ST_SetSRID(ST_MakePoint(-45.26903, -21.67078), 4326)),
(3,  1, 'N0_101',  'Acesso Sala 101 - Dívida Ativa',    'room',     ST_SetSRID(ST_MakePoint(-45.26912, -21.67078), 4326)),
(4,  1, 'N0_102',  'Acesso Sala 102 - ISS',             'room',     ST_SetSRID(ST_MakePoint(-45.26894, -21.67078), 4326)),
(5,  1, 'N0_C2',   'Corredor Sul (Térreo)',             'corridor', ST_SetSRID(ST_MakePoint(-45.26903, -21.67089), 4326)),
(6,  1, 'N0_103',  'Acesso Sala 103 - SEPLAN',          'room',     ST_SetSRID(ST_MakePoint(-45.26912, -21.67089), 4326)),
(7,  1, 'N0_104',  'Acesso Sala 104 - Receita Federal', 'room',     ST_SetSRID(ST_MakePoint(-45.26894, -21.67089), 4326)),
(8,  1, 'N0_C3',   'Hall do Elevador (Térreo)',         'corridor', ST_SetSRID(ST_MakePoint(-45.26903, -21.67095), 4326)),
(9,  1, 'N0_ELEV', 'Elevador (Térreo)',                 'elevator', ST_SetSRID(ST_MakePoint(-45.26903, -21.67098), 4326)),
(10, 1, 'N0_ESC',  'Escada (Térreo)',                   'stairs',   ST_SetSRID(ST_MakePoint(-45.26891, -21.67098), 4326)),
(11, 1, 'N0_WC',   'Sanitários (Térreo)',               'restroom', ST_SetSRID(ST_MakePoint(-45.26915, -21.67098), 4326)),

-- 1º Andar
(12, 2, 'N1_ELEV', 'Elevador (1º Andar)',               'elevator', ST_SetSRID(ST_MakePoint(-45.26903, -21.67098), 4326)),
(13, 2, 'N1_ESC',  'Escada (1º Andar)',                 'stairs',   ST_SetSRID(ST_MakePoint(-45.26891, -21.67098), 4326)),
(14, 2, 'N1_WC',   'Sanitários (1º Andar)',             'restroom', ST_SetSRID(ST_MakePoint(-45.26915, -21.67098), 4326)),
(15, 2, 'N1_C3',   'Hall do Elevador (1º Andar)',       'corridor', ST_SetSRID(ST_MakePoint(-45.26903, -21.67095), 4326)),
(16, 2, 'N1_C2',   'Corredor Sul (1º Andar)',           'corridor', ST_SetSRID(ST_MakePoint(-45.26903, -21.67089), 4326)),
(17, 2, 'N1_203',  'Acesso Sala 203 - RH',              'room',     ST_SetSRID(ST_MakePoint(-45.26912, -21.67089), 4326)),
(18, 2, 'N1_204',  'Acesso Sala 204 - Licitações',      'room',     ST_SetSRID(ST_MakePoint(-45.26894, -21.67089), 4326)),
(19, 2, 'N1_C1',   'Corredor Norte (1º Andar)',         'corridor', ST_SetSRID(ST_MakePoint(-45.26903, -21.67078), 4326)),
(20, 2, 'N1_201',  'Acesso Sala 201 - Finanças',        'room',     ST_SetSRID(ST_MakePoint(-45.26912, -21.67078), 4326)),
(21, 2, 'N1_202',  'Acesso Sala 202 - Obras',           'room',     ST_SetSRID(ST_MakePoint(-45.26894, -21.67078), 4326)),
(22, 2, 'N1_SEC',  'Acesso Secretaria / Gabinete',      'room',     ST_SetSRID(ST_MakePoint(-45.26903, -21.67068), 4326))
ON CONFLICT (id) DO NOTHING;

-- 4. Salas (Térreo e 1º Andar)
INSERT INTO rooms (id, floor_id, code, name, department, category, description, opening_hours, node_id, geometry)
VALUES
-- Salas do Térreo
(
    1, 1, 'REC', 'Recepção', 'Atendimento ao Cidadão / Triagem', 'reception',
    'Ponto de boas-vindas, informações gerais, emissão de senhas e orientação ao público.',
    '08:00 às 17:00', 1,
    ST_GeomFromText('POLYGON((-45.26918 -21.67072, -45.26888 -21.67072, -45.26888 -21.67064, -45.26918 -21.67064, -45.26918 -21.67072))', 4326)
),
(
    2, 1, '101', 'Sala 101', 'Dívida Ativa e Parcelamento', 'service',
    'Regularização fiscal, negociação de débitos municipais, IPTU atrasado e emissão de guias.',
    '08:30 às 16:30', 3,
    ST_GeomFromText('POLYGON((-45.26931 -21.67083, -45.26910 -21.67083, -45.26910 -21.67073, -45.26931 -21.67073, -45.26931 -21.67083))', 4326)
),
(
    3, 1, '102', 'Sala 102', 'ISS e Tributos Mobiliários', 'service',
    'Atendimento sobre Imposto Sobre Serviços (ISS), Nota Fiscal Eletrônica e cadastro de empresas.',
    '08:30 às 16:30', 4,
    ST_GeomFromText('POLYGON((-45.26896 -21.67083, -45.26875 -21.67083, -45.26875 -21.67073, -45.26896 -21.67073, -45.26896 -21.67083))', 4326)
),
(
    4, 1, '103', 'Sala 103', 'SEPLAN - Planejamento Urbano', 'service',
    'Aprovação de plantas, alvarás de construção, habite-se e consultas de zoneamento.',
    '09:00 às 16:00', 6,
    ST_GeomFromText('POLYGON((-45.26931 -21.67094, -45.26910 -21.67094, -45.26910 -21.67084, -45.26931 -21.67084, -45.26931 -21.67094))', 4326)
),
(
    5, 1, '104', 'Sala 104', 'Posto Receita Federal / Protocolo', 'service',
    'Protocolo geral de processos administrativos, abertura de requerimentos e posto conveniado.',
    '08:00 às 17:00', 7,
    ST_GeomFromText('POLYGON((-45.26896 -21.67094, -45.26875 -21.67094, -45.26875 -21.67084, -45.26896 -21.67084, -45.26896 -21.67094))', 4326)
),
(
    6, 1, 'ELEV-0', 'Elevador', 'Circulação Vertical Acessível', 'vertical_circulation',
    'Elevador social com acessibilidade para acesso ao 1º Andar.',
    '07:00 às 19:00', 9,
    ST_GeomFromText('POLYGON((-45.26908 -21.67102, -45.26898 -21.67102, -45.26898 -21.67095, -45.26908 -21.67095, -45.26908 -21.67102))', 4326)
),
(
    7, 1, 'ESC-0', 'Escada', 'Circulação Vertical', 'vertical_circulation',
    'Escada principal de acesso ao 1º Andar.',
    '07:00 às 19:00', 10,
    ST_GeomFromText('POLYGON((-45.26897 -21.67102, -45.26885 -21.67102, -45.26885 -21.67095, -45.26897 -21.67095, -45.26897 -21.67102))', 4326)
),
(
    8, 1, 'WC-0', 'Sanitários Térreo', 'Banheiros Acessíveis / PNE', 'facility',
    'Sanitários públicos masculino, feminino e acessível (PNE).',
    '07:00 às 19:00', 11,
    ST_GeomFromText('POLYGON((-45.26921 -21.67102, -45.26909 -21.67102, -45.26909 -21.67095, -45.26921 -21.67095, -45.26921 -21.67102))', 4326)
),

-- Salas do 1º Andar
(
    9, 2, 'SEC', 'Secretaria Geral', 'Gabinete e Secretaria de Governo', 'admin',
    'Secretaria Executiva, atendimento institucional e assessoria do Gabinete Municipal.',
    '09:00 às 17:00', 22,
    ST_GeomFromText('POLYGON((-45.26921 -21.67072, -45.26885 -21.67072, -45.26885 -21.67064, -45.26921 -21.67064, -45.26921 -21.67072))', 4326)
),
(
    10, 2, '201', 'Sala 201', 'Secretaria da Fazenda e Finanças', 'service',
    'Diretoria financeira, contabilidade pública, tesouraria e atendimento a fornecedores.',
    '08:30 às 16:30', 20,
    ST_GeomFromText('POLYGON((-45.26931 -21.67083, -45.26910 -21.67083, -45.26910 -21.67073, -45.26931 -21.67073, -45.26931 -21.67083))', 4326)
),
(
    11, 2, '202', 'Sala 202', 'Secretaria de Obras e Infraestrutura', 'service',
    'Projetos viários, fiscalização de obras públicas, manutenção urbana e drenagem.',
    '08:30 às 16:30', 21,
    ST_GeomFromText('POLYGON((-45.26896 -21.67083, -45.26875 -21.67083, -45.26875 -21.67073, -45.26896 -21.67073, -45.26896 -21.67083))', 4326)
),
(
    12, 2, '203', 'Sala 203', 'Recursos Humanos (RH)', 'admin',
    'Atendimento ao servidor público, concursos, folha de pagamento e benefícios.',
    '09:00 às 16:30', 17,
    ST_GeomFromText('POLYGON((-45.26931 -21.67094, -45.26910 -21.67094, -45.26910 -21.67084, -45.26931 -21.67084, -45.26931 -21.67094))', 4326)
),
(
    13, 2, '204', 'Sala 204', 'Licitações e Contratos', 'admin',
    'Comissão permanente de licitações, pregão eletrônico e gestão de contratos.',
    '09:00 às 16:30', 18,
    ST_GeomFromText('POLYGON((-45.26896 -21.67094, -45.26875 -21.67094, -45.26875 -21.67084, -45.26896 -21.67084, -45.26896 -21.67094))', 4326)
),
(
    14, 2, 'ELEV-1', 'Elevador', 'Circulação Vertical Acessível', 'vertical_circulation',
    'Elevador social com acesso ao Térreo.',
    '07:00 às 19:00', 12,
    ST_GeomFromText('POLYGON((-45.26908 -21.67102, -45.26898 -21.67102, -45.26898 -21.67095, -45.26908 -21.67095, -45.26908 -21.67102))', 4326)
),
(
    15, 2, 'ESC-1', 'Escada', 'Circulação Vertical', 'vertical_circulation',
    'Escada principal de acesso ao Térreo.',
    '07:00 às 19:00', 13,
    ST_GeomFromText('POLYGON((-45.26897 -21.67102, -45.26885 -21.67102, -45.26885 -21.67095, -45.26897 -21.67095, -45.26897 -21.67102))', 4326)
),
(
    16, 2, 'WC-1', 'Sanitários 1º Andar', 'Banheiros Acessíveis / PNE', 'facility',
    'Sanitários públicos masculino, feminino e acessível (PNE).',
    '07:00 às 19:00', 14,
    ST_GeomFromText('POLYGON((-45.26921 -21.67102, -45.26909 -21.67102, -45.26909 -21.67095, -45.26921 -21.67095, -45.26921 -21.67102))', 4326)
)
ON CONFLICT (id) DO NOTHING;

-- 5. Arestas de Roteamento (Bidirecionais serão tratadas pelo algoritmo ou inseridas nos dois sentidos)
INSERT INTO routing_edges (from_node, to_node, distance, edge_type, is_accessible, instruction_hint)
VALUES
-- Ligações do Térreo
(1, 2, 22.0, 'corridor', TRUE,  'Siga pelo corredor principal a partir da Recepção'),
(2, 1, 22.0, 'corridor', TRUE,  'Siga pelo corredor em direção à Recepção'),

(2, 3, 10.0, 'door',     TRUE,  'Vire à direita para entrar na Sala 101 (Dívida Ativa)'),
(3, 2, 10.0, 'door',     TRUE,  'Saia da Sala 101 para o corredor principal'),

(2, 4, 10.0, 'door',     TRUE,  'Vire à esquerda para entrar na Sala 102 (ISS)'),
(4, 2, 10.0, 'door',     TRUE,  'Saia da Sala 102 para o corredor principal'),

(2, 5, 12.0, 'corridor', TRUE,  'Continue em frente pelo corredor central'),
(5, 2, 12.0, 'corridor', TRUE,  'Continue pelo corredor em direção à ala norte'),

(5, 6, 10.0, 'door',     TRUE,  'Vire à direita para entrar na Sala 103 (SEPLAN)'),
(6, 5, 10.0, 'door',     TRUE,  'Saia da Sala 103 para o corredor central'),

(5, 7, 10.0, 'door',     TRUE,  'Vire à esquerda para entrar na Sala 104 (Receita Federal / Protocolo)'),
(7, 5, 10.0, 'door',     TRUE,  'Saia da Sala 104 para o corredor central'),

(5, 8,  8.0, 'corridor', TRUE,  'Siga até o hall do elevador e escadas'),
(8, 5,  8.0, 'corridor', TRUE,  'Siga do hall do elevador para o corredor central'),

(8, 9,  4.0, 'corridor', TRUE,  'Vá até o elevador'),
(9, 8,  4.0, 'corridor', TRUE,  'Saia do elevador para o hall do Térreo'),

(8, 10, 12.0, 'corridor', TRUE, 'Dirija-se até a escada'),
(10, 8, 12.0, 'corridor', TRUE, 'Saia da escada para o hall do Térreo'),

(8, 11, 12.0, 'door',     TRUE, 'Entre nos Sanitários do Térreo'),
(11, 8, 12.0, 'door',     TRUE, 'Saia dos Sanitários para o hall do Térreo'),

-- Conexões Verticais (Térreo <-> 1º Andar)
(9,  12, 5.0, 'elevator', TRUE,  'Suba pelo elevador para o 1º Andar'),
(12, 9,  5.0, 'elevator', TRUE,  'Desça pelo elevador para o Térreo'),

(10, 13, 9.0, 'stairs',   FALSE, 'Suba pela escada para o 1º Andar'),
(13, 10, 9.0, 'stairs',   FALSE, 'Desça pela escada para o Térreo'),

-- Ligações do 1º Andar
(12, 15,  4.0, 'corridor', TRUE, 'Saia do elevador no 1º Andar e acesse o hall'),
(15, 12,  4.0, 'corridor', TRUE, 'Vá até o elevador do 1º Andar'),

(13, 15, 12.0, 'corridor', TRUE, 'Saia da escada no 1º Andar e acesse o hall'),
(15, 13, 12.0, 'corridor', TRUE, 'Dirija-se à escada do 1º Andar'),

(15, 14, 12.0, 'door',     TRUE, 'Entre nos Sanitários do 1º Andar'),
(14, 15, 12.0, 'door',     TRUE, 'Saia dos Sanitários para o hall do 1º Andar'),

(15, 16,  8.0, 'corridor', TRUE, 'Siga pelo corredor do 1º Andar'),
(16, 15,  8.0, 'corridor', TRUE, 'Siga até o hall do elevador do 1º Andar'),

(16, 17, 10.0, 'door',     TRUE, 'Vire à esquerda para entrar na Sala 203 (Recursos Humanos)'),
(17, 16, 10.0, 'door',     TRUE, 'Saia da Sala 203 para o corredor'),

(16, 18, 10.0, 'door',     TRUE, 'Vire à direita para entrar na Sala 204 (Licitações e Contratos)'),
(18, 16, 10.0, 'door',     TRUE, 'Saia da Sala 204 para o corredor'),

(16, 19, 12.0, 'corridor', TRUE, 'Continue pelo corredor principal do 1º Andar'),
(19, 16, 12.0, 'corridor', TRUE, 'Continue pelo corredor em direção ao sul'),

(19, 20, 10.0, 'door',     TRUE, 'Vire à esquerda para entrar na Sala 201 (Secretaria de Finanças)'),
(20, 19, 10.0, 'door',     TRUE, 'Saia da Sala 201 para o corredor'),

(19, 21, 10.0, 'door',     TRUE, 'Vire à direita para entrar na Sala 202 (Secretaria de Obras)'),
(21, 19, 10.0, 'door',     TRUE, 'Saia da Sala 202 para o corredor'),

(19, 22, 14.0, 'door',     TRUE, 'Siga em frente até a Secretaria Geral / Gabinete'),
(22, 19, 14.0, 'door',     TRUE, 'Saia da Secretaria Geral para o corredor principal');

-- Ajusta as sequences do PostgreSQL após inserção com IDs explícitos
SELECT setval('buildings_id_seq', (SELECT COALESCE(MAX(id), 1) FROM buildings));
SELECT setval('floors_id_seq', (SELECT COALESCE(MAX(id), 1) FROM floors));
SELECT setval('routing_nodes_id_seq', (SELECT COALESCE(MAX(id), 1) FROM routing_nodes));
SELECT setval('rooms_id_seq', (SELECT COALESCE(MAX(id), 1) FROM rooms));
SELECT setval('routing_edges_id_seq', (SELECT COALESCE(MAX(id), 1) FROM routing_edges));
