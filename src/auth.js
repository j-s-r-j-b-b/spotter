import { useState } from 'preact/hooks';
import { html, Logo, Link, navigate, Icon } from './ui.js';
import { api } from './api.js';

export function AuthPage({ mode }) {
  const signup = mode === 'signup';
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await api('/api/auth?op=' + (signup ? 'signup' : 'login'), { method: 'POST', body: f }); navigate(signup ? '/app/connect' : '/app'); }
    catch (x) { setErr(x.message); setBusy(false); }
  };
  const demo = async () => {
    setBusy(true);
    try { await api('/api/auth?op=demo', { method: 'POST', body: {} }); navigate('/app'); }
    catch (x) { setErr(x.message); setBusy(false); }
  };
  return html`<div class="auth">
    <div class="auth-card">
      <${Link} to="/"><${Logo} /><//>
      <h1>${signup ? 'Create your coach account' : 'Welcome back, coach'}</h1>
      <p class="muted">${signup ? 'Free for your first 3 clients. You\'ll get your personal Claude connector link next.' : 'Log in to see your clients and your Claude connector link.'}</p>
      <form onSubmit=${submit}>
        ${signup && html`<label>Your name<input value=${f.name} onInput=${set('name')} placeholder="e.g. Arjun Rao" autocomplete="name" /></label>`}
        <label>Email<input type="email" required value=${f.email} onInput=${set('email')} placeholder="you@example.com" autocomplete="email" /></label>
        <label>Password<input type="password" required minlength="6" value=${f.password} onInput=${set('password')} placeholder=${signup ? 'At least 6 characters' : ''} autocomplete=${signup ? 'new-password' : 'current-password'} /></label>
        ${err && html`<div class="form-err"><${Icon} n="alert" s=${14} /> ${err}</div>`}
        <button class="btn dark lg full" disabled=${busy}>${busy ? 'Please wait…' : signup ? 'Create account' : 'Log in'}</button>
      </form>
      <div class="or"><span>or</span></div>
      <button class="btn full" onClick=${demo} disabled=${busy}>Try the demo account</button>
      <p class="tiny muted center">Demo login: <span class="mono">demo@spotter.fit</span> / <span class="mono">spotter-demo</span></p>
      <p class="center small">${signup ? html`Already have an account? <${Link} to="/login">Log in<//>` : html`New to Spotter? <${Link} to="/signup">Create an account<//>`}</p>
    </div>
  </div>`;
}
