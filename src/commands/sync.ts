import { fetchRegistry, fetchRegistryFile, fetchStackManifest } from "../core/registry";
import { write, read, exists } from "../core/fs";
import { paths } from "../core/path";

export async function sync(args: string[]) {
  console.log("Syncing with AI OS Registry...\n");

  let registry;
  try {
    registry = await fetchRegistry();
  } catch (e) {
    console.log("❌ Failed to reach registry. Check your connection or AI_OS_REGISTRY_URL.");
    console.log(`   ${(e as Error).message}`);
    return;
  }

  let targetVersion = registry.latest;

  if (args[0] === "--version" && args[1]) {
    targetVersion = args[1];
  }

  const versionEntry = registry.versions[targetVersion];
  if (!versionEntry) {
    console.log(`❌ Version ${targetVersion} not found in registry.`);
    return;
  }

  const versionUrl = versionEntry.url!;
  console.log(`📦 Version: ${targetVersion}`);

  // Sync core control files
  const controlFiles = ["AGENTS.md", "RULES.md"];
  for (const file of controlFiles) {
    try {
      const content = await fetchRegistryFile(versionUrl, file);
      await write(`${paths.control}/${file}`, content);
      console.log(`   ✔ control/${file}`);
    } catch {
      console.log(`   ⚠ control/${file} (not found)`);
    }
  }

  // Sync memory template
  try {
    const memory = await fetchRegistryFile(versionUrl, "MEMORY.md");
    await write(paths.systemContext, memory);
    console.log("   ✔ memory/SYSTEM_CONTEXT.md");
  } catch {
    console.log("   ⚠ memory/SYSTEM_CONTEXT.md (not found)");
  }

  // Sync stack-specific rules if stack is set
  if (await exists(paths.stack)) {
    const stackRaw = await read(paths.stack);
    const stackName = stackRaw.split("\n").filter(l => l.trim() && !l.startsWith("#"))[0]?.trim();

    if (stackName && stackName !== "not-set") {
      try {
        const manifest = await fetchStackManifest(versionUrl);
        const stackEntry = manifest[stackName];

        if (stackEntry) {
          const stackRules = await fetchRegistryFile(versionUrl, stackEntry.rules);
          await write(`${paths.control}/STACK_RULES.md`, stackRules);
          console.log(`   ✔ control/STACK_RULES.md (${stackName})`);
        } else {
          console.log(`   ⚠ No stack rules found for: ${stackName}`);
        }
      } catch {
        console.log("   ⚠ Stack manifest not available");
      }
    }
  }

  // Write version marker
  await write(paths.version, targetVersion);

  console.log(`\n✅ Sync complete (v${targetVersion})`);
}