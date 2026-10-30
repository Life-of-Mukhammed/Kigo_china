import {getChatGPTUser} from '@/app/chatgpt-auth';
import {cookieName,cookiesOf,digest,serializeCookie} from '@/lib/app-auth';
import {removeRecord} from '@/lib/record-store';
export async function POST(request:Request){const origin=new URL(request.url).origin;if(request.headers.get('origin')!==origin)return new Response(null,{status:403});const name=cookieName(origin,'session');const token=cookiesOf(request.headers.get('cookie'))[name];if(token&&/^[a-zA-Z0-9_-]{43}$/.test(token))await removeRecord('session:'+await digest(token),'auth-session');const siteUser=await getChatGPTUser();return new Response(null,{status:303,headers:{Location:siteUser?origin+'/signout-with-chatgpt?return_to=%2F':origin+'/', 'Set-Cookie':serializeCookie(name,'',origin,0),'Cache-Control':'no-store'}})}
