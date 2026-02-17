-- =============================================================================
-- Tabela: fretes
-- Descrição: Registro completo de fretes realizados
-- =============================================================================

CREATE TABLE IF NOT EXISTS fretes (
  -- Identificação Principal
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo_frete VARCHAR(20) UNIQUE NULL COMMENT 'ID de negócio (Ex: FRT-2026-001)',
  
  -- Origem e Destino
  origem VARCHAR(255) NOT NULL COMMENT 'Local de origem (fazenda)',
  destino VARCHAR(255) NOT NULL COMMENT 'Local de destino (secador, armazém)',
  
  -- Relacionamentos
  motorista_id INT NOT NULL COMMENT 'ID numérico do motorista (FK)',
  motorista_nome VARCHAR(200) NOT NULL COMMENT 'Nome do motorista (cache)',
  caminhao_id INT NOT NULL COMMENT 'ID numérico do caminhão (FK)',
  caminhao_placa VARCHAR(10) NOT NULL COMMENT 'Placa do caminhão (cache)',
  ticket VARCHAR(50) DEFAULT NULL COMMENT 'Ticket da balança (identificação numérica)',
  fazenda_id INT COMMENT 'ID numérico da fazenda origem (FK)',
  fazenda_nome VARCHAR(200) COMMENT 'Nome da fazenda (cache)',
  
  -- Mercadoria
  mercadoria VARCHAR(100) NOT NULL COMMENT 'Tipo de mercadoria transportada',
  variedade VARCHAR(100) COMMENT 'Variedade específica (ex: Verde, Vermelho, Runner)',
  
  -- Data e Quantidades
  data_frete DATE NOT NULL COMMENT 'Data de realização do frete',
  quantidade_sacas INT NOT NULL COMMENT 'Quantidade de sacas transportadas',
  toneladas DECIMAL(10,2) NOT NULL COMMENT 'Peso total em toneladas',
  
  -- Valores Financeiros
  valor_por_tonelada DECIMAL(10,2) NOT NULL COMMENT 'Valor cobrado por tonelada',
  receita DECIMAL(10,2) NOT NULL COMMENT 'Receita total do frete (toneladas × valor)',
  custos DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Total de custos do frete (soma dos custos registrados na tela de Custos)',
  resultado DECIMAL(10,2) COMMENT 'Lucro líquido do frete (receita - custos se houver)',
  
  -- Vínculo com Pagamento
  pagamento_id INT COMMENT 'ID numérico do pagamento que incluiu este frete (NULL = não pago ainda)',
  
  -- Auditoria
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Data de criação do registro',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Data da última atualização',
  
  -- Foreign Keys
  FOREIGN KEY (motorista_id) REFERENCES motoristas(id) ON DELETE RESTRICT,
  FOREIGN KEY (caminhao_id) REFERENCES frota(id) ON DELETE RESTRICT,
  FOREIGN KEY (fazenda_id) REFERENCES fazendas(id) ON DELETE RESTRICT,
  FOREIGN KEY (pagamento_id) REFERENCES pagamentos(id) ON DELETE SET NULL,
  
  -- Índices para otimização
  INDEX idx_data_frete (data_frete),
  INDEX idx_pagamento (pagamento_id),
  INDEX idx_motorista (motorista_id),
  INDEX idx_caminhao (caminhao_id),
  INDEX idx_ticket (ticket),
  INDEX idx_fazenda (fazenda_id),
  INDEX idx_origem (origem),
  INDEX idx_destino (destino)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Registro completo de fretes realizados';

-- =============================================================================
-- Dados de Exemplo
-- =============================================================================

INSERT INTO fretes (
  id, origem, destino, motorista_id, motorista_nome, caminhao_id, caminhao_placa,
  ticket,
  fazenda_id, fazenda_nome, mercadoria, mercadoria_id, variedade,
  data_frete, quantidade_sacas, toneladas, valor_por_tonelada,
  receita, custos, resultado, pagamento_id
) VALUES
  (
    'FRETE-2026-001', 'Fazenda Santa Esperança', 'Secador Central - Filial 1',
    'MOT-001', 'Carlos Silva', '1', 'ABC-1234',
    NULL,
    '1', 'Fazenda Santa Esperança', 'Amendoim em Casca', '1', 'Verde',
    '2026-01-20', 450, 11.25, 600.00,
    6750.00, 1720.00, 5030.00, NULL
  ),
  (
    'FRETE-2026-002', 'Fazenda Boa Vista', 'Secador Central - Filial 2',
    'MOT-002', 'João Oliveira', '2', 'DEF-5678',
    NULL,
    '2', 'Fazenda Boa Vista', 'Amendoim em Casca', '2', 'Vermelho',
    '2026-01-18', 380, 9.5, 720.00,
    6840.00, 1690.00, 5150.00, NULL
  ),
  (
    'FRETE-2026-003', 'Fazenda São João', 'Secador Central - Filial 1',
    'MOT-003', 'Pedro Santos', '3', 'GHI-9012',
    NULL,
    '3', 'Fazenda São João', 'Amendoim Premium', '3', 'Selecionado',
    '2026-01-15', 500, 12.5, 600.00,
    7500.00, 0.00, 7500.00, NULL
  ),
  (
    'FRETE-2026-004', 'Fazenda Vale Verde', 'Secador Central - Filial 3',
    'MOT-004', 'André Costa', '4', 'JKL-3456',
    NULL,
    '4', 'Fazenda Vale Verde', 'Amendoim Descascado', '4', 'Tipo 1',
    '2026-01-12', 300, 7.5, 1000.00,
    7500.00, 1720.00, 5780.00, NULL
  ),
  (
    'FRETE-2026-005', 'Fazenda Recanto', 'Secador Central - Filial 1',
    'MOT-005', 'Lucas Ferreira', '5', 'MNO-7890',
    NULL,
    '5', 'Fazenda Recanto', 'Amendoim em Casca', '1', 'Runner',
    '2026-01-10', 420, 10.5, 640.00,
    6720.00, 1580.00, 5140.00, NULL
  )
ON DUPLICATE KEY UPDATE
  custos = VALUES(custos),
  resultado = VALUES(resultado);

-- =============================================================================
-- Observações sobre a estrutura
-- =============================================================================
-- 1. `id` é numérico AUTO_INCREMENT e `codigo_frete` guarda o identificador de negócio (ex: FRT-2026-001).
-- 2. Foreign Keys para `motoristas`, `frota` e `fazendas` com RESTRICT — não permite excluir
--    motorista/caminhão/fazenda se houver fretes vinculados.
-- 3. Campos cache (`motorista_nome`, `caminhao_placa`, `fazenda_nome`) evitam JOINs desnecessários.
-- 4. `toneladas` normalmente calculado: `quantidade_sacas × peso_medio_saca / 1000` (padrão do setor).
-- 5. `receita` calculado: toneladas × valor_por_tonelada; `resultado` = receita - custos.
-- 6. `custos` pode ser atualizado pelo backend com a soma da tabela `custos` vinculada por `frete_id`.
-- 7. `pagamento_id` vincula o frete a um pagamento (NULL = não pago ainda).
-- 8. `ticket` é o identificador da balança (VARCHAR para preservar zeros e formatos variados).
-- 9. `variedade` é opcional para detalhamento de mercadoria.
-- 10. Índices criados para acelerar buscas por data, motorista, caminhão, fazenda e ticket.

-- =============================================================================
-- Queries de Exemplo
-- =============================================================================
-- Listar fretes não pagos
-- SELECT id, codigo_frete, origem, destino, motorista_nome, toneladas, receita
-- FROM fretes
-- WHERE pagamento_id IS NULL
-- ORDER BY data_frete ASC;

-- Trigger sugerido: recalcular `custos` e `resultado` após inserção de custos
-- DELIMITER $$
-- CREATE TRIGGER trg_atualiza_resultado_frete
-- BEFORE INSERT ON custos
-- FOR EACH ROW
-- BEGIN
--   UPDATE fretes
----   SET custos = COALESCE((SELECT SUM(valor) FROM custos WHERE frete_id = NEW.frete_id), 0),
--   SET resultado = receita - custos
--   WHERE id = NEW.frete_id;
-- END$$
-- DELIMITER ;

-- =============================================================================
-- Queries de Exemplo
-- =============================================================================

-- Listar todos os fretes
-- SELECT id, origem, destino, motorista_nome, caminhao_placa,
--        quantidade_sacas, toneladas, FORMAT(receita, 2, 'pt_BR') as receita,
--        FORMAT(custos, 2, 'pt_BR') as custos, FORMAT(resultado, 2, 'pt_BR') as resultado,
--        data_frete, 
--        CASE WHEN pagamento_id IS NULL THEN 'Não Pago' ELSE 'Pago' END as situacao_pagamento
-- FROM fretes
-- ORDER BY data_frete DESC;

-- Listar apenas fretes não pagos (aguardando pagamento semanal)
-- SELECT id, origem, destino, motorista_nome,
--        data_frete, toneladas,
--        FORMAT(resultado, 2, 'pt_BR') as valor_a_pagar,
--        DATEDIFF(NOW(), data_frete) as dias_desde_frete
-- FROM fretes
-- WHERE pagamento_id IS NULL
-- ORDER BY motorista_nome, data_frete ASC;

-- Fretes por motorista
-- SELECT motorista_nome,
--        COUNT(*) as total_fretes,
--        SUM(toneladas) as total_toneladas,
--        SUM(receita) as total_receita
-- FROM fretes
-- GROUP BY motorista_id, motorista_nome
-- ORDER BY total_receita DESC;

-- Fretes por caminhão
-- SELECT caminhao_placa,
--        COUNT(*) as total_fretes,
--        SUM(toneladas) as total_toneladas,
--        SUM(resultado) as resultado_liquido
-- FROM fretes
-- GROUP BY caminhao_id, caminhao_placa
-- ORDER BY total_fretes DESC;

-- Fretes por fazenda
-- SELECT fazenda_nome,
--        COUNT(*) as total_fretes,
--        SUM(quantidade_sacas) as total_sacas,
--        SUM(toneladas) as total_toneladas,
--        SUM(receita) as total_faturamento
-- FROM fretes
-- WHERE fazenda_id IS NOT NULL
-- GROUP BY fazenda_id, fazenda_nome
-- ORDER BY total_toneladas DESC;

-- Total por período
-- SELECT DATE_FORMAT(data_frete, '%Y-%m') as mes_ano,
--        COUNT(*) as total_fretes,
--        SUM(toneladas) as total_toneladas,
--        SUM(receita) as receita_total,
--        SUM(custos) as custos_totais,
--        SUM(resultado) as resultado_liquido
-- FROM fretes
-- GROUP BY mes_ano
-- ORDER BY mes_ano DESC;

-- Fretes mais lucrativos
-- SELECT id, origem, destino, motorista_nome,
--        FORMAT(receita, 2, 'pt_BR') as receita,
--        FORMAT(custos, 2, 'pt_BR') as custos,
--        FORMAT(resultado, 2, 'pt_BR') as resultado,
--        data_frete
-- FROM fretes
-- ORDER BY resultado DESC
-- LIMIT 10;

-- Fretes com prejuízo
-- SELECT id, origem, destino, motorista_nome,
--        FORMAT(receita, 2, 'pt_BR') as receita,
--        FORMAT(custos, 2, 'pt_BR') as custos,
--        FORMAT(resultado, 2, 'pt_BR') as resultado
-- FROM fretes
-- WHERE resultado < 0
-- ORDER BY resultado ASC;

-- Atualizar custos de um frete (normalmente feito por trigger/backend)
-- UPDATE fretes
-- SET custos = (SELECT SUM(valor) FROM custos WHERE frete_id = 'FRETE-2026-001'),
--     resultado = receita - custos
-- WHERE id = 'FRETE-2026-001';

-- Buscar fretes não pagos de um motorista específico (para criar pagamento)
-- SELECT id, origem, destino, data_frete,
--        quantidade_sacas, toneladas,
--        FORMAT(receita, 2, 'pt_BR') as receita,
--        FORMAT(custos, 2, 'pt_BR') as custos,
--        FORMAT(resultado, 2, 'pt_BR') as resultado
-- FROM fretes
-- WHERE motorista_id = 'MOT-001' 
--   AND pagamento_id IS NULL
-- ORDER BY data_frete ASC;

-- Total a pagar para um motorista (fretes não pagos)
-- SELECT motorista_nome,
--        COUNT(*) as total_fretes_pendentes,
--        SUM(toneladas) as total_toneladas,
--        SUM(receita) as total_receita,
--        SUM(custos) as total_custos,
--        SUM(resultado) as total_a_pagar
-- FROM fretes
-- WHERE motorista_id = 'MOT-001'
--   AND pagamento_id IS NULL
-- GROUP BY motorista_id, motorista_nome;

-- Buscar fretes por mercadoria
-- SELECT id, origem, destino, mercadoria, variedade,
--        quantidade_sacas, toneladas, FORMAT(receita, 2, 'pt_BR') as receita
-- FROM fretes
-- WHERE mercadoria LIKE '%Amendoim%'
-- ORDER BY data_frete DESC;

-- Média de receita por tonelada
-- SELECT mercadoria,
--        AVG(valor_por_tonelada) as media_valor_tonelada,
--        MIN(valor_por_tonelada) as min_valor,
--        MAX(valor_por_tonelada) as max_valor
-- FROM fretes
-- GROUP BY mercadoria;

-- =============================================================================
-- Triggers para Manutenção Automática
-- =============================================================================

-- Trigger para calcular resultado automaticamente
-- DELIMITER $$
-- CREATE TRIGGER trg_calcula_resultado_frete
-- BEFORE INSERT ON fretes
-- FOR EACH ROW
-- BEGIN
--   SET NEW.resultado = NEW.receita - NEW.custos;
-- END$$
-- CREATE TRIGGER trg_calcula_resultado_frete_update
-- BEFORE UPDATE ON fretes
-- FOR EACH ROW
-- BEGIN
--   SET NEW.resultado = NEW.receita - NEW.custos;
-- END$$
-- DELIMITER ;

-- Trigger para vincular fretes ao pagamento quando pagamento é criado
-- NOTA: Este trigger seria criado na tabela pagamentos, não aqui
-- Incluído aqui apenas para documentação do fluxo
-- 
-- AFTER INSERT ON pagamentos
-- FOR EACH ROW
-- BEGIN
--   -- Atualizar todos os fretes incluídos neste pagamento
--   UPDATE fretes
--   SET pagamento_id = NEW.id
--   WHERE FIND_IN_SET(id, REPLACE(NEW.fretes_incluidos, ',', ','));
-- END

-- Trigger para atualizar totais da fazenda quando frete é registrado
-- DELIMITER $$
-- CREATE TRIGGER trg_atualiza_fazenda_frete
-- AFTER INSERT ON fretes
-- FOR EACH ROW
-- BEGIN
--   IF NEW.fazenda_id IS NOT NULL THEN
--     UPDATE fazendas
--     SET total_sacas_carregadas = total_sacas_carregadas + NEW.quantidade_sacas,
--         total_toneladas = total_toneladas + NEW.toneladas,
--         faturamento_total = faturamento_total + NEW.receita,
--         ultimo_frete = NEW.data_frete
--     WHERE id = NEW.fazenda_id;
--   END IF;
-- END$$
-- DELIMITER ;

-- Trigger para atualizar métricas do motorista quando frete é registrado
-- DELIMITER $$
-- CREATE TRIGGER trg_atualiza_motorista_frete
-- AFTER INSERT ON fretes
-- FOR EACH ROW
-- BEGIN
--   UPDATE motoristas
--   SET viagens_realizadas = viagens_realizadas + 1,
--       receita_gerada = receita_gerada + NEW.receita
--   WHERE id = NEW.motorista_id;
-- END$$
-- DELIMITER ;

-- =============================================================================
-- Views Úteis
-- =============================================================================

-- View: Resumo completo de fretes com custos detalhados
-- CREATE OR REPLACE VIEW vw_fretes_completo AS
-- SELECT 
--   f.id, f.origem, f.destino, f.data_frete,
--   f.motorista_nome, f.caminhao_placa, f.fazenda_nome,
--   f.mercadoria, f.variedade,
--   f.quantidade_sacas, f.toneladas,
--   f.valor_por_tonelada, f.receita, f.custos, f.resultado,
--   COUNT(c.id) as total_custos_registrados,
--   SUM(CASE WHEN c.tipo = 'combustivel' THEN c.valor ELSE 0 END) as custo_combustivel,
--   SUM(CASE WHEN c.tipo = 'pedagio' THEN c.valor ELSE 0 END) as custo_pedagio,
--   SUM(CASE WHEN c.tipo = 'manutencao' THEN c.valor ELSE 0 END) as custo_manutencao,
--   SUM(CASE WHEN c.tipo = 'outros' THEN c.valor ELSE 0 END) as custo_outros
-- FROM fretes f
-- LEFT JOIN custos c ON f.id = c.frete_id
-- GROUP BY f.id;

-- View: Performance por motorista
-- CREATE OR REPLACE VIEW vw_performance_motoristas AS
-- SELECT 
--   m.id, m.nome, m.tipo,
--   COUNT(f.id) as total_fretes,
--   SUM(f.toneladas) as total_toneladas,
--   SUM(f.receita) as receita_total,
--   SUM(f.custos) as custos_totais,
--   SUM(f.resultado) as resultado_liquido,
--   AVG(f.resultado) as media_resultado_frete
-- FROM motoristas m
-- LEFT JOIN fretes f ON m.id = f.motorista_id
-- GROUP BY m.id, m.nome, m.tipo;

-- =============================================================================
-- Relatórios e Análises
-- =============================================================================

-- Análise de rentabilidade por rota
-- SELECT CONCAT(origem, ' → ', destino) as rota,
--        COUNT(*) as total_fretes,
--        AVG(resultado) as resultado_medio,
--        SUM(resultado) as resultado_total
-- FROM fretes
-- GROUP BY origem, destino
-- ORDER BY resultado_total DESC;

-- Eficiência operacional (resultado por tonelada)
-- SELECT id, origem, destino, motorista_nome,
--        toneladas,
--        ROUND(resultado / toneladas, 2) as resultado_por_tonelada
-- FROM fretes
-- WHERE toneladas > 0
-- ORDER BY resultado_por_tonelada DESC;

-- =============================================================================
-- Manutenção
-- =============================================================================

-- Recalcular custos e resultado de um frete
-- UPDATE fretes f
-- SET f.custos = COALESCE((SELECT SUM(valor) FROM custos WHERE frete_id = f.id), 0),
--     f.resultado = f.receita - f.custos
-- WHERE f.id = 'FRETE-2026-001';

-- Recalcular todos os fretes
-- UPDATE fretes f
-- SET f.custos = COALESCE((SELECT SUM(valor) FROM custos c WHERE c.frete_id = f.id), 0),
--     f.resultado = f.receita - f.custos;
