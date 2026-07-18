export interface FileSummary {
  path: string;
  lastUsedAt: string;
}

export interface AppSettings {
  colorScheme: string;
  summary: FileSummary[];
}

export const DEFAULT_SETTINGS: AppSettings = {
  colorScheme: "graphite",
  summary: [],
};

const MAX_FILE_SUMMARIES = 5;

export function normalizeSettings(value: unknown): AppSettings {
  const settings = isRecord(value) ? value : {};
  const seenPaths = new Set<string>();
  const summary = Array.isArray(settings.summary)
    ? settings.summary.flatMap((item) => {
      if (!isRecord(item)) return [];

      const path = typeof item.path === "string" ? item.path.trim() : "";
      const lastUsedAt = typeof item.lastUsedAt === "string"
        ? item.lastUsedAt
        : "";

      if (!path || !isDateString(lastUsedAt) || seenPaths.has(path)) return [];

      seenPaths.add(path);
      return [{ path, lastUsedAt }];
    }).slice(0, MAX_FILE_SUMMARIES)
    : [];

  return {
    colorScheme: typeof settings.colorScheme === "string"
      ? settings.colorScheme
      : DEFAULT_SETTINGS.colorScheme,
    summary,
  };
}

export function recordRecentFile(
  settings: AppSettings,
  path: string,
  usedAt = new Date(),
): AppSettings {
  const normalized = normalizeSettings(settings);
  const trimmedPath = path.trim();

  if (!trimmedPath) return normalized;

  return {
    ...normalized,
    summary: [
      { path: trimmedPath, lastUsedAt: usedAt.toISOString() },
      ...normalized.summary.filter((item) => item.path !== trimmedPath),
    ].slice(0, MAX_FILE_SUMMARIES),
  };
}

export function removeRecentFile(
  settings: AppSettings,
  path: string,
): AppSettings {
  const normalized = normalizeSettings(settings);

  return {
    ...normalized,
    summary: normalized.summary.filter((item) => item.path !== path),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isDateString(value: string): boolean {
  return value.length > 0 && Number.isFinite(Date.parse(value));
}
