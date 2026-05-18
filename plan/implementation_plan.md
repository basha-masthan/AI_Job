# 🚀 AI Job Hunt Pro → Ziro-Level Transformation Plan

## Vision
Transform AI Job Hunt Pro from a dark-mode SaaS dashboard into a **clean, light-mode, professional career intelligence platform** — inspired by Ziro Digital's design language, product depth, and UX clarity. This plan is executable in phases, each delivering standalone value.

---

## 🔍 Ziro Digital Analysis (What We're Emulating)

### Design System
| Element | Ziro Digital | Current App |
|---|---|---|
| Background | `#f0f0f8` (soft lavender-gray) | `#080c14` (dark navy) |
| Primary Color | `#7C3AED` (vivid purple) | `#6366f1` (indigo) |
| Typography | Heavy bold display headings, clean body | Space Grotesk + Inter |
| Layout | Top horizontal navbar + content | Left sidebar + content |
| Cards | White/light with soft purple shadows | Dark glass cards |
| Buttons | Solid purple CTA + ghost outline | Gradient purple |
| Data Viz | Circular score rings, progress bars | Minimal tags |

### Features Ziro Has (We Will Build)
1. **Skill Passport** → AI Skill Assessment with scored quizzes per technology
2. **RoleFit Analysis** → % match between user's skills and job roles
3. **Ziro Verified** → Certification/badge system after passing assessments
4. **Aptitude Practice** → Logical reasoning, quantitative, verbal test modules
5. **HR Connect** → Direct HR visibility/job board for verified candidates
6. **English Engine** → Communication & grammar practice with AI feedback
7. **Role Fit Report** → Score card showing Top Matching Roles (#1, #2, #3 with %)
8. **Weekly Tests** → Scheduled skill tests for consistency tracking

---

## 📐 Phase 1: Design System Overhaul (Foundation)
**Goal**: Switch from dark mode to Ziro's clean light-mode design system.

### 1.1 — New `globals.css` Token System
```
Color Palette:
  --bg-primary:    #f0f0f8   (lavender-gray body)
  --bg-surface:    #ffffff   (card surfaces)
  --bg-section:    #f7f7fc   (section backgrounds)
  --accent-purple: #7C3AED   (primary CTA)
  --accent-light:  #EDE9FE   (purple tint backgrounds)
  --text-dark:     #1a1a2e   (headings)
  --text-body:     #4B5563   (body copy)
  --text-muted:    #9CA3AF   (helper text)
  --border:        #E5E7EB   (card borders)
  --shadow-card:   0 2px 12px rgba(124,58,237,0.08)

Typography:
  Font 1: 'Inter' — body, labels
  Font 2: 'Space Grotesk' — headings, scores, numbers
  Display sizes: 48px / 36px / 24px / 18px / 14px
```

### 1.2 — Navigation: Top Navbar (Replace Left Sidebar)
Build a fixed top navbar with:
- Left: Logo `AI Job Hunt Pro` with branded icon
- Center: Nav links → Dashboard | Skill Passport | RoleFit | Job Tracker | Resume Builder | Training
- Right: Profile avatar dropdown + "Go to Dashboard" button

```
File: src/components/Navbar.js  [NEW]
File: src/app/globals.css       [MODIFY — full rewrite]
File: src/app/layout.js         [MODIFY — swap Sidebar → Navbar]
```

---

## 📐 Phase 2: Public Landing Page
**Goal**: Build a world-class marketing landing page (like Ziro's homepage).

### Sections (in order):
1. **Hero** — Bold headline "Find Your Dream Job — Powered by AI", subtext, two CTAs: `Start Free →` and `Explore Features ✦`, + animated dashboard mockup on right
2. **Social Proof Bar** — Scrolling logos: "Trusted by students from IIT, NIT, BITS..."
3. **Features Grid** — 6 cards: Skill Assessment, RoleFit Analysis, AI Resume Builder, Job Tracker, Interview Prep, Email Sync
4. **How It Works** — 3 step timeline: Assess → Match → Apply
5. **RoleFit Demo** — Live preview of the Role Fit Report card (78/100 score ring, top 3 matching roles)
6. **Pricing** — Free tier vs Pro tier cards
7. **Testimonials** — 3 student testimonial cards
8. **CTA Banner** — "Start Your Career Journey Today" with gradient background
9. **Footer** — 4-column: Links, Contact, Support, Recognitions (MSME, Startup India logos)

```
File: src/app/landing/page.js  [NEW]
File: src/app/page.js          [MODIFY — redirect logged-in → /dashboard, else → /landing]
```

---

## 📐 Phase 3: Skill Passport (Core New Feature)
**Goal**: AI-powered skill assessment engine with scored results.

### User Flow:
1. User selects a technology track (React, Python, SQL, Node.js, etc.)
2. App generates 10 MCQ questions using AI (from a question bank or live generation)
3. Timer-based quiz interface (30s per question)
4. Results page: Score %, skill strengths, skill gaps, Passport Badge
5. Badge stored in user profile → shown on HR Connect

### Data Model:
```json
{
  "assessmentId": "uuid",
  "userId": "email",
  "track": "React.js",
  "score": 78,
  "level": "Intermediate",
  "badge": "react-intermediate",
  "completedAt": "ISO date",
  "breakdown": [
    { "topic": "Hooks", "correct": 4, "total": 5 },
    { "topic": "State Management", "correct": 3, "total": 5 }
  ]
}
```

### Files:
```
src/app/skill-passport/page.js           [NEW] — Track selection UI
src/app/skill-passport/[track]/page.js   [NEW] — Quiz interface
src/app/skill-passport/results/page.js   [NEW] — Score + badge
src/app/api/skill-passport/generate/route.js [NEW] — AI question gen
src/app/api/skill-passport/submit/route.js   [NEW] — Score + save
data/assessments.json                    [NEW] — Persistent store
```

---

## 📐 Phase 4: RoleFit Analysis Engine
**Goal**: Give user a % match score between their assessed skills and job roles.

### How It Works:
1. User completes 2+ skill assessments
2. System maps scores to role requirements (pre-defined skill matrices)
3. AI ranks top 5 matching roles with % fit
4. Shows: Strengths (green tags), To Improve (purple tags), Recommended Next Steps

### Role-Skill Matrix (Pre-defined):
```
Data Analyst:    SQL(30%), Excel(20%), Python(25%), Statistics(25%)
Frontend Dev:    React(35%), CSS(20%), JS(30%), Git(15%)
Backend Dev:     Node.js(30%), SQL(20%), API Design(25%), Python(25%)
Full Stack:      React(25%), Node(25%), SQL(20%), Git(15%), Docker(15%)
DevOps Eng:      Docker(30%), Linux(25%), CI/CD(25%), Cloud(20%)
```

### UI Components:
- **Score Ring**: SVG circular progress (like Ziro's 78/100 ring)
- **Role Cards**: Rank #1, #2, #3 with company-style fit % badge
- **Skill Heatmap**: Grid of skills colored by proficiency level
- **Improvement Roadmap**: Ordered list of what to learn next

```
src/app/rolefit/page.js              [NEW]
src/app/api/rolefit/analyze/route.js [NEW]
src/lib/rolematrix.js                [NEW] — role skill weights
```

---

## 📐 Phase 5: Interview Prep (Aptitude + Technical)
**Goal**: Replace basic training page with a full interview prep engine.

### Modules:
1. **Aptitude Practice** — Quant, Logical, Verbal (50 questions per category, timed)
2. **Technical Mock** — Role-specific coding/theory questions
3. **AI Interview Simulator** — User answers → AI scores + gives feedback
4. **Weekly Test** — Scheduled Sunday test with leaderboard

### AI Interview Simulator Flow:
1. User selects role + difficulty
2. AI generates 5 questions (behavioral + technical mix)
3. User types/speaks answers
4. AI grades: Communication (1-10), Technical Accuracy (1-10), Feedback text

```
src/app/training/page.js             [MODIFY — add module cards]
src/app/training/aptitude/page.js    [NEW]
src/app/training/mock-interview/page.js [NEW]
src/app/api/training/generate/route.js  [NEW]
src/app/api/training/evaluate/route.js  [NEW]
```

---

## 📐 Phase 6: HR Connect
**Goal**: Verified job board where HRs can see student profiles (like LinkedIn but within the app).

### Concept:
- Students who earn badges become "Ziro Verified" equivalent → "AI Verified"
- HR Connect page shows their public profile card with: name, top skills, role fit %, badges earned
- Students can set visibility: Public / Private
- "Express Interest" button on job listings → HR gets notified

### Data Model:
```json
{
  "userId": "email",
  "publicProfile": true,
  "displayName": "Basha M.",
  "topSkills": ["React", "Node.js", "SQL"],
  "roleFitScore": 82,
  "badges": ["react-intermediate", "sql-advanced"],
  "interestedRoles": ["Full Stack Developer", "Frontend Engineer"]
}
```

```
src/app/hr-connect/page.js              [NEW] — Public profile directory
src/app/profile/page.js                 [MODIFY — add badge showcase]
src/app/api/hr-connect/route.js         [NEW]
```

---

## 📐 Phase 7: English Engine
**Goal**: AI-powered English communication practice.

### Modules:
1. **Grammar Correction** — Paste text, AI returns corrected version with explanations
2. **Email Writing** — AI drafts professional emails from a prompt
3. **Vocabulary Builder** — 5 words/day with usage examples
4. **Spoken English Score** — Type a response to a scenario, AI rates it 1-10

```
src/app/english-engine/page.js          [NEW]
src/app/api/english/analyze/route.js    [NEW]
```

---

## 📐 Phase 8: Dashboard Redesign
**Goal**: Transform the dashboard to match Ziro's clean, data-rich style.

### New Dashboard Layout:
```
Top: "Good Morning, Basha 👋  |  Your Career Intelligence Hub"
Row 1: 4 stat cards (light bg, purple icons)
  → Skill Score Avg | RoleFit % | Jobs Tracked | Applications Sent

Row 2 (split):
  Left (60%):  RoleFit Score Ring + Top 3 Matching Roles
  Right (40%): Recent Activity Feed (email syncs, new badges, job updates)

Row 3: Quick Actions (4 cards with icon + title + arrow)
Row 4: Upcoming Weekly Test countdown banner
```

---

## 📐 Phase 9: Pricing Page
**Goal**: Clean, conversion-optimized pricing tiers.

| Feature | Free | Pro (₹299/mo) |
|---|---|---|
| Job Tracker | ✅ Unlimited | ✅ |
| Skill Assessments | 3/month | ✅ Unlimited |
| Resume Builder | 2 resumes | ✅ Unlimited |
| RoleFit Analysis | Basic | ✅ Full Report |
| HR Connect Profile | ❌ | ✅ |
| Interview Simulator | ❌ | ✅ |
| Email Sync | ✅ | ✅ |
| Priority AI | ❌ | ✅ Claude/GPT-4 |

---

## 🛠️ Technical Infrastructure Changes

### New Data Files Needed:
```
data/assessments.json     — user skill assessment results
data/rolefit.json         — user rolefit analysis cache
data/badges.json          — earned badge registry
data/aptitude-bank.json   — 200+ pre-generated aptitude questions
```

### New API Routes Summary:
```
POST /api/skill-passport/generate   → AI generates quiz questions
POST /api/skill-passport/submit     → saves score, awards badge
GET  /api/rolefit/analyze           → computes role fit from assessments
POST /api/training/mock-interview   → AI interview Q&A
POST /api/english/analyze           → grammar + communication scoring
GET  /api/hr-connect                → public profile directory
POST /api/hr-connect/interest       → express interest in role
```

### Shared Component Library (New):
```
src/components/Navbar.js            — Top nav with links + user menu
src/components/ScoreRing.js         — SVG circular score (0-100)
src/components/BadgeCard.js         — Earned skill badge display
src/components/QuizCard.js          — MCQ question UI with timer
src/components/RoleFitCard.js       — Role match % card
src/components/StatsCard.js         — Light-mode stat widget
src/components/Timeline.js          — Activity/progress timeline
src/components/PricingCard.js       — Pricing tier card
```

---

## 📅 Execution Order (Recommended)

| Phase | Est. Effort | Impact |
|---|---|---|
| Phase 1 — Design System | 1 day | Foundation for everything |
| Phase 2 — Landing Page | 1-2 days | First impression, marketing |
| Phase 8 — Dashboard Redesign | 1 day | Core UX improvement |
| Phase 3 — Skill Passport | 2-3 days | Biggest new feature |
| Phase 4 — RoleFit Engine | 1-2 days | Unique differentiator |
| Phase 5 — Interview Prep | 2 days | Retention driver |
| Phase 7 — English Engine | 1 day | Quick win |
| Phase 6 — HR Connect | 2 days | Monetization enabler |
| Phase 9 — Pricing Page | 0.5 days | Revenue |

**Total Estimated Effort: ~12-14 days of focused work**

---

## 🎯 Success Metrics (Post-Launch)
- User completes at least 1 skill assessment → **Activation**
- User views RoleFit report → **Engagement**
- User applies to 3+ jobs → **Core Value Delivery**
- User upgrades to Pro → **Revenue**
