-- =============================================================================
-- Tabela: custos
-- Descrição: Registro de custos operacionais dos fretes
-- =============================================================================

CREATE TABLE IF NOT EXISTS custos (
  -- Identificação Principal
  id INT AUTO_INCREMENT PRIMARY KEY,
  frete_id INT NOT NULL COMMENT 'ID numérico do frete relacionado',
  
  -- Tipo e Descrição
  tipo ENUM('combustivel', 'manutencao', 'pedagio', 'outros') NOT NULL COMMENT 'Tipo de custo',
  descricao VARCHAR(255) NOT NULL COMMENT 'Descrição detalhada do custo',
  
  -- Valores
  valor DECIMAL(10,2) NOT NULL COMMENT 'Valor do custo em reais',
  data DATE NOT NULL COMMENT 'Data em que o custo foi realizado',
  
  -- Comprovação
  comprovante BOOLEAN DEFAULT FALSE COMMENT 'Indica se possui comprovante fiscal',
  observacoes TEXT COMMENT 'Observações adicionais sobre o custo',
  
  -- Relacionamentos (informativo)
  motorista VARCHAR(200) COMMENT 'Nome do motorista (referência)',
  caminhao VARCHAR(10) COMMENT 'Placa do caminhão (referência)',
  rota VARCHAR(255) COMMENT 'Rota do frete (origem → destino)',
  
  -- Campos Específicos de Combustível
  litros DECIMAL(10,2) COMMENT 'Quantidade de litros abastecidos',
  tipo_combustivel ENUM('gasolina', 'diesel', 'etanol', 'gnv') COMMENT 'Tipo de combustível',
  
  -- Auditoria
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Data de criação do registro',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Data da última atualização',
  
  -- Índices para otimização
  INDEX idx_frete_id (frete_id),
  INDEX idx_tipo (tipo),
  INDEX idx_data (data),
  INDEX idx_motorista (motorista),
  INDEX idx_caminhao (caminhao),
  INDEX idx_comprovante (comprovante)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Registro de custos operacionais dos fretes';

-- =============================================================================
-- Dados de Exemplo
-- =============================================================================

INSERT INTO custos (
  id, frete_id, tipo, descricao, valor, data, comprovante,
  motorista, caminhao, rota, observacoes, litros, tipo_combustivel
) VALUES
  (
    '1', 'FRETE-2026-001', 'combustivel', 'Abastecimento completo',
    2500.00, '2025-01-20', TRUE,
    'Carlos Silva', 'ABC-1234', 'São Paulo → Rio de Janeiro',
    'Posto Shell - Rodovia Presidente Dutra KM 180', 450.00, 'diesel'
  ),
  (
    '2', 'FRETE-2026-001', 'pedagio', 'Via Dutra - trecho completo',
    850.00, '2025-01-20', TRUE,
    'Carlos Silva', 'ABC-1234', 'São Paulo → Rio de Janeiro',
    '9 praças de pedágio no trajeto', NULL, NULL
  ),
  (
    '3', 'FRETE-2026-002', 'manutencao', 'Troca de pneus dianteiros',
    3200.00, '2025-01-18', TRUE,
    'João Oliveira', 'XYZ-5678', 'Curitiba → Florianópolis',
    'Borracharia São José - 2 pneus Pirelli novos', NULL, NULL
  ),
  (
    '4', 'FRETE-2026-002', 'combustivel', 'Abastecimento parcial',
    1800.00, '2025-01-17', FALSE,
    'João Oliveira', 'XYZ-5678', 'Curitiba → Florianópolis',
    NULL, 320.00, 'diesel'
  ),
  (
    '5', 'FRETE-2026-004', 'outros', 'Estacionamento',
    150.00, '2025-01-15', TRUE,
    'André Costa', 'DEF-9012', 'São Paulo → Rio de Janeiro',
    'Estacionamento durante pernoite - 24h', NULL, NULL
  )
ON DUPLICATE KEY UPDATE
  valor = VALUES(valor),
  comprovante = VALUES(comprovante);

-- =============================================================================
-- Observações sobre a estrutura
-- =============================================================================
-- 1. `id` é numérico AUTO_INCREMENT; `frete_id` é numérico e referencia `fretes.id`.
-- 2. `tipo` enum limita às categorias suportadas: 'combustivel', 'manutencao', 'pedagio', 'outros'.
-- 3. Campos de combustível (`litros`, `tipo_combustivel`) são opcionais, usados apenas quando aplicável.
-- 4. `comprovante` indica se existe documentação fiscal anexada.
-- 5. Campos `motorista`, `caminhao`, `rota` são informativos e facilitam relatórios sem JOINs.
-- 6. Recomenda-se criar trigger/backend para recalcular `fretes.custos` quando novos custos forem inseridos.

-- =============================================================================
-- Queries de Exemplo
-- =============================================================================
-- Listar todos os custos de um frete específico
-- SELECT id, tipo, descricao, FORMAT(valor, 2, 'pt_BR') as valor, data, comprovante
-- FROM custos
-- WHERE frete_id = 1
-- ORDER BY data DESC;

-- Total de custos por frete
-- SELECT frete_id, COUNT(*) as total_lancamentos, SUM(valor) as total_custos
-- FROM custos
-- GROUP BY frete_id
-- ORDER BY total_custos DESC;

-- =============================================================================
-- Queries de Exemplo
-- =============================================================================

-- Listar todos os custos de um frete específico
-- SELECT id, tipo, descricao, FORMAT(valor, 2, 'pt_BR') as valor, 
--        data, comprovante
-- FROM custos
-- WHERE frete_id = 'FRETE-2026-001'
-- ORDER BY data DESC;

-- Total de custos por frete
-- SELECT frete_id, 
--        COUNT(*) as total_lancamentos,
--        SUM(valor) as total_custos,
--        AVG(valor) as media_custo
-- FROM custos
-- GROUP BY frete_id
-- ORDER BY total_custos DESC;

-- Custos por tipo
-- SELECT tipo, 
--        COUNT(*) as quantidade,
--        SUM(valor) as total,
--        AVG(valor) as media
-- FROM custos
-- WHERE data >= '2025-01-01'
-- GROUP BY tipo
-- ORDER BY total DESC;

-- Custos de combustível detalhados
-- SELECT id, frete_id, descricao, valor, litros, tipo_combustivel,
--        ROUND(valor / litros, 2) as preco_por_litro,
--        data, caminhao
-- FROM custos
-- WHERE tipo = 'combustivel' AND litros IS NOT NULL
-- ORDER BY data DESC;

-- Custos sem comprovante (pendentes)
-- SELECT id, frete_id, tipo, descricao, valor, data, motorista
-- FROM custos
-- WHERE comprovante = FALSE
-- ORDER BY data DESC;

-- Total de custos por motorista
-- SELECT motorista,
--        COUNT(*) as total_custos,
--        SUM(valor) as valor_total,
--        AVG(valor) as media
-- FROM custos
-- WHERE motorista IS NOT NULL
-- GROUP BY motorista
-- ORDER BY valor_total DESC;

-- Custos por caminhão
-- SELECT caminhao,
--        COUNT(*) as total_custos,
--        SUM(valor) as valor_total
-- FROM custos
-- WHERE caminhao IS NOT NULL
-- GROUP BY caminhao
-- ORDER BY valor_total DESC;

-- Custos por período
-- SELECT DATE_FORMAT(data, '%Y-%m') as mes_ano,
--        tipo,
--        SUM(valor) as total
-- FROM custos
-- WHERE data >= '2025-01-01'
-- GROUP BY mes_ano, tipo
-- ORDER BY mes_ano DESC, tipo;

-- Análise de preço médio de combustível
-- SELECT tipo_combustivel,
--        AVG(valor / litros) as preco_medio_litro,
--        MIN(valor / litros) as preco_min,
--        MAX(valor / litros) as preco_max,
--        COUNT(*) as abastecimentos
-- FROM custos
-- WHERE tipo = 'combustivel' AND litros > 0
-- GROUP BY tipo_combustivel;

-- Custos acima de um valor específico
-- SELECT id, frete_id, tipo, descricao, valor, data, comprovante
-- FROM custos
-- WHERE valor > 1000.00
-- ORDER BY valor DESC;

-- Atualizar status de comprovante
-- UPDATE custos
-- SET comprovante = TRUE,
--     observacoes = 'Nota fiscal anexada'
-- WHERE id = '4';

-- Adicionar observação a um custo
-- UPDATE custos
-- SET observacoes = 'Manutenção preventiva programada'
-- WHERE id = '3';

-- Corrigir valor de um custo
-- UPDATE custos
-- SET valor = 1850.00,
--     updated_at = CURRENT_TIMESTAMP
-- WHERE id = '4';

-- =============================================================================
-- Views Úteis
-- =============================================================================

-- View: Resumo de custos por frete
-- CREATE OR REPLACE VIEW vw_custos_por_frete AS
-- SELECT 
--   frete_id,
--   SUM(CASE WHEN tipo = 'combustivel' THEN valor ELSE 0 END) as combustivel,
--   SUM(CASE WHEN tipo = 'manutencao' THEN valor ELSE 0 END) as manutencao,
--   SUM(CASE WHEN tipo = 'pedagio' THEN valor ELSE 0 END) as pedagio,
--   SUM(CASE WHEN tipo = 'outros' THEN valor ELSE 0 END) as outros,
--   SUM(valor) as total_custos,
--   COUNT(*) as total_lancamentos
-- FROM custos
-- GROUP BY frete_id;

-- View: Custos pendentes de comprovante
-- CREATE OR REPLACE VIEW vw_custos_pendentes AS
-- SELECT 
--   id, frete_id, tipo, descricao, valor, data,
--   motorista, caminhao, rota,
--   DATEDIFF(CURDATE(), data) as dias_pendente
-- FROM custos
-- WHERE comprovante = FALSE
-- ORDER BY data ASC;

-- =============================================================================
-- Triggers Sugeridos (Implementar no backend)
-- =============================================================================

-- Trigger para validar valor positivo
-- DELIMITER $$
-- CREATE TRIGGER trg_valida_valor_custo
-- BEFORE INSERT ON custos
-- FOR EACH ROW
-- BEGIN
--   IF NEW.valor <= 0 THEN
--     SIGNAL SQLSTATE '45000'
--     SET MESSAGE_TEXT = 'Valor do custo deve ser maior que zero';
--   END IF;
-- END$$
-- DELIMITER ;

-- Trigger para validar litros quando tipo é combustível
-- DELIMITER $$
-- CREATE TRIGGER trg_valida_combustivel
-- BEFORE INSERT ON custos
-- FOR EACH ROW
-- BEGIN
--   IF NEW.tipo = 'combustivel' AND NEW.litros IS NOT NULL THEN
--     IF NEW.litros <= 0 THEN
--       SIGNAL SQLSTATE '45000'
--       SET MESSAGE_TEXT = 'Quantidade de litros deve ser maior que zero';
--     END IF;
--     IF NEW.tipo_combustivel IS NULL THEN
--       SIGNAL SQLSTATE '45000'
--       SET MESSAGE_TEXT = 'Tipo de combustível é obrigatório quando litros é informado';
--     END IF;
--   END IF;
-- END$$
-- DELIMITER ;

-- =============================================================================
-- Integrações Futuras
-- =============================================================================

-- Relacionamento com Fretes (implementar quando criar tabela fretes)
-- ALTER TABLE custos ADD CONSTRAINT fk_custos_frete
--   FOREIGN KEY (frete_id) REFERENCES fretes(id) ON DELETE CASCADE;

-- Nota: Ao excluir um frete, todos os custos relacionados serão excluídos (CASCADE)

-- =============================================================================
-- Relatórios e Análises
-- =============================================================================

-- Relatório de custos mensais por categoria
-- SELECT 
--   DATE_FORMAT(data, '%Y-%m') as mes,
--   tipo,
--   COUNT(*) as quantidade,
--   SUM(valor) as total,
--   AVG(valor) as media
-- FROM custos
-- WHERE data >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
-- GROUP BY mes, tipo
-- ORDER BY mes DESC, total DESC;

-- Eficiência de combustível (km/litro) - quando integrado com fretes
-- SELECT 
--   c.caminhao,
--   SUM(c.litros) as total_litros,
--   SUM(f.distancia_km) as total_km,
--   ROUND(SUM(f.distancia_km) / SUM(c.litros), 2) as km_por_litro
-- FROM custos c
-- INNER JOIN fretes f ON c.frete_id = f.id
-- WHERE c.tipo = 'combustivel' AND c.litros > 0
-- GROUP BY c.caminhao
-- ORDER BY km_por_litro DESC;

-- =============================================================================
-- Manutenção
-- =============================================================================

-- Limpar custos de um frete cancelado
-- DELETE FROM custos WHERE frete_id = 'FRETE-XXXX';

-- Resetar flag de comprovante
-- UPDATE custos SET comprovante = FALSE WHERE id = 'XXX';

-- Adicionar comprovante em lote para um frete
-- UPDATE custos 
-- SET comprovante = TRUE 
-- WHERE frete_id = 'FRETE-2026-001';
