import juice from 'juice';
import * as fs from 'fs';
import * as path from 'path';
import nodemailer from 'nodemailer';
import { escapeHtml } from '../lib/ids.js';
import type { AppSettings, CoachResult, Session } from '../types.js';

function weekLabel(session: Session) {
  const number = session.weekNumber ? `Week ${escapeHtml(session.weekNumber)}` : 'Training Week';
  return session.weekName ? `${number} - ${escapeHtml(session.weekName)}` : number;
}



export function reportHtml(session: Session, coachData: CoachResult = { score: 0, advice: [] }): string {
  const logs = session.logs || [];
  const done = logs.filter((l) => l.status !== 'skipped');
  const skipped = logs.length - done.length;
  const totalSets = done.reduce((sum, l) => sum + (l.sets || []).length, 0);
  const tonnage = done.reduce(
    (t, l) => t + (l.sets || []).reduce((s, set) => s + (Number(set.w) || 0) * (Number(set.r) || 0), 0),
    0,
  );
  const readiness = session.readiness;
  const score = readiness?.score ?? Math.max(0, Math.min(100, Math.round((coachData.score || 0) * 100 || 75)));

  const getReadinessTiles = () => {
    if (!readiness) return '';
    const tiles = [
      { label: 'SLEEP', value: `${readiness.sleepHours || 0}h`, icon: 'bedtime', colorClass: 'text-tertiary-fixed-dim' },
      { label: 'SORENESS', value: `${readiness.soreness ?? 0}/10`, icon: 'healing', colorClass: 'text-error' },
      { label: 'ENERGY', value: `${readiness.energy ?? 0}/10`, icon: 'bolt', colorClass: 'text-primary-fixed' },
      { label: 'STRESS', value: `${readiness.stress ?? 0}/10`, icon: 'waves', colorClass: 'text-error-container' },
      { label: 'MOTIVATION', value: `${readiness.motivation ?? 0}/10`, icon: 'local_fire_department', colorClass: 'text-primary-fixed' },
      { label: 'MOOD', value: `${readiness.mood ?? 0}/10`, icon: 'mood', colorClass: 'text-tertiary-fixed-dim' },
      { label: 'HYDRATION', value: `${readiness.hydration ?? 0}/10`, icon: 'water_drop', colorClass: 'text-tertiary-fixed' },
      { label: 'PROTEIN', value: `${readiness.mealProtein ?? 0}/10`, icon: 'egg_alt', colorClass: 'text-secondary-fixed' }
    ];
    return tiles.map(t => `
<div class="bg-surface-container-lowest rounded-xl p-sm flex items-center gap-3 border border-outline-variant/10">
<div class="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center ${t.colorClass}">
<span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1;">${t.icon}</span>
</div>
<div class="flex flex-col">
<span class="text-label-caps font-label-caps text-secondary">${t.label}</span>
<span class="text-stat-value font-stat-value text-primary">${t.value}</span>
</div>
</div>`).join('');
  };

  const exerciseCards = logs.map((log, index) => {
    const isSkipped = log.status === 'skipped';
    
    if (isSkipped) {
      return `
<!-- Exercise ${index + 1} (Skipped) -->
<article class="bg-surface-container/40 backdrop-blur-md border border-outline-variant/10 rounded-xl p-lg flex flex-col gap-sm relative overflow-hidden shadow-sm opacity-80">
<div class="absolute left-0 top-0 bottom-0 w-2 bg-surface-variant"></div>
<div class="flex flex-col gap-1 pl-4">
<span class="text-label-caps font-label-caps text-secondary uppercase tracking-wider flex items-center gap-2"><span class="material-symbols-outlined text-[14px]" style="font-variation-settings: 'FILL' 1;">block</span> SKIPPED | ${escapeHtml((log.target || 'OTHER').toUpperCase())}</span>
<h3 class="text-headline-md font-headline-md text-secondary">${index + 1}. ${escapeHtml(log.name)}</h3>
</div>
<div class="mt-2 pl-4">
<span class="text-body-md font-body-md text-secondary/70 italic bg-surface-container/50 px-3 py-2 rounded-md inline-block">No sets recorded.</span>
</div>
</article>`;
    }

    const setsHtml = (log.sets || []).map((set, setIndex) => {
        const isLast = setIndex === (log.sets || []).length - 1;
        const rpeHtml = set.rpe != null && set.rpe !== '' ? ` @ RPE ${escapeHtml(set.rpe)}` : '';
        return `
<div class="flex justify-between items-center text-body-md font-body-md ${isLast ? 'pb-1' : 'border-b border-outline-variant/10 pb-2'}">
<span class="text-secondary">Set ${set.s}</span>
<span class="text-primary font-bold bg-surface-container rounded-md px-2 py-1">${escapeHtml(set.w || 0)} kg x ${escapeHtml(set.r || 0)}${rpeHtml}</span>
</div>`;
    }).join('');

    return `
<!-- Exercise ${index + 1} -->
<article class="bg-surface-container-high/60 backdrop-blur-md border border-outline-variant/20 rounded-xl p-lg flex flex-col gap-sm relative overflow-hidden shadow-md">
<div class="absolute left-0 top-0 bottom-0 w-2 bg-primary-fixed shadow-[0_0_10px_rgba(195,244,0,0.6)]"></div>
<div class="flex flex-col gap-1 pl-4">
<span class="text-label-caps font-label-caps text-primary-fixed uppercase tracking-wider flex items-center gap-2"><span class="material-symbols-outlined text-[14px]" style="font-variation-settings: 'FILL' 1;">check_circle</span> COMPLETED | ${escapeHtml((log.target || 'OTHER').toUpperCase())}</span>
<h3 class="text-headline-md font-headline-md text-primary">${index + 1}. ${escapeHtml(log.name)}</h3>
</div>
<div class="flex flex-col gap-xs mt-3 pl-4">
${setsHtml}
</div>
${log.aiCoachComment ? `
<div class="mt-md p-md rounded-xl bg-tertiary-container/10 border border-tertiary-fixed/20 flex gap-3 ml-4">
<span class="material-symbols-outlined text-tertiary-fixed-dim" style="font-variation-settings: 'FILL' 1;">tips_and_updates</span>
<div class="flex flex-col gap-1">
<span class="text-label-caps font-label-caps text-tertiary-fixed-dim uppercase tracking-wider">AI COACH</span>
<p class="text-body-md font-body-md text-primary/90">${escapeHtml(log.aiCoachComment)}</p>
</div>
</div>
` : ''}
</article>`;
  }).join('');

  const summary = session.aiOverallSummary || coachData.advice?.[0] || 'Your training report is ready.';

  const scoreText = score >= 80 ? 'Optimal' : score >= 60 ? 'Good' : 'Low';

  const html = `<!DOCTYPE html>
<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Body OS - Session Report</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;700;800&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    "colors": {
                        "surface-container-highest": "#2a3548",
                        "surface-tint": "#abd600",
                        "secondary-container": "#3f465c",
                        "inverse-primary": "#506600",
                        "tertiary-container": "#c4e7ff",
                        "on-tertiary": "#00354a",
                        "primary-fixed": "#c3f400",
                        "on-surface": "#d8e3fb",
                        "error": "#ffb4ab",
                        "primary-fixed-dim": "#abd600",
                        "on-secondary-fixed-variant": "#3f465c",
                        "on-background": "#d8e3fb",
                        "tertiary-fixed": "#c4e7ff",
                        "surface-container-high": "#1f2a3c",
                        "primary": "#ffffff",
                        "secondary-fixed-dim": "#bec6e0",
                        "on-primary-fixed": "#161e00",
                        "surface-container-low": "#111c2d",
                        "surface-variant": "#2a3548",
                        "error-container": "#93000a",
                        "on-error-container": "#ffdad6",
                        "surface-dim": "#081425",
                        "background": "#081425",
                        "tertiary-fixed-dim": "#7bd0ff",
                        "on-tertiary-fixed-variant": "#004c69",
                        "on-surface-variant": "#c4c9ac",
                        "on-primary-container": "#556d00",
                        "on-tertiary-container": "#006c93",
                        "secondary-fixed": "#dae2fd",
                        "on-tertiary-fixed": "#001e2c",
                        "on-secondary-fixed": "#131b2e",
                        "outline-variant": "#444933",
                        "inverse-surface": "#d8e3fb",
                        "primary-container": "#c3f400",
                        "inverse-on-surface": "#263143",
                        "secondary": "#bec6e0",
                        "surface-container": "#152031",
                        "outline": "#8e9379",
                        "surface": "#081425",
                        "surface-container-lowest": "#040e1f",
                        "on-error": "#690005",
                        "on-secondary": "#283044",
                        "on-primary": "#283500",
                        "surface-bright": "#2f3a4c",
                        "on-secondary-container": "#adb4ce",
                        "on-primary-fixed-variant": "#3c4d00",
                        "tertiary": "#ffffff"
                    },
                    "borderRadius": {
                        "DEFAULT": "0.125rem",
                        "lg": "0.25rem",
                        "xl": "0.5rem",
                        "full": "0.75rem"
                    },
                    "spacing": {
                        "xl": "48px",
                        "xs": "8px",
                        "sm": "16px",
                        "base": "4px",
                        "gutter": "16px",
                        "margin-desktop": "40px",
                        "lg": "32px",
                        "margin-mobile": "16px",
                        "md": "24px"
                    },
                    "fontFamily": {
                        "body-md": ["Manrope", "sans-serif"],
                        "display-lg": ["Manrope", "sans-serif"],
                        "headline-md": ["Manrope", "sans-serif"],
                        "stat-value": ["Manrope", "sans-serif"],
                        "headline-lg": ["Manrope", "sans-serif"],
                        "body-lg": ["Manrope", "sans-serif"],
                        "label-caps": ["Manrope", "sans-serif"]
                    },
                    "fontSize": {
                        "body-md": ["16px", { "lineHeight": "24px", "fontWeight": "400" }],
                        "display-lg": ["48px", { "lineHeight": "56px", "letterSpacing": "-0.02em", "fontWeight": "800" }],
                        "headline-md": ["24px", { "lineHeight": "32px", "fontWeight": "700" }],
                        "stat-value": ["20px", { "lineHeight": "24px", "fontWeight": "700" }],
                        "headline-lg": ["32px", { "lineHeight": "40px", "letterSpacing": "-0.01em", "fontWeight": "700" }],
                        "body-lg": ["18px", { "lineHeight": "28px", "fontWeight": "400" }],
                        "label-caps": ["12px", { "lineHeight": "16px", "letterSpacing": "0.1em", "fontWeight": "800" }]
                    }
                }
            }
        }
    </script>
<style type="text/tailwindcss">
        @layer utilities {
            .glass-card {
                @apply bg-surface-container-high/80 backdrop-blur-md border border-outline-variant/30 rounded-xl;
            }
            .ai-border {
                @apply border border-primary-fixed shadow-[0_0_15px_rgba(195,244,0,0.15)] bg-surface-container-high/90;
            }
            .hide-scrollbar::-webkit-scrollbar {
                display: none;
            }
            .hide-scrollbar {
                -ms-overflow-style: none;
                scrollbar-width: none;
            }
        }
    </style>
</head>
<body class="bg-background text-on-surface font-body-md antialiased min-h-screen flex flex-col pb-24">
<nav class="bg-surface/90 backdrop-blur-sm border-b border-outline-variant flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop py-md max-w-7xl mx-auto top-0 z-50 sticky">
<div class="flex items-center gap-3">
<div class="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center">
<span class="material-symbols-outlined text-surface-container-lowest text-sm" style="font-variation-settings: 'FILL' 1;">fitness_center</span>
</div>
<span class="text-headline-md font-headline-md font-extrabold text-primary-fixed dark:text-primary-fixed tracking-tight uppercase">Body OS</span>
</div>
</nav>
<main class="flex-grow w-full max-w-3xl mx-auto px-margin-mobile md:px-0 py-lg space-y-lg">
<header class="bg-surface-container-lowest rounded-xl p-lg border border-outline-variant/20 shadow-lg relative overflow-hidden">
<div class="absolute inset-0 bg-gradient-to-br from-surface-container to-background opacity-50 z-0"></div>
<div class="relative z-10 flex flex-col gap-2">
<span class="text-label-caps font-label-caps text-primary-fixed uppercase tracking-[0.2em]">Workout OS Session Report</span>
<h1 class="text-display-lg font-display-lg text-primary uppercase tracking-tight">${escapeHtml(session.name || 'Athlete')}</h1>
<p class="text-body-md font-body-md text-secondary-fixed-dim mt-2">${weekLabel(session)} | ${escapeHtml(session.dayKey || '')} ${escapeHtml(session.dayTitle || '')} | ${escapeHtml(session.date || '')}</p>
</div>
</header>
<section class="grid grid-cols-2 md:grid-cols-4 gap-sm">
<div class="bg-gradient-to-br from-surface-container to-surface-container-high p-md flex flex-col items-start justify-center border border-outline-variant/10 rounded-xl shadow-sm">
<span class="text-label-caps font-label-caps text-secondary mb-1">DONE</span>
<span class="text-headline-lg font-headline-lg text-primary-fixed drop-shadow-[0_2px_10px_rgba(195,244,0,0.2)]">${done.length}</span>
</div>
<div class="bg-gradient-to-br from-surface-container to-surface-container-high p-md flex flex-col items-start justify-center border border-outline-variant/10 rounded-xl shadow-sm">
<span class="text-label-caps font-label-caps text-secondary mb-1">SKIPPED</span>
<span class="text-headline-lg font-headline-lg text-error drop-shadow-[0_2px_10px_rgba(255,180,171,0.2)]">${skipped}</span>
</div>
<div class="bg-gradient-to-br from-surface-container to-surface-container-high p-md flex flex-col items-start justify-center border border-outline-variant/10 rounded-xl shadow-sm">
<span class="text-label-caps font-label-caps text-secondary mb-1">SETS</span>
<span class="text-headline-lg font-headline-lg text-primary drop-shadow-[0_2px_10px_rgba(255,255,255,0.1)]">${totalSets}</span>
</div>
<div class="bg-gradient-to-br from-surface-container to-surface-container-high p-md flex flex-col items-start justify-center border border-outline-variant/10 rounded-xl shadow-sm">
<span class="text-label-caps font-label-caps text-secondary mb-1">TONNAGE</span>
<span class="text-headline-lg font-headline-lg text-primary drop-shadow-[0_2px_10px_rgba(255,255,255,0.1)]">${(tonnage / 1000).toFixed(1)}k kg</span>
</div>
</section>
<section class="bg-gradient-to-br from-surface-container-high to-surface-container border border-outline-variant/20 rounded-xl p-lg shadow-lg">
<div class="flex items-center gap-2 mb-md text-primary">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">monitor_heart</span>
<h2 class="text-headline-md font-headline-md">Readiness</h2>
</div>
<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-sm">
<div class="col-span-2 md:col-span-4 lg:col-span-1 bg-surface-container-lowest rounded-xl p-md flex flex-col items-center justify-center border border-outline-variant/10 shadow-inner">
<span class="text-label-caps font-label-caps text-secondary mb-3 text-center w-full tracking-widest">OVERALL SCORE</span>
<div class="relative w-24 h-24 flex items-center justify-center">
<svg class="absolute inset-0 w-full h-full transform -rotate-90" viewbox="0 0 36 36">
<path class="text-surface-container-highest stroke-current" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke-linecap="round" stroke-width="2"></path>
<path class="text-primary-fixed stroke-current drop-shadow-[0_0_5px_rgba(195,244,0,0.5)]" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke-dasharray="${score}, 100" stroke-linecap="round" stroke-width="2.5"></path>
</svg>
<div class="absolute flex flex-col items-center justify-center">
<span class="text-headline-lg font-headline-lg text-primary font-extrabold leading-none">${score}</span>
<span class="text-[10px] font-bold text-secondary uppercase">${scoreText}</span>
</div>
</div>
</div>
${getReadinessTiles()}
</div>
</section>
<section class="rounded-xl ai-border p-lg flex flex-col gap-sm relative overflow-hidden">
<div class="absolute right-0 top-0 w-32 h-32 bg-primary-fixed/5 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none"></div>
<div class="flex items-center gap-3 text-primary-fixed relative z-10">
<div class="w-10 h-10 rounded-full bg-primary-fixed/10 flex items-center justify-center">
<span class="material-symbols-outlined text-xl" data-icon="psychology" style="font-variation-settings: 'FILL' 1;">psychology</span>
</div>
<h3 class="text-body-lg font-headline-md uppercase font-bold tracking-widest text-primary-fixed drop-shadow-[0_0_8px_rgba(195,244,0,0.4)]">AI Session Analysis</h3>
</div>
<p class="text-body-lg font-body-lg text-primary/90 relative z-10 leading-relaxed">${escapeHtml(summary)}</p>
</section>
<div class="w-full flex justify-center py-sm">
<div class="w-24 h-1 bg-surface-container-highest rounded-full shadow-inner"></div>
</div>
<section class="space-y-lg">
${exerciseCards}
</section>
<footer class="flex flex-col items-center justify-center gap-4 py-xl mt-lg opacity-70">
<div class="w-12 h-12 bg-surface-container-high rounded-full flex items-center justify-center border border-outline-variant/20 shadow-inner">
<img alt="Body OS Logo" class="w-8 h-8 object-contain" src="https://lh3.googleusercontent.com/aida-public/AB6AXuClrbjc16eakVS5GG_UHKHeCD1ip1Fcoyv07TVMpfzgV_fsCo7zNFKly90EH3MhnycaJ27vPPoSnoSnrOAq04gOgWGjvzGNjssvwSiXMb5OygsqGKB2S20xLTD4gcSKZs73ryVrzHh4UtzXYCCoFUaMIUgtFzCk-kmEdG-hqc6_TGw_hJZRbddI2j3fvMOx6ubjtIV3D_Z2UzhoSo1tDSht2qVkm2bPjTf7Zeqnye1fypKXPnQKZfRAbHW0F8QqbAfChQ"/>
</div>
<span class="text-label-caps font-label-caps tracking-[0.2em] uppercase text-secondary">Generated by Body OS</span>
</footer></main>
</body></html>`;
  const EMAIL_CSS = fs.readFileSync(path.join(process.cwd(), "src/server/services/email.css"), "utf8");
  return juice(html, { extraCss: EMAIL_CSS });
}

export async function sendMail(
  settings: AppSettings,
  opts: { to: string[]; subject: string; html: string; attachments?: { filename: string; content: Buffer }[] },
): Promise<void> {
  if (!settings.senderEmail || !settings.appPassword || !opts.to.length) {
    throw new Error('Email settings are incomplete.');
  }
  if (!settings.senderEmail.includes('@')) {
    throw new Error('Invalid sender email format.');
  }
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: settings.senderEmail.trim(), pass: settings.appPassword.replace(/\s+/g, '') },
  });
  await transporter.sendMail({
    from: `"${settings.senderName}" <${settings.senderEmail}>`,
    to: opts.to.join(', '),
    subject: opts.subject,
    html: opts.html,
    attachments: opts.attachments,
  });
}

export function welcomeEmailHtml(profileName: string): string {
  return `<!doctype html><html><body style="margin:0;background:#07110d;font-family:Arial,Helvetica,sans-serif;color:#eaf3ed"><div style="max-width:640px;margin:auto;padding:32px 18px"><div style="background:linear-gradient(145deg,#192b22,#0d1711);border:1px solid #355540;border-radius:28px;padding:38px 30px"><div style="color:#b8f567;font-size:12px;font-weight:800;letter-spacing:2px">BODY OS · SETUP COMPLETE</div><h1 style="font-size:34px;line-height:1.08;margin:18px 0 12px">Welcome, ${escapeHtml(profileName)}.</h1><p style="color:#b8cbbd;font-size:16px;line-height:1.6;margin:0">Your complete Body OS workspace is active. Training, Care, private backups, reporting, Telegram delivery, and AI coaching are ready.</p><div style="height:1px;background:#355540;margin:28px 0"></div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:0 8px 14px 0"><div style="background:#102117;border-radius:14px;padding:16px"><b style="color:#b8f567">01 · Start today</b><p style="margin:8px 0 0;color:#b8cbbd;font-size:14px">Log readiness, then open your planned workout.</p></div></td><td style="padding:0 0 14px 8px"><div style="background:#102117;border-radius:14px;padding:16px"><b style="color:#b8f567">02 · Build insight</b><p style="margin:8px 0 0;color:#b8cbbd;font-size:14px">Use plans, records, analysis, and reports on the web.</p></div></td></tr><tr><td style="padding:0 8px 0 0"><div style="background:#102117;border-radius:14px;padding:16px"><b style="color:#b8f567">03 · Stay protected</b><p style="margin:8px 0 0;color:#b8cbbd;font-size:14px">Your Drive backup is private and your sync belongs to your Google account.</p></div></td><td style="padding:0 0 0 8px"><div style="background:#102117;border-radius:14px;padding:16px"><b style="color:#b8f567">04 · Keep moving</b><p style="margin:8px 0 0;color:#b8cbbd;font-size:14px">Use Care and Coach when you need the next best action.</p></div></td></tr></table><p style="margin:30px 0 0;color:#8ea996;font-size:13px;line-height:1.6">Open Body OS and complete the welcome guide. You can change connected services later in Core settings.</p></div></div></body></html>`;
}


import puppeteer from 'puppeteer';

export async function generateReportEmailPayload(session: Session, coachData?: CoachResult): Promise<{ html: string; attachments: any[] }> {
  let htmlStr = reportHtml(session, coachData);
  // Never send a generic report as an AI report. The delivery service only reaches this
  // point after validated analysis, and this visible section makes recommendations clear.
  const recommendations = String(session.aiOverallSummary || '').split(/\n|(?<=[.!?])\s+(?=[A-Z])/).map((line) => line.replace(/^[-•\d.\s]+/, '').trim()).filter(Boolean).slice(0, 5);
  if (recommendations.length) {
    htmlStr = htmlStr.replace('</main>', `<section style="margin:24px 0;padding:24px;border-radius:16px;background:#152031;border:1px solid #c3f400;color:#fff"><h2 style="margin:0 0 12px;color:#c3f400">AI recommendations</h2><ul style="margin:0;padding-left:20px;line-height:1.7">${recommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section></main>`);
  }
  if (!htmlStr.includes('cdn.tailwindcss.com')) {
      htmlStr = htmlStr.replace('<head>', '<head><script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>');
  }
  try { const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 1200, deviceScaleFactor: 2 });
    
await page.setContent(htmlStr, { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 2000));

    const imageBuffer = await page.screenshot({ fullPage: true, type: 'png' });
    
    return {
      html: `<html><body style="margin:0; padding:0; background:#081425; text-align:center;"><img src="cid:reportImage" style="width:100%; max-width:800px; display:block; margin:0 auto;" /></body></html>`,
      attachments: [{
        filename: 'report.png',
        content: imageBuffer,
        cid: 'reportImage',
        contentDisposition: 'inline'
      }]
    };
  } finally {
    await browser.close();
  } } catch {
    // Chromium is optional. Raw, fully styled HTML remains a dependable email fallback.
    return { html: htmlStr, attachments: [] };
  }
}

/** Converts SMTP failures into setup guidance without ever returning a credential. */
export function emailDeliveryMessage(error: unknown): string {
  const value = error as { code?: string; responseCode?: number; message?: string };
  if (value?.code === 'EAUTH' || value?.responseCode === 535 || /username and password|authentication|invalid login/i.test(value?.message || '')) {
    return 'Gmail rejected the sign-in. Confirm this is a Gmail App Password (not your normal Gmail password), created after enabling 2-Step Verification. Save it again, then test.';
  }
  if (value?.code === 'ETIMEDOUT' || value?.code === 'ECONNECTION' || value?.code === 'ESOCKET') {
    return 'Body OS could not reach Gmail SMTP. Check your internet, firewall, antivirus, or proxy, then try again.';
  }
  if (value?.code === 'ENOTFOUND') return 'Gmail SMTP could not be found. Check your internet or DNS connection, then try again.';
  return 'Email test failed. Confirm the sender Gmail, its App Password, and at least one valid recipient, then try again.';
}
