import * as SecureStore from 'expo-secure-store';
import type { ChatMessage } from '../../../../src/shared/ai/prompts';
export interface MobileAiConfig {provider:'openrouter'|'nvidia'|'ollama';model:string;apiKey:string;endpoint?:string;}
const key='body-os-ai-settings';
export async function savedAiConfig():Promise<MobileAiConfig> {const raw=await SecureStore.getItemAsync(key);return raw?JSON.parse(raw):{provider:'openrouter',model:'',apiKey:''};}
export async function saveAiConfig(config:MobileAiConfig){await SecureStore.setItemAsync(key,JSON.stringify(config));}
export async function askAi(config:MobileAiConfig,messages:ChatMessage[]):Promise<string> {
  if(!config.model.trim())throw new Error('Choose a model in AI settings first.');
  if(config.provider!=='ollama'&&!config.apiKey.trim())throw new Error('Enter your provider API key in AI settings first.');
  const endpoint=config.provider==='openrouter'?'https://openrouter.ai/api/v1/chat/completions':config.provider==='nvidia'?'https://integrate.api.nvidia.com/v1/chat/completions':config.endpoint||'';
  if(!/^https:\/\//i.test(endpoint))throw new Error('A reachable HTTPS Ollama chat-completions endpoint is required on this build.');
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(config.apiKey?{Authorization:`Bearer ${config.apiKey}`}:{})},body:JSON.stringify({model:config.model,messages,temperature:0.3,max_tokens:1800}),signal:AbortSignal.timeout(60000)});
  const data=await response.json() as {choices?:{message?:{content?:string}}[];error?:{message?:string}};
  if(!response.ok)throw new Error(data.error?.message||`Provider request failed (${response.status}).`);
  const text=data.choices?.[0]?.message?.content?.trim();if(!text)throw new Error('The provider returned no text.');return text;
}
