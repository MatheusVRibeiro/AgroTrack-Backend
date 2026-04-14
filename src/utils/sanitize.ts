/**
 * Módulo de sanitização server-side.
 *
 * Limpa inputs de texto antes de salvar no banco de dados,
 * prevenindo XSS stored (armazenado) e injeção de HTML.
 */

// ─── HTML Strip / Escape ─────────────────────────────────────────────────────

const HTML_TAG_RE = /<[^>]*>/g;
const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#96;',
};
const HTML_ESCAPE_RE = /[&<>"'`/]/g;

/**
 * Remove todas as tags HTML de uma string.
 */
export function stripHtml(input: unknown): string {
  if (input === null || input === undefined) return '';
  return String(input).replace(HTML_TAG_RE, '');
}

/**
 * Escapa caracteres HTML perigosos.
 */
export function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return '';
  return String(input).replace(HTML_ESCAPE_RE, (char) => HTML_ESCAPE_MAP[char] || char);
}

// ─── Text sanitization ──────────────────────────────────────────────────────

/**
 * Sanitiza um campo de texto genérico:
 * - Trim
 * - Remove tags HTML
 * - Limita comprimento
 */
export function sanitizeText(value: unknown, maxLength = 500): string {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  const cleaned = stripHtml(str);
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

/**
 * Sanitiza um email.
 */
export function sanitizeEmail(email: unknown): string {
  if (email === null || email === undefined) return '';
  return String(email)
    .trim()
    .toLowerCase()
    .replace(/[<>"'`]/g, '');
}

/**
 * Sanitiza um campo de observação (texto livre mais longo).
 */
export function sanitizeObservacao(value: unknown, maxLength = 2000): string {
  return sanitizeText(value, maxLength);
}

// ─── Sanitização profunda de objetos ─────────────────────────────────────────

/**
 * Sanitiza todos os campos string de um objeto (1 nível de profundidade).
 * Útil para limpar payloads inteiros antes de processá-los.
 *
 * Campos numéricos, booleanos e null são preservados.
 * Campos string são sanitizados com stripHtml + trim.
 */
export function sanitizePayload<T extends Record<string, unknown>>(
  obj: T,
  options?: { maxLength?: number; excludeKeys?: string[] }
): T {
  const maxLength = options?.maxLength ?? 500;
  const excludeKeys = new Set(options?.excludeKeys ?? []);
  const result = { ...obj };

  for (const [key, value] of Object.entries(result)) {
    if (excludeKeys.has(key)) continue;

    if (typeof value === 'string') {
      (result as Record<string, unknown>)[key] = sanitizeText(value, maxLength);
    }
  }

  return result;
}

// ─── SQL Injection defense (complementar a parameterized queries) ────────────

/**
 * Valida que um ID é numérico ou um código válido (ex: PAG-2026-001).
 * Previne injeção via parâmetros de rota.
 */
export function isValidId(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const str = String(value);
  // Aceita IDs numéricos OU códigos no formato XXX-YYYY-NNN
  return /^\d+$/.test(str) || /^[A-Z]{2,5}-\d{4}-\d{1,5}$/i.test(str);
}

/**
 * Valida e sanitiza um parâmetro de ordenação (ORDER BY) para prevenir injeção.
 */
export function sanitizeOrderBy(
  field: unknown,
  allowedFields: string[],
  defaultField = 'created_at'
): string {
  if (!field || typeof field !== 'string') return defaultField;
  const cleaned = field.replace(/[^a-zA-Z0-9_]/g, '');
  return allowedFields.includes(cleaned) ? cleaned : defaultField;
}

/**
 * Valida a direção de ordenação.
 */
export function sanitizeSortDirection(direction: unknown): 'ASC' | 'DESC' {
  if (!direction || typeof direction !== 'string') return 'DESC';
  return direction.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
}
