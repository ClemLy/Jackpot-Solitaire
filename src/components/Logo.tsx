// Embleme du jeu: une carte as de pique legerement inclinee et un jeton dore.
// Meme dessin que public/favicon.svg.

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="logo-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF1BF" />
          <stop offset="0.45" stopColor="#E3B95A" />
          <stop offset="1" stopColor="#9C6E1E" />
        </linearGradient>
      </defs>
      <g transform="rotate(-9 30 30)">
        <rect
          x="11"
          y="7"
          width="34"
          height="46"
          rx="5"
          fill="#FBF6EA"
          stroke="url(#logo-gold)"
          strokeWidth="2"
        />
        <rect
          x="14.5"
          y="10.5"
          width="27"
          height="39"
          rx="3"
          fill="none"
          stroke="#E3B95A"
          strokeOpacity="0.55"
          strokeWidth="0.9"
        />
        <svg x="17" y="16" width="22" height="22" viewBox="0 0 100 100">
          <use href="#suit-spades" style={{ color: '#17191F' }} />
        </svg>
      </g>
      <g transform="translate(36 34)">
        <circle cx="12" cy="12" r="12" fill="url(#logo-gold)" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect
            key={i}
            x="10.3"
            y="0.6"
            width="3.4"
            height="3.8"
            rx="0.8"
            fill="#FFF6DA"
            transform={`rotate(${i * 60} 12 12)`}
          />
        ))}
        <circle
          cx="12"
          cy="12"
          r="7.4"
          fill="#E9BE5C"
          stroke="#8A5F14"
          strokeWidth="0.8"
        />
        <path
          d="M12 7.6 L13.2 10.7 L16.4 10.8 L13.9 12.8 L14.8 15.9 L12 14.1 L9.2 15.9 L10.1 12.8 L7.6 10.8 L10.8 10.7 Z"
          fill="#6B4A10"
        />
      </g>
    </svg>
  );
}
