import {useEffect,useState} from 'react';
import {Pressable,Text} from 'react-native';
import {BottomTabBar,type BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {View} from 'react-native';
import {preference,subscribePreferences} from '../lib/store';
import {fonts,useTheme} from '../ui/theme';
export function WorkoutResumeBar(props:BottomTabBarProps){
 const t=useTheme(),[title,setTitle]=useState('');
 useEffect(()=>{let active=true;const load=async()=>{const draft=await preference<{dayTitle?:string;logs?:{sets:unknown[]}[]}|null>('workoutDraft',null);if(active)setTitle(draft?.logs?.some(l=>l.sets.length)?draft.dayTitle||'Workout in progress':'');};void load().catch(()=>{});const unsubscribe=subscribePreferences(key=>{if(key==='workoutDraft')void load().catch(()=>{});});return()=>{active=false;unsubscribe();};},[]);
 const current=props.state.routes[props.state.index];
 const stack=current.state;
 const workoutVisible=stack?.routes[stack.index??0]?.name==='Workout';
 return <View>{title!==''&&!workoutVisible&&<Pressable accessibilityRole="button" accessibilityLabel="Resume active workout" onPress={()=>props.navigation.navigate('TrainTab',{screen:'Workout'})} style={{paddingHorizontal:20,paddingVertical:12,backgroundColor:t.raised,borderTopWidth:1,borderColor:t.line}}><Text style={{fontFamily:fonts.bold,color:t.lime,fontSize:14}}>Resume · {title}</Text></Pressable>}<BottomTabBar {...props}/></View>;
}
