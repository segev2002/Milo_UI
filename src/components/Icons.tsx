type Props = { className?: string };

const base = "h-[18px] w-[18px]";

export const IconDashboard = ({ className = base }: Props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
    <rect x="3" y="3" width="7" height="9" rx="2" />
    <rect x="14" y="3" width="7" height="5" rx="2" />
    <rect x="14" y="10" width="7" height="11" rx="2" />
    <rect x="3" y="14" width="7" height="7" rx="2" />
  </svg>
);

export const IconChat = ({ className = base }: Props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
    <path d="M21 12a8 8 0 0 1-8 8H8l-4 3v-5.5A8 8 0 1 1 21 12Z" strokeLinejoin="round" />
  </svg>
);

export const IconPlaybook = ({ className = base }: Props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
    <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V5Z" strokeLinejoin="round" />
    <path d="M9 8h7M9 12h7M9 16h4" strokeLinecap="round" />
  </svg>
);

export const IconLedger = ({ className = base }: Props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" strokeLinecap="round" />
  </svg>
);

export const IconSettings = ({ className = base }: Props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2.5M12 18.5V21M4.2 7.5l2.2 1.3M17.6 15.2l2.2 1.3M4.2 16.5l2.2-1.3M17.6 8.8l2.2-1.3" strokeLinecap="round" />
  </svg>
);

export const IconSend = ({ className = base }: Props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
    <path d="M4 12 20 4l-3.5 16-5-6.5L4 12Z" strokeLinejoin="round" />
  </svg>
);

export const IconSpark = ({ className = base }: Props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" strokeLinejoin="round" />
  </svg>
);

export const IconArrow = ({ className = base }: Props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
