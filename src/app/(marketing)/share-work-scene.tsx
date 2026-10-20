import { DemoAvatar, demoIdentity } from "./profile-preview";

function IdentityMark() {
  return (
    <svg viewBox="0 0 96 96" fill="none" aria-hidden="true">
      <path d="M16 76V20L48 52L80 20V76M32 76V58L48 74L64 58V76" stroke="currentColor" strokeWidth="5" strokeLinejoin="miter" />
    </svg>
  );
}

export function ShareWorkScene() {
  return (
    <div className="pe-work-scene">
      <div className="pe-portfolio" role="img" aria-label="Sample portfolio for Mika Santos, Brand Designer: Project 01, Brand Identity, 2026; Project 02, Digital Design; Project 03, Art Direction">
        <header>
          <div className="pe-portfolio-identity"><DemoAvatar /><div><strong>{demoIdentity.fullName}</strong><span>{demoIdentity.headline}</span></div></div>
          <span>Selected work</span>
        </header>
        <div className="pe-project-main">
          <div className="pe-brand-study" aria-hidden="true">
            <div className="pe-brand-mark"><IdentityMark /><span>MS / 01</span></div>
            <div className="pe-brand-wordmark"><span>Identity system</span><strong>Mika<br />Santos</strong><div className="pe-brand-swatches"><i /><i /><i /></div></div>
          </div>
          <div className="pe-project-caption"><span>Project 01 <strong>Brand Identity</strong></span><span>2026</span></div>
        </div>
        <div className="pe-project-thumbnails">
          <div>
            <div className="pe-digital-study" aria-hidden="true"><div><strong>MS</strong><span>Work / About</span></div><p>Selected<br />work.</p><IdentityMark /></div>
            <div className="pe-project-caption"><span>Project 02 <strong>Digital Design</strong></span></div>
          </div>
          <div>
            <div className="pe-type-study" aria-hidden="true"><span>TYPE / FORM</span><strong>Aa</strong><small>01 — 26</small></div>
            <div className="pe-project-caption"><span>Project 03 <strong>Art Direction</strong></span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
