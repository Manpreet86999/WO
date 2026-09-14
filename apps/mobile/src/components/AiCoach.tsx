import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import type { SyncRecord } from '../../../../src/shared/sync';
import { snapshotFromRecords } from '../../../../src/shared/record-snapshot';
import { buildAthleteContext } from '../../../../src/shared/ai/context';
import { askMessages, morningBriefMessages, plateauMessages, exerciseCueMessages, workoutGenMessages, skinBuildMessages, type ChatMessage } from '../../../../src/shared/ai/prompts';
import { aiWorkoutSchema, aiSkinSchema } from '../../../../src/shared/schemas';
import { localDateKey } from '../../../../src/shared/evidence';
import { stepsFromPlan } from '../../../../src/shared/skin';
import { deviceId, saveRecord, saveRecordsAtomically } from '../lib/store';
import { askAi, savedAiConfig, saveAiConfig, type MobileAiConfig } from '../lib/ai';
export function AiCoach({records,onSaved,skin=false}:{records:SyncRecord[];onSaved:()=>Promise<void>;skin?:boolean}) {
  const [config,setConfig]=useState<MobileAiConfig>({provider:'openrouter',model:'',apiKey:''}),[settings,setSettings]=useState(false),[question,setQuestion]=useState(''),[answer,setAnswer]=useState(''),[busy,setBusy]=useState(false),[proposal,setProposal]=useState<{kind:'workout'|'skin';data:unknown}|null>(null);
  const lock=useRef(false);
  useEffect(()=>{void savedAiConfig().then(setConfig).catch(()=>Alert.alert('AI settings unavailable'));},[]);
  const field=(label:string,value:string,change:(v:string)=>void,secret=false)=><View><Text style={{color:'#A7ADB7'}}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={change} secureTextEntry={secret} autoCapitalize="none" style={{padding:12,color:'#F6F7F8',borderWidth:1,borderColor:'#53645a',borderRadius:8}}/></View>;
  const button=(label:string,action:()=>void)=><Pressable accessibilityRole="button" disabled={busy} style={{padding:14,backgroundColor:'#232A35',borderRadius:10}} onPress={action}><Text style={{color:'#F6F7F8'}}>{label}</Text></Pressable>;
  async function request(kind:'ask'|'brief'|'plateau'|'cues'|'workout'|'skin') {
    if(lock.current)return;lock.current=true;setBusy(true);setProposal(null);
    try {
      const db=snapshotFromRecords(records),context=JSON.stringify(buildAthleteContext(db,undefined,{includeMetrics:true,includeSessions:true,includeTargets:true,includeProgression:true}));
      let messages:ChatMessage[];
      if(['ask','plateau','cues','workout'].includes(kind)&&!question.trim())throw new Error('Enter your question or exercise first.');
      if(kind==='workout')messages=workoutGenMessages(question);
      else if(kind==='skin')messages=skinBuildMessages(JSON.stringify(db.skin),question);
      else if(kind==='brief')messages=morningBriefMessages(context);
      else if(kind==='plateau')messages=plateauMessages(context,question);
      else if(kind==='cues')messages=exerciseCueMessages(question);
      else if(skin)messages=[{role:'system',content:'You are Body OS skin coach. Answer using only the supplied profile, shelf and logs. Do not diagnose, prescribe, invent products, or claim you changed records. Give concise advice; explain uncertainty.'},{role:'user',content:`Skin records: ${JSON.stringify(db.skin)}\nQuestion: ${question}`}];
      else messages=askMessages(context,question);
      const result=await askAi(config,messages);if(kind!=='workout'&&kind!=='skin')setAnswer(result);
      if(kind==='workout'||kind==='skin'){
        const fenced=result.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];const parsed=JSON.parse(fenced||result);
        const data=kind==='workout'?aiWorkoutSchema.parse(parsed):aiSkinSchema.parse(parsed);setProposal({kind,data});if(kind==='workout'){const plan=aiWorkoutSchema.parse(data);setAnswer(`${plan.name}\n${plan.exercises.map(e=>`${e.name}: ${e.vol} · ${e.cue}`).join('\n')}`);}else{const plan=aiSkinSchema.parse(data);setAnswer(`AM: ${(plan.am||[]).map(s=>`${s.product} (wait ${s.waitMin||0} min)`).join(' → ')}\nPM: ${(plan.pm||[]).map(s=>`${s.product} (wait ${s.waitMin||0} min)`).join(' → ')}\n${plan.notes||''}`);}
      }
    }catch(error){Alert.alert('AI request failed',(error as Error).message);}finally{lock.current=false;setBusy(false);}
  }
  async function apply(){if(!proposal||lock.current)return;lock.current=true;setBusy(true);try{
    const now=new Date().toISOString(),device=await deviceId();
    if(proposal.kind==='workout'){const plan=aiWorkoutSchema.parse(proposal.data),id=`ai-week-${Date.now()}`;await saveRecord({id,entityType:'week',payload:{id,name:plan.name,weekNumber:1,startDate:localDateKey(),notes:'Generated proposal reviewed before saving.',active:false,days:[{key:'Day1',title:plan.name,type:'workout',subtitle:'',muscles:[],exercises:plan.exercises}]},updatedAt:now,revision:1,deviceId:device});}
    else{const parsed=aiSkinSchema.parse(proposal.data),db=snapshotFromRecords(records);const changes:SyncRecord[]=[];for(const slot of ['am','pm'] as const){const proposed=parsed[slot];if(!proposed)continue;if(proposed.some(step=>!db.skin!.products.some(product=>product.name.toLowerCase()===step.product.toLowerCase())))throw new Error('The proposal includes a product outside your shelf. Generate a new proposal or add the product yourself first.');const existing=db.skin!.routines.find(r=>r.slot===slot);const id=existing?.id||`routine-${slot}`;const steps=stepsFromPlan(proposed,db.skin!.products,slot);changes.push({id,entityType:'skinRoutine',payload:{id,slot,name:existing?.name||`${slot.toUpperCase()} routine`,steps,updatedAt:now},updatedAt:now,revision:1,deviceId:device});}if(!changes.length)throw new Error('The response did not contain an AM or PM routine.');await saveRecordsAtomically(changes);}
    await onSaved();setProposal(null);setAnswer('Reviewed proposal saved.');
  }catch(error){Alert.alert('Could not save proposal',(error as Error).message);}finally{lock.current=false;setBusy(false);}}
  return <View style={{padding:16,gap:10,backgroundColor:'#17191F',borderRadius:18}}><Text style={{color:'#9EEA22',fontSize:20}}>{skin?'Skin':'Training'} AI coach</Text>{button(settings?'Hide AI settings':'AI settings',()=>setSettings(!settings))}{settings&&<>{(['openrouter','nvidia','ollama'] as const).map(provider=><View key={provider}>{button(`${config.provider===provider?'✓ ':''}${provider}`,()=>setConfig({...config,provider}))}</View>)}{field('Model ID',config.model,model=>setConfig({...config,model}))}{field('Provider API key',config.apiKey,apiKey=>setConfig({...config,apiKey}),true)}{config.provider==='ollama'&&field('HTTPS chat-completions URL',config.endpoint||'',endpoint=>setConfig({...config,endpoint}))}{button('Save AI settings',()=>void saveAiConfig(config).then(()=>setSettings(false)).catch(error=>Alert.alert('Could not save',error.message)))}<Text style={{color:'#A7ADB7'}}>The provider controls model pricing and availability. No model is selected automatically. Keys stay in secure device storage.</Text></>}
    <Text style={{color:'#A7ADB7'}}>Asking AI sends the relevant records to your configured provider. Offline guidance remains available without an API key.</Text>{field(skin?'Question or routine request':'Question, exercise or workout request',question,setQuestion)}{button(busy?'Working…':'Ask coach',()=>void request('ask'))}{skin?button('Propose AM/PM routines',()=>void request('skin')):<>{button('Morning briefing',()=>void request('brief'))}{button('Exercise cues',()=>void request('cues'))}{button('Plateau guidance',()=>void request('plateau'))}{button('Generate workout proposal',()=>void request('workout'))}</>}
    {answer?<Text selectable style={{color:'#F6F7F8',lineHeight:24}}>{answer}</Text>:null}{proposal&&button('Save reviewed proposal',()=>void apply())}
  </View>;
}
