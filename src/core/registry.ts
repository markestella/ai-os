const DEFAULT_REGISTRY_URL = "https://ai-cli-registry.mckbyte.com";

interface VersionEntry {
  path: string;
  url?: string;
}

interface RegistryManifest {
  latest: string;
  versions: Record<string, VersionEntry>;
}

export function getRegistryUrl(): string {
  return process.env.AI_OS_REGISTRY_URL || DEFAULT_REGISTRY_URL;
}

export async function fetchRegistry(): Promise<RegistryManifest> {
  const baseUrl = getRegistryUrl();
  const res = await fetch(`${baseUrl}/latest.json`);

  if (!res.ok) {
    throw new Error(`Failed to fetch registry: ${res.status} ${res.statusText}`);
  }

  const manifest = (await res.json()) as RegistryManifest;

  // Resolve full URLs for each version
  for (const [version, entry] of Object.entries(manifest.versions)) {
    if (!entry.url) {
      entry.url = `${baseUrl}${entry.path}`;
    }
  }

  return manifest;
}

export async function fetchRegistryFile(versionUrl: string, file: string): Promise<string> {
  const url = `${versionUrl}${file}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }

  return await res.text();
}

export async function fetchStackManifest(versionUrl: string): Promise<Record<string, StackEntry>> {
  const raw = await fetchRegistryFile(versionUrl, "stacks/manifest.json");
  return JSON.parse(raw);
}

export interface StackEntry {
  category: string;
  runtime: string;
  rules: string;
}
