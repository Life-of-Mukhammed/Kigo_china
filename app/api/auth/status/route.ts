import {googleReady} from '@/lib/app-auth';
import {chatGPTAuthAvailable} from '@/app/chatgpt-auth';
export async function GET(){return Response.json({google:googleReady(),chatgpt:chatGPTAuthAvailable()},{headers:{'Cache-Control':'no-store'}})}
