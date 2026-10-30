import { env } from "cloudflare:workers";
import { takeRecord } from "@/lib/record-store";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { verifyGoogleToken } from "@/lib/google-oidc";
import {
  createSession,
  cookieName,
  cookiesOf,
  digest,
  googleIdentity,
  googleReady,
  publicOrigin,
  safeReturnTo,
  serializeCookie,
} from "@/lib/app-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  let origin = url.origin;
  try {
    origin = publicOrigin(request);
    if (!googleReady()) throw new Error("not configured");
    const state = url.searchParams.get("state") || "";
    const binding = cookiesOf(request.headers.get("cookie"))[cookieName(origin, "oauth")];
    if (!/^[a-zA-Z0-9_-]{43}$/.test(state) || !binding) throw new Error("invalid state");
    const id = "oauth:" + await digest(state);
    const row = await takeRecord(id, "auth-attempt");
    if (!row) throw new Error("unknown state");
    const flow = JSON.parse(row.data);
    if (flow.bindingHash !== await digest(binding) || Date.parse(flow.expiresAt) < Date.now()) throw new Error("expired state");
    const code = url.searchParams.get("code");
    if (!code || code.length > 4096 || url.searchParams.has("error")) throw new Error("denied");
    const tokenResult = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        code,
        code_verifier: flow.verifier,
        grant_type: "authorization_code",
        redirect_uri: origin + "/auth/google/callback",
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!tokenResult.ok) throw new Error("exchange failed");
    const token = await tokenResult.json() as { id_token?: string };
    if (!token.id_token) throw new Error("token missing");
    const claims = await verifyGoogleToken(token.id_token, env.GOOGLE_CLIENT_ID!, flow.nonce);
    const user = await googleIdentity(claims.subject, claims.email, claims.name, claims.authoritative, await getChatGPTUser());
    const headers = new Headers({
      Location: origin + safeReturnTo(flow.returnTo),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    });
    headers.append("Set-Cookie", await createSession(user, origin));
    headers.append("Set-Cookie", serializeCookie(cookieName(origin, "oauth"), "", origin, 0));
    return new Response(null, { status: 303, headers });
  } catch {
    const headers = new Headers({
      Location: origin + "/login?auth_error=google_failed",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    });
    headers.append("Set-Cookie", serializeCookie(cookieName(origin, "oauth"), "", origin, 0));
    return new Response(null, { status: 303, headers });
  }
}
