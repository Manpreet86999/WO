import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { preference, setPreference } from '../lib/store';
import { startRest } from '../lib/reminders';

export function RestTimer({defaultSeconds=90,refreshToken=0}:{defaultSeconds?:number;refreshToken?:number}) {
  const [end,setEnd]=useState(0),[now,setNow]=useState(Date.now()),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{let active=true;void preference('restEndsAt',0).then(v=>{if(active)setEnd(v);});const timer=setInterval(()=>setNow(Date.now()),500);return()=>{active=false;clearInterval(timer);};},[refreshToken]);
  const remaining=Math.max(0,Math.ceil((end-now)/1000));
  async function update(seconds:number) {
    if(busy)return;setBusy(true);setMessage('');
    try {
      const target=seconds>0?Date.now()+seconds*1000:0;
      await setPreference('restEndsAt',target);setEnd(target);setNow(Date.now());
      try {if(seconds>0)await startRest(seconds);else await Notifications.cancelScheduledNotificationAsync('body-os-rest');}
      catch {setMessage('The on-screen timer works; Android notifications are unavailable.');}
    } catch {setMessage('Could not save the timer. Try again.');}finally{setBusy(false);}
  }
  return <View style={{gap:10,paddingVertical:12}}><Text accessibilityLiveRegion="none" style={{color:'#F6F7F8',fontSize:24}}>Rest: {Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</Text>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{[defaultSeconds,60,120].filter((v,i,a)=>a.indexOf(v)===i).map(seconds=><Pressable accessibilityRole="button" disabled={busy} key={seconds} style={{padding:14,backgroundColor:'#232A35',borderRadius:10}} onPress={()=>void update(seconds)}><Text style={{color:'#F6F7F8'}}>Start {seconds}s</Text></Pressable>)}
    {remaining>0&&<><Pressable accessibilityRole="button" disabled={busy} style={{padding:14}} onPress={()=>void update(remaining+30)}><Text style={{color:'#F6F7F8'}}>+30 sec</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} style={{padding:14}} onPress={()=>void update(0)}><Text style={{color:'#F6F7F8'}}>Skip rest</Text></Pressable></>}
    </View>{message?<Text style={{color:'#A7ADB7'}}>{message}</Text>:null}</View>;
}
