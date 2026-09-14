import {useState} from 'react';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useBody} from '../state/BodyProvider';
import {useNav,type RootRoutes} from '../navigation/routes';
import {Action,Card,Chip,Empty,Heading,Input,Kicker,Label,Metric,Page,Row} from '../ui/kit';
import {RecordEditor} from './RecordEditor';
import {careSpecs} from '../components/record-specs';
import type {RecordSpec} from '../components/RecordManager';
import {defaultSkinRoutines,type SkinLog,type SkinProduct,type SkinRoutine} from '../../../../src/shared/skin';
import {localDateKey} from '../../../../src/shared/evidence';
import {TrendChart} from '../components/TrendChart';

export function SkinProfileScreen(){return <RecordEditor spec={careSpecs[1]} title="My Skin Profile"/>;}
export function ProductsScreen(){
 const {rows}=useBody(),nav=useNav(),[query,setQuery]=useState(''),[status,setStatus]=useState('active');
 const products=rows<SkinProduct>('skinProduct').filter(row=>(status==='all'||row.payload.status===status)&&`${row.payload.name} ${row.payload.brand} ${row.payload.category}`.toLowerCase().includes(query.toLowerCase()));
 return <Page><Kicker>Your daily essentials</Kicker><Heading>Product Shelf</Heading><Input label="Find a product, brand or category" value={query} onChange={setQuery}/><Row wrap>{['active','paused','wishlist','all'].map(value=><Chip key={value} title={value} selected={status===value} onPress={()=>setStatus(value)}/>)}</Row><Action title="Add product" icon="plus" onPress={()=>nav.navigate('ProductEditor')}/>{products.map(row=><Card key={row.id}><Kicker>{row.payload.category} · {row.payload.status}</Kicker><Heading size={22}>{row.payload.name}</Heading><Label muted>{row.payload.brand}</Label>{row.payload.actives.length>0&&<Label muted size={13}>{row.payload.actives.join(' · ')}</Label>}<Action title="View product" secondary onPress={()=>nav.navigate('Product',{id:row.id})}/></Card>)}{products.length===0&&<Empty title="A shelf built around you" detail="Add the products you use to link them to your routines."/>}</Page>;
}
export function ProductScreen({route}:NativeStackScreenProps<RootRoutes,'Product'>){
 const {rows}=useBody(),nav=useNav(),product=rows<SkinProduct>('skinProduct').find(row=>row.id===route.params.id)?.payload;
 if(!product)return <Page><Empty title="Product unavailable" detail="It may have been deleted."/></Page>;
 return <Page><Kicker>{product.category} · {product.status}</Kicker><Heading>{product.name}</Heading><Label muted>{product.brand}</Label><Card><Kicker>Ingredients & use</Kicker><Label>{product.actives.join(' · ')||'No ingredients recorded'}</Label><Label muted>{product.useCase||'No usage notes recorded'}</Label><Label>Opened: {product.openedAt||'Not recorded'}</Label><Label>Expires: {product.expiresAt||'Not recorded'}</Label></Card>{product.notes!==''&&<Card><Kicker>Notes</Kicker><Label>{product.notes}</Label></Card>}<Action title="Edit product" onPress={()=>nav.navigate('ProductEditor',{id:product.id})}/></Page>;
}
export function ProductEditorScreen({route}:NativeStackScreenProps<RootRoutes,'ProductEditor'>){return <RecordEditor spec={careSpecs[0]} id={route.params?.id} title="Product details"/>;}
export function RoutinesScreen(){
 const {rows}=useBody(),nav=useNav(),[slot,setSlot]=useState<'am'|'pm'>('am');
 const saved=rows<SkinRoutine>('skinRoutine').map(row=>row.payload);
 // Keep the other starter slot available when a member has saved a custom AM
 // or PM routine. A custom morning routine must not make the evening starter
 // routine disappear.
 const routines=defaultSkinRoutines().filter(routine=>routine.slot===slot).map(starter=>saved.find(routine=>routine.id===starter.id||routine.slot===starter.slot)||starter);
 return <Page><Kicker>Your daily rituals</Kicker><Heading>AM / PM Routines</Heading><Row><Chip title="Morning" selected={slot==='am'} onPress={()=>setSlot('am')}/><Chip title="Evening" selected={slot==='pm'} onPress={()=>setSlot('pm')}/></Row>{routines.map(routine=><Card key={routine.id}><Kicker>{saved.length?'Your routine':'Starter template'}</Kicker><Heading size={23}>{routine.name}</Heading>{routine.steps.map((step,index)=><Card key={step.id}><Kicker>Step {index+1}{step.paused?' · Paused':''}</Kicker><Heading size={18}>{step.label}</Heading>{step.notes!==''&&<Label muted>{step.notes}</Label>}{step.waitMin>0&&<Label muted size={12}>Wait {step.waitMin} minutes</Label>}</Card>)}<Action title="Run routine" onPress={()=>nav.navigate('RoutineRun',{id:routine.id})}/><Action title="Edit routine" secondary onPress={()=>nav.navigate('RoutineEditor',{id:routine.id})}/></Card>)}<Action title="Create a routine" secondary icon="plus" onPress={()=>nav.navigate('RoutineEditor')}/></Page>;
}
export function SkinJournalScreen(){
 const {rows}=useBody(),nav=useNav(),[metric,setMetric]=useState<'barrier'|'hydration'|'oiliness'|'irritation'>('barrier');
 const logs=rows<SkinLog>('skinLog').sort((a,b)=>b.payload.date.localeCompare(a.payload.date));
 const points=logs.filter(row=>typeof row.payload[metric]==='number').map(row=>({date:row.payload.date,value:row.payload[metric] as number}));
 return <Page><Kicker>Observe your consistency</Kicker><Heading>Skin Journal</Heading><Action title="Log today’s skin" onPress={()=>nav.navigate('SkinCheckIn')}/><Row wrap>{(['barrier','hydration','oiliness','irritation'] as const).map(key=><Chip key={key} title={key==='hydration'?'Skin hydration':key} selected={metric===key} onPress={()=>setMetric(key)}/>)}</Row><Card><TrendChart title={metric==='hydration'?'Skin hydration':metric} unit="/10" points={points}/><Label muted size={12}>Only self-reported observations appear in this chart.</Label></Card>{logs.map(row=><Card key={row.id}><Kicker>{row.payload.date}</Kicker><Row><Metric title="Barrier" value={row.payload.barrier??'—'} unit="/10"/><Metric title="Irritation" value={row.payload.irritation??'—'} unit="/10"/></Row><Label muted>AM: {row.payload.routineDone.am?'Done':'Not logged'} · PM: {row.payload.routineDone.pm?'Done':'Not logged'}</Label>{row.payload.notes!==''&&<Label>{row.payload.notes}</Label>}<Action title="View / edit entry" secondary onPress={()=>nav.navigate('SkinCheckIn',{id:row.id})}/></Card>)}{logs.length===0&&<Empty title="Begin your skin journal" detail="Record your observations to see changes over time."/>}</Page>;
}
export function SkinCheckInScreen({route}:NativeStackScreenProps<RootRoutes,'SkinCheckIn'>){
 const {rows}=useBody(),existing=rows<SkinLog>('skinLog').find(row=>route.params?.id?row.id===route.params.id:row.payload.date===localDateKey());
 const spec:RecordSpec={type:'skinLog',title:'Skin check-in',defaults:{concerns:[],routineDone:{am:false,pm:false}},fields:[{key:'date',label:'Date',kind:'date',required:true},...['barrier','hydration','oiliness','irritation'].map(key=>({key,label:key==='hydration'?'Skin hydration (1–10)':`${key} (1–10)`,kind:'number' as const,min:1,max:10,required:true})),{key:'routineDone.am',label:'Morning routine completed',kind:'boolean'},{key:'routineDone.pm',label:'Evening routine completed',kind:'boolean'},{key:'concerns',label:'Concerns',kind:'list'},{key:'notes',label:'Your observations'}]};
 return <RecordEditor spec={spec} id={existing?.id}/>;
}
