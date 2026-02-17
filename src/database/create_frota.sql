-- =============================================================================
-- Tabela: Frota
-- Descrição: Gerenciamento completo da frota de veículos
-- =============================================================================

CREATE TABLE IF NOT EXISTS frota (
  -- Identificação Principal (Obrigatórios)
  id INT AUTO_INCREMENT PRIMARY KEY,
  placa VARCHAR(10) NOT NULL UNIQUE COMMENT 'Placa do caminhão trator (ex: ABC-1234) - OBRIGATÓRIO',
  modelo VARCHAR(100) NOT NULL COMMENT 'Modelo completo do veículo incluindo marca (ex: Volvo FH 540) - OBRIGATÓRIO',
  tipo_veiculo ENUM('TRUCADO', 'TOCO', 'CARRETA', 'BITREM', 'RODOTREM') NOT NULL COMMENT 'Classificação do tipo de veículo - OBRIGATÓRIO',
  status ENUM('disponivel', 'em_viagem', 'manutencao') NOT NULL DEFAULT 'disponivel' COMMENT 'Status operacional do veículo - OBRIGATÓRIO',
  
  -- Regra de Reboque
  placa_carreta VARCHAR(10) UNIQUE COMMENT 'OBRIGATÓRIA se tipo_veiculo for CARRETA, BITREM ou RODOTREM',
  
  -- Status e Operação (Flexível)
  motorista_fixo_id INT COMMENT 'Vínculo numérico com motorista (pode ser nulo para veículo sem condutor fixo)',
  
  -- Especificações Técnicas (Agora Opcionais - NULL)
  ano_fabricacao INT COMMENT 'Ano de fabricação do veículo',
  capacidade_toneladas DECIMAL(10,2) COMMENT 'Capacidade de carga em toneladas',
  km_atual INT DEFAULT 0 COMMENT 'Quilometragem atual do veículo',
  tipo_combustivel ENUM('DIESEL', 'S10', 'ARLA', 'OUTRO') DEFAULT 'S10' COMMENT 'Tipo de combustível utilizado',
  
  -- Documentação e Fiscal (Opcionais - NULL)
  renavam VARCHAR(20) UNIQUE COMMENT 'RENAVAM do caminhão trator',
  renavam_carreta VARCHAR(20) UNIQUE COMMENT 'RENAVAM do reboque/carreta',
  chassi VARCHAR(30) UNIQUE COMMENT 'Número do chassi do veículo',
  registro_antt VARCHAR(20) COMMENT 'Registro na ANTT',
  validade_seguro DATE COMMENT 'Data de vencimento do seguro',
  validade_licenciamento DATE COMMENT 'Data de vencimento do licenciamento (CRLV)',
  
  -- Gestão e Manutenção (Opcionais - NULL)
  proprietario_tipo ENUM('PROPRIO', 'TERCEIRO', 'AGREGADO') DEFAULT 'PROPRIO' COMMENT 'Tipo de proprietário',
  ultima_manutencao_data DATE COMMENT 'Data da última manutenção realizada',
  proxima_manutencao_km INT COMMENT 'Quilometragem prevista para próxima revisão',
  
  -- Auditoria
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Data de criação do registro',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Data da última atualização',

  -- Relacionamentos
  FOREIGN KEY (motorista_fixo_id) REFERENCES motoristas(id) ON DELETE SET NULL,
  
  -- Índices para otimização
  INDEX idx_placa (placa),
  INDEX idx_status (status),
  INDEX idx_motorista_fixo (motorista_fixo_id),
  INDEX idx_tipo_veiculo (tipo_veiculo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Gestão de frota com campos opcionais e validação condicional de carreta';

-- =============================================================================
-- Dados de Exemplo
-- =============================================================================

INSERT INTO frota (
  id, placa, placa_carreta, modelo, ano_fabricacao, status, motorista_fixo_id,
  capacidade_toneladas, km_atual, tipo_combustivel, tipo_veiculo, renavam, renavam_carreta,
  chassi, registro_antt, validade_seguro, validade_licenciamento, proprietario_tipo,
  ultima_manutencao_data, proxima_manutencao_km
) VALUES
  (
    '1', 'ABC-1234', 'CRT-5678', 'Volvo FH 540', 2020, 'em_viagem', 'MOT-001',
    40.00, 245000, 'S10', 'CARRETA', '12345678901', '98765432109',
    '9BWHE21JX24060831', 'ANTT-2020-001', '2025-12-15', '2025-03-31', 'PROPRIO',
    '2025-01-15', 250000
  ),
  (
    '2', 'DEF-5678', 'BTR-9012', 'Scania R450', 2019, 'disponivel', 'MOT-002',
    35.00, 180000, 'DIESEL', 'BITREM', '23456789012', '87654321098',
    '9BSE4X2BXCR123456', 'ANTT-2019-002', '2025-11-20', '2025-02-28', 'TERCEIRO',
    '2025-01-10', 200000
  ),
  (
    '3', 'GHI-9012', NULL, 'Mercedes Actros', 2018, 'manutencao', NULL,
    38.00, 320000, 'S10', 'TRUCADO', '34567890123', NULL,
    'WDB9340231K123789', 'ANTT-2018-003', '2025-10-10', '2025-01-15', 'PROPRIO',
    '2025-01-25', 350000
  ),
  (
    '4', 'JKL-3456', 'DAF-7890', 'DAF XF', 2021, 'disponivel', 'MOT-003',
    42.00, 95000, 'S10', 'CARRETA', '45678901234', '76543210987',
    'XLRTE47MS0E654321', 'ANTT-2021-004', '2026-06-30', '2025-04-15', 'AGREGADO',
    '2025-01-05', 150000
  ),
  (
    '5', 'MNO-7890', 'RDT-1234', 'Volvo FH 500', 2020, 'em_viagem', 'MOT-004',
    40.00, 210000, 'DIESEL', 'RODOTREM', '56789012345', '65432109876',
    'YV2A22C60GA456789', 'ANTT-2020-005', '2025-08-18', '2025-05-22', 'PROPRIO',
    '2025-01-12', 240000
  )
ON DUPLICATE KEY UPDATE
  placa = VALUES(placa),
  modelo = VALUES(modelo),
  status = VALUES(status);
-- -- =============================================================================
-- Observações sobre a estrutura
-- =============================================================================
-- 1. Campos ENUM garantem valores padronizados e evitam inconsistências operacionais.
-- 2. Flexibilidade de Cadastro: Campos técnicos (RENAVAM, Chassi, Capacidade) permitem NULL, 
--    viabilizando o cadastro rápido de veículos com apenas dados básicos.
-- 3. Validação Condicional: A coluna placa_carreta deve ser exigida pelo sistema apenas 
--    quando o tipo_veiculo for 'CARRETA', 'BITREM' ou 'RODOTREM'.
-- 4. Relacionamento com motoristas permite rastrear o condutor fixo do veículo.
--    - ON DELETE SET NULL: Se um motorista for excluído, o veículo permanece no sistema, 
--      apenas perdendo o vínculo fixo.
-- 5. Índices Estratégicos: Otimizam buscas por placa, status operacional e tipo de veículo.
-- 6. UNIQUE em identificadores: Placas, RENAVAM e Chassi possuem restrição de unicidade 
--    para evitar duplicidade de ativos na frota.
-- 7. Campos de Auditoria: created_at e updated_at permitem rastrear a data de inserção 
--    e a última modificação do registro.

-- =============================================================================
-- Observações sobre a estrutura
-- =============================================================================
-- 1. Campos ENUM garantem valores padronizados e evitam inconsistências operacionais.
-- 2. Flexibilidade de Cadastro: Campos técnicos (RENAVAM, Chassi, Capacidade) permitem NULL,
--    viabilizando o cadastro rápido de veículos com apenas dados básicos.
-- 3. Validação Condicional: A coluna `placa_carreta` deve ser exigida pelo sistema apenas
--    quando o `tipo_veiculo` for 'CARRETA', 'BITREM' ou 'RODOTREM'.
-- 4. Relacionamento com `motoristas` permite rastrear o condutor fixo do veículo.
--    - `ON DELETE SET NULL`: Se um motorista for excluído, o veículo permanece no sistema,
--      apenas perdendo o vínculo fixo.
-- 5. Índices Estratégicos: Otimizam buscas por placa, status operacional e tipo de veículo.
-- 6. UNIQUE em identificadores: Placas, RENAVAM e Chassi possuem restrição de unicidade
--    para evitar duplicidade de ativos na frota.
-- 7. Campos de Auditoria: `created_at` e `updated_at` permitem rastrear a data de inserção
--    e a última modificação do registro.

-- =============================================================================
-- Queries de Exemplo - Relacionamento Frota x Motoristas
-- =============================================================================
-- Listar veículos, motoristas fixos e destacar quem precisa de placa de carreta
-- SELECT 
--     f.id, f.placa, f.modelo, f.tipo_veiculo,
--     CASE 
--         WHEN f.tipo_veiculo IN ('CARRETA', 'BITREM', 'RODOTREM') AND f.placa_carreta IS NULL 
--         THEN 'PENDENTE' ELSE f.placa_carreta 
--     END AS status_reboque,
--     m.nome AS motorista_fixo
-- FROM frota f
-- LEFT JOIN motoristas m ON f.motorista_fixo_id = m.id;

-- Buscar sugestões de "Placas Órfãs" (Motoristas terceiros com placa mas sem veículo na frota)
-- SELECT 
--     m.id AS motorista_id, 
--     m.nome AS motorista_nome, 
--     m.caminhao_atual
-- FROM motoristas m
-- WHERE m.caminhao_atual IS NOT NULL
-- AND m.caminhao_atual NOT IN (SELECT placa FROM frota)
-- ;

-- =============================================================================
-- Queries de Exemplo - Relacionamento Frota x Motoristas
-- =============================================================================

-- Listar veículos, motoristas fixos e destacar quem precisa de placa de carreta
SELECT 
    f.placa, 
    f.modelo, 
    f.tipo_veiculo,
    CASE 
        WHEN f.tipo_veiculo IN ('CARRETA', 'BITREM', 'RODOTREM') AND f.placa_carreta IS NULL 
        THEN 'PENDENTE' ELSE f.placa_carreta 
    END AS status_reboque,
    m.nome AS motorista_fixo
FROM frota f
LEFT JOIN motoristas m ON f.motorista_fixo_id = m.id;

-- Buscar sugestões de "Placas Órfãs" (Motoristas terceiros com placa mas sem veículo na frota)
-- Esta query ajuda a implementar a lógica de preenchimento automático que você solicitou.
SELECT 
    m.id AS motorista_id, 
    m.nome AS motorista_nome, 
  m.caminhao_atual
FROM motoristas m
WHERE m.caminhao_atual IS NOT NULL
AND m.caminhao_atual NOT IN (SELECT placa FROM frota)
;
