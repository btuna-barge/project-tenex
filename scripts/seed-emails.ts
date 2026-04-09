/**
 * Seed script: inserts test emails into the authenticated Gmail account.
 *
 * Usage:
 *   npx tsx scripts/seed-emails.ts
 *
 * Requires: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET in .env.local
 * Optional: SEED_TO_EMAIL (defaults below) - recipient for all inserts
 *
 * Inserts 200 threads (matching the app's fetch limit) so every seeded email
 * is classified. Emails are shuffled to distribute categories naturally.
 *
 * Subjects use RFC 2047 UTF-8 (base64) to avoid mojibake in Gmail.
 */

import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const TOKEN_PATH = path.resolve(__dirname, ".seed-token.json");
const SEED_REDIRECT_URI = "http://localhost:3001/oauth/callback";

/** Total inserts: matches the 200-thread fetch limit so every email is classified. */
const TARGET_TOTAL = 200;

type SeedEmail = {
  from: string;
  subject: string;
  body: string;
  category: string;
};

/** Curated anchors (realistic examples). Bulk generator fills the rest to TARGET_TOTAL. */
const HANDCRAFTED: SeedEmail[] = [
  {
    from: "Sarah Chen <sarah.chen@company.com>",
    subject: "Q2 Planning - Need Your Input by Wednesday",
    body: "Hey, we're finalizing the Q2 roadmap and I need your input on the infrastructure migration timeline. Can you review the attached proposal and send me your estimates by Wednesday? This is blocking the budget approval. Thanks!",
    category: "important",
  },
  {
    from: "David Park <david.park@company.com>",
    subject: "Re: Production incident - API latency spike",
    body: "Just a heads up, we're seeing p99 latency spike to 4s on the /api/process endpoint since the last deploy. Can you roll back your change from this morning while we investigate? Customers are starting to notice.",
    category: "important",
  },
  {
    from: "Lisa Wong <lisa.wong@company.com>",
    subject: "Your performance review is scheduled for Thursday",
    body: "Hi, I've scheduled your mid-year performance review for Thursday at 2pm. Please come prepared with your self-assessment and any talking points. Looking forward to discussing your growth this quarter.",
    category: "important",
  },
  {
    from: "Morning Brew <morningbrew@email.morningbrew.com>",
    subject: "Daily Digest: Tech layoffs slow, AI spending surges",
    body: "Good morning! Here's your daily roundup. Tech layoffs have slowed 40% this quarter while AI infrastructure spending hits record highs. Plus: why every SaaS company is pivoting to 'AI-native'. Read more below.",
    category: "newsletter",
  },
  {
    from: "TLDR Newsletter <dan@tldrnewsletter.com>",
    subject: "TLDR: Claude 4.5 benchmarks leaked, Rust in the Linux kernel, YC W26 highlights",
    body: "TLDR 2026-04-03\nBig Tech & Startups\n- Claude 4.5 benchmarks leaked showing major reasoning improvements\n- Rust officially in the Linux kernel 6.12 release\n- YC W26 batch highlights: 8 AI infra companies worth watching\nPlus: a deep dive on why SQLite is eating the world.",
    category: "newsletter",
  },
  {
    from: "Substack <no-reply@substack.com>",
    subject: "New post from Lenny's Newsletter: The death of product-market fit",
    body: "Lenny Rachitsky published a new post: 'The death of product-market fit - why the old playbook doesn't work in the AI era.' Click to read the full post on Substack.",
    category: "newsletter",
  },
  {
    from: "Amazon <shipment-tracking@amazon.com>",
    subject: "Your package has been delivered",
    body: "Your Amazon package was delivered today at 2:34 PM. It was placed at your front door. Track all deliveries in the Amazon app.",
    category: "auto-archive",
  },
  {
    from: "GitHub <notifications@github.com>",
    subject: "[acme-corp/api-service] CI Build #4521 passed",
    body: "Build #4521 on branch main passed. All 342 tests passed in 2m 14s. View the full build log on GitHub Actions.",
    category: "auto-archive",
  },
  {
    from: "Google <no-reply@accounts.google.com>",
    subject: "Security alert: New sign-in from MacBook Pro",
    body: "We noticed a new sign-in to your Google Account on a MacBook Pro device. If this was you, you can safely ignore this email. If not, please secure your account immediately.",
    category: "auto-archive",
  },
  {
    from: "Figma <notifications@figma.com>",
    subject: "50% off Figma Pro - Limited Time Offer",
    body: "Upgrade to Figma Pro at 50% off! Get unlimited projects, advanced prototyping, and team libraries. This offer expires in 48 hours. Don't miss out!",
    category: "promotions",
  },
  {
    from: "Nike <nike@email.nike.com>",
    subject: "Just dropped: Air Max 2026 - Shop now before they're gone",
    body: "The all-new Air Max 2026 is here. Featuring revolutionary Air cushioning and sustainable materials. Free shipping on orders over $100. Shop now at nike.com.",
    category: "promotions",
  },
  {
    from: "Vercel <sales@vercel.com>",
    subject: "Your Pro trial ends in 3 days - upgrade now",
    body: "Your Vercel Pro trial is expiring soon. Upgrade now to keep access to advanced analytics, serverless functions, and priority support. Use code KEEPBUILDING for 20% off your first year.",
    category: "promotions",
  },
  {
    from: "Jira <jira@company.atlassian.net>",
    subject: "[PROJ-1234] Comment added: Refactor auth middleware",
    body: "Alex Kim commented on PROJ-1234: 'I think we should use the new session library instead of rolling our own. I'll draft a spike ticket for next sprint.' View the full comment in Jira.",
    category: "can-wait",
  },
  {
    from: "Slack <notification@slack.com>",
    subject: "New messages in #engineering-general",
    body: "You have 12 unread messages in #engineering-general. Jake: 'Anyone tried the new VS Code extension?' Maria: 'Team lunch is moved to 1pm Thursday.' View in Slack.",
    category: "can-wait",
  },
  {
    from: "LinkedIn <messages-noreply@linkedin.com>",
    subject: "You have 3 new connection requests",
    body: "You have pending connection requests from: Mike Torres (Senior PM at Stripe), Rachel Adams (Engineering Manager at Datadog), and Sam Patel (Recruiter at Anthropic). View and respond on LinkedIn.",
    category: "can-wait",
  },
  {
    from: "City Clerk <elections@metro-city.gov>",
    subject: "Early voting opens Saturday for city council primary",
    body: "Early voting for the city council primary runs Saturday through next Friday. Polls are open 8am-8pm at the library and recreation center. Sample ballot and nonpartisan candidate guide: elections.metro-city.gov.",
    category: "politics",
  },
  {
    from: "Ballotpedia Daily <newsletter@ballotpedia.org>",
    subject: "This week: 12 state bills tracked on housing and transit",
    body: "Your weekly roundup of legislation we are following: new housing density bills in three states, two transit funding measures, and one open-data transparency package. Read summaries and vote calendars on Ballotpedia.",
    category: "politics",
  },
  {
    from: "Citizens Forum <digest@citizensforum.example>",
    subject: "Town hall recap: budget Q and A with the mayor",
    body: "Thanks to everyone who joined last night. Topics covered: FY27 capital plan, snow removal contract, and the new parks bond. Full transcript and timestamped video will be posted within 48 hours.",
    category: "politics",
  },
  {
    from: "Prince Okonkwo <prince.okonkwo.lagos@hotmail.com>",
    subject: "URGENT: $4.5M Inheritance - Your Assistance Required",
    body: "Dear Beloved, I am Prince Okonkwo from Lagos, Nigeria. I have an inheritance of $4,500,000 USD that I need your help transferring. Please send your bank details and I will deposit 30% into your account as commission.",
    category: "spam",
  },
  {
    from: "CryptoGains <invest@cryptogains247.xyz>",
    subject: "Turn $500 into $50,000 in 30 days - GUARANTEED",
    body: "Our proprietary AI trading bot has a 99.7% win rate. Join 10,000+ members making passive income with crypto. Limited spots available. Sign up now and get a FREE Bitcoin starter pack!",
    category: "spam",
  },
  {
    from: "Dr. Weight Loss <results@slim-fast-pills.biz>",
    subject: "Lose 30 lbs in 2 weeks - doctors HATE this trick",
    body: "Revolutionary new weight loss formula discovered by a mom in Ohio. No diet, no exercise required. FDA-approved ingredients. Order now and get 3 bottles FREE. Limited time offer!!",
    category: "spam",
  },
];

/** How many synthetic emails to add per category (sums to TARGET_TOTAL - HANDCRAFTED.length) */
function bulkCounts(): Record<string, number> {
  const need = TARGET_TOTAL - HANDCRAFTED.length;
  // Rough inbox mix: lots of noise + newsletters, some important, politics for custom bucket demo
  const weights = {
    important: 0.12,
    "can-wait": 0.12,
    newsletter: 0.2,
    promotions: 0.16,
    "auto-archive": 0.18,
    spam: 0.1,
    politics: 0.12,
  } as const;

  const keys = Object.keys(weights) as (keyof typeof weights)[];
  let allocated = 0;
  const out: Record<string, number> = {};
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (i === keys.length - 1) {
      out[k] = need - allocated;
    } else {
      const n = Math.floor(need * weights[k]);
      out[k] = n;
      allocated += n;
    }
  }
  return out;
}

function generateBulk(): SeedEmail[] {
  const counts = bulkCounts();
  const out: SeedEmail[] = [];

  const push = (e: SeedEmail) => {
    out.push(e);
  };

  // --- Important: diverse people writing directly to you ---
  const importantTemplates = [
    { from: "Maria Santos <maria.santos@company.com>", subject: "Can you cover my on-call shift this Friday?", body: "Hey, something came up and I can't do Friday night on-call. Would you be able to swap? I can take your Wednesday next week in return. Let me know ASAP so I can update PagerDuty." },
    { from: "Tom Bradley <tom.b@company.com>", subject: "Need your sign-off on the DB migration plan", body: "I've drafted the migration plan for moving user_sessions to the new schema. You're the only one with prod write access so I need your approval before we can schedule the maintenance window." },
    { from: "Rachel Kim <rachel@company.com>", subject: "Quick question about your PR #892", body: "Hey, I'm reviewing your PR and the retry logic in the webhook handler looks like it could loop indefinitely if the upstream returns 429. Can you take a look? I don't want to approve until we sort this out." },
    { from: "James Liu <james.liu@company.com>", subject: "Laptop return - IT needs yours by Thursday", body: "IT is doing an asset audit and your old MacBook Pro (asset tag MP-4521) needs to be returned by Thursday. Drop it off at the IT desk on floor 3 or let me know if you need a shipping label." },
    { from: "Nina Patel <nina@startup.io>", subject: "Following up on our coffee chat", body: "Great meeting you at the meetup last week! I'd love to continue our conversation about event-driven architectures. Are you free for lunch next Tuesday? My treat." },
    { from: "Alex Thompson <alex.t@company.com>", subject: "You're needed in the sprint retro - don't skip this one", body: "I know retros aren't your favorite but we really need your input on the deployment pipeline issues. The team specifically asked for your perspective. Thursday 3pm, conf room B." },
    { from: "Sandra Chen <sandra.chen@company.com>", subject: "Expense report needs resubmission", body: "Finance kicked back your expense report from the NYC trip. The hotel receipt is missing and they need the itemized version, not just the total. Can you resubmit by end of week?" },
    { from: "Mike O'Brien <mike.obrien@company.com>", subject: "Your DNS change broke staging", body: "Heads up - the CNAME change you made this morning is pointing staging.app.com to prod. QA team is blocked. Can you revert or fix the record? I'd do it but only you have Cloudflare access." },
    { from: "Priya Sharma <priya@company.com>", subject: "Mentorship program - will you be my mentor?", body: "Hi! The eng mentorship program launched and I was hoping you'd consider being my mentor this quarter. I'm trying to level up on system design and everyone says you're the person to learn from." },
    { from: "Kevin Walsh <kevin.w@company.com>", subject: "Re: Offer letter - need your reference call", body: "The recruiter from Datadog wants to schedule a reference call with you for my application. Would you be willing? It'd be a 15-min call sometime this week. Means a lot." },
  ];
  for (let i = 0; i < (counts.important ?? 0); i++) {
    const t = importantTemplates[i % importantTemplates.length];
    push({ ...t, subject: i >= importantTemplates.length ? `Re: ${t.subject}` : t.subject, category: "important" });
  }

  // --- Can Wait: useful FYI stuff, not urgent ---
  const canWaitTemplates = [
    { from: "confluence@acme.atlassian.net", subject: "[WIKI] Page updated: Runbook / on-call rotation", body: "The page 'On-call rotation Q2' was edited. Summary: minor wording changes to escalation steps. No action required unless you are primary this week." },
    { from: "Jira <jira@company.atlassian.net>", subject: "[ENG-567] Sprint velocity report published", body: "The sprint velocity report for Sprint 24 has been published. Team averaged 42 story points. View the full breakdown in Jira." },
    { from: "Google Calendar <calendar-noreply@google.com>", subject: "Reminder: Team standup moved to 10:30am", body: "Your recurring event 'Daily Standup' has been moved from 10:00am to 10:30am starting next Monday. Updated by eng-manager@company.com." },
    { from: "Notion <notify@makenotion.com>", subject: "3 comments on 'API Design Guidelines'", body: "New comments on the page 'API Design Guidelines' in your Engineering workspace. Preview: 'Should we mandate OpenAPI 3.1 for all new services?'" },
    { from: "HR Team <hr@company.com>", subject: "Updated PTO policy - effective next month", body: "We've updated the PTO policy to include mental health days. The new policy takes effect May 1st. Full details on the HR portal. No action needed right now." },
    { from: "Datadog <alerts@datadoghq.com>", subject: "Weekly infrastructure summary - all green", body: "Your weekly infra summary: 99.97% uptime, p99 latency 180ms (down from 210ms), 0 critical alerts. Full dashboard link attached." },
    { from: "Slack <notification@slack.com>", subject: "Weekly digest from #engineering", body: "Top threads from #engineering this week: 'Postgres 17 upgrade plan', 'New code review guidelines', and 'Friday demo schedule'. 47 messages you might have missed." },
    { from: "GitHub <notifications@github.com>", subject: "[company/platform] Discussion #89: RFC for auth token rotation", body: "New discussion opened by @security-lead: 'RFC: Rotate service auth tokens every 90 days'. 4 comments so far. Your input welcome but not blocking." },
    { from: "Linear <notifications@linear.app>", subject: "Project update: API v3 Migration - 72% complete", body: "Weekly project summary: 18 of 25 tasks completed. 3 in progress, 4 remaining. On track for the April 15 deadline. No blockers reported." },
    { from: "IT Announcements <it-announce@company.com>", subject: "Scheduled maintenance: VPN upgrade Saturday 2am-4am", body: "The VPN gateway will be upgraded Saturday 2am-4am EST. Remote access will be briefly interrupted. No action required - reconnect after 4am if affected." },
  ];
  for (let i = 0; i < (counts["can-wait"] ?? 0); i++) {
    const t = canWaitTemplates[i % canWaitTemplates.length];
    push({ ...t, subject: i >= canWaitTemplates.length ? `Re: ${t.subject}` : t.subject, category: "can-wait" });
  }

  // --- Newsletter: subscribed content ---
  const newsletterTemplates = [
    { from: "Pointer.io <newsletter@pointer.io>", subject: "Pointer: Why SQLite is the future of edge computing", body: "This week's top reads: Why SQLite beats Postgres at the edge, a deep-dive into Zig's memory model, and why your CI pipeline is slower than it should be." },
    { from: "Changelog <noreply@changelog.com>", subject: "Changelog Weekly: Deno 4.0, Bun vs Node benchmarks", body: "This week: Deno 4.0 drops with npm compat, new Bun vs Node benchmarks show surprising results, and an interview with the creator of htmx." },
    { from: "Hacker Newsletter <kale@hackernewsletter.com>", subject: "Hacker Newsletter #702", body: "Top HN stories this week: Show HN - I built a GPU-accelerated terminal, Why we moved from Kubernetes to bare metal, and Ask HN - What's your salary in 2026?" },
    { from: "Dense Discovery <kai@densediscovery.com>", subject: "Dense Discovery #312: The attention economy is dead", body: "This week: tools for deep work, the end of the attention economy, a beautifully designed weather app, and a long read on digital minimalism." },
    { from: "ByteByteGo <alex@bytebytego.com>", subject: "System Design: How Netflix handles 250M subscribers", body: "This week's deep dive: Netflix's architecture for serving 250M subscribers across 190 countries. Plus: a cheat sheet for database sharding strategies." },
    { from: "JavaScript Weekly <peter@cooperpress.com>", subject: "JS Weekly #730: TC39 approves pattern matching", body: "TC39 Stage 3: pattern matching is coming to JavaScript. Plus: React 20 RC, a new state management library, and why you should try Solid.js." },
    { from: "TLDR AI <dan@tldrnewsletter.com>", subject: "TLDR AI: GPT-5 rumors, Anthropic raises $10B", body: "Big Tech & AI: GPT-5 capabilities leaked, Anthropic closes $10B Series E, and Google announces Gemini Ultra Pro Max. Plus: 3 open-source models worth trying." },
    { from: "Platformer <casey@platformer.news>", subject: "Platformer: Inside Meta's AI pivot", body: "Casey Newton reports on Meta's aggressive AI strategy, the internal tension between social and AI teams, and what it means for Instagram's future." },
    { from: "Stratechery <ben@stratechery.com>", subject: "Stratechery: Apple's AI moment", body: "Ben Thompson analyzes Apple's latest AI announcements, why on-device processing matters, and how Apple Intelligence compares to the competition." },
    { from: "Pragmatic Engineer <gergely@pragmaticengineer.com>", subject: "The Pragmatic Engineer: Compensation trends in 2026", body: "Gergely Orosz breaks down 2026 tech compensation data: which companies pay the most, how remote vs hybrid affects offers, and the return of sign-on bonuses." },
  ];
  for (let i = 0; i < (counts.newsletter ?? 0); i++) {
    const t = newsletterTemplates[i % newsletterTemplates.length];
    push({ ...t, subject: i >= newsletterTemplates.length ? `Re: ${t.subject}` : t.subject, category: "newsletter" });
  }

  // --- Promotions: marketing and deals ---
  const promoTemplates = [
    { from: "Raycast <hello@raycast.com>", subject: "Raycast Pro: 50% off for early adopters", body: "Upgrade to Raycast Pro and get AI commands, cloud sync, and custom themes. 50% off for the first year. Offer ends Friday." },
    { from: "AWS <aws-marketing@amazon.com>", subject: "Save 30% on EC2 with Reserved Instances", body: "Optimize your cloud spend: switch to 1-year Reserved Instances and save up to 30% on EC2. Compare pricing in your AWS console." },
    { from: "Notion <team@makenotion.com>", subject: "Notion AI is here - try it free for 30 days", body: "Notion AI can now write, summarize, and brainstorm inside your workspace. Try it free for 30 days, then $10/member/month." },
    { from: "1Password <offers@1password.com>", subject: "Teams plan: first 3 months free", body: "Secure your team with 1Password. Get enterprise-grade password management free for 3 months. No credit card required to start." },
    { from: "Uniqlo <newsletter@uniqlo.com>", subject: "New arrivals: summer essentials + free shipping", body: "Shop the new summer collection. AIRism, linen shirts, and ultralight jackets. Free shipping on orders over $75 through Sunday." },
    { from: "Allbirds <hello@allbirds.com>", subject: "The Tree Dasher 3 is here - 20% off launch", body: "Our most comfortable running shoe yet. Made with eucalyptus fiber and sugarcane foam. 20% off for the first week. Shop now." },
    { from: "Linear <sales@linear.app>", subject: "Linear Pro: streamline your team's workflow", body: "Upgrade to Linear Pro for advanced roadmaps, custom workflows, and priority support. Start a 14-day free trial today." },
    { from: "Superhuman <team@superhuman.com>", subject: "Superhuman for teams - exclusive early access", body: "The fastest email experience is now available for teams. Shared snippets, read statuses, and AI triage built in. Request early access." },
    { from: "Apple <no_reply@email.apple.com>", subject: "Trade in your old Mac - up to $1200 credit", body: "Get credit toward a new MacBook Pro when you trade in your current Mac. Free shipping both ways. Estimate your trade-in value now." },
    { from: "Tailwind Labs <team@tailwindcss.com>", subject: "Tailwind UI: new dashboard templates just dropped", body: "12 new professionally designed dashboard templates for Tailwind CSS. Built with React, Vue, and HTML. Lifetime access for existing customers." },
  ];
  for (let i = 0; i < (counts.promotions ?? 0); i++) {
    const t = promoTemplates[i % promoTemplates.length];
    push({ ...t, subject: i >= promoTemplates.length ? `Re: ${t.subject}` : t.subject, category: "promotions" });
  }

  // --- Auto-archive: automated noise ---
  const archiveTemplates = [
    { from: "GitHub <notifications@github.com>", subject: "[company/api] CI: Build #4892 passed", body: "All 287 tests passed in 1m 48s on branch feature/auth-refresh. View the full log on GitHub Actions." },
    { from: "Stripe <receipts@stripe.com>", subject: "Your receipt from Stripe - $29.00", body: "Payment of $29.00 for your monthly subscription was processed successfully. Invoice #INV-2026-04-1847. View receipt in your Stripe dashboard." },
    { from: "Google <no-reply@accounts.google.com>", subject: "Security alert: new sign-in from Chrome on Mac", body: "A new sign-in to your account was detected from Chrome on macOS. If this was you, no action is needed." },
    { from: "Vercel <system@vercel.com>", subject: "Deployment succeeded: app-production-abc123", body: "Your deployment to production completed successfully. Build time: 42s. Preview: https://app-abc123.vercel.app" },
    { from: "Amazon <auto-confirm@amazon.com>", subject: "Your order #112-4928371-8837264 has shipped", body: "Your order is on its way! Estimated delivery: Wednesday. Track your package in the Amazon app." },
    { from: "Dropbox <no-reply@dropbox.com>", subject: "Someone shared 'Q2 Planning' with you", body: "maria@company.com shared the folder 'Q2 Planning' with you. You can view files at dropbox.com/shared." },
    { from: "DocuSign <dse@docusign.net>", subject: "Completed: NDA - Acme Corp", body: "All parties have signed the document 'NDA - Acme Corp'. A copy has been sent to all signers. View the completed document in DocuSign." },
    { from: "Sentry <noreply@sentry.io>", subject: "Resolved: TypeError in /api/webhooks handler", body: "The issue 'TypeError: Cannot read property of undefined' in api-service has been auto-resolved. No new occurrences in 72 hours." },
    { from: "Calendly <notifications@calendly.com>", subject: "New event: Coffee chat with Nina Patel", body: "A new event has been scheduled. Coffee chat with Nina Patel, Tuesday 12:00pm-12:30pm. Added to your Google Calendar." },
    { from: "UPS <auto-notify@ups.com>", subject: "UPS: Your package was delivered", body: "Your package was delivered at 2:14 PM and left at the front door. Tracking #1Z999AA10123456784." },
  ];
  for (let i = 0; i < (counts["auto-archive"] ?? 0); i++) {
    const t = archiveTemplates[i % archiveTemplates.length];
    push({ ...t, subject: i >= archiveTemplates.length ? `Re: ${t.subject}` : t.subject, category: "auto-archive" });
  }

  // --- Spam: unsolicited junk ---
  const spamTemplates = [
    { from: "BusinessLeads Pro <info@bizleads-pro.xyz>", subject: "We found 10,000 leads in your industry - download free", body: "Our AI scraped 10,000 verified decision-maker emails in your niche. Download the full CSV absolutely free. No strings attached. Act now!" },
    { from: "Dr. SEO <rankings@seo-guaranteed.biz>", subject: "Your website is INVISIBLE on Google - we can fix it", body: "We analyzed your site and found 47 critical SEO issues. We guarantee page 1 rankings in 30 days or your money back. Reply for a free audit." },
    { from: "Forex Signals <vip@forex-millionaire.net>", subject: "I made $47,000 last week trading from my phone", body: "Join our VIP signal group and copy my trades automatically. 95% win rate. No experience needed. Limited to 50 new members this month." },
    { from: "Account Security <verify@paypa1-secure.com>", subject: "Action required: verify your account immediately", body: "We detected unusual activity on your account. Click the link below to verify your identity within 24 hours or your account will be suspended." },
    { from: "Crypto Airdrop <free@token-drop.xyz>", subject: "Claim your FREE 500 USDT airdrop now", body: "You've been selected for an exclusive crypto airdrop. Connect your wallet to claim 500 USDT instantly. Offer expires in 2 hours." },
    { from: "Magic Pills <orders@supplement-king.biz>", subject: "Boost your brain power 300% - clinical results", body: "Scientists discover high-frequency nootropic stack that increases IQ by 40 points. Free trial bottle - just pay shipping. Order now before stock runs out." },
    { from: "LinkedIn Helper <sales@linkedhelper-pro.io>", subject: "Automate your LinkedIn outreach - 500 connections/day", body: "Our tool sends personalized connection requests on autopilot. 500 new connections per day guaranteed. Start your free trial - no LinkedIn password needed." },
    { from: "Casino Rewards <vip@lucky-spin-casino.com>", subject: "You won a $1000 bonus - claim before midnight", body: "Congratulations! You've been awarded a $1000 welcome bonus at Lucky Spin Casino. No deposit required. Claim now and start playing." },
  ];
  for (let i = 0; i < (counts.spam ?? 0); i++) {
    const t = spamTemplates[i % spamTemplates.length];
    push({ ...t, subject: i >= spamTemplates.length ? `Re: ${t.subject}` : t.subject, category: "spam" });
  }

  // --- Politics: civic/government broadcasts ---
  const politicsTemplates = [
    { from: "City Clerk <elections@metro-city.gov>", subject: "Voter registration deadline: April 15", body: "The deadline to register for the June primary is April 15. Register or update your address at vote.metro-city.gov. Sincerely, Office of the City Clerk." },
    { from: "Ballotpedia <newsletter@ballotpedia.org>", subject: "Your weekly legislative tracker: 8 bills to watch", body: "This week: housing density bills in 3 states, a transit funding measure in Oregon, and new data privacy legislation in California. Read nonpartisan summaries." },
    { from: "County Board <notices@county.gov>", subject: "Public hearing notice: proposed park development", body: "The County Board will hold a public hearing on the proposed Riverside Park development on April 22 at 7pm. Written comments accepted through April 20." },
    { from: "League of Women Voters <info@lwv.org>", subject: "Candidate forum recap: school board race", body: "Thank you to everyone who attended the school board candidate forum. Recording and transcript now available at lwv.org/forums. Next forum: city council, April 18." },
    { from: "State Assembly <updates@assembly.state.gov>", subject: "New bill introduced: SB-1247 data privacy", body: "Senator Martinez introduced SB-1247, the Consumer Data Privacy Act. The bill would require companies to disclose data collection practices. Hearing scheduled for May 3." },
    { from: "GovTrack <alerts@govtrack.us>", subject: "Bill update: Infrastructure Investment Act passed committee", body: "H.R. 4521 (Infrastructure Investment Act) was reported favorably by the Transportation Committee. Floor vote expected next week. Track at govtrack.us." },
    { from: "Civic Forum <digest@civicforum.org>", subject: "Monthly civic digest: budget season preview", body: "FY2027 budget hearings begin next week. Key items: public transit funding, library hours expansion, and the new community center proposal. Full calendar inside." },
    { from: "OpenSecrets <newsletter@opensecrets.org>", subject: "Campaign finance update: Q1 2026 filings", body: "Q1 campaign finance reports are in. Top fundraisers, biggest PAC contributions, and dark money trends. Nonpartisan analysis at opensecrets.org." },
  ];
  for (let i = 0; i < (counts.politics ?? 0); i++) {
    const t = politicsTemplates[i % politicsTemplates.length];
    push({ ...t, subject: i >= politicsTemplates.length ? `Re: ${t.subject}` : t.subject, category: "politics" });
  }

  return out;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildAllEmails(): SeedEmail[] {
  return shuffle([...HANDCRAFTED, ...generateBulk()]);
}

function encodeUtf8Header(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`;
}

function getSeedToAddress(): string {
  return process.env.SEED_TO_EMAIL || "marcus.aurelius.inbox@gmail.com";
}

function createRawEmail(email: { from: string; subject: string; body: string }): string {
  const to = getSeedToAddress();
  const date = new Date(
    Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)
  ).toUTCString();

  const message = [
    `From: ${email.from}`,
    `To: ${to}`,
    `Subject: ${encodeUtf8Header(email.subject)}`,
    `Date: ${date}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    `MIME-Version: 1.0`,
    "",
    Buffer.from(email.body, "utf-8").toString("base64"),
  ].join("\r\n");

  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function waitForAuthCode(): Promise<string> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost:3001`);
      const code = url.searchParams.get("code");
      if (code) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h2>Authorized! You can close this tab.</h2>");
        server.close();
        resolve(code);
      } else {
        res.writeHead(400);
        res.end("No code found");
      }
    });
    server.listen(3001);
  });
}

async function getAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    SEED_REDIRECT_URI
  );

  if (fs.existsSync(TOKEN_PATH)) {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
    oauth2Client.setCredentials(tokens);
    return oauth2Client;
  }

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/gmail.insert",
      "https://www.googleapis.com/auth/gmail.modify",
    ],
  });

  console.log("\nOpen this URL in your browser to authorize:\n");
  console.log(authUrl);
  console.log("\nWaiting for authorization...\n");

  const code = await waitForAuthCode();

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log("Token saved to", TOKEN_PATH);

  return oauth2Client;
}

async function main() {
  const all = buildAllEmails();
  if (all.length !== TARGET_TOTAL) {
    console.error(`Expected ${TARGET_TOTAL} emails, got ${all.length}. Fix bulkCounts logic.`);
    process.exit(1);
  }

  console.log(`\nSeeding ${all.length} threads (${HANDCRAFTED.length} handcrafted + ${all.length - HANDCRAFTED.length} generated) -> ${getSeedToAddress()}\n`);

  const auth = await getAuthClient();
  const gmail = google.gmail({ version: "v1", auth });

  let ok = 0;
  for (let i = 0; i < all.length; i++) {
    const email = all[i];
    try {
      const raw = createRawEmail(email);
      await gmail.users.messages.insert({
        userId: "me",
        requestBody: {
          raw,
          labelIds: ["INBOX"],
        },
      });
      ok++;
      if ((i + 1) % 25 === 0 || i === 0) {
        console.log(`  ... ${i + 1}/${all.length} inserted`);
      }
    } catch (error) {
      console.error(`  ✗ [${email.category}] ${email.subject}`, error);
    }
  }

  console.log(`\nDone: ${ok}/${all.length} inserted. Open Inbox Concierge with this Gmail to classify up to 200 recent threads.`);
}

main().catch(console.error);
