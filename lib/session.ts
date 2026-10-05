import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { cookies } from "next/headers";
import type { LastFmSession } from "@/lib/lastfm";

export const SESSION_COOKIE = "lfm_session";
export const AUTH_STARTED_COOKIE = "lfm_auth_started";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type StoredSession = LastFmSession & {
  expiresAt: number;
};

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

function encryptionKey() {
  const secret = process.env.AUTH_COOKIE_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("AUTH_COOKIE_SECRET must contain at least 32 characters.");
  }

  return createHash("sha256").update(secret, "utf8").digest();
}

function seal(payload: StoredSession) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [iv, encrypted, tag]
    .map((part) => part.toString("base64url"))
    .join(".");
}

function unseal(value: string): StoredSession | null {
  try {
    const [ivValue, encryptedValue, tagValue] = value.split(".");

    if (!ivValue || !encryptedValue || !tagValue) return null;

    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const session = JSON.parse(decrypted) as Partial<
      Omit<StoredSession, "subscriber"> & { subscriber: unknown }
    >;
    // Older cookies may hold `subscriber` as a number, as Last.fm sent it.
    const subscriber = String(session.subscriber);

    if (
      typeof session.name !== "string" ||
      typeof session.key !== "string" ||
      (subscriber !== "0" && subscriber !== "1") ||
      typeof session.expiresAt !== "number" ||
      session.expiresAt <= Date.now()
    ) {
      return null;
    }

    return {
      name: session.name,
      key: session.key,
      subscriber,
      expiresAt: session.expiresAt,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<LastFmSession | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) return null;

  const session = unseal(value);
  if (!session) return null;

  return {
    name: session.name,
    key: session.key,
    subscriber: session.subscriber,
  };
}

export async function saveSession(session: LastFmSession) {
  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE,
    seal({
      ...session,
      expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    }),
    {
      ...cookieOptions(),
      maxAge: SESSION_MAX_AGE_SECONDS,
    },
  );
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export const authCookieOptions = cookieOptions;
