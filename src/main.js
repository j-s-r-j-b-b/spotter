import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { html } from './ui.js';
import { Landing } from './landing.js';
import { AuthPage } from './auth.js';
import { CoachApp } from './coach.js';
import { Phone } from './phone.js';

function usePath() {
  const [p, setP] = useState(location.pathname);
  useEffect(() => { const f = () => setP(location.pathname); addEventListener('popstate', f); return () => removeEventListener('popstate', f); }, []);
  return p;
}

function App() {
  const path = usePath();
  useEffect(() => { document.body.classList.toggle('phone-body', path.startsWith('/c/')); }, [path]);
  if (path.startsWith('/c/')) return html`<${Phone} token=${path.split('/')[2]} />`;
  if (path === '/login' || path === '/signup') return html`<${AuthPage} mode=${path.slice(1)} />`;
  if (path.startsWith('/app')) return html`<${CoachApp} path=${path} />`;
  return html`<${Landing} />`;
}

render(html`<${App} />`, document.getElementById('app'));
