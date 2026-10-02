// Builds the whole magazine into ./dist from the files in ./content.
// To publish an article: add content/articles/<slug>.html (JSON comment header + HTML body) and push.
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const SITE = (process.env.SITE_URL || 'https://buckscountywoman.onrender.com').replace(/\/$/, '');
const GSC = process.env.GSC_VERIFY || '';
const NAME = 'Bucks County Woman';
const TAGLINE = 'The magazine for every woman in Bucks County';

const CATS = [
  { slug: 'health', name: 'Health & Wellness', blurb: 'Reporting on women\'s health care, with the studies and the local doctors behind it.', tags: ['flowers', 'outdoors', 'older', 'sunbeam'] },
  { slug: 'care-near-you', name: 'Care Near You', blurb: 'Clinics, imaging centers and practices across the county, with addresses we checked ourselves.', tags: ['river', 'nature', 'park'] },
  { slug: 'resources', name: 'Resources & Safe Spaces', blurb: 'Help lines, shelters, legal aid and support groups that serve Bucks County women.', tags: ['sunbeam', 'nature'], page: '/resources/' },
  { slug: 'business', name: 'Business & Career', blurb: 'Founders, funding, certifications and the people who can open a door for you.', tags: ['business'] },
  { slug: 'business-events', name: 'Business Events', blurb: 'The networking breakfasts, summits and workshops on the calendar this season.', tags: ['business', 'town'] },
  { slug: 'meetups', name: 'Meetups & Community', blurb: 'Groups, circles and standing get-togethers where you can walk in and belong.', tags: ['friends', 'lgbtq', 'disability'] },
  { slug: 'out-and-about', name: 'Out & About', blurb: 'What is happening in Bucks County this week, from river towns to Upper Bucks.', tags: ['town', 'park', 'fall'] },
  { slug: 'local-finds', name: 'Local Finds', blurb: 'Where women are shopping right now, and the local creators who spotted it first.', tags: ['shopping', 'town'] },
  { slug: 'her-story', name: 'Her Story', blurb: 'Profiles of the women who make this county run.', tags: ['older', 'disability', 'lgbtq', 'friends'] },
  { slug: 'food-safety', name: 'Food Safety', blurb: 'Recalls, contamination alerts, who owns your grocery store and the farm stands down the road.', tags: ['farm', 'food'], page: '/food-safety/' },
  { slug: 'homemaking', name: 'Homemaking', blurb: 'School lunches, family calendars, holiday prep and the shortcuts that give you an evening back.', tags: ['mother', 'food', 'flowers'] },
  { slug: 'artisans', name: 'Local Artisans', blurb: 'Work by women artists and makers in Bucks County. Scan the code and buy it from her directly.', tags: ['flowers', 'shopping'], page: '/artisans/', pageOnly: true },
  { slug: 'directory', name: 'Women-Run Businesses', blurb: 'A growing directory of businesses owned and run by Bucks County women.', tags: ['business', 'shopping'], page: '/directory/', pageOnly: true },
];
const CAT = Object.fromEntries(CATS.map((c) => [c.slug, c]));
// Articles that belong in more than one section.
const EXTRA = {
  'bucks-county-womens-health-care-guide': ['care-near-you'],
  'bucks-county-women-business-networking-fall-2026': ['business-events', 'meetups'],
};

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const read = (p) => fs.readFileSync(p, 'utf8');
const readJson = (p, d) => { try { return JSON.parse(read(path.join(ROOT, p))); } catch (e) { return d; } };
function parse(file) {
  const raw = read(file);
  const m = raw.match(/^\s*<!--\s*(\{[\s\S]*?\})\s*-->/);
  if (!m) throw new Error('Missing JSON header in ' + file);
  return { meta: JSON.parse(m[1]), body: raw.slice(m[0].length).trim() };
}
function out(rel, html) {
  const p = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, html);
}
const fmtDate = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

// ---------- images ----------
const IMAGES = readJson('content/images.json', []);
const used = new Map();
function pick(tags, group) {
  let best = null, bestScore = -1e9;
  for (const im of IMAGES) {
    if (group && im.group !== group) continue;
    const overlap = (im.tags || []).filter((t) => tags.includes(t)).length;
    const score = overlap * 10 - (used.get(im.url) || 0) * 25;
    if (score > bestScore) { best = im; bestScore = score; }
  }
  if (best) used.set(best.url, (used.get(best.url) || 0) + 1);
  return best;
}
const imgTag = (im, cls, eager) => im ? `<img class="${cls || ''}" src="${esc(im.url)}" alt="${esc(im.alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" onerror="this.remove()">` : '';
const credit = (im) => im ? `<span class="credit">Photo: <a href="${esc(im.creditUrl)}" target="_blank" rel="noopener">${esc(im.credit)}</a>${im.license ? ', ' + esc(im.license) : ''}</span>` : '';

// ---------- decorative svg ----------
const BUTTERFLY = `<svg class="bfly" viewBox="0 0 64 48" aria-hidden="true"><defs><linearGradient id="bw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9ecb"/><stop offset=".5" stop-color="#b79bff"/><stop offset="1" stop-color="#7fe3df"/></linearGradient></defs><path fill="url(#bw)" d="M31 24C26 8 12 0 5 4c-7 4-3 18 8 21-8 2-9 14-2 17 7 3 16-6 20-18z"/><path fill="url(#bw)" d="M33 24c5-16 19-24 26-20 7 4 3 18-8 21 8 2 9 14 2 17-7 3-16-6-20-18z"/><path d="M32 12v26M32 12c-2-5-5-7-7-7M32 12c2-5 5-7 7-7" stroke="#3b1f4a" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`;
const FLOWER = `<svg class="flower" viewBox="0 0 60 60" aria-hidden="true"><g transform="translate(30 30)">${[0, 60, 120, 180, 240, 300].map((a) => `<ellipse rx="8" ry="15" cy="-14" transform="rotate(${a})" fill="currentColor" opacity=".85"/>`).join('')}<circle r="7" fill="#ffd66b"/></g></svg>`;

// ---------- forms ----------
const TOWNS = ['Doylestown', 'New Hope', 'Newtown', 'Yardley', 'Bensalem', 'Levittown', 'Bristol', 'Quakertown', 'Perkasie', 'Warminster', 'Warrington', 'Langhorne', 'Chalfont', 'Southampton', 'Morrisville', 'Upper Bucks', 'Somewhere else in Bucks'];
const F = {
  text: (n, l, req, type) => `<label>${l}<input type="${type || 'text'}" name="${n}" ${req ? 'required' : ''} maxlength="300"></label>`,
  area: (n, l, req) => `<label>${l}<textarea name="${n}" rows="4" ${req ? 'required' : ''} maxlength="3500"></textarea></label>`,
  town: () => `<label>Your town<select name="town">${TOWNS.map((t) => `<option>${t}</option>`).join('')}</select></label>`,
  sel: (n, l, opts) => `<label>${l}<select name="${n}">${opts.map((t) => `<option>${t}</option>`).join('')}</select></label>`,
};
const FORMS = {
  contact: { btn: 'Send message', f: [F.text('name', 'Your name', 1), F.text('email', 'Email', 1, 'email'), F.sel('topic', 'What is this about?', ['A question', 'A correction', 'Advertising', 'Partnership', 'Something else']), F.area('message', 'Message', 1)] },
  tip: { btn: 'Send tip', f: [F.text('name', 'Your name (optional)'), F.text('email', 'Email (optional)', 0, 'email'), F.town(), F.area('message', 'What should we look into?', 1)] },
  'submit-event': { btn: 'Submit event', f: [F.text('title', 'Event name', 1), F.text('date', 'Date and time', 1), F.text('location', 'Venue and address', 1), F.town(), F.text('url', 'Link for details or tickets', 0, 'url'), F.text('email', 'Your email', 1, 'email'), F.area('message', 'Tell us about it', 1)] },
  'directory-listing': { btn: 'Request listing', f: [F.text('business', 'Business name', 1), F.text('owner', 'Owner\'s name', 1), F.text('email', 'Email', 1, 'email'), F.town(), F.text('category', 'What you do', 1), F.text('url', 'Website or social link', 0, 'url'), F.area('message', 'One or two sentences for your listing', 1)] },
  artisan: { btn: 'Apply to be featured', f: [F.text('name', 'Your name', 1), F.text('email', 'Email', 1, 'email'), F.town(), F.text('medium', 'Your medium (painting, pottery, jewelry...)', 1), F.text('photos', 'Link to 3 to 5 photos of your work', 1, 'url'), F.text('buy', 'Link where people can buy your work', 1, 'url'), F.area('message', 'Short bio', 1)] },
  membership: { btn: 'Save my founding spot', note: 'No payment today. Founding members get first access when membership opens, and we will email you once.', f: [F.text('name', 'Your first name', 1), F.text('email', 'Email', 1, 'email'), F.town(), F.sel('plan', 'Which plan fits you?', ['Digital, $1 a month', 'Digital, $12 a year', 'Digital plus print at home']), '<input type="hidden" name="newsletter" value="yes">'] },
};
function form(type) {
  if (type === 'newsletter') return signup('newsletter-page', 'Join the list');
  const d = FORMS[type]; if (!d) return '';
  return `<form class="bcw-form card" data-type="${type}" novalidate>${d.f.join('')}<label class="hp" aria-hidden="true">Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label><button class="btn" type="submit">${d.btn}</button>${d.note ? `<p class="fine">${d.note}</p>` : ''}<p class="form-msg" role="status" aria-live="polite"></p></form>`;
}
function signup(source, btn) {
  return `<form class="signup" data-source="${source}" novalidate><label class="sr" for="em-${source}">Email address</label><input id="em-${source}" type="email" name="email" placeholder="you@example.com" required autocomplete="email"><label class="hp" aria-hidden="true">Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label><button class="btn" type="submit">${btn || 'Sign me up'}</button><p class="form-msg" role="status" aria-live="polite"></p></form>`;
}

// ---------- layout ----------
const NAV = ['health', 'resources', 'business', 'meetups', 'out-and-about', 'local-finds', 'food-safety', 'homemaking', 'artisans'];
const catUrl = (c) => c.page || `/category/${c.slug}/`;
function layout({ title, description, urlPath, body, image, type, jsonld, bodyClass }) {
  const full = title === NAME ? `${NAME} | ${TAGLINE}` : `${title} | ${NAME}`;
  const canon = SITE + urlPath;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description || '')}">
<link rel="canonical" href="${canon}">
${GSC ? `<meta name="google-site-verification" content="${esc(GSC)}">` : ''}
<meta property="og:site_name" content="${NAME}">
<meta property="og:type" content="${type || 'website'}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description || '')}">
<meta property="og:url" content="${canon}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<meta name="theme-color" content="#7b4dd6">
<link rel="alternate" type="application/rss+xml" title="${NAME}" href="/feed.xml">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="manifest" href="/app/manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&family=Nunito+Sans:opsz,wght@6..12,400..800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body class="${bodyClass || ''}">
<a class="skip" href="#main">Skip to content</a>
<div class="ribbon"><span>Membership is $1 a month.</span> <span>10% of all proceeds go to local women's organizations.</span> <a href="/membership/">Become a founding member</a></div>
<header class="mast">
  <a class="logo" href="/" aria-label="${NAME} home">${BUTTERFLY}<span class="logo-t"><em>Bucks County</em> Woman</span></a>
  <p class="tag">${TAGLINE}</p>
  <details class="navwrap"><summary>Sections</summary><nav class="nav" aria-label="Sections">${NAV.map((s) => `<a href="${catUrl(CAT[s])}">${CAT[s].name}</a>`).join('')}<a href="/events/">Events</a><a href="/directory/">Directory</a><a class="pill" href="/app/">Community App</a></nav></details>
  <nav class="nav desk" aria-label="Sections">${NAV.map((s) => `<a href="${catUrl(CAT[s])}">${CAT[s].name}</a>`).join('')}<a href="/events/">Events</a><a href="/directory/">Directory</a><a class="pill" href="/app/">Community App</a></nav>
</header>
<main id="main">
${body}
</main>
<section class="join opal">
  <div class="wrap join-in">${FLOWER}
    <div><h2>The good stuff, every Thursday</h2><p>One free email with the week's events, new resources, local finds and the stories worth your time. Unsubscribe whenever you like.</p></div>
    ${signup('footer', 'Sign me up')}
  </div>
</section>
<footer class="foot">
  <div class="wrap foot-grid">
    <div><a class="logo small" href="/">${BUTTERFLY}<span class="logo-t"><em>Bucks County</em> Woman</span></a><p>Local news, resources and joy for every woman in Bucks County, Pennsylvania. All ages, all backgrounds, all abilities, LGBTQIA+ women always welcome.</p><p class="fine">Published by Main Street Creative, 152 N Main St, Doylestown, PA 18901. (215) 206-3657</p></div>
    <div><h3>Read</h3>${CATS.filter((c) => !c.pageOnly).map((c) => `<a href="${catUrl(c)}">${c.name}</a>`).join('')}</div>
    <div><h3>Take part</h3><a href="/membership/">Membership</a><a href="/app/">Community App</a><a href="/events/">Events</a><a href="/submit/">Submit an event or tip</a><a href="/get-listed/">List your business</a><a href="/artisans/">Local Artisans</a><a href="/directory/">Women-Run Businesses</a><a href="/newsletter/">Newsletter</a><a href="/print-edition/">Print edition</a></div>
    <div><h3>About</h3><a href="/about/">About us</a><a href="/giving/">Our 10% pledge</a><a href="/advertise/">Advertise</a><a href="/contact/">Contact</a><a href="/editorial-standards/">Editorial standards</a><a href="/community-guidelines/">Community guidelines</a><a href="/accessibility/">Accessibility</a><a href="/privacy-policy/">Privacy policy</a><a href="/terms/">Terms of use</a><a href="/feed.xml">RSS feed</a></div>
  </div>
  <p class="wrap copy">&copy; 2026 ${NAME}. Health coverage is information, not medical advice. If you are in danger, call 911.</p>
</footer>
<script src="/assets/site.js" defer></script>
</body>
</html>`;
}

function card(a, big) {
  return `<article class="acard${big ? ' big' : ''}"><a class="acard-img opal" href="${a.url}" tabindex="-1" aria-hidden="true">${imgTag(a.image)}</a><div class="acard-body"><a class="kicker" href="${catUrl(CAT[a.category])}">${CAT[a.category].name}</a><h3><a href="${a.url}">${esc(a.title)}</a></h3><p>${esc(a.dek)}</p><p class="meta">${fmtDate(a.date)} &middot; ${a.readMinutes || 5} min read</p></div></article>`;
}

async function build() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  used.clear();

  // ----- articles -----
  const adir = path.join(ROOT, 'content/articles');
  const articles = fs.readdirSync(adir).filter((f) => f.endsWith('.html')).map((f) => {
    const { meta, body } = parse(path.join(adir, f));
    if (!CAT[meta.category]) meta.category = 'out-and-about';
    const cats = [meta.category, ...(meta.categories || []), ...(EXTRA[meta.slug] || [])];
    const image = meta.image ? { url: meta.image, alt: meta.imageAlt || meta.title, credit: meta.imageCredit || '', creditUrl: meta.imageCreditUrl || '#' } : null;
    return { ...meta, cats, body, url: `/${meta.slug}/`, image };
  }).sort((a, b) => (b.date + b.slug).localeCompare(a.date + a.slug) * 1 || 0);
  // newest first, health guide leads on equal dates
  articles.sort((a, b) => b.date.localeCompare(a.date) || (a.slug === 'bucks-county-womens-health-care-guide' ? -1 : b.slug === 'bucks-county-womens-health-care-guide' ? 1 : 0));
  for (const a of articles) if (!a.image) a.image = pick(CAT[a.category].tags, 'bucks') || pick(CAT[a.category].tags);

  for (const a of articles) {
    const related = articles.filter((x) => x !== a).slice(0, 3);
    const body = `<article class="story">
<header class="story-head opal"><div class="wrap narrow"><a class="kicker" href="${catUrl(CAT[a.category])}">${CAT[a.category].name}</a><h1>${esc(a.title)}</h1><p class="dek">${esc(a.dek)}</p><p class="meta">${fmtDate(a.date)} &middot; ${a.readMinutes || 5} min read</p></div></header>
<figure class="hero-fig wrap">${imgTag(a.image, '', true)}<figcaption>${esc(a.image ? a.image.alt : '')}. ${credit(a.image)}</figcaption></figure>
<div class="wrap narrow prose">${a.body}
<aside class="note card"><p><strong>Spot something out of date?</strong> Hours, phone numbers and programs change. <a href="/contact/">Tell us</a> and we will fix it. This article was researched with AI assistance and reviewed against the sources listed above. See our <a href="/editorial-standards/">editorial standards</a>.</p></aside>
<div class="share"><span>Share:</span> <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SITE + a.url)}" target="_blank" rel="noopener">Facebook</a> <a href="mailto:?subject=${encodeURIComponent(a.title)}&body=${encodeURIComponent(SITE + a.url)}">Email</a> <button type="button" class="linkbtn" data-copy="${SITE + a.url}">Copy link</button></div>
</div></article>
<section class="wrap"><h2 class="sec">Keep reading</h2><div class="grid3">${related.map((r) => card(r)).join('')}</div></section>`;
    out(`${a.slug}/index.html`, layout({
      title: a.title, description: a.excerpt || a.dek, urlPath: a.url, body, image: a.image && a.image.url, type: 'article',
      jsonld: { '@context': 'https://schema.org', '@type': 'Article', headline: a.title, description: a.excerpt || a.dek, datePublished: a.date, dateModified: a.date, image: a.image ? [a.image.url] : undefined, mainEntityOfPage: SITE + a.url, author: { '@type': 'Organization', name: NAME }, publisher: { '@type': 'Organization', name: NAME, url: SITE } },
    }));
  }

  // ----- data-driven blocks -----
  const events = readJson('content/events.json', []).filter((e) => e && e.title && e.date).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const upcoming = events.filter((e) => String(e.date).slice(0, 10) >= new Date().toISOString().slice(0, 10));
  const evHtml = (list) => list.length ? `<ul class="events">${list.map((e) => { const d = new Date(String(e.date).slice(0, 10) + 'T12:00:00Z'); return `<li class="card ev"><div class="ev-date"><b>${d.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' })}</b><span>${d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}</span></div><div><h3>${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title)}</a>` : esc(e.title)}</h3><p>${[e.time, e.location, e.town].filter(Boolean).map(esc).join(' &middot; ')}</p><p class="meta">Hosted by ${esc(e.organizer || 'the organizer')}. Confirm details with the host before you go.</p></div></li>`; }).join('')}</ul>` : '<p>New events are added every week. <a href="/submit/">Send us yours</a>.</p>';

  const artisans = readJson('content/artisans.json', []);
  const artCards = [];
  for (const a of artisans) {
    const qr = await QRCode.toString(a.buyUrl || SITE + '/artisans/', { type: 'svg', margin: 1, color: { dark: '#3b1f4a', light: '#ffffff' } });
    artCards.push(`<article class="card art"><div class="art-img opal">${a.image ? `<img src="${esc(a.image)}" alt="${esc(a.imageAlt || a.title || a.name)}" loading="lazy" onerror="this.remove()">` : FLOWER}</div><div class="art-body">${a.sample ? '<span class="badge">Sample card</span>' : ''}<h3>${esc(a.name)}</h3><p class="meta">${esc([a.medium, a.town].filter(Boolean).join(' · '))}</p><p>${esc(a.bio || '')}</p></div><a class="qr" href="${esc(a.buyUrl || '/artisans/')}" ${a.sample ? '' : 'target="_blank" rel="noopener"'} aria-label="Buy from ${esc(a.name)}">${qr}<span>Scan to buy</span></a></article>`);
  }
  const artHtml = `<div class="art-grid">${artCards.join('')}</div>`;

  const dir = readJson('content/directory.json', []);
  const finds = readJson('content/finds.json', []);

  // ----- standing pages -----
  const pdir = path.join(ROOT, 'content/pages');
  const pages = fs.readdirSync(pdir).filter((f) => f.endsWith('.html')).map((f) => parse(path.join(pdir, f)));
  const pageHero = (title, sub) => `<header class="page-head opal"><div class="wrap narrow">${BUTTERFLY}<h1>${esc(title)}</h1>${sub ? `<p class="dek">${esc(sub)}</p>` : ''}</div></header>`;
  for (const p of pages) {
    let html = p.body.replace(/<div data-form="([a-z-]+)"><\/div>/g, (_, t) => form(t)).replace(/<div data-artisans><\/div>/g, artHtml);
    let extra = '';
    if (p.meta.slug === 'resources') extra = '<button type="button" class="quick-exit" data-exit>Quick exit</button>';
    if (p.meta.slug === 'food-safety') {
      const fa = articles.filter((a) => a.cats.includes('food-safety'));
      if (fa.length) html += `<h2>From the magazine</h2><div class="grid3">${fa.map((a) => card(a)).join('')}</div>`;
    }
    out(`${p.meta.slug}/index.html`, layout({ title: p.meta.title, description: p.meta.description, urlPath: `/${p.meta.slug}/`, body: `${pageHero(p.meta.title, p.meta.description)}${extra}<div class="wrap narrow prose">${html}</div>` }));
  }
  const pageSlugs = pages.map((p) => p.meta.slug);

  // events page
  out('events/index.html', layout({ title: 'Events', description: 'Upcoming events for women in Bucks County: business breakfasts, meetups, workshops and more.', urlPath: '/events/', body: `${pageHero('Events', 'What is coming up for women in Bucks County. Every listing was checked on the host\'s own page.')}<div class="wrap narrow">${evHtml(upcoming)}<p class="center"><a class="btn" href="/submit/">Submit an event</a></p></div>` }));

  // directory page
  const dirHtml = dir.length ? `<div class="grid3">${dir.map((d) => `<article class="card biz"><h3>${d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.name)}</a>` : esc(d.name)}</h3><p class="meta">${esc([d.category, d.town].filter(Boolean).join(' · '))}</p><p>${esc(d.blurb || '')}</p></article>`).join('')}</div>` : `<div class="card empty">${FLOWER}<h2>The first listings are being verified now</h2><p>Every business in this directory is owned or run by a woman in Bucks County, and we confirm each one before it appears. A basic listing is free.</p><p><a class="btn" href="/get-listed/">List your business</a></p></div>`;
  out('directory/index.html', layout({ title: 'Women-Run Businesses', description: 'A directory of businesses owned and run by women in Bucks County, PA. Basic listings are free.', urlPath: '/directory/', body: `${pageHero('Women-Run Businesses', 'Shops, studios, practices and services owned and run by Bucks County women.')}<div class="wrap">${dirHtml}</div>` }));

  // category pages
  for (const c of CATS.filter((c) => !c.pageOnly)) {
    const list = articles.filter((a) => a.cats.includes(c.slug));
    let inner = list.length ? `<div class="grid3">${list.map((a) => card(a)).join('')}</div>` : `<div class="card empty">${FLOWER}<h2>First stories land this month</h2><p>${esc(c.blurb)} Get them in your inbox the day they publish.</p>${signup('cat-' + c.slug, 'Tell me first')}</div>`;
    if (c.page) inner = `<p class="center"><a class="btn" href="${c.page}">${c.slug === 'resources' ? 'Open the full resource list' : 'Open the Food Safety Watch'}</a></p>` + inner;
    if (c.slug === 'local-finds') inner += `<div class="card note"><h2>Found something good?</h2><p>Local Finds shows what Bucks County women are buying and loving right now. When we feature an Instagram post, we use Instagram's own embed so the creator is credited, tagged and linked every time, and she can ask us to take it down.</p>${finds.length ? finds.map((f) => `<blockquote class="instagram-media" data-instgrm-permalink="${esc(f.url)}" data-instgrm-version="14"><a href="${esc(f.url)}">Post by ${esc(f.creator)}</a></blockquote>`).join('') + '<script async src="https://www.instagram.com/embed.js"></script>' : ''}<p><a class="btn" href="/submit/">Share a find</a></p></div>`;
    if (c.slug === 'business-events' || c.slug === 'meetups' || c.slug === 'out-and-about') inner += `<h2 class="sec">On the calendar</h2>${evHtml(upcoming.slice(0, 6))}`;
    out(`category/${c.slug}/index.html`, layout({ title: c.name, description: c.blurb, urlPath: `/category/${c.slug}/`, body: `${pageHero(c.name, c.blurb)}<div class="wrap">${inner}</div>` }));
  }

  // ----- home -----
  const [lead, ...rest] = articles;
  const heroIm = pick(['river', 'fall', 'nature'], 'bucks');
  const tiles = CATS.map((c) => { const im = pick(c.tags, ['meetups', 'her-story', 'business', 'homemaking', 'health'].includes(c.slug) ? 'women' : 'bucks'); return `<a class="tile opal" href="${catUrl(c)}">${imgTag(im)}<span><b>${c.name}</b><small>${esc(c.blurb)}</small></span></a>`; }).join('');
  const mosaic = [pick(['friends'], 'women'), pick(['bridge'], 'bucks'), pick(['disability'], 'women'), pick(['flowers'], 'bucks'), pick(['older'], 'women'), pick(['river'], 'bucks'), pick(['lgbtq'], 'women'), pick(['park'], 'bucks'), pick(['business'], 'women'), pick(['town'], 'bucks'), pick(['mother'], 'women'), pick(['farm'], 'bucks')].filter(Boolean);
  const home = `
<section class="hero">
  <div class="hero-bg">${imgTag(heroIm, '', true)}</div><div class="beams" aria-hidden="true"></div>
  <span class="float f1" aria-hidden="true">${BUTTERFLY}</span><span class="float f2" aria-hidden="true">${BUTTERFLY}</span><span class="float f3" aria-hidden="true">${FLOWER}</span><span class="float f4" aria-hidden="true">${FLOWER}</span>
  <div class="wrap hero-in">
    <p class="eyebrow">Bucks County, Pennsylvania</p>
    <h1>Everything a woman here needs to know, <em>and a few things she will love.</em></h1>
    <p class="lede">Where the clinics are. Who is hiring, funding and meeting. Which rooms are safe. What is worth buying on Main Street this week. Written for every woman in the county.</p>
    <div class="hero-cta"><a class="btn" href="/membership/">Join for $1 a month</a><a class="btn ghost" href="/resources/">Find help now</a></div>
    <p class="fine">${heroIm ? credit(heroIm) : ''}</p>
  </div>
</section>
<section class="wrap pledge"><div class="card pledge-in"><div><b>10%</b><span>of all proceeds go to local women's organizations</span></div><div><b>100%</b><span>local to Bucks County</span></div><div><b>$1</b><span>a month for the whole magazine</span></div><div><b>Every</b><span>woman welcome, at every age</span></div></div></section>
<section class="wrap"><h2 class="sec">This month</h2>${lead ? card(lead, true) : ''}<div class="grid3">${rest.map((a) => card(a)).join('')}</div></section>
<section class="wrap"><h2 class="sec">Find your section</h2><div class="tiles">${tiles}</div></section>
<section class="band opal"><div class="wrap two">
  <div><h2>Help is closer than you think</h2><p>We keep one page of verified phone numbers and addresses for the moments that cannot wait: crisis lines, shelter, legal aid, postpartum support, and services for LGBTQIA+ women, older women and women with disabilities.</p><p><a class="btn" href="/resources/">Resources &amp; Safe Spaces</a> <a class="btn ghost" href="/category/care-near-you/">Care Near You</a></p></div>
  <div><h2>On the calendar</h2>${evHtml(upcoming.slice(0, 3))}<p><a href="/events/">See every event</a></p></div>
</div></section>
<section class="wrap two app-promo">
  <div><p class="eyebrow">The companion app</p><h2>Your town's group chat, without the strangers</h2><p>The Bucks County Woman app is a members-only community organized by town: Doylestown, Newtown, New Hope, Quakertown, Levittown and more. Ask for a recommendation, find a walking partner, share an event, or join a circle for new moms, women in business, caregivers and LGBTQIA+ women.</p><p><a class="btn" href="/app/">Open the app</a> <a class="btn ghost" href="/community-guidelines/">How we keep it kind</a></p></div>
  <div class="card art-teaser"><p class="eyebrow">Local Artisans</p><h2>Art by the women next door</h2><p>Each issue features work by women artists and makers in Bucks County. Scan the code beside the piece and you are buying it from her.</p><p><a class="btn" href="/artisans/">See the showcase</a></p></div>
</section>
<section class="wrap"><h2 class="sec">Bucks County, in bloom</h2><div class="mosaic">${mosaic.map((im) => `<figure class="opal">${imgTag(im)}<figcaption>${esc(im.alt)}. ${credit(im)}</figcaption></figure>`).join('')}</div></section>`;
  out('index.html', layout({ title: NAME, description: 'Bucks County Woman is the local magazine for every woman in Bucks County, PA: health care, safe spaces, business events, meetups, local finds and women-run businesses.', urlPath: '/', body: home, image: heroIm && heroIm.url, bodyClass: 'home', jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', name: NAME, url: SITE, publisher: { '@type': 'Organization', name: NAME, address: { '@type': 'PostalAddress', streetAddress: '152 N Main St', addressLocality: 'Doylestown', addressRegion: 'PA', postalCode: '18901' } } } }));

  out('404.html', layout({ title: 'Page not found', description: 'That page is not here.', urlPath: '/404', body: `${pageHero('We could not find that page', 'It may have moved. The front page has everything new.')}<p class="center"><a class="btn" href="/">Back to the front page</a></p>` }));

  // ----- machine files -----
  const urls = ['/', '/events/', '/directory/', '/app/', ...pageSlugs.map((s) => `/${s}/`), ...CATS.filter((c) => !c.pageOnly).map((c) => `/category/${c.slug}/`), ...articles.map((a) => a.url)];
  const today = new Date().toISOString().slice(0, 10);
  out('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...new Set(urls)].map((u) => { const a = articles.find((x) => x.url === u); return `<url><loc>${SITE}${u}</loc><lastmod>${a ? a.date : today}</lastmod></url>`; }).join('\n')}\n</urlset>\n`);
  out('robots.txt', `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`);
  out('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>${NAME}</title><link>${SITE}/</link><description>${TAGLINE}</description><language>en-us</language>\n${articles.map((a) => `<item><title>${esc(a.title)}</title><link>${SITE}${a.url}</link><guid isPermaLink="true">${SITE}${a.url}</guid><pubDate>${new Date(a.date + 'T14:00:00Z').toUTCString()}</pubDate><category>${esc(CAT[a.category].name)}</category><description>${esc(a.dek)}</description>${a.image ? `<media:content url="${esc(a.image.url)}" medium="image"/>` : ''}</item>`).join('\n')}\n</channel></rss>\n`);
  out('api/articles.json', JSON.stringify(articles.map((a) => ({ title: a.title, slug: a.slug, url: a.url, category: a.category, categoryName: CAT[a.category].name, dek: a.dek, image: a.image && a.image.url, date: a.date }))));
  console.log(`Built ${articles.length} articles, ${pages.length} pages, ${CATS.length} sections.`);
}

module.exports = { build };
if (require.main === module) build().catch((e) => { console.error(e); process.exit(1); });
