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
     * Alterna um frete de uma fazenda para outra (usado no update do frete).
     */
    static async trocarFazendaDoFrete(
        connection: Connection,
        fazendaAnteriorId: string | number,
        fazendaNovaId: string | number,
        freteAtualToneladas: number,
        freteAtualSacas: number,
        freteAtualReceita: number,
        freteNovoToneladas: number,
        freteNovoSacas: number,
        freteNovoReceita: number
    ): Promise<void> {
        // 1. Subtrai os valores antigos da fazenda anterior
        await this.sincronizarTotais(
            connection,
            fazendaAnteriorId,
            -freteAtualToneladas,
            -freteAtualSacas,
            -freteAtualReceita
        );

        // 2. Adiciona os novos valores na fazenda nova
        await this.sincronizarTotais(
            connection,
            fazendaNovaId,
            freteNovoToneladas,
            freteNovoSacas,
            freteNovoReceita
        );
    }
}
