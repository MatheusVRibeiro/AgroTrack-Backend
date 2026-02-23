import { Response } from 'express';
import pool from '../database/connection';
import { ApiResponse, AuthRequest } from '../types';
import { getCache, setCache } from '../utils/cache';

const CACHE_TTL_SECONDS = Number(process.env.REDIS_TTL || 60);

export class DashboardController {
  async obterKPIs(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const cacheKey = 'dashboard:kpis';
      const cached = await getCache<Record<string, number>>(cacheKey);
      if (cached) {
        res.json({
          success: true,
          message: 'KPIs carregados com sucesso (cache)',
          data: cached,
        } as ApiResponse<Record<string, number>>);
        return;
      }

      const [freteRows] = await pool.execute(
        `SELECT 
          COALESCE(SUM(receita), 0) AS receita_total,
          COALESCE(SUM(custos), 0) AS custos_total,
          COALESCE(SUM(receita - custos), 0) AS lucro_total,
          COUNT(*) AS total_fretes
        FROM fretes`
      );
      const frete = (freteRows as any[])[0];

      const [motoristaStats] = await pool.execute(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'ativo' THEN 1 ELSE 0 END) as ativos,
          SUM(CASE WHEN status = 'ativo' AND (cnh_validade IS NULL OR cnh_validade >= CURDATE()) THEN 1 ELSE 0 END) as regulares
        FROM motoristas`
      );
      const mStats = (motoristaStats as any[])[0];

      const [frotaStats] = await pool.execute(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'disponivel' THEN 1 ELSE 0 END) as disponiveis,
          SUM(CASE WHEN (validade_licenciamento IS NULL OR validade_licenciamento >= CURDATE()) 
                    AND (validade_seguro IS NULL OR validade_seguro >= CURDATE()) THEN 1 ELSE 0 END) as regulares
        FROM frota`
      );
      const fStats = (frotaStats as any[])[0];

      const [pagamentoStats] = await pool.execute(
        `SELECT 
          COALESCE(SUM(CASE WHEN status = 'pago' THEN valor_total ELSE 0 END), 0) as pago,
          COALESCE(SUM(CASE WHEN status = 'pendente' THEN valor_total ELSE 0 END), 0) as pendente
        FROM pagamentos`
      );
      const pStats = (pagamentoStats as any[])[0];

      const [fazendaStats] = await pool.execute(
        `SELECT 
          COALESCE(SUM(total_toneladas), 0) as volume_real,
          COUNT(*) as total_fazendas
        FROM fazendas`
      );
      const fazStats = (fazendaStats as any[])[0];

      // Saúde Normativa: Média entre regularidade de motoristas ativos e frota total
      const saudeMotoristas = mStats.ativos > 0 ? (mStats.regulares / mStats.ativos) * 100 : 100;
      const saudeFrota = fStats.total > 0 ? (fStats.regulares / fStats.total) * 100 : 100;
      const saudeNormativa = Number(((saudeMotoristas + saudeFrota) / 2).toFixed(2));

      const margemLucro = frete.receita_total > 0
        ? Number(((frete.lucro_total / frete.receita_total) * 100).toFixed(2))
        : 0;

      const data = {
        receitaTotal: Number(frete.receita_total),
        custosTotal: Number(frete.custos_total),
        lucroTotal: Number(frete.lucro_total),
        margemLucro,
        totalFretes: Number(frete.total_fretes),
        motoristasAtivos: Number(mStats.ativos),
        caminhoesDisponiveis: Number(fStats.disponiveis),
        saudeNormativa,
        pagamentosPendentes: Number(pStats.pendente),
        pagamentosPagos: Number(pStats.pago),
        volumeColheitaTotal: Number(fazStats.volume_real),
      };

      await setCache(cacheKey, data, CACHE_TTL_SECONDS);

      res.json({
        success: true,
        message: 'KPIs carregados com sucesso',
        data,
      } as ApiResponse<Record<string, number>>);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao carregar KPIs',
      } as ApiResponse<null>);
    }
  }

  async obterEstatisticasPorRota(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const cacheKey = 'dashboard:estatisticas-rotas';
      const cached = await getCache<unknown[]>(cacheKey);
      if (cached) {
        res.json({
          success: true,
          message: 'Estatisticas por rota carregadas com sucesso (cache)',
          data: cached,
        } as ApiResponse<unknown>);
        return;
      }

      const [rows] = await pool.execute(
        `SELECT 
          origem,
          destino,
          COUNT(*) AS total_fretes,
          COALESCE(SUM(receita), 0) AS receita_total,
          COALESCE(SUM(custos), 0) AS custos_total,
          COALESCE(SUM(receita - custos), 0) AS lucro_total
        FROM fretes
        GROUP BY origem, destino
        ORDER BY lucro_total DESC`
      );

      await setCache(cacheKey, rows, CACHE_TTL_SECONDS);

      res.json({
        success: true,
        message: 'Estatisticas por rota carregadas com sucesso',
        data: rows,
      } as ApiResponse<unknown>);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao carregar estatisticas por rota',
      } as ApiResponse<null>);
    }
  }
}
