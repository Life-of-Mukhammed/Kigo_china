import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {getChatGPTUser,type ChatGPTUser} from '@/app/chatgpt-auth';
export type AppUser=ChatGPTUser&{provider?:'google'|'chatgpt'|'password'};
import {cookiesOf,digest,tokenValue,cookieName,serializeCookie} from "@/lib/auth-crypto";
export {cookiesOf,digest,tokenValue,cookieName,serializeCookie,safeReturnTo} from "@/lib/auth-crypto";
export function publicOrigin(request:Request){const configured=env.KIGO_PUBLIC_ORIGIN;if(configured)return new URL(configured).origin;const u=new URL(request.url);if(['localhost','127.0.0.1'].includes(u.hostname))return u.origin;throw new Error('Saytning doimiy manzili sozlanmagan')}
export function googleReady(){return Boolean(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET&&env.KIGO_PUBLIC_ORIGIN)}
export async function getAppUser():Promise<AppUser|null>{
 const h=await headers();const c=cookiesOf(h.get('cookie'));const host=h.get('host')||'';const local=/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);const token=c['__Host-kigo_session']||(local?c.kigo_session_dev:'');
 if(token&&/^[a-zA-Z0-9_-]{43}$/.test(token)){
  const row=await env.DB.prepare("SELECT data,owner FROM records WHERE id=? AND kind='auth-session'").bind('session:'+await digest(token)).first<{data:string;owner:string}>();
  if(row){try{const data=JSON.parse(row.data);if(!data.revokedAt&&Date.parse(data.expiresAt)>Date.now()&&typeof data.email==='string'&&(data.emailVerified===true||data.provider==='password'))return{userId:row.owner,email:data.email,displayName:data.name||data.email,fullName:data.name||null,provider:data.provider||'google'}}catch{}}
 }
 const user=await getChatGPTUser();return user?{...user,provider:'chatgpt'}:null;
}
export async function createSession(user:{id:string;email:string;name:string},origin:string,provider:'google'|'password'='google'){await env.DB.prepare("DELETE FROM records WHERE kind IN ('auth-session','auth-attempt') AND json_extract(data,'$.expiresAt')<?").bind(new Date().toISOString()).run();const token=tokenValue();const id='session:'+await digest(token);const expiresAt=new Date(Date.now()+7*86400000).toISOString();await env.DB.prepare("INSERT INTO records(id,kind,owner,target,data,created_at) VALUES(?,'auth-session',?,?,?,?)").bind(id,user.id,provider,JSON.stringify({email:user.email,emailVerified:provider==='google',name:user.name,provider,expiresAt}),new Date().toISOString()).run();return serializeCookie(cookieName(origin,'session'),token,origin,7*86400)}
export async function googleIdentity(subject:string,email:string,name:string,authoritative:boolean,platform:ChatGPTUser|null){
 const linkId='google:'+subject;const existing=await env.DB.prepare("SELECT data FROM records WHERE id=? AND kind='auth-link'").bind(linkId).first<{data:string}>();let userId=existing?JSON.parse(existing.data).userId:null;
 if(!userId&&authoritative){if(platform?.email.toLowerCase()===email.toLowerCase())userId=platform.userId;else{const matches=await env.DB.prepare("SELECT owner FROM records WHERE kind='account' AND lower(json_extract(data,'$.email'))=?").bind(email.toLowerCase()).all<{owner:string}>();if(matches.results.length>1)throw new Error('Hisobni bog‘lash uchun administratorga murojaat qiling');userId=matches.results[0]?.owner}}
 userId ||= 'google:'+subject;
 const account=await env.DB.prepare("SELECT data FROM records WHERE id=? AND kind='account'").bind('account:'+userId).first<{data:string}>();if(account){const a=JSON.parse(account.data);if(a.deletedAt||a.status==='suspended')throw new Error('Hisobingiz faol emas')}
 if(!existing)await env.DB.prepare("INSERT INTO records(id,kind,owner,target,data,created_at) VALUES(?,'auth-link',?,'google',?,?) ON CONFLICT(id) DO NOTHING").bind(linkId,userId,JSON.stringify({userId,email,provider:'google',linkedAt:new Date().toISOString()}),new Date().toISOString()).run();
 return{id:userId,email,name};
}
