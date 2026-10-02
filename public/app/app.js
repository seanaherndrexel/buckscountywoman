/* Bucks County Woman community app. Vanilla JS, no build step. */
(function () {
  'use strict';
  var main = document.getElementById('main');
  var state = { me: null, groups: [], feedGroup: 'mine', installEvent: null };
  var TYPES = { ask: 'Ask', recommend: 'Recommend', event: 'Event', offer: 'Offer or Help', general: 'General' };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ---------- tiny helpers ---------- */
  // All member text goes through textContent, so it is always escaped on render.
  function h(tag, attrs) {
    var el = document.createElement(tag), i, k, c;
    attrs = attrs || {};
    for (k in attrs) {
      if (attrs[k] == null || attrs[k] === false) continue;
      if (k === 'class') el.className = attrs[k];
      else if (k === 'text') el.textContent = attrs[k];
      else if (k === 'svg') el.innerHTML = attrs[k]; // static, trusted markup only
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    for (i = 2; i < arguments.length; i++) {
      c = arguments[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) el.appendChild(x); });
      else el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }
  function api(method, url, body) {
    return fetch(url, {
      method: method, credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) { var e = new Error(data.error || 'Something went wrong. Please try again.'); e.status = r.status; throw e; }
        return data;
      });
    }, function () { throw new Error('You seem to be offline. Please check your connection and try again.'); });
  }
  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 4200);
  }
  function show() {
    var nodes = [];
    Array.prototype.forEach.call(arguments, function (a) { if (Array.isArray(a)) nodes = nodes.concat(a); else if (a) nodes.push(a); });
    main.replaceChildren.apply(main, nodes.filter(Boolean));
    window.scrollTo(0, 0);
  }
  function showError(box, err) { box.textContent = err.message; box.hidden = false; box.focus && box.focus(); }
  function errorBox() { return h('p', { class: 'error', role: 'alert', tabindex: '-1', hidden: true }); }
  function ago(iso) {
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' hr ago';
    if (s < 604800) return Math.floor(s / 86400) + ' d ago';
    var d = new Date(iso); return MONTHS[d.getMonth()] + ' ' + d.getDate();
  }
  function group(id) { return state.groups.filter(function (g) { return g.id === id; })[0]; }
  function towns() { return state.groups.filter(function (g) { return g.kind === 'town'; }); }
  function field(id, label, input, hint) {
    input.id = id;
    return h('div', {}, h('label', { for: id, text: label }), input, hint ? h('p', { class: 'small', text: hint }) : null);
  }
  function townSelect(selected) {
    var s = h('select', { required: true }, h('option', { value: '', text: 'Choose your town' }));
    towns().forEach(function (g) { s.appendChild(h('option', { value: g.id, text: g.name, selected: g.id === selected })); });
    return s;
  }
  function quickExit() { window.location.replace('https://www.weather.com'); }

  var SVG = {
    sun: '<svg class="deco" viewBox="0 0 200 200" aria-hidden="true"><g class="rays" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".85">' +
      [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(function (a) { return '<line x1="100" y1="22" x2="100" y2="48" transform="rotate(' + a + ' 100 100)"/>'; }).join('') +
      '</g><circle cx="100" cy="100" r="40" fill="#fff" opacity=".8"/><circle cx="100" cy="100" r="28" fill="#ffe3c9"/></svg>',
    butterfly: '<svg class="flutter" viewBox="0 0 48 48" aria-hidden="true"><path d="M23 22C18 10 6 10 6 19c0 7 8 8 17 5z" fill="#7b4dd6"/><path d="M25 22c5-12 17-12 17-3 0 7-8 8-17 5z" fill="#7b4dd6"/><path d="M23 25c-9-1-14 4-12 9 2 5 9 2 12-7z" fill="#d6336c"/><path d="M25 25c9-1 14 4 12 9-2 5-9 2-12-7z" fill="#d6336c"/><rect x="23" y="17" width="2" height="16" rx="1" fill="#3b1f4a"/></svg>',
    flowers: '<svg viewBox="0 0 120 22" aria-hidden="true"><path d="M2 11h38M80 11h38" stroke="#d9ccff" stroke-width="2" stroke-linecap="round"/>' +
      [[50, '#ffd6e8'], [60, '#d9ccff'], [70, '#c4f1f0']].map(function (f) {
        return '<g transform="translate(' + f[0] + ' 11)">' + [0, 72, 144, 216, 288].map(function (a) {
          return '<ellipse cx="0" cy="-4.500" rx="2.600" ry="4" fill="' + f[1] + '" stroke="#7b4dd6" stroke-width=".5" transform="rotate(' + a + ')"/>';
        }).join('') + '<circle r="2" fill="#d6336c"/></g>';
      }).join('') + '</svg>',
    flower: '<svg viewBox="0 0 64 64" aria-hidden="true">' + [0, 60, 120, 180, 240, 300].map(function (a) {
      return '<ellipse cx="32" cy="16" rx="8" ry="13" fill="#ffd6e8" stroke="#d6336c" stroke-width="1" transform="rotate(' + a + ' 32 32)"/>';
    }).join('') + '<circle cx="32" cy="32" r="7" fill="#ffe3c9" stroke="#d6336c"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.500s-7.500-4.600-7.500-10.300C4.500 7.400 6.600 5.500 8.900 5.500c1.300 0 2.400.6 3.100 1.600.7-1 1.800-1.600 3.100-1.600 2.300 0 4.400 1.900 4.400 4.700 0 5.700-7.500 10.300-7.500 10.300z" fill="FILL" stroke="currentColor" stroke-width="1.800"/></svg>',
    bubble: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="1.800" stroke-linejoin="round"/></svg>'
  };
  Object.keys(SVG).forEach(function (k) { SVG[k] = SVG[k].replace(/(\d\.\d)00/g, '$1'); });
  function divider() { return h('div', { class: 'divider', svg: SVG.flowers }); }

  /* ---------- install hint ---------- */
  function installCard() {
    var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    var dismissed = false;
    try { dismissed = localStorage.getItem('bcw-install-dismissed') === '1'; } catch (e) {}
    if (standalone || dismissed) return null;
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (!ios && !state.installEvent) return null;
    var card = h('section', { class: 'card install', 'aria-label': 'Add to Home Screen' },
      h('h2', { text: 'Add this app to your Home Screen' }),
      h('p', { text: ios ? 'Tap the Share button in Safari, then choose "Add to Home Screen". The community will open like any other app.'
        : 'Keep the community one tap away. It opens like any other app on your phone.' }),
      h('div', { class: 'row' },
        !ios ? h('button', { type: 'button', class: 'btn teal', text: 'Add to Home Screen', onclick: function () {
          state.installEvent.prompt(); state.installEvent = null; card.remove();
        } }) : null,
        h('button', { type: 'button', class: 'btn ghost', text: 'Not now', onclick: function () {
          try { localStorage.setItem('bcw-install-dismissed', '1'); } catch (e) {}
          card.remove();
        } })));
    return card;
  }
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); state.installEvent = e;
    if (currentRoute()[0] === 'home' && !main.querySelector('.install')) { var c = installCard(); if (c) main.appendChild(c); }
  });

  /* ---------- welcome: join and sign in ---------- */
  function hero(title, text) {
    return h('section', { class: 'card hero' }, h('div', { svg: SVG.sun }), h('h1', { text: title }), h('p', { text: text }), h('div', { svg: SVG.butterfly }));
  }
  function viewWelcome(mode) {
    var err = errorBox();
    var first = h('input', { type: 'text', autocomplete: 'given-name', maxlength: '30', required: true });
    var initial = h('input', { type: 'text', maxlength: '1', autocapitalize: 'characters', required: true });
    var email = h('input', { type: 'email', autocomplete: 'email', inputmode: 'email', required: true });
    var town = townSelect();
    var agree = h('input', { type: 'checkbox', id: 'agree', required: true });
    var joinForm = h('form', { class: 'card', novalidate: true, onsubmit: function (e) {
      e.preventDefault(); err.hidden = true;
      api('POST', '/api/app/join', { first_name: first.value, last_initial: initial.value, email: email.value, home_group_id: Number(town.value), agree: agree.checked })
        .then(signedIn).catch(function (x) { showError(err, x); });
    } },
      h('h2', { text: 'Join the community' }),
      h('p', { class: 'preview', text: 'Preview: paid membership and phone verification turn on at launch' }),
      h('div', { class: 'grid2' }, field('first', 'First name', first), field('initial', 'Last initial', initial)),
      h('p', { class: 'small', text: 'Other members see your first name and last initial only, for example "Dana R."' }),
      field('email', 'Email', email, 'Your email is never shown to other members.'),
      field('town', 'Home town group', town),
      h('label', { class: 'check', for: 'agree' }, agree, h('span', {},
        'I agree to the ', h('a', { href: '/community-guidelines/', text: 'community guidelines' }),
        ', and I confirm that I am a woman aged 18 or older. All women are welcome here, and trans women are women.')),
      err,
      h('button', { type: 'submit', class: 'btn block', text: 'Join Bucks County Woman' }),
      h('p', { class: 'small', style: 'margin-top:12px' }, 'Read our ', h('a', { href: '/privacy-policy/', text: 'privacy policy' }), ' and ', h('a', { href: '/membership/', text: 'membership details' }), '.'));

    var err2 = errorBox();
    var email2 = h('input', { type: 'email', autocomplete: 'email', inputmode: 'email', required: true });
    var signForm = h('form', { class: 'card', novalidate: true, onsubmit: function (e) {
      e.preventDefault(); err2.hidden = true;
      api('POST', '/api/app/signin', { email: email2.value }).then(signedIn).catch(function (x) { showError(err2, x); });
    } },
      h('h2', { text: 'Welcome back' }),
      h('p', { class: 'preview', text: 'Preview: paid membership and phone verification turn on at launch' }),
      field('email2', 'The email you joined with', email2), err2,
      h('button', { type: 'submit', class: 'btn block', text: 'Sign in' }));

    var toggle = h('p', { style: 'text-align:center' },
      h('button', { type: 'button', class: 'linkbtn', text: mode === 'signin' ? 'New here? Join the community' : 'Already a member? Sign in',
        onclick: function () { viewWelcome(mode === 'signin' ? 'join' : 'signin'); } }));
    show(hero('Your town. Your circle. Your neighbors.',
      'Bucks County Woman is a friendly place to ask a question, share a recommendation and find out what is happening near you. All women are welcome.'),
      divider(), mode === 'signin' ? signForm : joinForm, toggle, installCard());
  }
  function signedIn(data) {
    state.me = data.member;
    return loadGroups().then(function () {
      document.getElementById('profile-link').hidden = false;
      toast('Welcome, ' + state.me.first_name + '. It is lovely to have you here.');
      if (currentRoute()[0] === 'home') route(); else location.hash = '#/home';
    });
  }
  function loadGroups() { return api('GET', '/api/app/groups').then(function (d) { state.groups = d.groups; }); }
  function needMember() {
    if (state.me) return true;
    show(h('section', { class: 'card' }, h('h2', { text: 'This part is for members' }),
      h('p', { text: 'Join or sign in to see what your neighbors are talking about.' }),
      h('a', { class: 'btn', href: '#/home', text: 'Join or sign in' })));
    return false;
  }

  /* ---------- posts ---------- */
  function openReport(type, id, onDone) {
    var dlg = document.getElementById('report-dialog'), form = document.getElementById('report-form');
    document.getElementById('report-cancel').onclick = function () { dlg.close(); };
    form.onsubmit = function (e) {
      e.preventDefault();
      api('POST', '/api/app/report', { target_type: type, target_id: id, reason: document.getElementById('report-reason').value })
        .then(function () { dlg.close(); toast('Thank you. Your report was sent and you will no longer see this item.'); onDone(); })
        .catch(function (x) { dlg.close(); toast(x.message); });
    };
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
  function heartButton(p) {
    var btn = h('button', { type: 'button', class: 'act heart' });
    function paint() {
      btn.setAttribute('aria-pressed', p.hearted ? 'true' : 'false');
      btn.setAttribute('aria-label', (p.hearted ? 'Remove your heart. ' : 'Give a heart. ') + p.hearts + (p.hearts === 1 ? ' heart' : ' hearts'));
      btn.innerHTML = SVG.heart.replace('FILL', p.hearted ? 'currentColor' : 'none');
      btn.appendChild(h('span', { text: String(p.hearts) }));
    }
    btn.addEventListener('click', function () {
      api('POST', '/api/app/posts/' + p.id + '/heart').then(function (d) { p.hearted = d.hearted; p.hearts = d.hearts; paint(); })
        .catch(function (x) { toast(x.message); });
    });
    paint(); return btn;
  }
  function postCard(p, detail) {
    var card = h('article', { class: 'card post' },
      h('div', { class: 'meta' },
        h('span', { class: 'chip ' + p.type, text: TYPES[p.type] || 'General' }),
        p.author.is_staff ? h('span', { class: 'chip staff', text: 'Staff' }) : null,
        h('strong', { text: p.author.name }),
        h('span', {}, 'in ', h('a', { href: '#/group/' + p.group_id, text: p.group_name })),
        h('span', { text: ago(p.created_at) })),
      p.title ? h('h3', {}, detail ? p.title : h('a', { href: '#/post/' + p.id, text: p.title })) : null,
      h('p', { class: 'body', text: p.body }),
      h('div', { class: 'actions' },
        heartButton(p),
        detail ? null : h('a', { class: 'act', href: '#/post/' + p.id, 'aria-label': p.reply_count + (p.reply_count === 1 ? ' reply' : ' replies') + '. Open to read or reply.' },
          h('span', { svg: SVG.bubble, style: 'display:inline-flex' }), h('span', { text: p.reply_count ? String(p.reply_count) : 'Reply' })),
        p.mine
          ? h('button', { type: 'button', class: 'act push', text: 'Delete', onclick: function () {
            if (!confirm('Delete this post and its replies?')) return;
            api('DELETE', '/api/app/posts/' + p.id).then(function () { toast('Your post was deleted.'); if (detail) location.hash = '#/home'; else card.remove(); })
              .catch(function (x) { toast(x.message); });
          } })
          : h('button', { type: 'button', class: 'act push', text: 'Report', onclick: function () {
            openReport('post', p.id, function () { if (detail) location.hash = '#/home'; else card.remove(); });
          } })));
    return card;
  }
  function feedInto(box, which) {
    box.replaceChildren(h('p', { class: 'loading', text: 'Gathering the latest posts…' }));
    api('GET', '/api/app/feed?group=' + encodeURIComponent(which)).then(function (d) {
      if (!d.posts.length) {
        box.replaceChildren(h('div', { class: 'empty' }, h('div', { svg: SVG.flower }), h('p', { text: 'Nothing here yet. You could be the first to say hello.' })));
        return;
      }
      box.replaceChildren.apply(box, d.posts.map(function (p) { return postCard(p, false); }));
    }).catch(function (x) { box.replaceChildren(h('p', { class: 'error', text: x.message })); });
  }
  function joined() { return state.groups.filter(function (g) { return g.joined; }); }

  function viewHome() {
    if (!state.me) return viewWelcome('join');
    var box = h('div', {});
    var sel = h('select', { onchange: function () { state.feedGroup = sel.value; feedInto(box, sel.value); } },
      h('option', { value: 'mine', text: 'My groups' }));
    joined().forEach(function (g) { sel.appendChild(h('option', { value: g.id, text: g.name })); });
    if (state.feedGroup !== 'mine' && !joined().some(function (g) { return String(g.id) === String(state.feedGroup); })) state.feedGroup = 'mine';
    sel.value = state.feedGroup;
    show(hero('Hello, ' + state.me.first_name + '.', 'Here is what your neighbors are sharing today.'),
      h('div', { class: 'feedbar' }, field('feed-group', 'Showing', sel),
        h('a', { class: 'btn rose', href: '#/new/' + (state.feedGroup === 'mine' ? state.me.home_group_id : state.feedGroup), text: 'New post' })),
      box, installCard());
    feedInto(box, state.feedGroup);
  }

  function viewGroup(id) {
    if (!needMember()) return;
    var g = group(Number(id));
    if (!g) return show(h('p', { class: 'card', text: 'We could not find that group.' }));
    var box = h('div', {});
    show(h('section', { class: 'card hero' }, h('div', { svg: SVG.sun }),
        h('h1', { text: g.name }),
        h('p', { text: (g.kind === 'town' ? 'Town group' : 'Interest circle') + ' · ' + g.members + (g.members === 1 ? ' member' : ' members') }),
        h('div', { class: 'row' },
          g.joined ? h('a', { class: 'btn rose', href: '#/new/' + g.id, text: 'New post' })
            : h('button', { type: 'button', class: 'btn', text: 'Join this group', onclick: function () { toggleGroup(g, true).then(function () { viewGroup(id); }); } }),
          h('a', { class: 'btn ghost', href: '#/groups', text: 'All groups' }))),
      box);
    feedInto(box, g.id);
  }
  function toggleGroup(g, join) {
    return api('POST', '/api/app/groups/' + g.id + (join ? '/join' : '/leave')).then(loadGroups)
      .then(function () { toast(join ? 'You joined ' + g.name + '.' : 'You left ' + g.name + '.'); })
      .catch(function (x) { toast(x.message); });
  }

  function viewGroups() {
    if (!needMember()) return;
    function list(kind) {
      return h('ul', { class: 'grouplist' }, state.groups.filter(function (g) { return g.kind === kind; }).map(function (g) {
        return h('li', {},
          h('a', { class: 'name', href: '#/group/' + g.id }, g.name,
            h('span', { text: (g.is_home ? 'Your home town · ' : '') + g.members + (g.members === 1 ? ' member' : ' members') })),
          g.is_home ? h('span', { class: 'chip', text: 'Home' })
            : h('button', { type: 'button', class: 'btn' + (g.joined ? ' ghost' : ''), text: g.joined ? 'Leave' : 'Join',
              'aria-label': (g.joined ? 'Leave ' : 'Join ') + g.name,
              onclick: function () { toggleGroup(g, !g.joined).then(viewGroups); } }));
      }));
    }
    show(h('h1', { text: 'Groups' }),
      h('p', { text: 'Your home town group is always yours. Join any other town or circle that feels like a fit.' }),
      h('h2', { text: 'Interest circles' }), list('circle'), divider(),
      h('h2', { text: 'Town groups' }), list('town'));
  }

  function viewNew(gid) {
    if (!needMember()) return;
    var err = errorBox();
    var gsel = h('select', {});
    joined().forEach(function (g) { gsel.appendChild(h('option', { value: g.id, text: g.name, selected: String(g.id) === String(gid) })); });
    var tsel = h('select', {});
    Object.keys(TYPES).forEach(function (k) { tsel.appendChild(h('option', { value: k, text: TYPES[k], selected: k === 'general' })); });
    var title = h('input', { type: 'text', maxlength: '120' });
    var count = h('p', { class: 'counter', 'aria-live': 'off', text: '0 of 2000' });
    var body = h('textarea', { maxlength: '2000', required: true, oninput: function () { count.textContent = body.value.length + ' of 2000'; } });
    var btn = h('button', { type: 'submit', class: 'btn rose', text: 'Post' });
    show(h('form', { class: 'card', novalidate: true, onsubmit: function (e) {
      e.preventDefault(); err.hidden = true; btn.disabled = true;
      api('POST', '/api/app/posts', { group_id: Number(gsel.value), type: tsel.value, title: title.value, body: body.value })
        .then(function (d) { toast('Your post is up.'); location.hash = '#/post/' + d.post.id; })
        .catch(function (x) { btn.disabled = false; showError(err, x); });
    } },
      h('h1', { text: 'New post' }),
      field('np-group', 'Post to', gsel), field('np-type', 'What kind of post is it?', tsel),
      field('np-title', 'Title (optional)', title), field('np-body', 'Your message', body), count,
      h('p', { class: 'small' }, 'Please be kind, protect privacy, and keep politics and religion out of it. ',
        h('a', { href: '/community-guidelines/', text: 'Community guidelines' }), '. New members can share links after their first 24 hours.'),
      err,
      h('div', { class: 'row' }, btn, h('a', { class: 'btn ghost', href: '#/home', text: 'Cancel' }))));
  }

  function replyEl(r) {
    var el = h('div', { class: 'reply' },
      h('div', { class: 'meta small' }, h('strong', { text: r.author.name }), ' · ' + ago(r.created_at)),
      h('p', { class: 'body', text: r.body }),
      r.mine ? h('button', { type: 'button', class: 'act', text: 'Delete', onclick: function () {
        api('DELETE', '/api/app/replies/' + r.id).then(function () { el.remove(); }).catch(function (x) { toast(x.message); });
      } }) : h('button', { type: 'button', class: 'act', text: 'Report', 'aria-label': 'Report this reply from ' + r.author.name,
        onclick: function () { openReport('reply', r.id, function () { el.remove(); }); } }));
    return el;
  }
  function viewPost(id) {
    if (!needMember()) return;
    show(h('p', { class: 'loading', text: 'Opening the conversation…' }));
    api('GET', '/api/app/posts/' + Number(id)).then(function (d) {
      var err = errorBox(), list = h('div', {}, d.replies.map(replyEl));
      var body = h('textarea', { maxlength: '2000', required: true, style: 'min-height:96px' });
      show(h('p', {}, h('a', { href: '#/group/' + d.post.group_id, text: 'Back to ' + d.post.group_name })),
        postCard(d.post, true),
        h('section', { class: 'card' }, h('h2', { text: 'Replies' }),
          d.replies.length ? null : h('p', { class: 'small', id: 'no-replies', text: 'No replies yet. A kind word goes a long way.' }),
          list,
          h('form', { novalidate: true, onsubmit: function (e) {
            e.preventDefault(); err.hidden = true;
            api('POST', '/api/app/posts/' + d.post.id + '/replies', { body: body.value }).then(function (r) {
              var n = document.getElementById('no-replies'); if (n) n.remove();
              list.appendChild(replyEl(r.reply)); body.value = '';
            }).catch(function (x) { showError(err, x); });
          } }, field('reply-body', 'Add a reply', body), err,
          h('div', { class: 'row' }, h('button', { type: 'submit', class: 'btn', text: 'Reply' })))));
    }).catch(function (x) { show(h('section', { class: 'card' }, h('p', { text: x.message }), h('a', { class: 'btn', href: '#/home', text: 'Back to Home' }))); });
  }

  /* ---------- events ---------- */
  function viewEvents() {
    show(h('h1', { text: 'Events' }), h('p', { class: 'loading', text: 'Checking the calendar…' }));
    api('GET', '/api/app/events').then(function (d) {
      var today = new Date(); today.setHours(0, 0, 0, 0);
      var list = d.events.map(function (ev) {
        var p = String(ev.date).split('-').map(Number); ev._d = new Date(p[0], p[1] - 1, p[2]); return ev;
      }).filter(function (ev) { return ev._d >= today; });
      show(h('h1', { text: 'Events' }),
        h('p', { text: 'Dates and details come from each organizer’s own page. Please confirm the time and cost with the host before you go.' }),
        list.length ? null : h('div', { class: 'empty' }, h('div', { svg: SVG.flower }), h('p', { text: 'No upcoming events are listed right now. Please check back soon.' })),
        list.map(function (ev) {
          return h('article', { class: 'card event' },
            h('div', { class: 'datebox', 'aria-hidden': 'true' }, h('span', { text: MONTHS[ev._d.getMonth()] }), h('b', { text: String(ev._d.getDate()) })),
            h('div', {},
              h('span', { class: 'chip event', text: ev.category || 'Event' }),
              h('h3', { text: ev.title, style: 'margin-top:8px' }),
              h('p', {}, h('strong', { text: ev._d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) })),
              h('p', { text: ev.time }), h('p', { text: ev.location }),
              h('p', { class: 'small', text: 'Hosted by ' + ev.organizer }),
              /^https:\/\//.test(ev.url || '') ? h('a', { class: 'btn ghost', href: ev.url, target: '_blank', rel: 'noopener noreferrer', text: 'Organizer’s page',
                'aria-label': 'Organizer’s page for ' + ev.title + ' (opens in a new tab)', style: 'margin-top:8px' }) : null));
        }),
        h('p', {}, h('a', { href: '/events/', text: 'See the full events page on the website' })));
    }).catch(function (x) { show(h('h1', { text: 'Events' }), h('p', { class: 'error', text: x.message })); });
  }

  /* ---------- magazine ---------- */
  function viewMagazine() {
    show(h('h1', { text: 'Magazine' }), h('p', { class: 'loading', text: 'Fetching the latest stories…' }));
    api('GET', '/api/articles.json').then(function (items) {
      items = (Array.isArray(items) ? items : []).slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, 30);
      show(h('h1', { text: 'Magazine' }), h('p', { text: 'The newest stories from Bucks County Woman.' }),
        items.length ? null : h('p', { class: 'empty', text: 'New stories are on the way.' }),
        items.map(function (a) {
          var href = /^(\/|https:\/\/)/.test(a.url || '') ? a.url : '/';
          var d = a.date ? new Date(a.date) : null;
          return h('article', { class: 'card article' }, h('a', { href: href },
            a.image ? h('img', { src: a.image, alt: '', loading: 'lazy' }) : null,
            h('div', { class: 'pad' },
              h('span', { class: 'cat', text: a.categoryName || a.category || 'Story' }),
              h('h3', { text: a.title, style: 'margin-top:4px' }),
              a.dek ? h('p', { text: a.dek }) : null,
              d && !isNaN(d) ? h('span', { class: 'small', text: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) }) : null)));
        }));
    }).catch(function () { show(h('h1', { text: 'Magazine' }), h('p', { class: 'card' }, 'We could not load the stories just now. ', h('a', { href: '/', text: 'Visit the website' }), ' to read the magazine.')); });
  }

  /* ---------- help ---------- */
  function viewHelp() {
    show(h('h1', { text: 'Help and safety' }),
      h('section', { class: 'card safety' },
        h('p', { class: 'big', text: 'If you are in danger, call 911.' }),
        h('p', {}, h('a', { class: 'tel', href: 'tel:911', text: 'Call 911' })),
        h('p', { text: 'If you or someone you love is in crisis, call or text 988 at any hour. The 988 Suicide and Crisis Lifeline is free and confidential.' }),
        h('p', {}, h('a', { class: 'tel', href: 'tel:988', text: 'Call 988' }), '   ', h('a', { class: 'tel', href: 'sms:988', text: 'Text 988' }))),
      h('section', { class: 'card' }, h('h2', { text: 'Local resources' }),
        h('p', { text: 'Find Bucks County support for health, safety, food, childcare and more.' }),
        h('a', { class: 'btn teal', href: '/resources/', text: 'Open the resources page' })),
      h('section', { class: 'card' }, h('h2', { text: 'Need to leave quickly?' }),
        h('p', { text: 'Quick Exit sends this screen straight to a weather site and keeps this page out of the Back button. It does not clear your browser history.' }),
        h('button', { type: 'button', class: 'btn rose', text: 'Quick Exit', onclick: quickExit })),
      h('section', { class: 'card' }, h('h2', { text: 'Keeping this a kind place' }),
        h('p', { text: 'Every post and reply has a Report button. An item is hidden once three members report it, and there are no private messages in this version.' }),
        h('div', { class: 'row' }, h('a', { class: 'btn ghost', href: '/community-guidelines/', text: 'Community guidelines' }),
          h('a', { class: 'btn ghost', href: '/directory/', text: 'Business directory' }))));
  }

  /* ---------- profile ---------- */
  function viewProfile() {
    if (!needMember()) return;
    var me = state.me, town = townSelect(me.home_group_id);
    var others = joined().filter(function (g) { return !g.is_home; });
    show(h('h1', { text: 'My profile' }),
      h('section', { class: 'card' },
        h('h2', { text: me.name }),
        h('p', { class: 'small', text: 'Member since ' + new Date(me.member_since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) + '. Other members see only this name.' }),
        h('p', { class: 'preview', text: 'Preview: paid membership and phone verification turn on at launch' }),
        field('p-town', 'Home town group', town),
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', text: 'Save town', onclick: function () {
          api('PATCH', '/api/app/me', { home_group_id: Number(town.value) }).then(function (d) { state.me = d.member; return loadGroups(); })
            .then(function () { toast('Your home town is updated.'); viewProfile(); }).catch(function (x) { toast(x.message); });
        } }))),
      h('section', { class: 'card' }, h('h2', { text: 'My groups' }),
        others.length ? h('ul', { class: 'grouplist' }, others.map(function (g) {
          return h('li', {}, h('a', { class: 'name', href: '#/group/' + g.id, text: g.name }),
            h('button', { type: 'button', class: 'btn ghost', text: 'Leave', 'aria-label': 'Leave ' + g.name, onclick: function () { toggleGroup(g, false).then(viewProfile); } }));
        })) : h('p', { text: 'You are in your home town group. Visit Groups to find a circle.' }),
        h('a', { class: 'btn ghost', href: '#/groups', text: 'Browse groups' })),
      h('section', { class: 'card' }, h('h2', { text: 'Account' }),
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn ghost', text: 'Sign out', onclick: function () {
          api('POST', '/api/app/signout').then(signedOut);
        } })),
        h('p', { style: 'margin-top:18px', text: 'Deleting your account removes your profile, your posts and your replies right away. This cannot be undone.' }),
        h('button', { type: 'button', class: 'btn rose', text: 'Delete my account', onclick: function () {
          if (!confirm('Delete your account, along with all of your posts and replies? This cannot be undone.')) return;
          api('DELETE', '/api/app/me').then(function () { signedOut(); toast('Your account was deleted. Take good care.'); }).catch(function (x) { toast(x.message); });
        } }),
        h('p', { class: 'small', style: 'margin-top:14px' }, h('a', { href: '/privacy-policy/', text: 'Privacy policy' }), ' · ', h('a', { href: '/membership/', text: 'Membership' }))));
  }
  function signedOut() {
    state.me = null; state.feedGroup = 'mine';
    document.getElementById('profile-link').hidden = true;
    return loadGroups().catch(function () {}).then(function () { if (currentRoute()[0] === 'home') route(); else location.hash = '#/home'; });
  }

  /* ---------- router ---------- */
  function currentRoute() { var p = location.hash.replace(/^#\/?/, '').split('/'); if (!p[0]) p[0] = 'home'; return p; }
  var TAB_FOR = { home: 'home', new: 'home', post: 'home', profile: '', groups: 'groups', group: 'groups', events: 'events', magazine: 'magazine', help: 'help' };
  function route() {
    var r = currentRoute(), views = { home: viewHome, groups: viewGroups, group: viewGroup, new: viewNew, post: viewPost, events: viewEvents, magazine: viewMagazine, help: viewHelp, profile: viewProfile };
    var tab = TAB_FOR[r[0]];
    Array.prototype.forEach.call(document.querySelectorAll('.tabs a'), function (a) {
      if (a.getAttribute('data-tab') === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    (views[r[0]] || viewHome)(r[1]);
  }
  window.addEventListener('hashchange', function () { route(); main.focus({ preventScroll: true }); });
  document.getElementById('quick-exit-top').addEventListener('click', quickExit);

  /* ---------- boot ---------- */
  Promise.all([api('GET', '/api/app/me'), loadGroups()]).then(function (res) {
    state.me = res[0].member;
    document.getElementById('profile-link').hidden = !state.me;
    route();
  }).catch(function (x) {
    show(h('section', { class: 'card' }, h('h2', { text: 'We could not open the community' }), h('p', { text: x.message }),
      h('button', { type: 'button', class: 'btn', text: 'Try again', onclick: function () { location.reload(); } })));
  });
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' }).catch(function () {}); });
  }
})();
