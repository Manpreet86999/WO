import {createContext,useContext,type ReactNode} from 'react';
import {useColorScheme} from 'react-native';
export const dark={background:'#0d141e',panel:'#19202b',raised:'#232a35',low:'#151c27',text:'#dce3f2',muted:'#c7c6cb',line:'#46464b',lime:'#a8f530',onLime:'#213600',error:'#ffb4ab',gold:'#FFD043'};
export const light={background:'#f3f5ef',panel:'#ffffff',raised:'#e4e9dd',low:'#edf0e8',text:'#192119',muted:'#4d584b',line:'#bcc5b6',lime:'#406b00',onLime:'#ffffff',error:'#a52b29',gold:'#805b00'};
export type Palette=typeof dark;
const Theme=createContext<Palette>(dark);
export function ThemeProvider({mode,children}:{mode:'dark'|'light'|'system';children:ReactNode}){const system=useColorScheme();return <Theme.Provider value={mode==='light'||mode==='system'&&system==='light'?light:dark}>{children}</Theme.Provider>;}
export const useTheme=()=>useContext(Theme);
export const fonts={body:'HankenGrotesk_400Regular',medium:'HankenGrotesk_600SemiBold',bold:'HankenGrotesk_700Bold',heading:'Manrope_700Bold',display:'Manrope_800ExtraBold'};
