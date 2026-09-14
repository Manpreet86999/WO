import * as repo from './dist/server/db/repository.js';
import { sendMail, reportHtml } from './dist/server/services/email.js';

async function main() {
  const db = repo.loadAppDb();
  const settings = repo.getSettings();
  
  const attachments = db.sessions.map(s => {
    const htmlStr = reportHtml(s);
    return {
      filename: `Session-${s.date}.html`,
      content: Buffer.from(htmlStr, 'utf8')
    };
  });
  
  if (db.sessions.length === 0) {
    console.log('No sessions to send.');
    return;
  }
  
  const latestSession = db.sessions[db.sessions.length - 1];
  
  await sendMail(settings, {
    to: settings.recipients || [settings.senderEmail],
    subject: 'Body OS: All Recorded Days - New Format Proof',
    html: reportHtml(latestSession),
    attachments
  });
  
  console.log('Sent email with ' + attachments.length + ' attachments.');
}

main().catch(console.error);
