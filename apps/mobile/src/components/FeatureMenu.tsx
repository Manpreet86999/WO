import {Children,isValidElement,useState,type ReactNode} from 'react';
import {Alert,BackHandler,Pressable,StyleSheet,Text,View} from 'react-native';
import {useEffect} from 'react';

/** Keep existing working feature components intact while giving each a focused destination. */
export function FeatureMenu({children,labels}:{children:ReactNode;labels:string[]}){
 const items=Children.toArray(children).filter(isValidElement),[selected,setSelected]=useState<number|null>(null);
 function close(){Alert.alert('Leave this screen?','Save any edits before leaving.',[{text:'Keep editing',style:'cancel'},{text:'Leave',onPress:()=>setSelected(null)}]);}
 useEffect(()=>{if(selected===null)return;const sub=BackHandler.addEventListener('hardwareBackPress',()=>{close();return true;});return()=>sub.remove();},[selected]);
 if(selected!==null)return <View style={{gap:20}}><Pressable accessibilityRole="button" onPress={close} style={s.back}><Text style={s.accent}>← All features</Text></Pressable><Text style={s.heading}>{labels[selected]||'Details'}</Text>{items[selected]}</View>;
 return <View style={{gap:12}}>{items.map((_,i)=><Pressable accessibilityRole="button" key={labels[i]||i} onPress={()=>setSelected(i)} style={s.row}><View style={s.icon}><Text style={s.accent}>{String(i+1).padStart(2,'0')}</Text></View><Text style={s.title}>{labels[i]||'Details'}</Text><Text style={s.accent}>↗</Text></Pressable>)}</View>;
}
const s=StyleSheet.create({row:{flexDirection:'row',alignItems:'center',gap:16,padding:20,borderRadius:20,backgroundColor:'#17191F',borderWidth:1,borderColor:'#2C3038'},icon:{width:42,height:42,borderRadius:12,backgroundColor:'#242E18',alignItems:'center',justifyContent:'center'},accent:{color:'#9EEA22',fontSize:16,fontWeight:'700'},title:{color:'#F6F7F8',fontWeight:'600',fontSize:17,flex:1},heading:{color:'#F6F7F8',fontSize:26,fontWeight:'800'},back:{alignSelf:'flex-start',minHeight:48,justifyContent:'center'}});
