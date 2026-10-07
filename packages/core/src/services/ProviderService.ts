import type { AppConfig } from "../config";
import type { Database } from "../db/Database";
import { InputError } from "../db/repositories/BaseRepository";
import type { ProviderRepository } from "../db/repositories/ProviderRepository";
import type { CreateProviderInput, UpdateProviderInput } from "../domain/schemas";
import { PROVIDER_KINDS, type ProviderRecord } from "../domain/types";
import { getDriver, PROVIDER_DRIVERS, type DriverContext, type ProviderDriver, type ProviderDriverInfo } from "../providers/drivers";
import type { ProviderRegistry } from "../providers/ProviderRegistry";
import { GRADIO_PRESETS, legacyProviders, upgradeLegacyGradio, type SeedRecord } from "../providers/seed";
import type { AnyProvider } from "../providers/types";
import { newId, nowIso } from "../utils/text";

/** Placeholder returned instead of stored secrets; sending it back keeps the stored value. */
export const SECRET_MASK = "••••••••";

export type PublicProviderRecord = ProviderRecord & { available: boolean; detail?: string; driverLabel: string };

/** Provider configuration stored in the database; keeps the live ProviderRegistry in sync with it. */
export class ProviderService {
  constructor(
    private readonly repo: ProviderRepository,
    private readonly db: Database,
    private readonly registry: ProviderRegistry,
    private readonly ctx: DriverContext,
  ) {}

  /** Runs the one-time data steps, then loads every record into the registry. */
  init(config: AppConfig): void {
    // Each step runs once per database, recorded in `meta`; append new steps, never rename old keys.
    this.once("providers_seeded", () => this.importLegacy(config));
    this.once("providers_gradio_v2", () => this.upgradeGradio(config.hfToken));
    for (const record of this.repo.list()) this.sync(record);
  }

  drivers(): ProviderDriverInfo[] {
    return PROVIDER_DRIVERS.map(({ create: _, ...info }) => info);
  }

  async list(): Promise<PublicProviderRecord[]> {
    const records = this.repo.list({ orderBy: "kind, is_default DESC, slug" });
    const live = new Map((await this.registry.describe()).map((p) => [`${p.kind}:${p.id}`, p]));
    return records.map((r) => {
      const info = live.get(`${r.kind}:${r.slug}`);
      return { ...this.toPublic(r), available: !!info?.available, detail: info?.detail, driverLabel: getDriver(r.type).label };
    });
  }

  create(input: CreateProviderInput): ProviderRecord {
    const driver = getDriver(input.type);
    if (this.repo.findBySlug(driver.kind, input.slug)) throw new InputError(`A ${driver.kind} provider "${input.slug}" already exists`);
    const isFirst = this.repo.count({ kind: driver.kind }) === 0;
    const record = this.repo.insert({
      id: newId(),
      kind: driver.kind,
      slug: input.slug,
      type: driver.type,
      label: input.label?.trim() || driver.label,
      enabled: input.enabled ?? true,
      isDefault: false,
      config: this.normalize(driver, input.config ?? {}, {}),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    return this.afterWrite(input.isDefault || isFirst ? this.repo.setDefault(record.id) : record);
  }

  update(id: string, patch: UpdateProviderInput): ProviderRecord {
    const current = this.repo.getById(id);
    if (patch.enabled === false && current.isDefault) throw new InputError("Set another default before disabling this provider");
    const record = this.repo.update(id, {
      ...(patch.label !== undefined && { label: patch.label.trim() || getDriver(current.type).label }),
      ...(patch.enabled !== undefined && { enabled: patch.enabled }),
      ...(patch.config && { config: this.normalize(getDriver(current.type), patch.config, current.config) }),
      updatedAt: nowIso(),
    });
    return this.afterWrite(record);
  }

  setDefault(id: string): ProviderRecord {
    const record = this.repo.getById(id);
    if (!record.enabled) throw new InputError("Enable the provider before making it the default");
    return this.afterWrite(this.repo.setDefault(id));
  }

  delete(id: string): void {
    const record = this.repo.getById(id);
    if (record.isDefault) throw new InputError("Set another default before deleting this provider");
    this.repo.delete(id);
    this.registry.remove(record.kind, record.slug);
  }

  private afterWrite(record: ProviderRecord): ProviderRecord {
    this.sync(record);
    return this.toPublic(record);
  }

  /** Applies one record to the live registry (build / replace / remove, and its default flag). */
  private sync(record: ProviderRecord): void {
    if (record.enabled) {
      const provider = this.build(record);
      if (provider) this.registry.set(provider);
    } else {
      this.registry.remove(record.kind, record.slug);
    }
    if (record.isDefault) this.registry.setDefault(record.kind, record.slug);
  }

  private build(record: ProviderRecord): AnyProvider | null {
    try {
      const provider = getDriver(record.type).create(record.config, this.ctx);
      // Identity comes from the record, so one driver can back several providers (e.g. two Qwen spaces).
      return Object.defineProperties(provider, { id: { value: record.slug }, label: { value: record.label } });
    } catch (error) {
      console.error(`Provider ${record.kind}:${record.slug} could not be loaded: ${(error as Error).message}`);
      return null;
    }
  }

  /** Keeps only the driver's fields, coerced to their types; masked/omitted secrets keep the stored value. */
  private normalize(driver: ProviderDriver, input: Record<string, unknown>, previous: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const field of driver.fields) {
      const value = input[field.key];
      switch (field.type) {
        case "secret":
          out[field.key] = value === undefined || value === SECRET_MASK ? (previous[field.key] ?? "") : String(value).trim();
          break;
        case "text":
          out[field.key] = value === undefined ? (previous[field.key] ?? "") : String(value).trim();
          break;
        case "number": {
          const n = value === undefined ? previous[field.key] : value === "" || value === null ? undefined : Number(value);
          if (n !== undefined && !Number.isFinite(n)) throw new InputError(`${field.label}: must be a number`);
          if (n !== undefined) out[field.key] = n;
          break;
        }
        case "list":
          out[field.key] =
            value === undefined
              ? (previous[field.key] ?? [])
              : (Array.isArray(value) ? value.map(String) : String(value).split(":")).map((v) => v.trim()).filter(Boolean);
          break;
        case "json":
          out[field.key] = value === undefined ? (previous[field.key] ?? {}) : ProviderService.parseJson(field.label, value);
          break;
      }
    }
    return out;
  }

  private static parseJson(label: string, value: unknown): Record<string, unknown> {
    let parsed = value;
    if (typeof value === "string") {
      try {
        parsed = value.trim() ? JSON.parse(value) : {};
      } catch {
        throw new InputError(`${label}: invalid JSON`);
      }
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new InputError(`${label}: must be a JSON object`);
    return parsed as Record<string, unknown>;
  }

  private toPublic(record: ProviderRecord): ProviderRecord {
    const secrets = getDriver(record.type).fields.filter((f) => f.type === "secret" && record.config[f.key]);
    if (!secrets.length) return record;
    return { ...record, config: { ...record.config, ...Object.fromEntries(secrets.map((f) => [f.key, SECRET_MASK])) } };
  }

  private once(key: string, step: () => void): void {
    const done = this.db.sql.query<{ value: string }, { key: string }>("SELECT value FROM meta WHERE key = $key").get({ key });
    if (done) return;
    this.db.transaction(() => {
      step();
      this.db.sql.query("INSERT INTO meta (key, value) VALUES ($key, $value)").run({ key, value: nowIso() });
    });
  }

  /** Imports the providers that used to come from .env and providers.config.json. */
  private importLegacy(config: AppConfig): void {
    const { records, defaults } = legacyProviders(config);
    records.forEach((r) => this.insertSeed(r));
    for (const kind of PROVIDER_KINDS) {
      const preferred = this.repo.findBySlug(kind, defaults[kind]) ?? this.repo.list({ where: { kind }, limit: 1 })[0];
      if (preferred) this.repo.setDefault(preferred.id);
    }
  }

  /** Moves old Gradio rows to the generic format and adds the preset Gradio image/TTS spaces. */
  private upgradeGradio(hfToken: string): void {
    for (const record of this.repo.list()) {
      const upgraded = upgradeLegacyGradio(record);
      if (upgraded) this.repo.update(record.id, { type: upgraded.type, config: this.normalize(getDriver(upgraded.type), upgraded.config, {}), updatedAt: nowIso() });
    }
    // HF Space ids (not URLs) get the existing Hugging Face token for better GPU quota.
    const isSpaceId = (space: unknown) => typeof space === "string" && !/^https?:/.test(space);
    GRADIO_PRESETS.forEach((r) => this.insertSeed(isSpaceId(r.config.space) ? { ...r, config: { ...r.config, hfToken } } : r));
  }

  /** Inserts a seed row unless its id is taken (never overwrites the user's own provider). */
  private insertSeed(seed: SeedRecord): void {
    if (this.repo.findBySlug(seed.kind, seed.slug)) return;
    const driver = getDriver(seed.type);
    const { enabled = true, ...fields } = seed;
    this.repo.insert({
      ...fields,
      id: newId(),
      label: seed.label || driver.label,
      enabled,
      isDefault: false,
      config: this.normalize(driver, seed.config, {}),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }
}
