-- =============================================================================
-- MIGRATION: Garantir coluna codigo_fazenda e backfill de dados legados
-- =============================================================================

ALTER TABLE fazendas
ADD COLUMN IF NOT EXISTS codigo_fazenda VARCHAR(20) UNIQUE NULL COMMENT 'ID de negócio (Ex: FAZ-2026-001)' AFTER id;

UPDATE fazendas
SET codigo_fazenda = CONCAT('FAZ-', YEAR(COALESCE(created_at, NOW())), '-', LPAD(id, 3, '0'))
WHERE codigo_fazenda IS NULL OR codigo_fazenda = '';

-- Diagnóstico rápido
SELECT id, codigo_fazenda, fazenda, created_at
FROM fazendas
ORDER BY id DESC
LIMIT 50;
