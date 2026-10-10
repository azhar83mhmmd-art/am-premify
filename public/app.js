// AM Premify - Premium Panel (frontend)
const CONFIG = {
  user: 'kenz',
  waNumber: '6282357961890' // 082357961890 dalam format internasional
};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

/* Toast */
let toastTimer;
function toast(msg, type = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = 'toast'), 2600);
}

/* Navigasi */
function show(view) {
  $$('.view').forEach((v) => v.classList.toggle('hidden', v.dataset.view !== view));
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === view));
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (view === 'home') renderHome();
}
$$('.tab').forEach((t) => t.addEventListener('click', () => show(t.dataset.tab)));
$$('[data-goto]').forEach((b) => b.addEventListener('click', () => show(b.dataset.goto)));

/* WhatsApp: pesan otomatis (menyertakan email jika sudah diisi) */
function waLink() {
  const email = ($('#email') && $('#email').value.trim()) || '';
  const lines = [
    'Halo kak, saya butuh bantuan terkait AM Premify.',
    '',
    email ? `Email akun: ${email}` : 'Email akun: -',
    'Kendala: '
  ];
  return `https://wa.me/${CONFIG.waNumber}?text=${encodeURIComponent(lines.join('\n'))}`;
}
$$('.js-wa').forEach((a) => {
  a.href = waLink();
  ['pointerdown', 'focus', 'click'].forEach((ev) => a.addEventListener(ev, () => (a.href = waLink())));
});

/* Stepper: 1 email, 2 link, 3 VIP, 4 selesai */
function setStep(n) {
  $$('.stp').forEach((el) => {
    const i = Number(el.dataset.step);
    el.classList.toggle('done', i < n);
    el.classList.toggle('active', i === n);
  });
}

/* Dashboard */
function renderHome() {
  const list = store.get('am_accounts', []);
  $('#stat-total').textContent = list.length;
  const box = $('#recent');
  if (!list.length) { box.innerHTML = '<div class="empty">Belum ada akun premium.</div>'; return; }
  box.innerHTML = list.slice(0, 5).map((u, i) => `
    <div class="item">
      <div class="meta"><b>${esc(u.email)}</b><span>${new Date(u.at).toLocaleString('id-ID')}</span></div>
      <span class="badge">VIP</span>
      <button class="mini" data-del="${i}" aria-label="Hapus"><svg class="ic"><use href="#i-trash"/></svg></button>
    </div>`).join('');
  $$('[data-del]', box).forEach((b) => b.addEventListener('click', () => {
    const l = store.get('am_accounts', []);
    l.splice(Number(b.dataset.del), 1);
    store.set('am_accounts', l);
    renderHome();
  }));
}

$('#clear-all').addEventListener('click', () => {
  if (!store.get('am_accounts', []).length) return toast('Belum ada data');
  if (!confirm('Hapus semua riwayat akun premium?')) return;
  store.set('am_accounts', []);
  renderHome();
  toast('Riwayat dihapus');
});

/* Terminal */
const term = {
  box: $('#term'),
  body: $('#term-body'),
  cursor: null,
  init() {
    this.cursor = document.createElement('div');
    this.cursor.className = 'cursor-ln';
    this.body.appendChild(this.cursor);
  },
  time() {
    const d = new Date(), p = (n) => String(n).padStart(2, '0');
    return `[${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}]`;
  },
  // type: sys | ready | info | ok | tip | warn | err | raw
  log(type, text, opts = {}) {
    const ln = document.createElement('div');
    ln.className = 'ln ' + type;
    const ts = document.createElement('span');
    ts.className = 'ts';
    ts.textContent = opts.label || this.time();
    const msg = document.createElement('span');
    msg.className = 'msg';
    const icon = { ok: 'i-ok', tip: 'i-info', err: 'i-fail', warn: 'i-info' }[type];
    if (icon) msg.innerHTML = `<svg class="ic"><use href="#${icon}"/></svg>`;
    msg.appendChild(document.createTextNode(text));
    ln.append(ts, msg);
    this.body.insertBefore(ln, this.cursor);
    this.body.scrollTop = this.body.scrollHeight;
  },
  welcome() {
    this.log('sys', 'Sistem Verifikasi Alight Motion (AM Premify core) siap digunakan.', { label: '[SYSTEM]' });
    this.log('ready', 'Silakan masukkan alamat email akun Alight Motion lalu klik "Kirim Magic Link".', { label: '[READY]' });
  },
  clear() {
    $$('.ln', this.body).forEach((l) => l.remove());
    this.welcome();
    this.log('info', 'Riwayat verifikasi dibersihkan.');
  },
  text() { return $$('.ln', this.body).map((l) => l.textContent.replace(/\s+/g, ' ').trim()).join('\n'); }
};
term.init();
term.welcome();

$('#term-clear').addEventListener('click', () => { term.clear(); setStep(1); });
$('#term-toggle').addEventListener('click', () => term.box.classList.toggle('collapsed'));
$('#term-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(term.text()); toast('Log disalin'); }
  catch { toast('Gagal menyalin', 'err'); }
});

/* Premiumkan Akun */
async function postJson(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  let data;
  try { data = await res.json(); } catch { data = { success: false, error: 'Respon tidak valid dari server' }; }
  const ok = res.ok && data.success !== false && !data.error;
  return { ok, data, status: res.status };
}

function errText(r) {
  const d = r.data || {};
  const m = d.error || d.message || (d.data && d.data.message) || 'Status ' + r.status;
  return typeof m === 'string' ? m : JSON.stringify(m);
}

function logRaw(data) {
  let t = '';
  try { t = JSON.stringify(data); } catch {}
  if (t.length > 280) t = t.slice(0, 280) + '...';
  if (t) term.log('raw', 'Respon server: ' + t);
}

function setBtn(btn, busy, text) {
  btn.disabled = busy;
  $('span', btn).textContent = text;
}

$('#email').addEventListener('input', () => setStep(1));

$('#send-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#email').value.trim();
  const btn = $('#send-btn');
  setBtn(btn, true, 'Mengirim...');
  term.log('info', `[*] Menghubungi server verifikasi untuk ${email}...`);
  try {
    const r = await postJson('/api/send-link', { email });
    logRaw(r.data);
    if (r.ok) {
      term.log('ok', `Link verifikasi berhasil dikirim ke: ${email}`);
      term.log('tip', 'Buka email masuk lalu tempelkan link verifikasi di Langkah 2');
      setStep(2);
      toast('Magic link terkirim, cek email target');
    } else {
      term.log('err', 'Gagal mengirim link: ' + errText(r));
      toast('Gagal mengirim magic link', 'err');
    }
  } catch (err) {
    term.log('err', 'Gagal terhubung ke server: ' + err.message);
    toast('Gagal terhubung ke server', 'err');
  } finally { setBtn(btn, false, 'Kirim Magic Link'); }
});

$('#verify-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#email').value.trim();
  const magicLink = $('#magic').value.trim();
  if (!email) {
    term.log('warn', 'Email target belum diisi. Isi email di Langkah 1 terlebih dahulu.');
    return toast('Isi email target dulu di langkah 1', 'err');
  }
  const btn = $('#verify-btn');
  setBtn(btn, true, 'Memverifikasi...');
  setStep(3);
  term.log('info', `[*] Memverifikasi link untuk ${email}...`);
  try {
    const r = await postJson('/api/verify-link', { email, magicLink });
    logRaw(r.data);
    if (r.ok) {
      const list = store.get('am_accounts', []);
      list.unshift({ email, at: Date.now() });
      store.set('am_accounts', list);
      $('#magic').value = '';
      term.log('ok', `Akun berhasil diaktifkan VIP: ${email}`);
      setStep(4);
      toast('Akun berhasil diaktifkan VIP');
    } else {
      term.log('err', 'Verifikasi gagal: ' + errText(r));
      setStep(2);
      toast('Verifikasi gagal, cek log', 'err');
    }
  } catch (err) {
    term.log('err', 'Gagal terhubung ke server: ' + err.message);
    setStep(2);
    toast('Gagal terhubung ke server', 'err');
  } finally { setBtn(btn, false, 'Verifikasi & Aktifkan VIP'); }
});

/* Init */
$$('[data-user]').forEach((el) => (el.textContent = CONFIG.user));
renderHome();
