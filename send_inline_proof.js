import * as repo from './dist/server/db/repository.js';
import { sendMail, reportHtml } from './dist/server/services/email.js';

async function main() {
  const db = repo.loadAppDb();
  const settings = repo.getSettings();
  
  const mondaySession = db.sessions.find(s => s.dayKey === 'Mon') || db.sessions[db.sessions.length - 1];
  
  if (!mondaySession) {
    console.log('No sessions to send.');
    return;
  }
  
  const htmlStr = reportHtml(mondaySession);
  
  await sendMail(settings, {
    to: settings.recipients || [settings.senderEmail],
    subject: 'Body OS: Beautifully Rendered Email Proof',
    html: htmlStr
  });
  
  console.log('Sent completely inline email!');
}

main().catch(console.error);
