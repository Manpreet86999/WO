import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
export type RootRoutes={
 Today:undefined;Train:undefined;Progress:undefined;Care:undefined;More:undefined;
 Readiness:{id?:string}|undefined;ReadinessHistory:undefined;ReadinessResult:{id:string};
 Workout:undefined;WorkoutPreview:{weekId:string;dayKey:string};Plans:undefined;Week:{id?:string}|undefined;Day:{weekId:string;dayKey?:string};Prescription:{weekId:string;dayKey:string;index?:number};PlanImport:undefined;
 Library:undefined;Exercise:{id:string};ExerciseEditor:{id?:string}|undefined;Splits:undefined;Programs:undefined;Program:{id?:string}|undefined;Calendar:undefined;ScheduleEditor:{id?:string;date?:string}|undefined;
 Records:undefined;Session:{id:string};SessionEditor:{id:string};Analytics:{section?:string}|undefined;Strength:undefined;LiftHistory:undefined;
 GoalCheckIn:{goalId:string;id?:string};Goals:undefined;Goal:{id:string};GoalEditor:{id?:string}|undefined;Body:undefined;MeasurementEditor:{id?:string}|undefined;Habits:undefined;Cardio:undefined;Pain:undefined;WeeklyReview:undefined;
 Coach:undefined;Reports:undefined;SkinProfile:undefined;Products:undefined;Product:{id:string};ProductEditor:{id?:string}|undefined;Routines:undefined;RoutineEditor:{id?:string}|undefined;RoutineRun:{id:string};SkinJournal:undefined;SkinCheckIn:{id?:string}|undefined;SkinCoach:undefined;
 Account:undefined;Sync:undefined;Conflicts:undefined;Backups:undefined;Profile:undefined;Appearance:undefined;Reminders:undefined;Health:undefined;Permissions:undefined;AISettings:undefined;Security:undefined;PC:undefined;Help:undefined;
};
export const useNav=()=>useNavigation<NativeStackNavigationProp<RootRoutes>>();
