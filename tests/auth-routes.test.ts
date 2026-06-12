import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonRequest, responseJson } from "./helpers";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userCreate: vi.fn(),
  userUpdate: vi.fn(),
  userDelete: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
  hash: vi.fn(),
  compare: vi.fn(),
  checkRateLimit: vi.fn(),
  clearRateLimit: vi.fn(),
  verifyToken: vi.fn(),
  createToken: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique, create: mocks.userCreate, update: mocks.userUpdate, delete: mocks.userDelete },
    accountDeletionAudit: { create: mocks.auditCreate },
    $transaction: mocks.transaction,
  },
}));
vi.mock("bcrypt", () => ({ default: { hash: mocks.hash, compare: mocks.compare } }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  clearRateLimit: mocks.clearRateLimit,
  requestIp: () => "127.0.0.1",
  rateLimitIdentity: (value: string) => `hash:${value}`,
}));
vi.mock("@/lib/auth", () => ({
  AUTH_COOKIE_NAME: "token",
  AUTH_TOKEN_MAX_AGE: 604800,
  createToken: mocks.createToken,
  verifyToken: mocks.verifyToken,
}));

import { POST as register } from "@/app/api/register/route";
import { POST as login } from "@/app/api/login/route";
import { DELETE as deleteAccount } from "@/app/api/account/route";

beforeEach(() => {
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 });
  mocks.transaction.mockResolvedValue([]);
});

describe("authentication routes", () => {
  it("registers an account", async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.hash.mockResolvedValue("hashed");
    mocks.userCreate.mockResolvedValue({ id: 1, email: "user@example.com" });
    const response = await register(jsonRequest("http://test/api/register", { email: "USER@example.com", password: "password1" }));
    expect(response.status).toBe(200);
    expect(mocks.userCreate).toHaveBeenCalledWith({ data: { email: "user@example.com", password: "hashed" } });
  });

  it("rejects duplicate registration", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: 1 });
    const response = await register(jsonRequest("http://test/api/register", { email: "user@example.com", password: "password1" }));
    expect(response.status).toBe(409);
  });

  it("logs in with valid credentials and sets a cookie", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: 1, email: "user@example.com", password: "hash" });
    mocks.compare.mockResolvedValue(true);
    mocks.createToken.mockReturnValue("jwt");
    const response = await login(jsonRequest("http://test/api/login", { email: "user@example.com", password: "password1" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("token=jwt");
    expect(mocks.userUpdate).toHaveBeenCalled();
  });

  it("rejects invalid login credentials", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: 1, email: "user@example.com", password: "hash" });
    mocks.compare.mockResolvedValue(false);
    const response = await login(jsonRequest("http://test/api/login", { email: "user@example.com", password: "wrong" }));
    expect(response.status).toBe(401);
  });

  it("rejects login for a deleted account", async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    const response = await login(jsonRequest("http://test/api/login", { email: "deleted@example.com", password: "password1" }));
    expect(response.status).toBe(401);
  });

  it("returns 429 when login is rate limited", async () => {
    mocks.checkRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 30 });
    const response = await login(jsonRequest("http://test/api/login", { email: "user@example.com", password: "password1" }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
  });

  it("returns 429 when registration is rate limited", async () => {
    mocks.checkRateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 60 });
    const response = await register(jsonRequest("http://test/api/register", { email: "user@example.com", password: "password1" }));
    expect(response.status).toBe(429);
  });

  it("deletes an authenticated account and records an audit", async () => {
    mocks.verifyToken.mockResolvedValue({ userId: 1, email: "user@example.com" });
    mocks.userFindUnique.mockResolvedValue({ id: 1, email: "user@example.com" });
    mocks.auditCreate.mockReturnValue({ operation: "audit" });
    mocks.userDelete.mockReturnValue({ operation: "delete" });
    const response = await deleteAccount(jsonRequest("http://test/api/account", { confirmation: "DELETE" }, "DELETE"));
    expect(response.status).toBe(200);
    expect(await responseJson(response)).toEqual({ success: true });
    expect(mocks.transaction).toHaveBeenCalledWith([{ operation: "audit" }, { operation: "delete" }]);
  });
});
