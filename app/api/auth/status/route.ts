import {googleReady} from '@/lib/app-auth';
export async function GET(){return Response.json({google:googleReady(),chatgpt:true},{headers:{'Cache-Control':'no-store'}})}
