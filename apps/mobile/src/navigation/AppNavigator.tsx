import {useEffect,useState,type ComponentType} from 'react';
import {NavigationContainer,DarkTheme,DefaultTheme} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import type {RootRoutes} from './routes';
import {useTheme,fonts} from '../ui/theme';
import {Card,Heading,Icon,Label,Loading,Page} from '../ui/kit';
import {useBody} from '../state/BodyProvider';
import {preference} from '../lib/store';
import {EntryScreen} from '../screens/EntryScreen';
import {TodayScreen,TrainScreen,ProgressScreen,CareScreen,MoreScreen} from '../screens/HubScreens';
import {ReadinessScreen,ReadinessHistoryScreen,ReadinessResultScreen} from '../screens/ReadinessScreens';
import {WorkoutScreen} from '../screens/WorkoutScreen';
import {PlansScreen,WorkoutPreviewScreen} from '../screens/PlanScreens';
import {WeekEditorScreen,DayEditorScreen,PrescriptionScreen} from '../screens/WeekEditorScreens';
import {LibraryScreen,ExerciseScreen,useCatalog} from '../screens/LibraryScreens';
import {ProgramsScreen,ProgramScreen} from '../screens/ProgramScreens';
import {TrainingCalendarScreen,ScheduleEditorScreen} from '../screens/CalendarScreen';
import {RecordsScreen,SessionScreen,StrengthScreen,GoalsScreen,GoalScreen,BodyScreen} from '../screens/ProgressScreens';
import {SessionEditorScreen} from '../screens/SessionEditorScreen';
import {RecordEditor} from '../screens/RecordEditor';
import {ReportsScreen} from '../screens/ReportsScreen';
import {SkinProfileScreen,ProductsScreen,ProductScreen,ProductEditorScreen,RoutinesScreen,SkinJournalScreen,SkinCheckInScreen} from '../screens/CareScreens';
import {RoutineRunScreen} from '../screens/RoutineRunScreen';
import {AccountScreen,ConflictsScreen,AppearanceScreen,RemindersScreen,HealthScreen,PermissionsScreen} from '../screens/ConnectionScreens';
import {DeviceSyncScreen} from '../screens/SyncScreen';
import {BackupScreen} from '../screens/BackupScreen';
import {SecurityScreen} from '../screens/SecurityScreen';
import {WorkoutResumeBar} from './WorkoutResumeBar';
import {PlanEditor} from '../components/PlanEditor';
import {RoutineEditor} from '../components/RoutineEditor';
import {ProgressAnalysis} from '../components/ProgressAnalysis';
import {LocalCoach} from '../components/LocalCoach';
import {AiCoach} from '../components/AiCoach';
import {RecordManager,type RecordSpec} from '../components/RecordManager';
import {progressSpecs,profileSpec} from '../components/record-specs';

const Stack=createNativeStackNavigator<RootRoutes>();
type Tabs={TodayTab:undefined;TrainTab:undefined;ProgressTab:undefined;CareTab:undefined;MoreTab:undefined};
const Tab=createBottomTabNavigator<Tabs>();

function PlanImportScreen(){const {records,refresh}=useBody();return <Page><PlanEditor records={records} onSaved={refresh}/></Page>;}
function SplitsScreen(){const {records,refresh}=useBody();return <Page><Heading>Saved splits</Heading><PlanEditor records={records} onSaved={refresh} entityType="librarySplit"/></Page>;}
function AnalyticsScreen(){const {records,units}=useBody();return <Page><ProgressAnalysis records={records} units={units}/></Page>;}
function GoalEditorScreen({route}:any){return <RecordEditor spec={progressSpecs[0]} id={route.params?.id} title="Goal editor"/>;}
function GoalCheckInScreen({route}:any){return <RecordEditor spec={{...progressSpecs[1],defaults:{goalId:route.params.goalId}}} id={route.params.id} title="Goal check-in"/>;}
function MeasurementEditorScreen({route}:any){return <RecordEditor spec={progressSpecs[2]} id={route.params?.id} title="Log measurements"/>;}
function ProfileScreen(){return <RecordEditor spec={profileSpec} title="Your profile"/>;}
function RoutineEditorScreen(){const {records,refresh}=useBody();return <Page><Heading>Routine editor</Heading><RoutineEditor records={records} onSaved={refresh}/></Page>;}
function makeRecords(type:string,title:string){return function Records(){const {records,refresh}=useBody();return <Page><Heading>{title}</Heading>{progressSpecs.filter(spec=>spec.type===type||(type==='habit'&&spec.type==='habitLog')).map(spec=><RecordManager key={spec.type} spec={spec} records={records} onSaved={refresh}/>)}</Page>;};}
function makeCoach(skin=false){return function Coach(){const {records,refresh}=useBody();return <Page><Heading>{skin?'Skin Coach':'Training Coach'}</Heading><LocalCoach records={records} skin={skin}/><AiCoach records={records} onSaved={refresh} skin={skin}/></Page>;};}
function PendingScreen(){return <Page><Heading>Not connected yet</Heading><Label>Desktop-only delivery is being kept separate from your phone so credentials and scheduled work never run on the device.</Label></Page>;}
function HelpScreen(){return <Page><Heading>Body OS 4.0</Heading><Card><Heading size={20}>Logging</Heading><Label>Swipe between cards, then use Log set, Save check-in or Finish workout to commit your record.</Label></Card><Card><Heading size={20}>Your data</Heading><Label>Core records work offline. Use the same Google account to sync devices, and create a backup before moving phones.</Label></Card><Label muted>Design and device acceptance are still in progress.</Label></Page>;}
const exerciseSpec:RecordSpec={type:'exercise',title:'Exercise details',defaults:{aliases:[],muscles:[],substitutions:[],equipment:'',movementPattern:'',trackingMode:'weight_reps'},fields:[{key:'name',label:'Exercise name',required:true},{key:'equipment',label:'Equipment'},{key:'muscles',label:'Muscles',kind:'list'},{key:'aliases',label:'Other names',kind:'list'},{key:'movementPattern',label:'Movement pattern'},{key:'trackingMode',label:'Tracking',options:['weight_reps','reps','time'],required:true},{key:'defaultCue',label:'Technique cue'},{key:'defaultRestSec',label:'Rest seconds',kind:'number',min:0,max:86400},{key:'defaultTempo',label:'Tempo'},{key:'tutorialLink',label:'Tutorial URL'}]};
function ExerciseEditorScreen({route}:any){const catalog=useCatalog(),source=catalog.find(row=>row.id===route.params?.id);return <RecordEditor spec={exerciseSpec} id={route.params?.id} source={source as any}/>;}

const screens:Record<keyof RootRoutes,ComponentType<any>>={
 Today:TodayScreen,Train:TrainScreen,Progress:ProgressScreen,Care:CareScreen,More:MoreScreen,
 Readiness:ReadinessScreen,ReadinessHistory:ReadinessHistoryScreen,ReadinessResult:ReadinessResultScreen,
 Workout:WorkoutScreen,WorkoutPreview:WorkoutPreviewScreen,Plans:PlansScreen,Week:WeekEditorScreen,Day:DayEditorScreen,Prescription:PrescriptionScreen,PlanImport:PlanImportScreen,
 Library:LibraryScreen,Exercise:ExerciseScreen,ExerciseEditor:ExerciseEditorScreen,Splits:SplitsScreen,Programs:ProgramsScreen,Program:ProgramScreen,Calendar:TrainingCalendarScreen,ScheduleEditor:ScheduleEditorScreen,
 Records:RecordsScreen,Session:SessionScreen,SessionEditor:SessionEditorScreen,Analytics:AnalyticsScreen,Strength:StrengthScreen,LiftHistory:AnalyticsScreen,
 GoalCheckIn:GoalCheckInScreen,Goals:GoalsScreen,Goal:GoalScreen,GoalEditor:GoalEditorScreen,Body:BodyScreen,MeasurementEditor:MeasurementEditorScreen,Habits:makeRecords('habit','Habits'),Cardio:makeRecords('cardio','Cardio history'),Pain:makeRecords('painLog','Pain & injury log'),WeeklyReview:makeRecords('weeklyReview','Weekly review'),
 Coach:makeCoach(),Reports:ReportsScreen,SkinProfile:SkinProfileScreen,Products:ProductsScreen,Product:ProductScreen,ProductEditor:ProductEditorScreen,Routines:RoutinesScreen,RoutineEditor:RoutineEditorScreen,RoutineRun:RoutineRunScreen,SkinJournal:SkinJournalScreen,SkinCheckIn:SkinCheckInScreen,SkinCoach:makeCoach(true),
 Account:AccountScreen,Sync:DeviceSyncScreen,Conflicts:ConflictsScreen,Backups:BackupScreen,Profile:ProfileScreen,Appearance:AppearanceScreen,Reminders:RemindersScreen,Health:HealthScreen,Permissions:PermissionsScreen,AISettings:makeCoach(),Security:SecurityScreen,PC:PendingScreen,Help:HelpScreen,
};
function ScreenStack({initial}:{initial:keyof RootRoutes}){const theme=useTheme();return <Stack.Navigator initialRouteName={initial} screenOptions={{headerStyle:{backgroundColor:theme.background},headerTintColor:theme.text,headerTitleStyle:{fontFamily:fonts.heading,fontSize:16},contentStyle:{backgroundColor:theme.background},animation:'slide_from_right'}}>{(Object.entries(screens) as [keyof RootRoutes,ComponentType<any>][]).map(([name,component])=><Stack.Screen key={name} name={name} component={component} options={{title:name===initial?'BODY OS · V4.0':name.replace(/([a-z])([A-Z])/g,'$1 $2')}}/>)}</Stack.Navigator>;}
const TodayStack=()=> <ScreenStack initial="Today"/>;
const TrainStack=()=> <ScreenStack initial="Train"/>;
const ProgressStack=()=> <ScreenStack initial="Progress"/>;
const CareStack=()=> <ScreenStack initial="Care"/>;
const MoreStack=()=> <ScreenStack initial="More"/>;

export function AppNavigator(){
 const theme=useTheme(),{loading,error,theme:mode}=useBody(),[onboarded,setOnboarded]=useState<boolean|null>(null);
 useEffect(()=>{void preference('onboardingVersion',0).then(value=>setOnboarded(value>=1));},[]);
 if(loading||onboarded===null)return <Loading message={error||'Opening your space…'}/>;
 if(!onboarded)return <EntryScreen onComplete={async()=>setOnboarded(true)}/>;
 const base=mode==='light'?DefaultTheme:DarkTheme;
 return <NavigationContainer theme={{...base,colors:{...base.colors,background:theme.background,card:theme.panel,text:theme.text,border:theme.line,primary:theme.lime}}}><Tab.Navigator tabBar={props=><WorkoutResumeBar {...props}/>} screenOptions={({route})=>({headerShown:false,tabBarActiveTintColor:theme.lime,tabBarInactiveTintColor:theme.muted,tabBarStyle:{backgroundColor:theme.background,borderTopColor:theme.line},tabBarLabelStyle:{fontFamily:fonts.medium,fontSize:11},tabBarIcon:({color})=><Icon name={route.name==='TodayTab'?'home':route.name==='TrainTab'?'train':route.name==='ProgressTab'?'progress':route.name==='CareTab'?'care':'more'} color={color}/>})}><Tab.Screen name="TodayTab" component={TodayStack} options={{title:'Today'}}/><Tab.Screen name="TrainTab" component={TrainStack} options={{title:'Train'}}/><Tab.Screen name="ProgressTab" component={ProgressStack} options={{title:'Progress'}}/><Tab.Screen name="CareTab" component={CareStack} options={{title:'Care'}}/><Tab.Screen name="MoreTab" component={MoreStack} options={{title:'More'}}/></Tab.Navigator></NavigationContainer>;
}
