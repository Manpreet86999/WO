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
  
  // 1. Get the raw HTML (before juice)
  // Wait, reportHtml currently runs juice. We can just use the HTML.
  let htmlStr = reportHtml(mondaySession);
  
  // Put back the tailwind script so puppeteer renders it properly
  if (!htmlStr.includes('cdn.tailwindcss.com')) {
      htmlStr = htmlStr.replace('<head>', '<head><script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>');
  }
  
  // 2. Render to Image
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 1200, deviceScaleFactor: 2 });
  await page.setContent(htmlStr, { waitUntil: 'networkidle0' });
  
  const imageBuffer = await page.screenshot({ fullPage: true, type: 'png' });
  await browser.close();
  
  // 3. Send email with inline image
  const { default: nodemailer } = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: settings.senderEmail, pass: settings.appPassword },
  });
  
  await transporter.sendMail({
    from: `"${settings.senderName}" <${settings.senderEmail}>`,
    to: settings.recipients || [settings.senderEmail],
    subject: 'Body OS: Beautifully Rendered Email Proof (Image)',
    html: `<html><body style="margin:0; padding:0; background:#081425; text-align:center;">
      <img src="cid:reportImage" style="width:100%; max-width:800px; display:block; margin:0 auto;" />
    </body></html>`,
    attachments: [{
      filename: 'report.png',
      content: imageBuffer,
      cid: 'reportImage',
      contentDisposition: 'inline'
    }]
  });
  
  console.log('Sent image-inlined email!');
}

main().catch(console.error);
