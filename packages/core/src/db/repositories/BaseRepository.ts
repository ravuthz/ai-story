import type { Database } from "../Database";

type Row = Record<string, unknown>;
type Bindings = Record<string, string | number | null>;

export interface ListOptions {
  where?: Record<string, string | number | null | undefined>;
  orderBy?: string;
  limit?: number;
  offset?: number;
}

/**
 * Generic table gateway. Subclasses only declare the table name and how to map
 * between a row and a domain entity; all CRUD lives here.
 */
export abstract class BaseRepository<T extends { id: string }> {
  protected abstract readonly table: string;

  constructor(protected readonly db: Database) {}

  protected abstract toEntity(row: Row): T;
  protected abstract toRow(entity: Partial<T>): Bindings;

  findById(id: string): T | null {
    const row = this.db.sql.query<Row, Bindings>(`SELECT * FROM ${this.table} WHERE id = $id`).get({ id });
    return row ? this.toEntity(row) : null;
  }

  getById(id: string): T {
    const entity = this.findById(id);
    if (!entity) throw new NotFoundError(`${this.table} ${id} not found`);
    return entity;
  }

  list(options: ListOptions = {}): T[] {
    const { clause, bindings } = this.whereClause(options.where);
    const order = options.orderBy ? ` ORDER BY ${options.orderBy}` : "";
    const page = options.limit ? ` LIMIT ${Math.trunc(options.limit)} OFFSET ${Math.trunc(options.offset ?? 0)}` : "";
    return this.db.sql
      .query<Row, Bindings>(`SELECT * FROM ${this.table}${clause}${order}${page}`)
      .all(bindings)
      .map((row) => this.toEntity(row));
  }

  count(where?: ListOptions["where"]): number {
    const { clause, bindings } = this.whereClause(where);
    return this.db.sql.query<{ n: number }, Bindings>(`SELECT COUNT(*) AS n FROM ${this.table}${clause}`).get(bindings)!.n;
  }

  insert(entity: T): T {
    const row = this.toRow(entity);
    const cols = Object.keys(row);
    this.db.sql
      .query(`INSERT INTO ${this.table} (${cols.join(", ")}) VALUES (${cols.map((c) => `$${c}`).join(", ")})`)
      .run(row);
    return entity;
  }

  update(id: string, patch: Partial<T>): T {
    const row = this.toRow(patch);
    delete row.id;
    const cols = Object.keys(row);
    if (cols.length) {
      this.db.sql
        .query(`UPDATE ${this.table} SET ${cols.map((c) => `${c} = $${c}`).join(", ")} WHERE id = $id`)
        .run({ ...row, id });
    }
    return this.getById(id);
  }

  delete(id: string): void {
    this.db.sql.query(`DELETE FROM ${this.table} WHERE id = $id`).run({ id });
  }

  private whereClause(where: ListOptions["where"] = {}) {
    const entries = Object.entries(where).filter(([, v]) => v !== undefined) as [string, string | number | null][];
    if (!entries.length) return { clause: "", bindings: {} as Bindings };
    return {
      clause: ` WHERE ${entries.map(([k]) => `${k} = $${k}`).join(" AND ")}`,
      bindings: Object.fromEntries(entries) as Bindings,
    };
  }
}

export class NotFoundError extends Error {
  readonly status = 404;
}

/** A request that is well-formed but not allowed (e.g. deleting the default provider). */
export class InputError extends Error {
  readonly status = 400;
}

/** Copies only the keys present on `source`, renaming them via `map` (entity key → column). */
export function pickColumns<T extends object>(
  source: Partial<T>,
  map: { [K in keyof T]?: [column: string, encode?: (value: T[K]) => string | number | null] },
): Bindings {
  const out: Bindings = {};
  for (const key of Object.keys(map) as (keyof T)[]) {
    if (!(key in source)) continue;
    const [column, encode] = map[key]!;
    const value = source[key] as T[typeof key];
    out[column] = encode ? encode(value) : ((value ?? null) as string | number | null);
  }
  return out;
}
