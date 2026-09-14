import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { dateKeySchema } from '../../../../src/shared/schemas';
import { localDateKey } from '../../../../src/shared/evidence';
import type { SyncRecord, SyncEntityType } from '../../../../src/shared/sync';
import { deviceId, saveRecord } from '../lib/store';

export type FieldSpec = {key:string;label:string;kind?:'number'|'date'|'boolean'|'list';required?:boolean;min?:number;max?:number;options?:string[];reference?:SyncEntityType;dayOf?:string};
export type RecordSpec = {type:SyncEntityType;title:string;fields:FieldSpec[];defaults?:Record<string,unknown>;singleton?:string};
type Props = {spec:RecordSpec;records:SyncRecord[];onSaved:()=>Promise<void>};

/** Native forms edit only declared fields, preserving metadata from other clients. */
export function RecordManager({spec,records,onSaved}:Props) {
  const [form,setForm]=useState<Record<string,unknown>|null>(null);
  const [original,setOriginal]=useState<SyncRecord>();
  const lock=useRef(false);
  const [busy,setBusy]=useState(false),[query,setQuery]=useState('');
  const rows=records.filter(r=>r.entityType===spec.type&&!r.deletedAt);
  const begin=(row?:SyncRecord)=>{setOriginal(row);setForm(row?{...row.payload as object}:{...spec.defaults,date:localDateKey()});};
  const commit=async(deleting=false)=>{
    if(lock.current||!form)return;lock.current=true;setBusy(true);
    try {
      const payload={...form};
      if(!deleting) for(const field of spec.fields) {
        const raw=payload[field.key],empty=raw===undefined||raw===null||String(raw).trim()==='';
        if(field.required&&empty)throw new Error(`${field.label} is required.`);
        if(empty){payload[field.key]=field.kind==='list'?[]:field.kind==='boolean'?false:'';continue;}
        if(field.kind==='number') {
          const n=Number(raw);if(!Number.isFinite(n)||(field.min!=null&&n<field.min)||(field.max!=null&&n>field.max))throw new Error(`Check ${field.label}${field.min!=null?` (minimum ${field.min})`:''}${field.max!=null?` (maximum ${field.max})`:''}.`);
          payload[field.key]=n;
        } else if(field.kind==='date') {if(!dateKeySchema.safeParse(raw).success)throw new Error(`${field.label}: use a real date in YYYY-MM-DD format.`);}
        else if(field.kind==='list') payload[field.key]=Array.isArray(raw)?raw:String(raw).split(',').map(x=>x.trim()).filter(Boolean);
        else if(field.kind!=='boolean')payload[field.key]=String(raw).trim();
        if(field.dayOf){const plan=records.find(r=>r.entityType==='week'&&r.id===payload[field.dayOf!]&&!r.deletedAt)?.payload as {days?:{key:string}[]}|undefined;if(!plan?.days?.some(day=>day.key===raw))throw new Error('Choose a day from the selected plan.');}
        if(field.options&&!field.options.includes(String(payload[field.key])))throw new Error(`Choose ${field.label}.`);
        if(field.reference&&!records.some(r=>r.entityType===field.reference&&r.id===raw&&!r.deletedAt))throw new Error(`Choose an existing ${field.label}.`);
      }
      const now=new Date().toISOString(),id=original?.id||spec.singleton||`${spec.type}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      await saveRecord({id,entityType:spec.type,payload:{...payload,id,createdAt:payload.createdAt||now,updatedAt:now},updatedAt:now,revision:original?.revision||1,deviceId:await deviceId(),...(deleting?{deletedAt:now}:{})},true,original?(original.deviceId==='builtin'?0:original.revision):0);
      await onSaved();setForm(null);setOriginal(undefined);
    } catch(error){Alert.alert('Could not save',(error as Error).message);} finally {lock.current=false;setBusy(false);}
  };
  return <View style={s.card}><Text style={s.title}>{spec.title}</Text>{form?<>
    {spec.fields.map(field=><View key={field.key} style={s.group}><Text style={s.text}>{field.label}{field.required?' *':''}</Text>
      {field.kind==='boolean'?<Switch accessibilityLabel={field.label} value={Boolean(form[field.key])} onValueChange={v=>setForm({...form,[field.key]:v})}/>
      :field.dayOf?<View>{((records.find(r=>r.entityType==='week'&&r.id===form[field.dayOf!]&&!r.deletedAt)?.payload as {days?:{key:string;title:string}[]}|undefined)?.days||[]).map(day=><Pressable accessibilityRole="button" key={day.key} style={s.button} onPress={()=>setForm({...form,[field.key]:day.key})}><Text style={s.text}>{form[field.key]===day.key?'✓ ':''}{day.title}</Text></Pressable>)}</View>
      :field.reference?<View>{records.filter(r=>r.entityType===field.reference&&!r.deletedAt).map(row=><Pressable accessibilityRole="button" accessibilityState={{selected:form[field.key]===row.id}} key={row.id} style={s.button} onPress={()=>setForm({...form,[field.key]:row.id,...Object.fromEntries(spec.fields.filter(f=>f.dayOf===field.key).map(f=>[f.key,'']))})}><Text style={s.text}>{form[field.key]===row.id?'âœ“ ':''}{String((row.payload as Record<string,unknown>).name||(row.payload as Record<string,unknown>).title||row.id)}</Text></Pressable>)}{!records.some(r=>r.entityType===field.reference&&!r.deletedAt)&&<Text style={s.text}>Create a {field.label.toLowerCase()} first.</Text>}</View>
      :field.options?<View style={s.wrap}>{field.options.map(value=><Pressable accessibilityRole="button" accessibilityState={{selected:form[field.key]===value}} key={value} style={s.button} onPress={()=>setForm({...form,[field.key]:value})}><Text style={s.text}>{form[field.key]===value?'âœ“ ':''}{value}</Text></Pressable>)}</View>
      :<TextInput accessibilityLabel={field.label} style={s.input} keyboardType={field.kind==='number'?'decimal-pad':'default'} autoCapitalize="none" placeholder={field.kind==='date'?'YYYY-MM-DD':field.kind==='list'?'Separate items with commas':''} placeholderTextColor="#A7ADB7" value={Array.isArray(form[field.key])?(form[field.key] as string[]).join(', '):String(form[field.key]??'')} onChangeText={v=>setForm({...form,[field.key]:v})}/>}
    </View>)}
    <Pressable accessibilityRole="button" disabled={busy} style={s.button} onPress={()=>void commit()}><Text style={s.text}>{busy?'Savingâ€¦':'Save'}</Text></Pressable>
    <Pressable accessibilityRole="button" disabled={busy} style={s.button} onPress={()=>Alert.alert('Discard changes?','Your saved record will remain unchanged.',[{text:'Keep editing',style:'cancel'},{text:'Discard',onPress:()=>setForm(null)}])}><Text style={s.text}>Cancel</Text></Pressable>
    {original&&!spec.singleton&&<Pressable accessibilityRole="button" disabled={busy} style={s.button} onPress={()=>Alert.alert('Delete record?','This deletion will also be sent to your other devices when you sync.',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>void commit(true)}])}><Text style={s.text}>Delete</Text></Pressable>}
  </>:<>
    <Pressable accessibilityRole="button" style={s.button} onPress={()=>begin(spec.singleton?rows[0]:undefined)}><Text style={s.text}>{spec.singleton?'Edit':'Add'}</Text></Pressable>
    {!spec.singleton&&<TextInput accessibilityLabel={`Search ${spec.title}`} style={s.input} placeholder="Search records" placeholderTextColor="#A7ADB7" value={query} onChangeText={setQuery}/>}
    {[...rows].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).filter(r=>JSON.stringify(r.payload).toLowerCase().includes(query.toLowerCase())).map(row=>{const data=row.payload as Record<string,unknown>;return <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${String(data.name||data.title||data.date||spec.title)}`} key={row.id} style={s.row} onPress={()=>begin(row)}>{spec.fields.map(f=><Text key={f.key} style={s.text}>{f.label}: {f.reference?String((records.find(r=>r.id===data[f.key]&&r.entityType===f.reference)?.payload as Record<string,unknown>|undefined)?.name||'Unavailable'):Array.isArray(data[f.key])?(data[f.key] as unknown[]).join(', '):typeof data[f.key]==='boolean'?(data[f.key]?'Yes':'No'):String(data[f.key]??'â€”')}</Text>)}</Pressable>;})}
    {!rows.length&&<Text style={s.text}>No records yet.</Text>}
  </>}</View>;
}
const s=StyleSheet.create({card:{padding:16,gap:12,backgroundColor:'#17191F',borderRadius:18},title:{color:'#9EEA22',fontSize:20,fontWeight:'700'},text:{color:'#F6F7F8',fontSize:15},group:{gap:8},wrap:{flexDirection:'row',flexWrap:'wrap',gap:8},button:{padding:14,minHeight:48,backgroundColor:'#232A35',borderRadius:10},input:{color:'#F6F7F8',padding:13,borderWidth:1,borderColor:'#53645a',borderRadius:10},row:{paddingVertical:14,gap:5,borderTopWidth:1,borderColor:'#53645a'}});
