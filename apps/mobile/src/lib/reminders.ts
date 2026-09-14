import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { inQuietHours, parseClock, reminderMinute } from '../../../../src/shared/reminders';
import { preference, setPreference } from './store';
export interface ReminderSettings { enabled:boolean; workout:string; skincare:string; quietStart:string; quietEnd:string; }
export const defaultReminders:ReminderSettings={enabled:false,workout:'17:00',skincare:'21:00',quietStart:'22:00',quietEnd:'07:00'};
async function permission() {
  if(Platform.OS==='android') await Notifications.setNotificationChannelAsync('body-os',{name:'Body OS reminders',importance:Notifications.AndroidImportance.DEFAULT});
  if(Platform.OS==='android') await Notifications.setNotificationChannelAsync('body-os-silent',{name:'Body OS quiet timers',importance:Notifications.AndroidImportance.LOW,sound:null});
  const state=await Notifications.requestPermissionsAsync();
  if(!state.granted) throw new Error('Notifications are disabled. Enable them in Android settings to receive reminders.');
}
/** Request notifications only after the member has seen the in-app explanation. */
export async function requestNotificationPermission(){await permission();return Notifications.getPermissionsAsync();}
export async function notificationPermissionStatus(){return Notifications.getPermissionsAsync();}
export async function configureReminders(settings:ReminderSettings) {
  const workout=reminderMinute(settings.workout,settings.quietStart,settings.quietEnd);
  const skincare=reminderMinute(settings.skincare,settings.quietStart,settings.quietEnd);
  if(settings.enabled) await permission();
  for(const id of ['body-os-workout','body-os-skincare']) await Notifications.cancelScheduledNotificationAsync(id);
  if(settings.enabled) {
    try {
      for(const [id,minute,body] of [['body-os-workout',workout,'Your planned workout is ready.'],['body-os-skincare',skincare,'Time to check your skincare routine.']] as const) {
        await Notifications.scheduleNotificationAsync({identifier:id,content:{title:'Body OS',body},trigger:{type:Notifications.SchedulableTriggerInputTypes.DAILY,hour:Math.floor(minute/60),minute:minute%60,channelId:'body-os'}});
      }
    } catch(error) {
      for(const id of ['body-os-workout','body-os-skincare']) await Notifications.cancelScheduledNotificationAsync(id);
      await setPreference('reminders',{...settings,enabled:false});throw error;
    }
  }
  await setPreference('reminders',settings);
}
export async function startRest(seconds=90) {
  await permission();
  const settings=await preference('reminders',defaultReminders);
  const finish=new Date(Date.now()+seconds*1000);
  const quiet=inQuietHours(finish.getHours()*60+finish.getMinutes(),parseClock(settings.quietStart),parseClock(settings.quietEnd));
  await Notifications.cancelScheduledNotificationAsync('body-os-rest');
  await Notifications.scheduleNotificationAsync({identifier:'body-os-rest',content:{title:'Rest complete',body:'Ready for your next set?',sound:quiet?false:'default'},trigger:{type:Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,seconds,channelId:quiet?'body-os-silent':'body-os'}});
  return finish.toISOString();
}
