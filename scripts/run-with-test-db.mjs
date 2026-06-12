import "dotenv/config";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";

const mode = process.argv[2];
if (!['integration', 'e2e'].includes(mode)) throw new Error("Use integration or e2e");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required to create a disposable test database");

const source = new URL(process.env.DATABASE_URL);
const databaseName = `gtv_test_${randomUUID().replaceAll("-", "")}`;
const adminUrl = new URL(source);
adminUrl.pathname = "/postgres";
const testUrl = new URL(source);
testUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: adminUrl.toString() });

function command(program, args, env) {
  const executable = process.platform === "win32" ? `${program}.cmd` : program;
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { stdio: "inherit", env, shell: process.platform === "win32" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${program} exited with code ${code}`)));
  });
}

async function waitForServer(url, child) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Next.js exited with code ${child.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Timed out waiting for Next.js");
}

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  const env = {
    ...process.env,
    DATABASE_URL: testUrl.toString(),
    JWT_SECRET: process.env.JWT_SECRET || "gtv-test-jwt-secret",
    NODE_ENV: "test",
    GTV_TEST_DATABASE: "1",
    GTV_E2E: mode === "e2e" ? "1" : "0",
  };
  await command("npx", ["prisma", "migrate", "deploy"], env);
  if (mode === "integration") {
    await command("npx", ["vitest", "run", "--config", "vitest.integration.config.ts"], env);
  } else {
    const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3100"], {
      stdio: "inherit",
      env,
    });
    try {
      await waitForServer("http://127.0.0.1:3100/login", server);
      await command("npx", ["playwright", "test"], { ...env, PLAYWRIGHT_EXTERNAL_SERVER: "1" });
    } finally {
      server.kill();
      await new Promise((resolve) => server.once("exit", resolve));
    }
  }
} finally {
  await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]);
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
  await admin.end();
}
