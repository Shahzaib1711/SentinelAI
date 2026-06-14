/**
 * Loads .env, builds DATABASE_URL from DB_* vars (or uses DATABASE_URL if set),
 * then runs the given command with that env.
 */
import { spawn } from "child_process";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvFile() {
  const envPath = resolve(root, ".env");
  if (!existsSync(envPath)) return {};

  const env = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function buildDatabaseUrl(env) {
  if (env.DATABASE_URL) return env.DATABASE_URL;

  const host = env.DB_HOST || "localhost";
  const port = env.DB_PORT || "5432";
  const user = env.DB_USER || "postgres";
  const password = env.DB_PASSWORD ?? "";
  const name = env.DB_NAME || "sentinelai";
  const schema = env.DB_SCHEMA || "public";

  const encUser = encodeURIComponent(user);
  const encPass = encodeURIComponent(password);
  return `postgresql://${encUser}:${encPass}@${host}:${port}/${name}?schema=${schema}`;
}

const fileEnv = loadEnvFile();
const env = { ...process.env, ...fileEnv };
env.DATABASE_URL = buildDatabaseUrl(env);

const [, , ...args] = process.argv;
if (args.length === 0) {
  console.error("Usage: node scripts/with-database-url.mjs <command> [args...]");
  process.exit(1);
}

const child = spawn(args.join(" "), {
  stdio: "inherit",
  shell: true,
  env,
  cwd: root,
});

child.on("exit", (code) => process.exit(code ?? 1));
