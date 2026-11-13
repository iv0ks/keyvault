// keyvault front-end.
//
// The UI lists your own secrets (with content, since they're yours) and a
// "team activity" feed. The feed renders each secret's UUID and owner — which
// is exactly the leak: a normal user sees ids that belong to other people. The
// UI never shows other users' *content*; reaching that is the lab, and it only
// takes feeding a leaked id to GET /api/secrets/:id (e.g. from Burp).
const $ = (sel) => document.querySelector(sel);

const loginCard = $('#login-card');
const vault = $('#vault');
const who = $('#who');

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function renderMine(rows) {
  $('#my-secrets').innerHTML = rows
    .map(
      (s) =>
        `<div class="row"><span class="title">${s.title}</span><span class="id">${s.id}</span></div>`,
    )
    .join('');
}

function renderActivity(rows) {
  $('#activity').innerHTML = rows
    .map(
      (s) =>
        `<div class="row"><span class="title">${s.title}</span>` +
        `<span><span class="owner">@${s.owner}</span> <span class="id">${s.id}</span></span></div>`,
    )
    .join('');
}

async function loadVault() {
  const me = await api('/api/secrets');
  if (me.status !== 200) return false;
  renderMine(me.body.secrets);
  const act = await api('/api/activity');
  if (act.status === 200) renderActivity(act.body.activity);
  loginCard.classList.add('hidden');
  vault.classList.remove('hidden');
  return true;
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-error').textContent = '';
  const f = e.target;
  const { status, body } = await api('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username: f.username.value, password: f.password.value }),
  });
  if (status !== 200) {
    $('#login-error').textContent = body.message || 'login failed';
    return;
  }
  who.textContent = `@${body.user.username}`;
  await loadVault();
});

$('#logout').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  vault.classList.add('hidden');
  loginCard.classList.remove('hidden');
  who.textContent = '';
});

// Resume an existing session on load.
api('/api/secrets').then(({ status, body }) => {
  if (status === 200) {
    renderMine(body.secrets);
    api('/api/activity').then((a) => a.status === 200 && renderActivity(a.body.activity));
    loginCard.classList.add('hidden');
    vault.classList.remove('hidden');
  }
});
