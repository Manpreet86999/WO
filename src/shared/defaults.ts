import type { AppSettings, Profile } from './types.js';

export const emptySettings = (): AppSettings => ({
  senderName: 'Body OS',
  userEmail: '',
  senderEmail: '',
  appPassword: '',
  recipients: [] as string[],
  streakStartDate: '',
  aiProvider: 'openrouter',
  aiApiKey: '',
  openRouterApiKey: '',
  nvidiaNimApiKey: '',
  /** Best free OpenRouter coaching model */
  aiModel: 'google/gemma-4-31b-it:free',
  pinHash: '',
  secretsSalt: '',
  telegramBotToken: '',
  telegramChatId: '',
  reportSchedule: 'Sunday 20:00',
  braveSearchApiKey: '',
  isActivated: false,
  productKeyHash: '',
  hasSeenFeatureGuide: false,
  githubUpdatesRepo: '',
  autoCheckUpdates: true,
  gdriveEnabled: false,
  gdriveSchedule: 'weekly',
  gdriveLastBackup: '',
  gdriveLastBackupSize: 0,
  gdriveFolderId: '',
  gdriveRefreshToken: '',
});

export const defaultProfile = (): Omit<Profile, 'createdAt'> & { createdAt: string } => ({
  displayName: '',
  units: 'kg' as const,
  createdAt: new Date().toISOString(),
});
