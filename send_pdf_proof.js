import * as repo from './dist/server/db/repository.js';
import { sendMail, reportHtml } from './dist/server/services/email.js';
import puppeteer from 'puppeteer';

async function main() {
  const db = repo.loadAppDb();
  const settings = repo.getSettings();
  
  const mondaySession = db.sessions.find(s => s.dayKey === 'Mon') || db.sessions[db.sessions.length - 1];
  
  if (!mondaySession) {
    console.log('No sessions to send.');
    return;
  }
  
  console.log('Generating PDF for session: ' + mondaySession.name);
  
  const htmlStr = reportHtml(mondaySession);
  
  // Launch puppeteer with Edge
  const browser = await puppeteer.launch({ 
      headless: true,
      executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  });
  const page = await browser.newPage();
  await page.setContent(htmlStr, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({ 
      format: 'A4', 
      printBackground: true,
      margin: { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' }
  });
  await browser.close();
  
  const attachments = [
    {
      filename: `Session-${mondaySession.date}.pdf`,
      content: Buffer.from(pdfBuffer)
    }
  ];
  
  await sendMail(settings, {
    to: settings.recipients || [settings.senderEmail],
    subject: 'Body OS: New PDF Report Format Proof (Monday)',
    html: `<p>Here is your new report design exported beautifully as a PDF!</p>`,
    attachments
  });
  
  console.log('Sent email with PDF attachment.');
}

main().catch(console.error);
