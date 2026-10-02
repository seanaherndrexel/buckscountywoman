# Bucks County Woman Community App: Research + v1 Feature Spec

Prepared Oct 1, 2026.

---

## Part 1. The reference app: Tabella

"The Tabilla app" is **Tabella** (tabella.app), the free Catholic community app by Churchly Inc. (Miami, FL; founder Juan Acosta).

- Google Play: "Tabella Catholic App", package `com.jointabella.tabella`, 50,000+ downloads, about 4.4 stars, rated Teen/12+.
- Also on iOS and on the web (web.tabella.app).
- Free for parishes and for parishioners. No subscription. Money comes from optional content products, a rewards program, advertising, and a local business ad component in digital bulletins.

### How Tabella works

| Area | How Tabella does it |
|---|---|
| **Grouping** | The parish is the top-level unit. Users find a parish in a location-based directory and follow or join it. Under each parish, admins create ministry groups (youth, choir, Bible study, etc.), each public or private, each with its own admins. Dioceses and independent ministries can also run communities. |
| **Trust / verification** | Trust is placed on the **organization**, not the individual. A parish is "claimed" or enrolled by filling in details and recording a **short verification video**. Individual members just create an account; private groups gate access by admin approval. Reviewers note there is no published badge standard, no diocesan endorsement, and no individual ID check. |
| **Feed** | Each parish and group has a feed of posts (text, photo, video, documents) with likes and comments. A user's home feed is filtered to the parishes and ministries they follow. |
| **Events / schedules** | Parishes publish Mass, Confession, Adoration and event times. Changes trigger push notifications. Accuracy depends on admins keeping it current. |
| **Directory** | Parish directory (search by location), member connections inside a parish, and a **local business directory/advertising** slot in digital bulletins (the J.S. Paluch print-bulletin model moved online; Paluch has closed and Tabella pitches itself as its successor). |
| **Messaging** | Posts plus messages exist. Reviewers warn against one-to-one adult-to-minor messaging and against using private groups for confidential matters. |
| **Notifications** | Unlimited push (iOS, Android, web) plus an **automatic weekly email digest** to members who do not use the app. |
| **Publications** | No magazine reader as such. The "Parish Assistant" converts a parish's paper bulletin into digital posts automatically, and a built-in design tool formats any post for sharing to Facebook/Instagram. A large devotional media library (Rosary, Daily Gospel, podcasts, talks) in English, Spanish and Filipino sits alongside the community. |
| **Moderation** | Terms ban hateful, obscene, abusive, threatening, deceptive and privacy-violating content. Group admins moderate their own spaces. Third-party reviews criticize the lack of published response times, appeals process, and youth-protection detail. |
| **Onboarding** | Install, create an account, find and follow your parish, optionally join ministry groups. Parish admins onboard by claiming the parish and recording the video. |
| **Weaknesses worth avoiding** | Store privacy label ("Data Not Collected") contradicts its own policy (which lists analytics, session recording, ad identifiers, location). Thin moderation transparency. Member-level trust is weak. |

**Takeaways for Bucks County Woman:** copy the structure (place-based home group, sub-groups with their own hosts, a digest email for non-app users, local business directory as revenue, bulletin-to-post publishing). Improve on the trust model (verify members, not just organizers), publish moderation standards, and keep the privacy story honest and simple.

### Other trust-and-grouping models worth borrowing

| App | Grouping | Trust mechanism | Borrow for BCW |
|---|---|---|---|
| **Nextdoor** | Fixed neighborhood boundaries; you see your neighborhood plus optional "nearby" ones. | Address verification (mailed postcard code, phone billing address, or card billing address). Real names required. Community Leads moderate locally. | Home town is assigned once and changed rarely. Billing ZIP from the payment card confirms Bucks residency. Volunteer local leads. |
| **Peanut** (women/moms) | Interest "Groups" and topic "Pages"; matching by life stage and distance. | Selfie verification at signup; women-focused positioning; block/report on every surface. | Selfie check is optional (v2). Life-stage circles. Every post and profile has block/report. |
| **Bumble BFF** | 1:1 matching, not groups. | Photo verification badge. | A visible "Verified Member" badge. |
| **Mighty Networks** | "Spaces" inside a paid network; courses, events, members. | Paid membership plus host approval of applications. | Payment as the trust gate. Spaces = towns and circles. Host role per space. |
| **Hallow** | Prayer groups/challenges; parish partnerships. | Account only; small private groups via invite. | Seasonal community "challenges" (e.g. Shop Women-Owned Week). |

---

## Part 2. Bucks County Woman Community: v1 Feature Spec

### Product in one line
A members-only, mobile-first web app where Bucks County women meet by town and by interest, find events and trusted resources, read the magazine, and support women-owned businesses. Nonpolitical and nonreligious. Inclusive of all women (trans women included) and nonbinary people who feel at home in a women's community.

### Platform
- **Installable PWA** (Add to Home Screen on iPhone and Android, works in any browser). No App Store submission at v1.
- Web push notifications (supported on Android and on iOS 16.4+ once installed to the home screen); email as fallback for everything.
- Offline: cached shell, last-loaded feed, and downloaded magazine issues readable offline.
- Suggested stack: Next.js (or SvelteKit) front end, Postgres (Supabase) for data/auth/storage with row-level security, Stripe Billing for membership, Resend/Postmark for email, Mapbox or Leaflet+OpenStreetMap for the map, hosted on Render or Vercel.

### 1. Membership and trust model

**Tiers**
| Tier | Price | Can do |
|---|---|---|
| Visitor (no account) | Free | Read magazine articles marked public, view public events, browse business directory and resources map. |
| Member | **$1/month** or **$10/year** | Everything: join groups, post, comment, RSVP, list a business, suggest resources. |
| Business listing add-on | Optional, later | Featured placement in directory (v2). |

Why offer annual: Stripe's per-transaction fee (about 2.9% + 30 cents) eats roughly a third of a $1 charge. Annual billing keeps most of the money. Monthly stays available because $1/mo is the headline.

**Verification steps (all required before posting)**
1. Email + password or magic link; phone number confirmed by SMS code.
2. Paid membership through Stripe. Card holder name and billing ZIP are stored (not the card). The payment is the main friction against trolls and fake accounts.
3. **Home town** selected from the Bucks list. Billing ZIP is checked against a Bucks County ZIP table. Non-Bucks ZIP gets flagged for manual review (allowed for people who work in Bucks or just moved; they pick "Newcomer" or "Works in Bucks").
4. Display name = first name + last initial by default (e.g. "Dana R."). Real first name required; full last name optional.
5. Accept the Community Guidelines (checkbox plus a 5-point summary screen, not a wall of text).
6. Profile photo optional at v1. Selfie verification badge is a v2 option.

**Trust signals shown on a profile:** Verified Member badge, home town, member-since date, circles joined (only if she chooses to show them). Membership lapse removes posting rights after a 7-day grace period; content stays.

**Changing home town:** allowed once every 90 days; triggers a ZIP re-check.

### 2. Groups

Two kinds of groups. Every member gets exactly one **Town** group automatically and can join any number of **Circles**.

**Town groups (auto-assigned by home town; can follow up to 3 others as read-and-comment):**
Doylestown · New Hope / Solebury · Newtown · Yardley / Lower Makefield · Bensalem · Levittown · Bristol · Quakertown · Perkasie / Sellersville · Warminster / Warrington · Langhorne / Middletown · Chalfont / New Britain · Upper Bucks (Perkasie north, Riegelsville, Springfield, Haycock, etc.) · Central Bucks other (Buckingham, Plumstead, Furlong, Jamison) · Lower Bucks other (Morrisville, Fairless Hills, Croydon).

**Interest Circles (join freely, opt in):**
New Moms · Women in Business · LGBTQIA+ · 50+ · Caregivers · Disability Community · Newcomers to Bucks · (v1.1 candidates: Running & Outdoors, Book Club, Single Moms, Empty Nesters, Women in the Trades).

**Sensitive circles** (LGBTQIA+, Disability Community, Caregivers): membership is hidden from other members' profiles by default, posts never appear in public previews, and joining requires a short host approval (one tap) to keep out bad actors.

**Roles per group**
- **Host** (1 to 3 volunteer members per group, appointed by BCW staff): pin posts, approve circle join requests, hide posts pending review, create events.
- **Member**: post, comment, react, RSVP.
- **BCW Staff/Admin**: everything, across all groups.

### 3. Feed

- **Home feed** tabs: *My Town* · *My Circles* · *All Bucks* (posts members mark "share countywide").
- Post types: Text, Photo (up to 4), Ask (question, gets "Answered" marker when the asker picks a best reply), Recommendation (structured: business/service name, category, town, rating 1 to 5), Event (see section 4), Poll (v1.1).
- Reactions: one "heart" plus "Helpful". Comments are one level of threading.
- Sort: newest by default; pinned posts on top; "Helpful" bubbles Ask answers.
- Post composer always shows which group it's going to and a one-line reminder of the guidelines.
- **Category tags** (required on posts in Town groups): Ask, Recommendation, Lost & Found, Event, Free/Swap, Kudos, General. Political-campaign and religious-promotion posts are not a category and are removed under the guidelines.
- No reshares outside the app at v1 (screenshots can't be stopped, but no share button lowers spread).

### 4. Events

- Sources: BCW staff events (magazine launches, meetups), host-created group events, member-submitted events (go to a host or staff approval queue before showing countywide).
- Fields: title, date/time, location (venue + town, map pin), cost, accessibility notes (step-free, ASL, sensory-friendly), kid-friendly flag, organizer, link.
- Views: list by date, filter by town / circle / free / this weekend; calendar month view.
- RSVP (Going / Interested), add-to-calendar (.ics), reminder push the day before.
- Public events are visible to visitors (marketing funnel to membership).

### 5. Resources and Safe Spaces map

- A map of vetted resources, curated by BCW staff (members can suggest; staff approve).
- Categories: Health & women's health clinics · Mental health & support lines · Domestic violence & crisis services (e.g. county and nonprofit hotlines) · Food pantries · Childcare & parenting · LGBTQIA+-affirming businesses and providers · Accessible venues · Lactation-friendly spots · Coworking & meeting spaces · Libraries and community centers.
- Each pin: name, address, phone, hours, website, tags, "last verified by BCW on [date]".
- **Quick exit** button on the Resources section (one tap jumps to a neutral page and clears the screen) for members using crisis resources.
- A persistent "Need help now?" link to 988 and 911 in the Resources header.
- List view for people who don't want a map; works offline once loaded.

### 6. Magazine reader

- Each print issue appears as an **Issue** with a cover, table of contents, and articles as native mobile pages (not a PDF flipbook). Optional "View print PDF" link.
- Articles tagged by town and topic, so a Doylestown article also surfaces in the Doylestown feed as a magazine card.
- Access: selected articles public (SEO and marketing), full issue for members. Download issue for offline reading.
- Comments on articles from members only.
- Publishing workflow for staff: paste or import article (from WordPress/Google Docs), set issue, cover image, tags, publish date. A "Share as post" button auto-creates a feed card in the matching town/circle groups (Tabella's bulletin-to-post idea).
- Weekly email digest (Tabella pattern): top posts from her town, upcoming events, new magazine pieces. Goes to every member, so people who never install the app still get value.

### 7. Women-owned business directory

- Listing fields: business name, owner first name, category, town, short description, photos (up to 5), phone, website, Instagram, hours, "women-owned" self-attestation, optional tags (LGBTQIA+-owned, BIPOC-owned, veteran-owned, home-based).
- Only paying members can list a business (one free listing per member at v1). Staff approve each listing before it goes live.
- Search and filter by category and town; map view.
- Member **Recommendation** posts that name a listed business link to it and count toward a "Recommended by N members" line.
- Visitors can browse the directory (it's the main public draw besides the magazine).
- v2: featured listings, member-only discounts, magazine ad bundle.

### 8. Messaging (not in v1)

Private 1:1 messages are **excluded** from v1 on purpose. Most harassment on community apps happens in DMs, where moderators can't see it. Instead:
- Public comments for conversation.
- "Contact" on business listings uses the business's own phone, email, or website.
- Event organizers are contacted through the event's public comments or the listed link.
- Revisit in v2 with: opt-in DMs only between members who both follow each other, message requests, block, report with transcript, and no images in first messages.

### 9. Notifications

| Trigger | Push | Email |
|---|---|---|
| Reply to my post/comment | On (default) | Off |
| Pinned announcement in my town or circles | On | In digest |
| Event reminder (RSVP'd) | Day before | Day before |
| New magazine issue | On | Yes |
| Circle join approved | On | Yes |
| Weekly digest | n/a | Weekly (default Thursday morning) |
| Payment failed / membership lapsing | On | Yes |

All per-type toggles in Settings; quiet hours 9pm to 8am by default.

### 10. Community Guidelines (summary shown at signup)

1. Be kind. Disagree with ideas, never attack people.
2. No politics or religion promotion. Local civic info (road closures, school board meeting times) is fine; campaigning, candidate talk, and proselytizing are not.
3. Everyone belongs. No hate or harassment based on identity, body, age, disability, or family situation.
4. Protect privacy. No posting other people's photos, addresses, kids' details, or screenshots of private conversations without consent.
5. Selling is for the Directory. Members may share their own business once a month in Town groups and freely in Women in Business.

Full guidelines page linked from every composer and report screen.

### 11. Reporting and moderation

- **Report** on every post, comment, event, listing, and profile. Reasons: Harassment, Hate, Politics/Religion promotion, Spam/Selling, Privacy, Misinformation, Unsafe/Emergency, Other.
- **Auto-hide threshold**: 3 reports from separate members hides content pending review.
- **Block** a member: you stop seeing her posts and comments, and she can't see yours.
- **Mod queue** (web admin page): reported items, newly submitted events, business listings, resource suggestions, flagged non-Bucks signups. Actions: approve, remove, warn, mute 7 days, suspend, ban (refund remaining annual months on ban).
- **Response target published in the app**: reports reviewed within 24 hours, "Unsafe/Emergency" within 2 hours during 8am to 10pm; outside that, the report screen directs to 911/988.
- **Strike system**: warning, 7-day mute, 30-day suspension, ban. Hosts can hide and warn; only staff can suspend or ban.
- **Appeals**: one email-based appeal per action, answered by a staff member who did not make the original call.
- Word filter for slurs (blocks post with a gentle message); link filter for known spam domains.
- Moderation log retained 12 months.

### 12. Onboarding flow (target: under 3 minutes)

1. Welcome screen: what BCW Community is, $1/month, who it's for.
2. Email + phone confirmation.
3. Pick home town (map or list).
4. Pay ($1/mo or $10/yr) via Stripe Checkout (Apple Pay / Google Pay supported).
5. Guidelines summary, accept.
6. Name and optional photo, optional one-line bio.
7. Pick Circles (optional, suggestions shown).
8. Turn on notifications (explains why) and "Add to Home Screen" prompt with iPhone instructions.
9. Land on My Town feed with a pinned welcome post from the host and "Introduce yourself" prompt.

### 13. Privacy commitments (stated plainly in the app)

- No ad tracking, no selling data, no session recording.
- Privacy-friendly analytics only (e.g. Plausible).
- Members can download their data and delete their account; deletion removes posts within 30 days.
- Precise location never collected; town only.
- Must be 18+ (stated at signup).

### 14. Admin (staff web dashboard)

- Members: search, status, town, payment status, strikes.
- Groups: create/rename, assign hosts, pin announcements across all towns.
- Content: mod queue, magazine publishing, events approval, directory approval, resource map editor.
- Metrics: paying members by town, weekly active members, posts per group, digest open rate, churn.

### 15. Data model (core tables)

`users` (id, name, display_name, email, phone, home_town_id, billing_zip, role, status, created_at) · `memberships` (user_id, stripe_customer_id, plan, status, current_period_end) · `towns` · `circles` (id, name, sensitive bool, requires_approval bool) · `group_members` (group_id, user_id, role, status) · `posts` (id, group_id, author_id, type, category, body, countywide bool, pinned bool, hidden bool) · `comments` · `reactions` · `events` (+ `rsvps`) · `issues` and `articles` · `businesses` · `resources` · `reports` · `mod_actions` · `blocks` · `notification_prefs`.

### 16. Build order

| Phase | Scope | Rough effort |
|---|---|---|
| **v1.0 (launch)** | Signup + Stripe + town verification, Town groups, 7 Circles, feed with posts/comments/reactions, report/block/mod queue, events with RSVP, magazine reader, business directory, resources list + map, weekly digest, web push, PWA install. | 8 to 10 weeks, one full-stack developer |
| **v1.1** | Polls, more circles, saved posts, search across posts, host analytics. | 3 weeks |
| **v2** | Opt-in DMs with safeguards, selfie verification badge, featured directory listings, member discounts, native app wrappers (Capacitor) for App Store presence. | 6 to 8 weeks |

### 17. Launch plan tied to the magazine

- Seed each Town group with a volunteer host before launch (15 hosts).
- QR code on the magazine cover and in each issue pointing to the signup page.
- First 500 members get a "Founding Member" badge.
- Every public magazine article on the website ends with "Talk about this with women in your town" linking to signup.

---

## Sources

- [Tabella Catholic App on Google Play](https://play.google.com/store/apps/details?id=com.jointabella.tabella&hl=en_US)
- [Tabella for Parishes](https://tabella.app/parishes)
- [Tabella and J.S. Paluch](https://tabella.app/jspaluch)
- [Tabella blog: digital bulletins, email, notifications](https://tabella.app/blog/save-money-on-parish-communication-free-catholic-software-for-digital-bulletins-email-notifications-with-tabella)
- [Tabella review 2026 (Learn of Christ)](https://learnofchrist.com/resources/tabella)
- [Startup to Follow: Tabella profile](https://www.startuptofollow.com/article/tabella-brings-the-catholic-community-closer-to-home)
- [Nextdoor: verify your address](https://nextdoor.desk.com/customer/en/portal/articles/805357-verify-your-address)
- [Peanut App (Wikipedia)](https://en.wikipedia.org/wiki/Peanut_App)
- [Peanut on Google Play](https://play.google.com/store/apps/details?id=com.teampeanut.peanut&hl=en_US)
