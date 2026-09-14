import { useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
export function TrendChart({title,points,unit=''}:{title:string;points:{date:string;value:number}[];unit?:string}) {
  const [range,setRange]=useState(90),[selected,setSelected]=useState<number|null>(null);
  const width=Math.max(180,Math.min(600,useWindowDimensions().width-88)),height=150,pad=12;
  const cutoff=range?Date.now()-range*86400000:-Infinity;
  const data=points.map(p=>({...p,time:Date.parse(`${p.date}T12:00:00`)})).filter(p=>Number.isFinite(p.value)&&Number.isFinite(p.time)&&p.time>=cutoff).sort((a,b)=>a.time-b.time);
  const first=data[0]?.time||0,last=data.at(-1)?.time||first;
  const low=data.length?Math.min(...data.map(p=>p.value)):0,high=data.length?Math.max(...data.map(p=>p.value)):0;
  const x=(i:number)=>last===first?width/2:pad+(data[i].time-first)/(last-first)*(width-2*pad);
  const y=(i:number)=>high===low?height/2:height-pad-(data[i].value-low)/(high-low)*(height-2*pad);
  const point=selected==null?data.at(-1):data[selected]||data.at(-1);
  return <View style={{gap:8,paddingVertical:10}}><Text style={{color:'#F6F7F8',fontSize:17}}>{title}</Text><View style={{flexDirection:'row',gap:8}}>{[30,90,0].map(days=><Pressable accessibilityRole="button" accessibilityState={{selected:range===days}} key={days} style={{padding:12,backgroundColor:range===days?'#2C3038':'#232A35',borderRadius:8}} onPress={()=>{setRange(days);setSelected(null);}}><Text style={{color:'#F6F7F8'}}>{days?`${days} days`:'All'}</Text></Pressable>)}</View>
    {data.length?<><Text style={{color:'#A7ADB7'}}>Range {low.toFixed(1)}–{high.toFixed(1)} {unit}</Text><Svg width={width} height={height} accessibilityLabel={`${title}, ${data.length} readings`}>
      <Line x1={pad} x2={width-pad} y1={height-pad} y2={height-pad} stroke="#53645a"/>
      {data.length>1&&<Polyline points={data.map((_,i)=>`${x(i)},${y(i)}`).join(' ')} fill="none" stroke="#9EEA22" strokeWidth={2}/>}
      {data.map((p,i)=><Circle key={`${p.date}-${i}`} cx={x(i)} cy={y(i)} r={selected===i?7:4} fill="#9EEA22" onPress={()=>setSelected(i)} accessibilityLabel={`${p.date}: ${p.value} ${unit}`}/>)}
    </Svg><Text style={{color:'#A7ADB7'}}>{data[0].date} — {data.at(-1)!.date}</Text><Text accessibilityLiveRegion="polite" style={{color:'#F6F7F8'}}>{point?.date}: {point?.value.toFixed(1)} {unit}</Text></>:<Text style={{color:'#A7ADB7'}}>No recorded values in this period.</Text>}
  </View>;
}
