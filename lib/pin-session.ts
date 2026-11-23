export type PinSession = { expires: number | null; profileId?: string };
const encoder = new TextEncoder();
const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const decode = (value: string) =>
  Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  );
async function key(secret: string) {
  if (secret.length < 32) throw new Error("Session unavailable.");
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
export async function signSession(session: PinSession, secret: string) {
  const payload = encode(encoder.encode(JSON.stringify(session)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await key(secret),
    encoder.encode(payload),
  );
  return `${payload}.${encode(new Uint8Array(signature))}`;
}
export async function verifySession(
  token: string,
  secret: string,
): Promise<PinSession | null> {
  try {
    if (token.length > 1024) return null;
    const [payload, signature, extra] = token.split(".");
    if (
      !payload ||
      !signature ||
      extra ||
      !(await crypto.subtle.verify(
        "HMAC",
        await key(secret),
        decode(signature),
        encoder.encode(payload),
      ))
    )
      return null;
    const session = JSON.parse(
      new TextDecoder().decode(decode(payload)),
    ) as PinSession;
    if (
      !session || typeof session !== "object" ||
      (session.expires !== null &&
        (!Number.isSafeInteger(session.expires) || session.expires! <= Date.now())) ||
      (session.profileId !== undefined &&
        (typeof session.profileId !== "string" ||
          !session.profileId ||
          session.profileId.length > 100))
    )
      return null;
    return session;
  } catch {
    return null;
  }
}
export async function digest(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
