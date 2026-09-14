import * as repo from '../db/repository.js';

export async function sendTelegramMessage(text: string, parseMode: 'MarkdownV2' | 'HTML' = 'MarkdownV2') {
  const s = repo.getSettings();
  if (!s.telegramBotToken || !s.telegramChatId) return;

  const chatIds = s.telegramChatId.split(',').map(id => id.trim()).filter(Boolean);
  if (!chatIds.length) return;

  const url = `https://api.telegram.org/bot${s.telegramBotToken}/sendMessage`;
  
  for (const chatId of chatIds) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode })
      });
      if (!res.ok) {
        const err = await res.text();
        console.error(`Telegram API error for chat ${chatId}:`, err.replace(s.telegramBotToken, '[REDACTED]'));
      }
    } catch (e) {
      console.error(`Failed to send telegram message to ${chatId}:`, e);
    }
  }
}

export async function sendTelegramDocument(filename: string, buffer: Buffer, caption?: string) {
  const s = repo.getSettings();
  if (!s.telegramBotToken || !s.telegramChatId) return;

  const chatIds = s.telegramChatId.split(',').map(id => id.trim()).filter(Boolean);
  if (!chatIds.length) return;

  const url = `https://api.telegram.org/bot${s.telegramBotToken}/sendDocument`;
  
  for (const chatId of chatIds) {
    try {
      const formData = new FormData();
      formData.append('chat_id', chatId);
      if (caption) formData.append('caption', caption);
      
      const blob = new Blob([new Uint8Array(buffer)], { type: 'application/pdf' });
      formData.append('document', blob, filename);

      const res = await fetch(url, {
        method: 'POST',
        body: formData as any
      });
      if (!res.ok) {
        const err = await res.text();
        console.error(`Telegram API error for chat ${chatId}:`, err.replace(s.telegramBotToken, '[REDACTED]'));
      }
    } catch (e) {
      console.error(`Failed to send telegram document to ${chatId}:`, e);
    }
  }
}

export async function getUpdatesToFindChatId(token: string): Promise<string | null> {
  try {
    const url = `https://api.telegram.org/bot${token}/getUpdates?limit=1&offset=-1`;
    const res = await fetch(url);
    const data: any = await res.json();
    if (data.ok && data.result.length > 0) {
      const msg = data.result[0].message;
      if (msg && msg.chat && msg.chat.id) {
        return String(msg.chat.id);
      }
    }
  } catch (e) {
    console.error('Failed to fetch updates:', e);
  }
  return null;
}
