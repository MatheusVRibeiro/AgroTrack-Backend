import pool from '../database/connection';

export class ValidationService {
    /**
     * Verifica se um registro existe em uma tabela específica através do ID.
     * @param table O nome da tabela no banco de dados.
     * @param id O ID a ser verificado.
     * @returns true se existir, false caso contrário.
     */
    static async exists(table: string, id: string | number): Promise<boolean> {
        const [rows] = await pool.execute(
            `SELECT id FROM \`${table}\` WHERE id = ? LIMIT 1`,
            [id]
        );
        return (rows as unknown[]).length > 0;
    }
}
