import type { AppConfig } from "../config";
import type { Database } from "../db/Database";
import { InputError } from "../db/repositories/BaseRepository";
import type { ProviderRepository } from "../db/repositories/ProviderRepository";
import type { CreateProviderInput, UpdateProviderInput } from "../domain/schemas";
import { PROVIDER_KINDS, type ProviderRecord } from "../domain/types";
import { getDriver, PROVIDER_DRIVERS, type DriverContext, type ProviderDriver, type ProviderDriverInfo } from "../providers/drivers";
import type { ProviderRegistry } from "../providers/ProviderRegistry";
import {
  GRADIO_PRESETS,
  legacyProviders,
  MERGED_GRADIO_GROUPS,
  toConnectionsConfig,
  upgradeLegacyGradio,
  VOXCPM_PLAIN_DEFAULTS,
  VOXCPM_VOICE_PARAMS,
  type SeedRecord,
} from "../providers/seed";
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
    /** Called before a provider row is deleted (e.g. to remove its voice files). */
    private readonly onDelete?: (providerId: string) => Promise<void>,
  ) {}

  /** Runs the one-time data steps, then loads every record into the registry. */
  init(config: AppConfig): void {
    // Each step runs once per database, recorded in `meta`; append new steps, never rename old keys.
    this.once("providers_seeded", () => this.importLegacy(config));
    this.once("providers_gradio_v2", () => this.upgradeGradio(config.hfToken));
    this.once("providers_gradio_connections_v3", () => this.mergeGradioConnections());
    this.once("providers_gradio_preset_fix_v4", () => this.repairGradioPresets(config.hfToken));
    this.once("providers_voxcpm_voices_v5", () => this.enableVoxcpmVoices());
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
    void this.onDelete?.(id).catch((e) => console.error(`Cleanup for provider ${record.slug} failed: ${(e as Error).message}`));
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
        case "connections":
          out[field.key] = value === undefined ? (previous[field.key] ?? []) : ProviderService.parseConnections(value);
          break;
      }
    }
    return out;
  }

  /** Validates an ordered Gradio connection list; params/valueMaps/meta may arrive as JSON text from the UI. */
  private static parseConnections(value: unknown): Record<string, unknown>[] {
    let list = value;
    if (typeof value === "string") {
      try {
        list = JSON.parse(value || "[]");
      } catch {
        throw new InputError("Connections: invalid JSON");
      }
    }
    if (!Array.isArray(list)) throw new InputError("Connections: must be a list");
    return list.map((item, i) => {
      const c = (item ?? {}) as Record<string, unknown>;
      const n = `Connection ${i + 1}`;
      const space = String(c.space ?? "").trim();
      if (!space) throw new InputError(`${n}: space / URL is required`);
      const optional = (key: string, label: string) => {
        const parsed = c[key] === undefined || c[key] === "" ? {} : ProviderService.parseJson(`${n} ${label}`, c[key]);
        return Object.keys(parsed).length ? { [key]: parsed } : {};
      };
      return {
        space,
        apiName: String(c.apiName ?? "").trim() || "/predict",
        params: c.params === undefined || c.params === "" ? {} : ProviderService.parseJson(`${n} parameters`, c.params),
        ...optional("valueMaps", "value maps"),
        ...optional("meta", "extra settings"),
        enabled: c.enabled !== false,
      };
    });
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
    // The existing Hugging Face token gives better GPU quota; GradioApi only sends it to Hugging Face hosts.
    GRADIO_PRESETS.forEach((r) => this.insertSeed({ ...r, config: { ...r.config, hfToken } }));
  }

  /** Points VoxCPM's reference-audio inputs at the cloned-voice placeholders, leaving user-edited values alone. */
  private enableVoxcpmVoices(): void {
    for (const record of this.repo.list({ where: { kind: "audio", type: "gradio-audio" } })) {
      let changed = false;
      const connections = ((record.config.connections ?? []) as { params?: Record<string, unknown> }[]).map((c) => {
        const params = c.params ?? {};
        if (params.text_input !== "{{text}}") return c;
        const next = { ...params };
        for (const [key, placeholder] of Object.entries(VOXCPM_VOICE_PARAMS)) {
          const current = next[key] === "" && key === "reference_wav_path_input" ? null : next[key];
          if (key in next && current === VOXCPM_PLAIN_DEFAULTS[key]) {
            next[key] = placeholder;
            changed = true;
          }
        }
        return { ...c, params: next };
      });
      if (changed) this.repo.update(record.id, { config: { ...record.config, connections }, updatedAt: nowIso() });
    }
  }

  /**
   * Repairs preset providers migrated by an in-between build: connections the preset ships switched off
   * are turned off again, and a missing HF token is filled in (GradioApi only sends it to Hugging Face).
   */
  private repairGradioPresets(hfToken: string): void {
    for (const preset of GRADIO_PRESETS) {
      const record = this.repo.findBySlug(preset.kind, preset.slug);
      if (!record) continue;
      const off = new Set(
        (preset.config.connections as { space: string; apiName: string; enabled?: boolean }[]).filter((c) => c.enabled === false).map((c) => `${c.space} ${c.apiName}`),
      );
      const connections = ((record.config.connections ?? []) as Record<string, unknown>[]).map((c) =>
        off.has(`${c.space} ${c.apiName}`) ? { ...c, enabled: false } : c,
      );
      this.repo.update(record.id, { config: { ...record.config, hfToken: record.config.hfToken || hfToken, connections }, updatedAt: nowIso() });
    }
  }

  /**
   * Gradio providers became ordered connection lists: converts single-endpoint rows, then folds the
   * separate per-space preset rows into one provider each (stories using a folded id are repointed).
   */
  private mergeGradioConnections(): void {
    for (const record of this.repo.list()) {
      const converted = record.type.startsWith("gradio-") && toConnectionsConfig(record.config);
      if (converted) this.repo.update(record.id, { config: this.normalize(getDriver(record.type), converted, {}), updatedAt: nowIso() });
    }
    for (const group of MERGED_GRADIO_GROUPS) {
      const leader = this.repo.findBySlug(group.kind, group.leader);
      const members = group.members.map((slug) => this.repo.findBySlug(group.kind, slug)).filter((m) => m !== null);
      if (!leader || !members.length) continue;
      const preset = GRADIO_PRESETS.find((p) => p.slug === group.leader)!;
      // Connections the preset ships switched off (e.g. one that "succeeds" with a placeholder) stay off.
      const presetOff = new Set(
        (preset.config.connections as { space: string; apiName: string; enabled?: boolean }[]).filter((c) => c.enabled === false).map((c) => `${c.space} ${c.apiName}`),
      );
      const connections = [leader, ...members].flatMap((r) =>
        ((r.config.connections ?? []) as Record<string, unknown>[]).map((c) => ({
          ...c,
          enabled: r.enabled && c.enabled !== false && !presetOff.has(`${c.space} ${c.apiName}`),
        })),
      );
      const hfToken = [leader, ...members].map((r) => r.config.hfToken).find((t) => typeof t === "string" && t) ?? "";
      this.repo.update(leader.id, {
        label: preset.label,
        enabled: true,
        config: { ...leader.config, hfToken, timeoutSec: leader.config.timeoutSec ?? preset.config.timeoutSec, connections },
        updatedAt: nowIso(),
      });
      for (const member of members) {
        if (member.isDefault) this.repo.setDefault(leader.id);
        this.db.sql
          .query(
            `UPDATE stories SET settings = json_set(settings, '$.providers.${group.kind}', $leader)
             WHERE json_extract(settings, '$.providers.${group.kind}') = $member`,
          )
          .run({ leader: group.leader, member: member.slug });
        this.repo.delete(member.id);
      }
    }
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
