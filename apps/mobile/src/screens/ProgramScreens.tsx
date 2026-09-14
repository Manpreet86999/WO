import {useRef,useState} from 'react';
import {Alert,Switch,View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {Program,ProgramPhase,Week} from '../../../../src/shared/types';
import {useBody} from '../state/BodyProvider';
import {useDraft} from '../state/useDraft';
import {useNav,type RootRoutes} from '../navigation/routes';
import {deviceId,saveRecord} from '../lib/store';
import {Action,Card,Chip,Empty,Heading,Input,Kicker,Label,Loading,Metric,Page,Row} from '../ui/kit';

export function ProgramsScreen(){
 const {rows}=useBody(),nav=useNav(),[archived,setArchived]=useState(false);
 const programs=rows<Program>('program').filter(r=>Boolean(r.payload.archived)===archived);
 return <Page><Kicker>Structured progression</Kicker><Heading>Programs</Heading><Label muted>Build a sequence of training weeks around your goals.</Label><Row><Chip title="Current" selected={!archived} onPress={()=>setArchived(false)}/><Chip title="Archived" selected={archived} onPress={()=>setArchived(true)}/></Row><Action title="Create program" icon="plus" onPress={()=>nav.navigate('Program')}/>{programs.map(r=><Card key={r.id}><Kicker>{r.payload.active?'Active program':'Saved program'}</Kicker><Heading size={24}>{r.payload.name}</Heading><Label muted>{r.payload.notes||'No program notes'}</Label><Row><Metric title="Weeks" value={r.payload.weeks.length}/><Metric title="Phases" value={new Set(r.payload.weeks.map(w=>w.phase)).size}/></Row><Action title="Open program" secondary onPress={()=>nav.navigate('Program',{id:r.id})}/></Card>)}{programs.length===0&&<Empty title={archived?'No archived programs':'Build your next training block'} detail="Add saved plans in order and choose a phase for each week."/>}</Page>;
}
export function ProgramScreen({route}:NativeStackScreenProps<RootRoutes,'Program'>){
 const {rows,refresh}=useBody(),nav=useNav(),original=rows<Program>('program').find(r=>r.id===route.params?.id);
 const draft=useDraft(`program:${route.params?.id||'new'}`,{baseRevision:original?.revision||0,program:original?.payload||{id:`program-${Date.now()}`,name:'',notes:'',weeks:[],active:true,createdAt:new Date().toISOString()} as Program});
 const [busy,setBusy]=useState(false),lock=useRef(false),[search,setSearch]=useState('');
 if(!draft.loaded)return <Loading message={draft.error||'Opening program…'}/>;
 const p=draft.value.program,change=(program:Program)=>draft.set({...draft.value,program}),weeks=rows<Week>('week');
 async function save(deleting=false){if(lock.current)return;lock.current=true;setBusy(true);try{
  if(!deleting&&!p.name.trim())throw new Error('Enter a program name.');
  if(!deleting&&p.weeks.some(w=>!weeks.some(r=>r.id===w.weekId)))throw new Error('A referenced plan was removed. Replace or remove that week before saving.');
  const now=new Date().toISOString();await saveRecord({id:p.id,entityType:'program',payload:{...p,weeks:p.weeks.map((w,i)=>({...w,weekNumber:i+1})),updatedAt:now},updatedAt:now,revision:original?.revision||1,deviceId:await deviceId(),...(deleting?{deletedAt:now}:{})},true,draft.value.baseRevision);await draft.clear();await refresh();nav.goBack();
 }catch(e){Alert.alert('Program not saved',(e as Error).message);}finally{lock.current=false;setBusy(false);}}
 return <Page><Kicker>Program workspace</Kicker><Heading>{p.name||'Your next training block'}</Heading><Card><Input label="Program name" value={p.name} onChange={name=>change({...p,name})}/><Input label="Program notes" multiline value={p.notes} onChange={notes=>change({...p,notes})}/><Row><View style={{flex:1}}><Label>Active program</Label></View><Switch accessibilityLabel="Active program" value={p.active} onValueChange={active=>change({...p,active})}/></Row><Row><View style={{flex:1}}><Label>Archived</Label></View><Switch accessibilityLabel="Archived program" value={Boolean(p.archived)} onValueChange={archived=>change({...p,archived,active:archived?false:p.active})}/></Row></Card>
 <Kicker>Ordered weeks & phases</Kicker>{p.weeks.map((w,index)=><Card key={`${w.weekId}:${index}`}><Kicker>Week {index+1}</Kicker><Heading size={22}>{weeks.find(r=>r.id===w.weekId)?.payload.name||w.name||'Plan unavailable'}</Heading><Row wrap>{(['accumulate','intensify','deload','peak','other'] as ProgramPhase[]).map(phase=><Chip key={phase} title={phase} selected={w.phase===phase} onPress={()=>change({...p,weeks:p.weeks.map((ref,i)=>i===index?{...ref,phase}:ref)})}/>)}</Row><Row wrap><Chip title="Move earlier" onPress={()=>{if(index===0)return;const refs=[...p.weeks];[refs[index-1],refs[index]]=[refs[index],refs[index-1]];change({...p,weeks:refs});}}/><Chip title="Move later" onPress={()=>{if(index===p.weeks.length-1)return;const refs=[...p.weeks];[refs[index+1],refs[index]]=[refs[index],refs[index+1]];change({...p,weeks:refs});}}/><Chip title="Remove week" onPress={()=>change({...p,weeks:p.weeks.filter((_,i)=>i!==index)})}/></Row></Card>)}
 <Card><Heading size={21}>Add a saved plan</Heading><Input label="Search saved plans" value={search} onChange={setSearch}/>{weeks.filter(r=>r.payload.name.toLowerCase().includes(search.toLowerCase())).map(r=><Action key={r.id} secondary title={`Add ${r.payload.name}`} onPress={()=>change({...p,weeks:[...p.weeks,{weekId:r.id,name:r.payload.name,weekNumber:p.weeks.length+1,phase:r.payload.phase||'accumulate'}]})}/>)}{weeks.length===0&&<Label muted>Create a training plan before adding program weeks.</Label>}</Card>{draft.error!==''&&<Label>{draft.error}</Label>}<Action title={busy?'Saving…':'Save program'} disabled={busy} onPress={()=>void save()}/>{original!=null&&<Action title="Delete program" secondary disabled={busy} onPress={()=>Alert.alert('Delete this program?','Its saved plans and past workouts will remain.',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>void save(true)}])}/>}</Page>;
}
