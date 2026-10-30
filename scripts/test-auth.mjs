import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
import {generateKeyPair,SignJWT,exportJWK} from 'jose';
const db=new DatabaseSync(':memory:');db.exec(await readFile('drizzle/0000_chunky_titania.sql','utf8'));
class Query{constructor(q,args=[]){this.q=q;this.args=args}bind(...args){return new Query(this.q,args)}async first(){return db.prepare(this.q).get(...this.args)||null}async all(){return {results:db.prepare(this.q).all(...this.args)}}async run(){const result=db.prepare(this.q).run(...this.args);return {meta:{changes:Number(result.changes||0)}}}}
globalThis.authEnv={DB:{prepare:q=>new Query(q),async batch(queries){const results=[];for(const query of queries)results.push(await query.run());return results}},KIGO_PUBLIC_ORIGIN:'https://kigo.test',GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret'};
globalThis.authHeaders=new Headers({host:'kigo.test'});globalThis.platformUser=null;
await mkdir('outputs',{recursive:true});
await build({stdin:{resolveDir:process.cwd(),contents:`export * from './lib/app-auth';export * from './lib/google-oidc';export {GET as start} from './app/auth/google/start/route';export {GET as callback} from './app/auth/google/callback/route';export {POST as logout} from './app/auth/logout/route';`,loader:'ts'},bundle:true,platform:'node',format:'esm',packages:'external',outfile:'outputs/auth-test.mjs',plugins:[{name:'boundaries',setup(b){for(const [filter,name,contents] of [[/^cloudflare:workers$/,'env','export const env=globalThis.authEnv'],[/^next\/headers$/,'headers','export const headers=async()=>globalThis.authHeaders'],[/chatgpt-auth/,'platform','export const getChatGPTUser=async()=>globalThis.platformUser']]){b.onResolve({filter},()=>({path:name,namespace:name}));b.onLoad({filter:/.*/,namespace:name},()=>({contents}))}}}]});
const a=await import('../outputs/auth-test.mjs');let n=0;function eq(x,y){n++;assert.deepEqual(x,y)}async function rejects(f){n++;await assert.rejects(f)}
eq(a.cookiesOf('a=x=y; b=2'),{a:'x=y',b:'2'});
for(const p of ['https://evil.test','//evil.test','/\\evil.test','/auth/google/start','/signin-with-chatgpt'])eq(a.safeReturnTo(p),'/profil');eq(a.safeReturnTo('/turnirlar/test?tab=a'),'/turnirlar/test?tab=a');
const {privateKey,publicKey}=await generateKeyPair('RS256',{extractable:true});
const sign=(overrides={})=>new SignJWT({sub:'google-sub',email:'member@gmail.com',email_verified:true,nonce:'nonce',name:'Member',...overrides}).setProtectedHeader({alg:'RS256'}).setIssuer('https://accounts.google.com').setAudience('test-client').setIssuedAt().setExpirationTime(overrides.exp??'5m').sign(privateKey);
const valid=await sign();eq((await a.verifyGoogleToken(valid,'test-client','nonce',async()=>publicKey)).email,'member@gmail.com');
await rejects(()=>a.verifyGoogleToken(valid,'wrong','nonce',async()=>publicKey));await rejects(()=>a.verifyGoogleToken(valid,'test-client','wrong',async()=>publicKey));
for(const p of [{email_verified:false},{azp:'other'},{sub:''},{email:'invalid'},{exp:1}])await rejects(async()=>a.verifyGoogleToken(await sign(p),'test-client','nonce',async()=>publicKey));
const insert=(id,kind,owner,data)=>db.prepare("INSERT INTO records VALUES(?,?,?,'',?,?)").run(id,kind,owner,JSON.stringify(data),new Date().toISOString());
insert('account:old-user','account','old-user',{email:'member@gmail.com',name:'Existing',status:'active'});
const identity=await a.googleIdentity('google-sub','member@gmail.com','Member',true,null);eq(identity.id,'old-user');eq(JSON.parse(db.prepare("SELECT data FROM records WHERE id='account:old-user'").get().data).name,'Existing');
eq((await a.googleIdentity('external','member@gmail.com','External',false,null)).id,'google:external');
const cookie=await a.createSession(identity,'https://kigo.test');eq(cookie.includes('Secure;'),false);assert.match(cookie,/HttpOnly/);n++;assert.match(cookie,/; Secure$/);n++;
const token=cookie.split(';')[0].split('=')[1];const session=db.prepare("SELECT * FROM records WHERE kind='auth-session'").get();eq(session.id,'session:'+await a.digest(token));eq(session.data.includes(token),false);
globalThis.authHeaders.set('cookie',cookie.split(';')[0]);eq((await a.getAppUser()).userId,'old-user');
let row=JSON.parse(session.data);row.expiresAt='2000-01-01';db.prepare('UPDATE records SET data=? WHERE id=?').run(JSON.stringify(row),session.id);eq(await a.getAppUser(),null);
const start=await a.start(new Request('https://kigo.test/auth/google/start?return_to=%2Fadmin'));eq(start.status,302);const target=new URL(start.headers.get('location'));eq(target.origin,'https://accounts.google.com');eq(target.searchParams.get('code_challenge_method'),'S256');eq(target.searchParams.get('redirect_uri'),'https://kigo.test/auth/google/callback');
const flow=db.prepare("SELECT * FROM records WHERE kind='auth-attempt'").get();const flowData=JSON.parse(flow.data);eq(flowData.returnTo,'/admin');eq(flow.id,'oauth:'+await a.digest(target.searchParams.get('state')));
const oauthCookie=start.headers.get('set-cookie').split(';')[0];
const wrong=await a.callback(new Request('https://kigo.test/auth/google/callback?state='+target.searchParams.get('state')+'&code=test'));eq(wrong.status,303);assert.ok(db.prepare('SELECT id FROM records WHERE id=?').get(flow.id));n++;
// A denied authorization consumes bound state once without exchanging any tokens.
await a.callback(new Request('https://kigo.test/auth/google/callback?state='+target.searchParams.get('state')+'&error=access_denied',{headers:{cookie:oauthCookie}}));eq(db.prepare('SELECT id FROM records WHERE id=?').get(flow.id),undefined);
// Complete callback against signed provider responses; network boundary only is replaced.
const second=await a.start(new Request('https://kigo.test/auth/google/start?return_to=%2Fprofil'));
const secondTarget=new URL(second.headers.get('location')),secondCookie=second.headers.get('set-cookie').split(';')[0];
const secondFlow=JSON.parse(db.prepare("SELECT data FROM records WHERE kind='auth-attempt'").get().data);
const jwk=await exportJWK(publicKey);jwk.kid='test-key';jwk.alg='RS256';jwk.use='sig';
const signed=await new SignJWT({sub:'google-sub',email:'member@gmail.com',email_verified:true,nonce:secondFlow.nonce,name:'Member'}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setIssuer('https://accounts.google.com').setAudience('test-client').setIssuedAt().setExpirationTime('5m').sign(privateKey);
const realFetch=globalThis.fetch;let exchanges=0;
globalThis.fetch=async(url,options)=>{if(String(url).includes('/oauth2/v3/certs'))return Response.json({keys:[jwk]});if(String(url)==='https://oauth2.googleapis.com/token'){exchanges++;eq(options.body.get('code_verifier'),secondFlow.verifier);eq(options.body.get('client_secret'),'test-secret');return Response.json({id_token:signed})}throw new Error('Unexpected fetch')};
const callbackRequest=()=>new Request('https://kigo.test/auth/google/callback?state='+secondTarget.searchParams.get('state')+'&code=valid-code',{headers:{cookie:secondCookie}});
const completed=await a.callback(callbackRequest());eq(completed.headers.get('location'),'https://kigo.test/profil');eq(completed.headers.getSetCookie().length,2);eq(exchanges,1);
const replay=await a.callback(callbackRequest());eq(new URL(replay.headers.get('location')).searchParams.get('auth_error'),'google_failed');eq(exchanges,1);globalThis.fetch=realFetch;
eq((await a.logout(new Request('https://kigo.test/auth/logout',{method:'POST',headers:{origin:'https://evil.test',cookie:cookie.split(';')[0]}}))).status,403);
eq((await a.logout(new Request('https://kigo.test/auth/logout',{method:'POST',headers:{origin:'https://kigo.test',cookie:cookie.split(';')[0]}}))).status,303);eq(db.prepare('SELECT id FROM records WHERE id=?').get(session.id),undefined);
console.log(`PASS ${n} auth assertions: signed Google tokens, audience/nonce/claims, safe redirects, hashed expiring sessions, profile linking, PKCE, bound one-time state, logout and CSRF.`);
