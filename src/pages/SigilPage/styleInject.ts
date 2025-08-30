// src/pages/SigilPage/styleInject.ts

export function injectSigilPageStyles() {
    const id = "sigilpage-crystal-styles";
    if (document.getElementById(id)) return;
  
    const style = document.createElement("style");
    style.id = id;
    style.innerHTML = `
    .sigilpage { --crystal-hue: 180; --crystal-accent: #00FFD0; --glass: hsla(0,0%,100%,0.08); --glass-strong: hsla(0,0%,100%,0.14); --ink: #e8fbff; --ink-dim: #bfe9ff; --ring: hsla(var(--crystal-hue), 95%, 62%, 0.45); --ring2: hsla(calc(var(--crystal-hue) + 24), 92%, 60%, 0.35); --aurora-a: hsla(calc(var(--crystal-hue) + 8), 100%, 60%, 0.25); --aurora-b: hsla(calc(var(--crystal-hue) - 22), 100%, 58%, 0.22); --aurora-c: hsla(calc(var(--crystal-hue) + 48), 100%, 58%, 0.20); color: var(--ink); background:
      radial-gradient(1600px 1000px at 10% -10%, rgba(255,255,255,0.04), transparent 60%),
      radial-gradient(1200px 900px at 120% 20%, rgba(255,255,255,0.04), transparent 60%),
      linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.55)); }
    .sp-veil::before, .sp-veil::after { content:""; position: fixed; inset: -10vmax; pointer-events:none;
      background: radial-gradient(1000px 700px at 20% 10%, var(--aurora-a), transparent 60%),
                  radial-gradient(900px 600px at 80% 0%, var(--aurora-b), transparent 55%),
                  radial-gradient(1200px 800px at 50% 120%, var(--aurora-c), transparent 60%);
      filter: blur(40px) saturate(120%); animation: auroraDrift 24s ease-in-out infinite alternate; opacity: .9; z-index: 0; }
    .sp-veil::after { animation-duration: 36s; mix-blend-mode: screen; filter: blur(60px) saturate(140%); opacity: .6; }
    @keyframes auroraDrift { from { opacity: .35 } to { opacity: .7 } }
    .sp-shell { position: relative; z-index: 1; }
    .sp-title { position: relative; letter-spacing: 0.02em; text-shadow: 0 1px 0 rgba(255,255,255,0.05), 0 0 24px var(--ring2); }
    .sp-title-glow { position: absolute; inset: -8px -12px; border-radius: 18px; background: radial-gradient(120px 60px at 30% 25%, var(--ring), transparent 60%), radial-gradient(180px 100px at 70% 40%, var(--ring2), transparent 60%); filter: blur(24px); opacity: .55; pointer-events: none; animation: glowPulse 6.5s ease-in-out infinite alternate; }
    @keyframes glowPulse { from { opacity: .35 } to { opacity: .7 } }
    .sp-card { position: relative; background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02)); border: 1px solid rgba(255,255,255,0.08); border-radius: 22px; box-shadow: 0 20px 70px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.08), 0 0 0 1px rgba(255,255,255,.03); overflow: hidden; backdrop-filter: blur(10px) saturate(140%); }
    .sp-frame::after { content:""; position: absolute; inset: 0; background: conic-gradient(from 0deg, transparent 0 70%, rgba(255,255,255,0.04) 75%, transparent 80%), radial-gradient(800px 800px at 50% 50%, rgba(255,255,255,0.06), transparent 70%); mix-blend-mode: overlay; opacity: .6; pointer-events: none; }
    .auth-badge { backdrop-filter: blur(8px) saturate(140%); border-radius: 999px; border: 1px solid rgba(255,255,255,.18); box-shadow: 0 6px 24px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.08); padding: 6px 10px; }
    .auth-badge--ok { background: linear-gradient(180deg, rgba(36,230,162,.22), rgba(0,0,0,.12)); }
    .auth-badge--bad { background: linear-gradient(180deg, rgba(255,64,64,.22), rgba(0,0,0,.12)); }
    .auth-badge--checking { background: linear-gradient(180deg, rgba(126,167,255,.22), rgba(0,0,0,.12)); }
    .archived-badge { margin-left: 12px; padding: 6px 10px; border-radius: 999px; border:1px solid rgba(255,255,255,.18); background: linear-gradient(180deg, rgba(255, 170, 64,.22), rgba(0,0,0,.12)); }
    .btn-primary { position: relative; overflow: hidden; border-radius: 14px; background: linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06)); border: 1px solid rgba(255,255,255,.14); box-shadow: 0 10px 30px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.08); padding: 10px 14px; }
    .btn-ghost { border: 1px solid rgba(255,255,255,.12); border-radius: 12px; padding: 8px 12px; background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02)); }
    button, .btn-primary, .btn-ghost, .sp-actions button { touch-action: manipulation; -webkit-tap-highlight-color: transparent; -webkit-user-select: none; cursor: pointer; }
  
    /* Upgrade banner */
    .sp-upgrade{display:grid;gap:10px;margin:16px 0 8px 0;padding:12px 14px;border-radius:16px;border:1px solid rgba(255,255,255,.14);background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(0,0,0,.02))}
    .sp-upgrade .row{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
    .sp-upgrade .pill{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:6px 10px;font-size:12px;border:1px solid rgba(255,255,255,.16);background:linear-gradient(180deg, rgba(255,170,64,.24), rgba(0,0,0,.10))}
    .sp-upgrade .muted{opacity:.8;font-size:13px}
    .sp-upgrade .spacer{flex:1 1 auto}
    .sp-upgrade .upg-btn{border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:8px 12px;cursor:pointer;font-weight:600;background:linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,.06));box-shadow:0 10px 30px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.08);color:#eafcff}
    .sp-upgrade .upg-btn[disabled]{opacity:.5;cursor:not-allowed}
  
    /* Live Φ price chip */
    .sp-price-chip{position:fixed;bottom:calc(12px + env(safe-area-inset-bottom));right:calc(12px + env(safe-area-inset-right));z-index:50;display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,.06));box-shadow:0 10px 30px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.08);font-weight:700;letter-spacing:.01em;transform:translateZ(0);will-change:transform}
    .sp-price-chip .phi{display:inline-block;width:16px;height:16px;mask-image:var(--phi-url);-webkit-mask-image:var(--phi-url);mask-size:contain;-webkit-mask-size:contain;background:currentColor}
    .sp-price-chip .price{min-width:8ch;text-align:right}
    .sp-price-chip .live-badge{font-size:10px;opacity:.8;border:1px solid rgba(255,255,255,.18);padding:2px 6px;border-radius:999px;margin-left:4px}
    .sp-price-chip.flash-up{animation:chipUp .45s ease}
    .sp-price-chip.flash-down{animation:chipDown .45s ease}
    @keyframes chipUp{from{box-shadow:0 0 0 rgba(0,0,0,0)} to{box-shadow:0 0 24px rgba(64,255,128,.35)}}
    @keyframes chipDown{from{box-shadow:0 0 0 rgba(0,0,0,0)} to{box-shadow:0 0 24px rgba(255,96,96,.28)}}
    `;
    document.head.appendChild(style);
  }
  