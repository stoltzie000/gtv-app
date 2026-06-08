import jwt, { type JwtPayload } from "jsonwebtoken";
import { cookies } from "next/headers";

export const AUTH_COOKIE_NAME = "token";
export const AUTH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7;

export type AuthSession = JwtPayload & {
  userId: number;
  email: string;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
}

export function createToken(userId: number, email: string) {
  return jwt.sign({ userId, email }, getJwtSecret(), {
    algorithm: "HS256",
    expiresIn: AUTH_TOKEN_MAX_AGE,
  });
}

export function verifyJwt(token: string): AuthSession | null {
  try {
    const payload = jwt.verify(token, getJwtSecret(), {
      algorithms: ["HS256"],
    });

    if (
      typeof payload === "string" ||
      typeof payload.userId !== "number" ||
      typeof payload.email !== "string"
    ) {
      return null;
    }

    return payload as AuthSession;
  } catch {
    return null;
  }
}

export async function verifyToken() {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;

  return token ? verifyJwt(token) : null;
}
