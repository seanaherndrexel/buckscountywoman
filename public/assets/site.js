(function () {
  function post(url, data) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(function (r) { return r.json().catch(function () { return { ok: false }; }); });
  }
  document.querySelectorAll('form.signup').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = f.querySelector('.form-msg');
      var email = f.email.value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg.textContent = 'Please enter a valid email address.'; return; }
      msg.textContent = 'One moment...';
      post('/api/subscribe', { email: email, source: f.dataset.source, website: f.website.value }).then(function (r) {
        if (r.ok) { f.reset(); msg.textContent = 'You are on the list. See you Thursday.'; } else { msg.textContent = r.error || 'Something went wrong. Please try again.'; }
      }).catch(function () { msg.textContent = 'Something went wrong. Please try again.'; });
    });
  });
  document.querySelectorAll('form.bcw-form').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = f.querySelector('.form-msg');
      if (!f.checkValidity()) { msg.textContent = 'Please fill in the required fields.'; f.reportValidity(); return; }
      var fields = {};
      new FormData(f).forEach(function (v, k) { if (k !== 'website') fields[k] = v; });
      msg.textContent = 'Sending...';
      post('/api/form', { type: f.dataset.type, fields: fields, website: f.website.value }).then(function (r) {
        if (r.ok) { f.reset(); msg.textContent = 'Thank you. We have it, and a real person will read it.'; } else { msg.textContent = r.error || 'Something went wrong. Please try again.'; }
      }).catch(function () { msg.textContent = 'Something went wrong. Please try again.'; });
    });
  });
  document.querySelectorAll('[data-exit]').forEach(function (b) {
    b.addEventListener('click', function () { window.location.replace('https://www.weather.com'); });
  });
  document.querySelectorAll('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () { if (navigator.clipboard) navigator.clipboard.writeText(b.dataset.copy).then(function () { b.textContent = 'Link copied'; }); });
  });
})();
