import styles from "./section-divider.module.css";

export function SectionDivider() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1000 36"
      preserveAspectRatio="none"
      className="block h-6 w-full text-border min-[769px]:h-8 min-[1024px]:h-9"
    >
      <path
        className={styles.line}
        d="M0 1H220C230 1 230 33 240 33H760C770 33 770 1 780 1H1000"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
