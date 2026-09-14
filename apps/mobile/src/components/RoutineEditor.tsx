import { useState } from 'react';
import { Alert, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { defaultSkinRoutines, type SkinProduct, type SkinRoutine } from '../../../../src/shared/skin';
import type { SyncRecord } from '../../../../src/shared/sync';
import { deviceId, saveRecord } from '../lib/store';
function Button({label,action}:{label:string;action:()=>void}) {return <Pressable accessibilityRole="button" style={{padding:14,backgroundColor:'#232A35',borderRadius:10}} onPress={action}><Text style={{color:'#F6F7F8'}}>{label}</Text></Pressable>;}
function Field({label,value,change}:{label:string;value:string;change:(v:string)=>void}) {return <View><Text style={{color:'#A7ADB7'}}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={change} style={{padding:12,color:'#F6F7F8',borderWidth:1,borderColor:'#53645a',borderRadius:8}}/></View>;}
export function RoutineEditor({records,onSaved}:{records:SyncRecord[];onSaved:()=>Promise<void>}) {
  const [draft,setDraft]=useState<SkinRoutine|null>(null),[busy,setBusy]=useState(false);
  const saved=records.filter(r=>r.entityType==='skinRoutine'&&!r.deletedAt).map(r=>r.payload as SkinRoutine);
  const routines=saved.length?saved:defaultSkinRoutines();
  const products=records.filter(r=>r.entityType==='skinProduct'&&!r.deletedAt).map(r=>r.payload as SkinProduct);
  async function save(){if(!draft||busy)return;setBusy(true);try{
    if(!draft.name.trim())throw new Error('Enter a routine name.');
    for(const step of draft.steps){if(!step.label.trim())throw new Error('Each step needs a label.');if(!Number.isFinite(Number(step.waitMin))||Number(step.waitMin)<0||Number(step.waitMin)>120)throw new Error('Wait times must be between 0 and 120 minutes.');}
    const now=new Date().toISOString();await saveRecord({id:draft.id,entityType:'skinRoutine',payload:{...draft,steps:draft.steps.map(step=>({...step,waitMin:Number(step.waitMin)})),updatedAt:now},updatedAt:now,revision:1,deviceId:await deviceId()});await onSaved();setDraft(null);
  }catch(error){Alert.alert('Routine not saved',(error as Error).message);}finally{setBusy(false);}}
  return <View style={{padding:16,gap:12,backgroundColor:'#17191F',borderRadius:18}}><Text style={{color:'#9EEA22',fontSize:20}}>Edit routines</Text>{!draft?routines.map(r=><Button key={r.id} label={`Edit ${r.name}`} action={()=>setDraft(JSON.parse(JSON.stringify(r)))}/>):<>
    <Field label="Routine name" value={draft.name} change={name=>setDraft({...draft,name})}/>
    {draft.steps.map((step,index)=>{const change=(patch:Partial<typeof step>)=>setDraft({...draft,steps:draft.steps.map((s,i)=>i===index?{...s,...patch}:s)});return <View key={step.id} style={{gap:10,paddingVertical:12,borderTopWidth:1,borderColor:'#53645a'}}>
      <Field label={`Step ${index+1}`} value={step.label} change={label=>change({label})}/><Field label="Wait minutes" value={String(step.waitMin)} change={value=>change({waitMin:value as unknown as number})}/><Field label="Notes" value={step.notes} change={notes=>change({notes})}/>
      <Text style={{color:'#A7ADB7'}}>Paused</Text><Switch accessibilityLabel={`Pause ${step.label}`} value={Boolean(step.paused)} onValueChange={paused=>change({paused})}/>
      <Text style={{color:'#A7ADB7'}}>Linked product: {products.find(p=>p.id===step.productId)?.name||'None'}</Text><Button label="No linked product" action={()=>change({productId:''})}/>{products.map(p=><Button key={p.id} label={p.name} action={()=>change({productId:p.id})}/>)}
      {index>0&&<Button label="Move up" action={()=>{const steps=[...draft.steps];[steps[index-1],steps[index]]=[steps[index],steps[index-1]];setDraft({...draft,steps});}}/>}
      <Button label="Remove step" action={()=>Alert.alert('Remove step?','Save the routine to apply this change.',[{text:'Cancel',style:'cancel'},{text:'Remove',onPress:()=>setDraft({...draft,steps:draft.steps.filter(s=>s.id!==step.id)})}])}/>
    </View>;})}
    <Button label="Add step" action={()=>setDraft({...draft,steps:[...draft.steps,{id:`step-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,label:'',productId:'',waitMin:0,notes:''}]})}/><Button label={busy?'Saving…':'Save routine'} action={()=>void save()}/><Button label="Cancel" action={()=>{if(!busy)Alert.alert('Discard edits?','Saved routines will remain unchanged.',[{text:'Keep editing',style:'cancel'},{text:'Discard',onPress:()=>setDraft(null)}]);}}/>
  </>}</View>;
}
