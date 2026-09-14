// Development-only visual review of the native screens. Uses a separate browser database.
// This is not the production Body OS web app or a substitute for Android acceptance.
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {useFonts} from 'expo-font';
import {Manrope_700Bold,Manrope_800ExtraBold} from '@expo-google-fonts/manrope';
import {HankenGrotesk_400Regular,HankenGrotesk_600SemiBold,HankenGrotesk_700Bold} from '@expo-google-fonts/hanken-grotesk';
import {ActivityIndicator,Text,View} from 'react-native';
import * as SQLite from 'expo-sqlite';
import {configureDatabaseFactory} from './src/lib/store';
import {BodyProvider} from './src/state/BodyProvider';
import {AppNavigator} from './src/navigation/AppNavigator';
if(__DEV__)configureDatabaseFactory(async()=>{const db=await SQLite.openDatabaseAsync('body-os-design-review.db');let queue=Promise.resolve();db.withExclusiveTransactionAsync=task=>{const next=queue.catch(()=>{}).then(()=>db.withTransactionAsync(()=>task(db)));queue=next;return next;};return db;});
export default function ReviewApp(){const [loaded,error]=useFonts({Manrope_700Bold,Manrope_800ExtraBold,HankenGrotesk_400Regular,HankenGrotesk_600SemiBold,HankenGrotesk_700Bold});if(!__DEV__)return <Text>Development preview only.</Text>;if(!loaded)return <Text>{error?.message||'Loading preview fonts…'}</Text>;return <SafeAreaProvider><View style={{flex:1,backgroundColor:'#0d141e'}}><Text style={{backgroundColor:'#25301c',color:'#dce3f2',textAlign:'center',fontSize:11,padding:4}}>DESIGN REVIEW · Separate test database · Native integrations require Android</Text><BodyProvider><AppNavigator/></BodyProvider></View></SafeAreaProvider>;}
