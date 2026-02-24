import { Connection } from 'mysql2/promise';

export class FazendaService {
    /**
     * Sincroniza os totais acumulados de uma fazenda baseando-se nas diferenças (deltas)
     * de um frete adicionado, alterado ou removido.
     *
     * @param connection Conexão com o banco (para controle de transação).
     * @param fazendaId ID da fazenda.
     * @param deltaToneladas Diferença de toneladas (positivo adiciona, negativo subtrai).
     * @param deltaSacas Diferença de sacas.
     * @param deltaReceita Diferença de faturamento/receita.
     */
    static async sincronizarTotais(
        connection: Connection,
        fazendaId: string | number,
        deltaToneladas: number,
        deltaSacas: number,
        deltaReceita: number
    ): Promise<void> {
        await connection.execute(
            `UPDATE fazendas
       SET total_toneladas = GREATEST(0, COALESCE(total_toneladas, 0) + ?),
           total_sacas_carregadas = GREATEST(0, COALESCE(total_sacas_carregadas, 0) + ?),
           faturamento_total = GREATEST(0, COALESCE(faturamento_total, 0) + ?),
           ultimo_frete = CASE WHEN ? > 0 THEN CURDATE() ELSE ultimo_frete END
       WHERE id = ?`,
            [deltaToneladas, deltaSacas, deltaReceita, deltaToneladas, fazendaId]
        );
    }

    /**
     * Recalcula os totais reais da fazenda diretamente a partir dos fretes vinculados.
     * Use esta função quando quiser garantir consistência (evita acumulações duplicadas).
     */
    static async recalcularTotais(connection: Connection, fazendaId: string | number): Promise<void> {
        await connection.execute(
            `UPDATE fazendas f
             SET
               total_toneladas = COALESCE((SELECT SUM(toneladas) FROM fretes WHERE fazenda_id = f.id), 0),
               total_sacas_carregadas = COALESCE((SELECT SUM(quantidade_sacas) FROM fretes WHERE fazenda_id = f.id), 0),
               faturamento_total = COALESCE((SELECT SUM(receita) FROM fretes WHERE fazenda_id = f.id), 0)
             WHERE f.id = ?`,
            [fazendaId]
        );
    }

    /**
     * Alterna um frete de uma fazenda para outra (usado no update do frete).
     */
    static async trocarFazendaDoFrete(
        connection: Connection,
        fazendaAnteriorId: string | number,
        fazendaNovaId: string | number
    ): Promise<void> {
        // Em vez de aplicar deltas (que acumulam se repetidos), recalculamos os totais
        if (fazendaAnteriorId) {
            await this.recalcularTotais(connection, fazendaAnteriorId);
        }
        if (fazendaNovaId) {
            await this.recalcularTotais(connection, fazendaNovaId);
        }
    }
}
