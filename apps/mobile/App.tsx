import {AppLockGate} from './src/screens/SecurityScreen';
import {AutoSyncService} from './src/state/AutoSyncService';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {useFonts} from 'expo-font';
import {Manrope_700Bold,Manrope_800ExtraBold} from '@expo-google-fonts/manrope';
import {HankenGrotesk_400Regular,HankenGrotesk_600SemiBold,HankenGrotesk_700Bold} from '@expo-google-fonts/hanken-grotesk';
import {ActivityIndicator,Text,View} from 'react-native';
import {BodyProvider} from './src/state/BodyProvider';
import {AppNavigator} from './src/navigation/AppNavigator';
export default function App(){const [loaded,error]=useFonts({Manrope_700Bold,Manrope_800ExtraBold,HankenGrotesk_400Regular,HankenGrotesk_600SemiBold,HankenGrotesk_700Bold});if(!loaded)return <View style={{flex:1,backgroundColor:'#0d141e',justifyContent:'center',alignItems:'center'}}>{error?<Text style={{color:'#ffb4ab'}}>Fonts could not load. Restart Body OS.</Text>:<ActivityIndicator color="#a8f530"/>}</View>;return <SafeAreaProvider><BodyProvider><AppLockGate><AutoSyncService/><AppNavigator/></AppLockGate></BodyProvider></SafeAreaProvider>;}

