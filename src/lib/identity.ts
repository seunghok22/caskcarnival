import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_NAME = "cask_uid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7일

export async function getOrCreateClientUid(): Promise<{
  uid: string;
  isNew: boolean;
}> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(COOKIE_NAME)?.value;
  if (existing && existing.length >= 16) {
    return { uid: existing, isNew: false };
  }
  return { uid: crypto.randomUUID(), isNew: true };
}

export async function getClientIp(): Promise<string> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return headerStore.get("x-real-ip") ?? "unknown";
}

export function attachUidCookie(
  response: NextResponse,
  uid: string,
  isNew: boolean
): NextResponse {
  if (isNew) {
    response.cookies.set(COOKIE_NAME, uid, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
  }
  return response;
}
