export function PackageContents() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 600 390" className="guide-package">
      <g stroke="var(--border-strong)" strokeWidth="1.2" strokeLinejoin="round">
        <path d="M64 216 330 155 539 229 273 303Z" fill="var(--subtle)" />
        <path d="M64 216v26l209 74 266-61v-26l-266 61Z" fill="var(--canvas)" />
        <path d="M273 290v26M64 230l209 73 266-61" fill="none" />
      </g>
      <g transform="translate(90 93) rotate(-10 140 85)">
        <rect x="3" y="7" width="282" height="178" rx="12" fill="var(--border-strong)" opacity="0.35" />
        <image href="/neffi-card-front-preview.svg" width="282" height="178" />
      </g>
      <g transform="translate(360 89) rotate(8 70 94)">
        <rect x="3" y="6" width="140" height="187" rx="4" fill="var(--border-strong)" opacity="0.35" />
        <rect width="140" height="187" rx="4" fill="var(--background)" stroke="var(--foreground)" strokeWidth="1.5" />
        <path d="M22 28h52M22 39h34" stroke="var(--fg-secondary)" strokeWidth="1" />
        <rect x="22" y="77" width="96" height="36" rx="4" fill="var(--subtle)" stroke="var(--border-strong)" />
        <path d="M34 95h19m8 0h8m8 0h29" stroke="var(--fg-secondary)" strokeWidth="2" strokeLinecap="round" />
        <path d="M22 141h73M22 151h54" stroke="var(--border-strong)" />
        <path d="M22 61h14" stroke="var(--brand)" strokeWidth="2" />
      </g>
    </svg>
  );
}
