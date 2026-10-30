import { env } from 'cloudflare:workers';
import { createSession, publicOrigin } from '@/lib/app-auth';
import { digest } from '@/lib/auth-crypto';

const encoder = new TextEncoder();

async function hashPassword(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 310000 }, key, 256);
  return Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string; password?: string; name?: string; mode?: string };
    const email = body.email?.trim().toLowerCase() || '';
    const password = body.password || '';
    const mode = body.mode;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 8 || password.length > 128 || !['signin', 'signup'].includes(mode || '')) {
      return Response.json({ error: 'Email va parolni tekshiring. Parol kamida 8 belgidan iborat bo‘lsin.' }, { status: 400 });
    }
    const emailKey = await digest(email);
    const id = `password:${emailKey}`;
    const current = await env.DB.prepare("SELECT owner,data FROM records WHERE id=? AND kind='password-account'").bind(id).first<{ owner: string; data: string }>();
    let userId: string;
    let name: string;
    if (mode === 'signup') {
      if (current) return Response.json({ error: 'Bu email bilan hisob mavjud. Kirish bo‘limidan foydalaning.' }, { status: 409 });
      name = body.name?.trim().slice(0, 80) || email.split('@')[0];
      userId = `email:${emailKey}`;
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const saltHex = Array.from(salt, byte => byte.toString(16).padStart(2, '0')).join('');
      const passwordHash = await hashPassword(password, salt);
      await env.DB.prepare("INSERT INTO records(id,kind,owner,target,data,created_at) VALUES(?,'password-account',?,'password',?,?)").bind(id, userId, JSON.stringify({ email, name, salt: saltHex, passwordHash, createdAt: new Date().toISOString() }), new Date().toISOString()).run();
    } else {
      if (!current) return Response.json({ error: 'Email yoki parol noto‘g‘ri.' }, { status: 401 });
      const account = JSON.parse(current.data) as { email: string; name: string; salt: string; passwordHash: string };
      const salt = Uint8Array.from(account.salt.match(/.{2}/g) || [], byte => parseInt(byte, 16));
      const candidate = await hashPassword(password, salt);
      if (candidate !== account.passwordHash) return Response.json({ error: 'Email yoki parol noto‘g‘ri.' }, { status: 401 });
      userId = current.owner;
      name = account.name;
    }
    const origin = publicOrigin(request);
    const cookie = await createSession({ id: userId, email, name }, origin, 'password');
    return Response.json({ ok: true }, { headers: { 'Set-Cookie': cookie, 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Kirish amalga oshmadi. Qayta urinib ko‘ring.' }, { status: 500 });
  }
}
