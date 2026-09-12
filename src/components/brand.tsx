import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="OpsStudio home">
      <svg
        className="brand-symbol"
        width="34"
        height="34"
        viewBox="0 0 36 36"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3 3H15V7H7V15H3ZM21 3H33V15H29V7H21ZM3 21H7V29H15V33H3ZM29 21H33V33H21V29H29Z"
          fill="currentColor"
        />
        <path d="M12 13H24V23H12Z" fill="currentColor" />
      </svg>
      {!compact && (
        <span>
          Ops<span className="brand-light">Studio</span>
        </span>
      )}
    </Link>
  );
}
