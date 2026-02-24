-- Migration: Recalculate fazendas totals from fretes
-- Run this once to fix inconsistent totals

UPDATE fazendas f
SET f.total_toneladas = (
    SELECT COALESCE(SUM(fr.toneladas), 0)
    FROM fretes fr
    WHERE fr.fazenda_id = f.id
),
f.total_sacas_carregadas = (
    SELECT COALESCE(SUM(fr.quantidade_sacas), 0)
    FROM fretes fr
    WHERE fr.fazenda_id = f.id
),
f.faturamento_total = (
    SELECT COALESCE(SUM(fr.receita), 0)
    FROM fretes fr
    WHERE fr.fazenda_id = f.id
);
