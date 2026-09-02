import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "pn_admin_session";
export const PENDING_COOKIE = "pn_admin_pending";
const SESSION_MINUTES = 30;
const PENDING_MINUTES = 5;

export type AdminSessionPayload = {
  adminId: string;
  email: string;
};

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: AdminSessionPayload) {
  return new SignJWT({ ...payload, type: "admin_session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MINUTES}m`)
    .sign(authSecret());
}

export async function verifySessionToken(token: string): Promise<AdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, authSecret());
    if (payload.type !== "admin_session" || typeof payload.adminId !== "string") return null;
    return { adminId: payload.adminId, email: String(payload.email ?? "") };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MINUTES * 60,
  };
}

export async function createPendingToken(adminId: string) {
  return new SignJWT({ adminId, type: "admin_pending" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PENDING_MINUTES}m`)
    .sign(authSecret());
}

export async function verifyPendingToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, authSecret());
    if (payload.type !== "admin_pending" || typeof payload.adminId !== "string") return null;
    return payload.adminId;
  } catch {
    return null;
  }
}

export function pendingCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: PENDING_MINUTES * 60,
  };
}
