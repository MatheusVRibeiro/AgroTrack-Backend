export interface Pagination {
  page: number;
  limit: number;
  offset: number;
}

export function getPagination(query: Record<string, unknown>): Pagination {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.max(1, parseInt(query.limit as string) || 10);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function buildUpdate(
  data: Record<string, unknown>,
  allowedFields: string[]
): { fields: string[]; values: unknown[] } {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (allowedFields.includes(key) && value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  return { fields, values };
}

export class QueryBuilder {
  private whereClauses: string[] = [];
  private params: unknown[] = [];

  addCondition(condition: string, value: unknown): this {
    if (value !== undefined && value !== null && value !== '') {
      this.whereClauses.push(condition);
      this.params.push(value);
    }
    return this;
  }

  build(baseQuery: string): { sql: string; params: unknown[] } {
    let sql = baseQuery;
    if (this.whereClauses.length > 0) {
      sql += ' WHERE ' + this.whereClauses.join(' AND ');
    }
    return { sql, params: this.params };
  }
}
