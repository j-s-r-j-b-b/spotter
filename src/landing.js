import { useState } from 'preact/hooks';
import { html, Icon, Logo, Link, navigate, toast } from './ui.js';
import { api } from './api.js';

export function Landing() {
  const [busy, setBusy] = useState(false);
  const demo = async () => {
    setBusy(true);
    try { await api('/api/auth?op=demo', { method: 'POST', body: {} }); navigate('/app'); }
    catch (e) { toast(e.message, 'bad'); setBusy(false); }
  };
  return html`<div class="landing">
    <nav class="l-nav"><${Logo} /><div class="row"><${Link} to="/login" class="btn ghost">Log in<//><${Link} to="/signup" class="btn dark">Start free<//></div></nav>

    <section class="hero">
      <div class="hero-copy">
        <span class="eyebrow">For online fitness & strength coaches</span>
        <h1>Your Claude writes the program.<br /><span class="hl">Spotter keeps clients on it.</span></h1>
        <p class="lede">Connect your own Claude in one minute. Ask it to build a client's plan — it lands in Spotter, you tweak it, your client trains from a link on their phone, and Claude reads what they actually did to adjust next week.</p>
        <div class="row gap">
          <${Link} to="/signup" class="btn dark lg">Start free <${Icon} n="arrow" /><//>
          <button class="btn lg" onClick=${demo} disabled=${busy}>${busy ? 'Opening…' : 'Try the demo account'}</button>
        </div>
        <p class="tiny muted"><${Icon} n="shield" s=${13} /> No AI inside Spotter. Your Claude plan does the thinking, so there's no AI bill.</p>
      </div>

      <div class="hero-visual" aria-hidden="true">
        <div class="hv claude">
          <div class="hv-h"><${Icon} n="spark" s=${13} /> Claude</div>
          <div class="bubble me">New client Priya, 32, fat loss, 3 days a week, home dumbbells, sore right knee. Build her a 4-week plan.</div>
          <div class="bubble ai"><span class="tool">spotter · save_plan ✓</span>Done — knee-friendly box squats instead of lunges. Here's Priya's phone link.</div>
        </div>
        <div class="hv dash">
          <div class="hv-h"><${Logo} /></div>
          <div class="mini-row"><b>Priya Nair</b><span class="flag info">Week 1 of 4</span></div>
          <div class="mini-ex"><span>Box squat</span><span class="mono">3×12 @ 8 kg</span></div>
          <div class="mini-ex edited"><span>DB Romanian deadlift</span><span class="mono">3×10 @ 10 kg</span></div>
          <div class="mini-ex"><span>Glute bridge</span><span class="mono">3×15</span></div>
        </div>
        <div class="hv phone">
          <div class="ph-notch"></div>
          <div class="ph-mini-h">Today · Day A</div>
          <div class="ph-mini-set done">Box squat <span>12 × 8 kg ✓</span></div>
          <div class="ph-mini-set done">Box squat <span>12 × 8 kg ✓</span></div>
          <div class="ph-mini-set">Box squat <span>12 × 8 kg</span></div>
          <div class="ph-mini-btn">Finish workout</div>
        </div>
      </div>
    </section>

    <section class="steps">
      ${[
        ['plug', 'Plug in your Claude', 'Paste your private Spotter link into Claude → Customize → Connectors. Claude can now add clients, write plans, read logs and send messages.'],
        ['dumbbell', 'Claude writes, you approve', 'Every plan Claude writes shows up in Spotter. Change any set, rep or exercise yourself. Spotter highlights exactly what Claude changed and why.'],
        ['phone', 'Clients train from a link', 'No app to install, no login. Clients see today\'s workout, tick off sets, log weights and flag pain. You see it live.'],
        ['refresh', 'Claude adjusts every week', '“How did Rahul do?” Claude reads planned vs. actual, effort and pain notes, then rewrites next week and sends a check-in.'],
      ].map(([i, t, d], n) => html`<div class="step"><span class="step-n">${n + 1}</span><${Icon} n=${i} s=${22} /><h3>${t}</h3><p>${d}</p></div>`)}
    </section>

    <section class="why">
      <div>
        <h2>Why coaches pay for Spotter, not just Claude</h2>
        <ul class="ticks">
          <li><b>Your clients don't have your Claude.</b> Spotter is the place they see the plan and log what they did.</li>
          <li><b>Claude forgets; Spotter remembers.</b> Every set, weight, effort score and pain note, week after week.</li>
          <li><b>You stay the coach.</b> Edit anything; nothing reaches a client that you can't see and change.</li>
          <li><b>No AI bill.</b> Spotter never calls an AI model. The thinking runs on the Claude plan you already pay for.</li>
        </ul>
      </div>
      <div class="pricing">
        <div class="price"><h4>Starter</h4><div class="amt">$19<span>/mo</span></div><p>Up to 15 active clients</p></div>
        <div class="price best"><h4>Pro</h4><div class="amt">$39<span>/mo</span></div><p>Up to 50 active clients, your logo on client pages</p></div>
        <p class="tiny muted">Free for your first 3 clients. Cancel anytime.</p>
      </div>
    </section>

    <footer class="l-foot"><${Logo} /><span class="muted">Spotter has no AI inside — your Claude does the thinking.</span></footer>
  </div>`;
}
