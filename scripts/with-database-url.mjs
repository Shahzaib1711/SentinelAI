/**
 * Loads .env, builds DATABASE_URL (Neon or local DB_*), sets DIRECT_URL for Prisma,
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

function isNeonHost(host) {
  return typeof host === "string" && host.includes("neon.tech");
}

function appendQueryParam(url, key, value) {
  if (!url || url.includes(`${key}=`)) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${key}=${value}`;
}

/** Neon requires SSL; ensure sslmode=require on cloud URLs. */
function ensureSslMode(url) {
  if (!url) return url;
  if (url.includes("sslmode=")) return url;

  try {
    const parsed = new URL(url.replace(/^postgresql:\/\//, "http://"));
    if (isNeonHost(parsed.hostname)) {
      return appendQueryParam(url, "sslmode", "require");
    }
  } catch {
    /* keep original url */
  }
  return url;
}

function buildDatabaseUrl(env) {
  const explicit = env.DATABASE_URL?.trim();
  if (explicit) {
    return ensureSslMode(explicit);
  }

  const host = env.DB_HOST || "localhost";
  const port = env.DB_PORT || "5432";
  const user = env.DB_USER || "postgres";
  const password = env.DB_PASSWORD ?? "";
  const name = env.DB_NAME || "sentinelai";
  const schema = env.DB_SCHEMA || "public";
  const sslmode = env.DB_SSLMODE || (isNeonHost(host) ? "require" : "");

  const encUser = encodeURIComponent(user);
  const encPass = encodeURIComponent(password);
  let url = `postgresql://${encUser}:${encPass}@${host}:${port}/${name}?schema=${schema}`;
  if (sslmode) {
    url = appendQueryParam(url, "sslmode", sslmode);
  }
  return url;
}

/** Prisma migrations need a direct (non-pooler) Neon connection. */
function buildDirectUrl(env, databaseUrl) {
  const explicit = env.DIRECT_URL?.trim();
  if (explicit) {
    return ensureSslMode(explicit);
  }
  if (!databaseUrl) return databaseUrl;

  // Neon pooler host: ep-xxx-pooler.region.aws.neon.tech → ep-xxx.region.aws.neon.tech
  const direct = databaseUrl.replace(/-pooler\./g, ".");
  return ensureSslMode(direct);
}

const fileEnv = loadEnvFile();
const env = { ...process.env, ...fileEnv };
env.DATABASE_URL = buildDatabaseUrl(env);
env.DIRECT_URL = buildDirectUrl(env, env.DATABASE_URL);

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
