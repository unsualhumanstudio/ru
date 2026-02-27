#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

// ── Helpers ────────────────────────────────────────────────────────────────────

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

function claudeConfigPath(): string {
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? "", "Claude", "claude_desktop_config.json");
  }
  return path.join(
    process.env.HOME ?? "",
    "Library", "Application Support", "Claude", "claude_desktop_config.json"
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log("\n🟣 rū setup\n");

const configPath = claudeConfigPath();
let config: Record<string, unknown> = {};

if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    console.error(`\n❌ Could not read Claude Desktop config at ${configPath}.`);
    console.error("It may be malformed JSON. Please check the file and try again.\n");
    rl.close();
    process.exit(1);
  }
}

const existingServers = (config.mcpServers as Record<string, unknown>) ?? {};

// Check if already configured with an Obsidian key
const existing = existingServers.ru as Record<string, unknown> | undefined;
const existingEnv = (existing?.env as Record<string, string>) ?? {};
const existingKey = existingEnv.OBSIDIAN_API_KEY ?? "";
const existingPort = existingEnv.OBSIDIAN_PORT ?? "";

let apiKey = existingKey;
let port = existingPort || "27123";

if (existingKey) {
  console.log("rū is already installed. Updating Obsidian connection.\n");
  console.log("Find your API key in Obsidian → Settings → Community Plugins → Local REST API\n");
  const newKey = (await ask(rl, `Paste your API key (Enter to keep existing): `)).trim();
  if (newKey) apiKey = newKey;
} else {
  console.log("Adding rū to Claude Desktop...\n");

  // Check if they want to connect Obsidian now
  const hasKey = (await ask(rl, "Do you have an Obsidian API key to connect now? (y/n): ")).trim().toLowerCase();
  if (hasKey === "y") {
    console.log("\nFind it in Obsidian → Settings → Community Plugins → Local REST API\n");
    apiKey = (await ask(rl, "Paste your API key: ")).trim();
  }
}

config.mcpServers = {
  ...existingServers,
  ru: {
    command: "npx",
    args: ["-y", "--package=ru-mcp", "ru-mcp-server"],
    env: {
      ...(apiKey ? { OBSIDIAN_API_KEY: apiKey, OBSIDIAN_PORT: port } : {}),
    },
  },
};

fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log(`\n✅ rū added to Claude Desktop.\n`);
console.log("━".repeat(50));
console.log("\n🎉 Setup complete!\n");
console.log("Next steps:");
console.log("  1. Fully quit Claude Desktop (Cmd+Q / right-click dock → Quit)");
console.log("  2. Relaunch Claude Desktop");
console.log("  3. Start a new conversation and type:");
console.log("     #ru/onboarding.ru\n");
console.log("Claude will walk you through the rest.\n");

rl.close();
