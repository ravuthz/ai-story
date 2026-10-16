import { useId } from "react";

interface StylePreviewImageProps {
  style?: string;
  className?: string;
}

const AVAILABLE_PREVIEWS: Record<string, true> = {
  "2d-cartoon": true, "35mm-film": true, "3d-animation": true, "3d-cartoon": true, "3d-render": true,
  "ai-presenter": true, "animated-podcast": true, "anime": true, "atmospheric": true, "bright-friendly-colors": true,
  "cartoon": true, "cinematic-realistic": true, "cinematic": true, "clean-negative-space": true, "comic-book": true,
  "contemplative": true, "cute-children-s-book-illustration": true, "dark-cinematic-horror": true,
  "dark-fantasy": true, "documentary": true, "dramatic-lighting": true, "elegant-cinematic-typography-backdrop": true,
  "epic-inspirational-cinematic": true, "film-grain": true, "golden-hour": true, "highly-detailed": true,
  "hollywood": true, "horror-cinematic": true, "low-key-lighting": true, "minimalist-surreal": true, "moody-fog": true,
  "muted-palette": true, "oil-painting": true, "ornate": true, "pastel-tones": true, "photorealistic": true,
  "pixar-style": true, "rich-golds-and-reds": true, "romantic-cinematic": true, "single-scene": true,
  "soft-romantic-cinematic": true, "soft-watercolor": true, "storybook": true, "sunrise-light": true,
  "symbolic-composition": true, "temple-murals": true, "traditional-khmer-painting-style": true,
  "ultra-realistic": true, "vibrant": true, "warm-bokeh": true, "watercolor": true, "whiteboard": true, "wide-shots": true,
  "hand-drawn-2d-animation": true, "chibi": true, "clay-stop-motion": true,
  "traditional-chinese-ink-painting": true, "paper-cut-collage": true,
  "colored-pencil-illustration": true, "painterly-folklore": true,
};
/**
 * Visual artwork preview for an image style.
 * Uses generated previews for the visual style choices and SVG artwork for custom styles.
 */
export function StylePreviewImage({ style = "", className = "" }: StylePreviewImageProps) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, "");
  const gid = (name: string) => `spi-${name}-${uid}`;

  const s = style.toLowerCase().trim();

  const slug = s.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (AVAILABLE_PREVIEWS[slug]) {
    return (
      <img
        src={`/style-previews/${slug}.webp`}
        alt=""
        loading="lazy"
        decoding="async"
        className={className}
      />
    );
  }

  if (["classic stickman", "doodle stickman", "colorful stickman", "neon stickman"].includes(s)) {
    const isDoodle = s === "doodle stickman";
    const isColorful = s === "colorful stickman";
    const isNeon = s === "neon stickman";
    const background = isNeon ? "#10102a" : isColorful ? "#fff5d6" : isDoodle ? "#f9f3e7" : "#ffffff";
    const ink = isNeon ? "#67e8f9" : isColorful ? "#2563eb" : "#171717";

    return (
      <svg viewBox="0 0 160 120" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <rect width="160" height="120" fill={background} />
        {isDoodle && (
          <path d="M0 30H160 M0 60H160 M0 90H160 M30 0V120 M60 0V120 M90 0V120 M120 0V120 M150 0V120" stroke="#cbd5e1" strokeWidth="0.7" opacity="0.65" />
        )}
        {isColorful && (
          <>
            <circle cx="27" cy="29" r="12" fill="#fbbf24" />
            <path d="M0 101 Q35 82 72 101 T160 98 V120 H0Z" fill="#86efac" />
            <circle cx="128" cy="32" r="8" fill="#f9a8d4" />
          </>
        )}
        {isNeon && (
          <>
            <path d="M0 93H160 M16 0V120 M144 0V120" stroke="#7c3aed" strokeWidth="1" opacity="0.55" />
            <circle cx="80" cy="62" r="49" fill="none" stroke="#a855f7" strokeWidth="2" opacity="0.55" />
          </>
        )}
        <g fill="none" stroke={ink} strokeWidth={isDoodle ? 3 : 4} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="80" cy="31" r="13" fill={isColorful ? "#fcd34d" : "none"} />
          <path d={isDoodle ? "M79 45 Q84 60 79 79 M80 54 Q64 50 51 63 M81 56 Q99 52 109 43 M80 79 Q70 90 60 106 M80 79 Q93 89 104 105" : "M80 44V78 M80 55L52 69 M80 55L108 47 M80 78L58 105 M80 78L104 105"} />
        </g>
        {isDoodle && <path d="M40 17Q54 8 65 19 M109 78Q124 71 136 82" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />}
        {isNeon && <circle cx="80" cy="31" r="18" fill="none" stroke="#22d3ee" strokeWidth="1" opacity="0.55" />}
        {isColorful && <path d="M46 63L39 69 M110 45L119 39" stroke="#f97316" strokeWidth="4" strokeLinecap="round" />}
      </svg>
    );
  }

  // 1. Anime / Manga
  if (s.includes("anime") || s.includes("manga")) {
    return (
      <svg viewBox="0 0 160 120" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={gid("sky")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="60%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#f472b6" />
          </linearGradient>
          <linearGradient id={gid("sun")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#fb923c" />
          </linearGradient>
        </defs>
        <rect width="160" height="120" fill={`url(#${gid("sky")})`} />
        {/* Sun rays */}
        <polygon points="80,45 20,0 35,0" fill="#ffffff" fillOpacity="0.25" />
        <polygon points="80,45 130,0 145,0" fill="#ffffff" fillOpacity="0.25" />
        <polygon points="80,45 0,30 0,45" fill="#ffffff" fillOpacity="0.2" />
        <polygon points="80,45 160,25 160,40" fill="#ffffff" fillOpacity="0.2" />
        {/* Sun */}
        <circle cx="80" cy="45" r="22" fill={`url(#${gid("sun")})`} />
        {/* Clouds */}
        <ellipse cx="40" cy="70" rx="35" ry="16" fill="#ffffff" fillOpacity="0.85" />
        <ellipse cx="65" cy="65" rx="28" ry="18" fill="#ffffff" fillOpacity="0.95" />
        <ellipse cx="120" cy="68" rx="32" ry="15" fill="#ffffff" fillOpacity="0.9" />
        {/* Hills / landscape */}
        <path d="M-10 120 L20 85 L70 120 Z" fill="#1e293b" />
        <path d="M40 120 L110 75 L170 120 Z" fill="#0f172a" />
        {/* Sakura petals */}
        <ellipse cx="50" cy="30" rx="4" ry="2" transform="rotate(-30 50 30)" fill="#fbcfe8" />
        <ellipse cx="110" cy="25" rx="5" ry="2.5" transform="rotate(25 110 25)" fill="#fbcfe8" />
        <ellipse cx="135" cy="45" rx="4" ry="2" transform="rotate(-15 135 45)" fill="#f472b6" />
      </svg>
    );
  }

  // 2. Cinematic / Anamorphic
  if (s.includes("cinematic") && !s.includes("horror") && !s.includes("romantic") && !s.includes("inspirational")) {
    return (
      <svg viewBox="0 0 160 120" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={gid("cine-bg")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#082f49" />
            <stop offset="50%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e1b4b" />
          </linearGradient>
          <linearGradient id={gid("flare")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={gid("glow")} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ea580c" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="160" height="120" fill={`url(#${gid("cine-bg")})`} />
        {/* Cinematic Horizon / Glow */}
        <circle cx="80" cy="62" r="40" fill={`url(#${gid("glow")})`} />
        {/* Mountain Silhouette */}
        <polygon points="0,95 45,60 85,82 125,55 160,88 160,120 0,120" fill="#020617" />
        {/* Solitary figure */}
        <ellipse cx="80" cy="74" rx="2.5" ry="3.5" fill="#f8fafc" />
        <path d="M77 78 L83 78 L82 86 L78 86 Z" fill="#f8fafc" />
        {/* Horizontal anamorphic lens flare beam */}
        <rect x="0" y="60" width="160" height="3" fill={`url(#${gid("flare")})`} />
        {/* Letterbox bars */}
        <rect x="0" y="0" width="160" height="14" fill="#000000" />
        <rect x="0" y="106" width="160" height="14" fill="#000000" />
      </svg>
    );
  }

  // 3. 3D Render / CGI
  if (s.includes("3d") || s.includes("render") || s.includes("cgi")) {
    return (
      <svg viewBox="0 0 160 120" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={gid("stage")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e1b4b" />
            <stop offset="100%" stopColor="#09090b" />
          </linearGradient>
          <radialGradient id={gid("sphere1")} cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="90%" stopColor="#1e1b4b" />
            <stop offset="100%" stopColor="#0f0c29" />
          </radialGradient>
          <radialGradient id={gid("sphere2")} cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="60%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#082f49" />
          </radialGradient>
        </defs>
        <rect width="160" height="120" fill={`url(#${gid("stage")})`} />
        {/* Grid floor */}
        <path d="M0 85 L160 85 M0 95 L160 95 M0 108 L160 108 M20 85 L0 120 M50 85 L35 120 M80 85 L80 120 M110 85 L125 120 M140 85 L160 120" stroke="#312e81" strokeWidth="1" strokeOpacity="0.5" />
        {/* Shadows */}
        <ellipse cx="80" cy="92" rx="30" ry="7" fill="#000000" fillOpacity="0.55" />
        <ellipse cx="120" cy="88" rx="16" ry="5" fill="#000000" fillOpacity="0.45" />
        {/* Big Sphere */}
        <circle cx="80" cy="62" r="30" fill={`url(#${gid("sphere1")})`} />
        {/* Specular highlight */}
        <ellipse cx="70" cy="50" rx="7" ry="4" transform="rotate(-30 70 50)" fill="#ffffff" fillOpacity="0.75" />
        {/* Small floating sphere */}
        <circle cx="120" cy="68" r="16" fill={`url(#${gid("sphere2")})`} />
        <ellipse cx="114" cy="62" rx="4" ry="2.5" transform="rotate(-30 114 62)" fill="#ffffff" fillOpacity="0.8" />
      </svg>
    );
  }

  // 4. Photorealistic / Photography
  if (s.includes("photo") || s.includes("realistic")) {
    return (
      <svg viewBox="0 0 160 120" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={gid("sunset")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0369a1" />
            <stop offset="45%" stopColor="#f59e0b" />
            <stop offset="70%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
        </defs>
        <rect width="160" height="120" fill={`url(#${gid("sunset")})`} />
        {/* Sun */}
        <circle cx="80" cy="65" r="14" fill="#fef08a" />
        {/* Horizon lake reflection */}
        <rect x="0" y="75" width="160" height="45" fill="#0f172a" fillOpacity="0.9" />
        <line x1="60" y1="80" x2="100" y2="80" stroke="#fef08a" strokeWidth="2" strokeOpacity="0.6" />
        <line x1="65" y1="86" x2="95" y2="86" stroke="#f59e0b" strokeWidth="2" strokeOpacity="0.5" />
        <line x1="72" y1="94" x2="88" y2="94" stroke="#ea580c" strokeWidth="1.5" strokeOpacity="0.4" />
        {/* Camera HUD overlay */}
        <path d="M20 20 L30 20 M20 20 L20 30" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.8" />
        <path d="M140 20 L130 20 M140 20 L140 30" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.8" />
        <path d="M20 100 L30 100 M20 100 L20 90" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.8" />
        <path d="M140 100 L130 100 M140 100 L140 90" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.8" />
        <circle cx="80" cy="60" r="1.5" fill="#ffffff" fillOpacity="0.9" />
      </svg>
    );
  }

  // 5. Watercolor
  if (s.includes("watercolor") || s.includes("watercolour")) {
    return (
      <svg viewBox="0 0 160 120" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id={gid("wc1")} cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
            <stop offset="60%" stopColor="#0284c7" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#f8fafc" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={gid("wc2")} cx="60%" cy="50%" r="65%">
            <stop offset="0%" stopColor="#ec4899" stopOpacity="0.8" />
            <stop offset="70%" stopColor="#8b5cf6" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#f8fafc" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={gid("wc3")} cx="50%" cy="65%" r="60%">
            <stop offset="0%" stopColor="#facc15" stopOpacity="0.75" />
            <stop offset="65%" stopColor="#f97316" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#f8fafc" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="160" height="120" fill="#fdfbf7" />
        {/* Organic bleeding watercolor wash shapes */}
        <path d="M20 30 Q50 15 80 35 Q115 50 100 85 Q80 110 40 95 Q10 80 20 30 Z" fill={`url(#${gid("wc1")})`} />
        <path d="M65 25 Q110 20 135 50 Q155 85 125 105 Q90 115 75 80 Q60 50 65 25 Z" fill={`url(#${gid("wc2")})`} />
        <path d="M45 60 Q85 50 110 75 Q120 110 80 115 Q40 110 35 85 Q30 70 45 60 Z" fill={`url(#${gid("wc3")})`} />
        {/* Splatters */}
        <circle cx="28" cy="22" r="2.5" fill="#0284c7" fillOpacity="0.7" />
        <circle cx="138" cy="30" r="2" fill="#ec4899" fillOpacity="0.7" />
        <circle cx="120" cy="18" r="1.5" fill="#8b5cf6" fillOpacity="0.7" />
        <circle cx="25" cy="100" r="3" fill="#f97316" fillOpacity="0.6" />
      </svg>
    );
  }

  // 6. Oil Painting
  if (s.includes("oil") || s.includes("painting")) {
    return (
      <svg viewBox="0 0 160 120" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={gid("canvas")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#451a03" />
            <stop offset="40%" stopColor="#78350f" />
            <stop offset="80%" stopColor="#b45309" />
            <stop offset="100%" stopColor="#1e1b4b" />
          </linearGradient>
        </defs>
        <rect width="160" height="120" fill={`url(#${gid("canvas")})`} />
        {/* Heavy impasto brushstrokes */}
        <path d="M-10 40 Q40 10 90 45 Q130 70 170 50" stroke="#f59e0b" strokeWidth="14" fill="none" strokeLinecap="round" strokeOpacity="0.8" />
        <path d="M0 65 Q50 35 110 75 Q140 95 170 80" stroke="#dc2626" strokeWidth="12" fill="none" strokeLinecap="round" strokeOpacity="0.75" />
        <path d="M10 85 Q70 65 120 100 Q150 110 170 95" stroke="#fbbf24" strokeWidth="10" fill="none" strokeLinecap="round" strokeOpacity="0.85" />
        <path d="M20 25 Q60 55 120 30 Q145 20 170 35" stroke="#1e3a8a" strokeWidth="8" fill="none" strokeLinecap="round" strokeOpacity="0.7" />
        {/* Painterly sun/highlight */}
        <circle cx="85" cy="45" r="16" fill="#fef08a" fillOpacity="0.9" />
      </svg>
    );
  }

  // 7. Pixar / 3D Character
  if (s.includes("pixar") || s.includes("disney") || s.includes("3d character")) {
    return (
      <svg viewBox="0 0 160 120" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={gid("pixar-sky")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#fed7aa" />
          </linearGradient>
          <radialGradient id={gid("cute-head")} cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="70%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#9a3412" />
          </radialGradient>
        </defs>
        <rect width="160" height="120" fill={`url(#${gid("pixar-sky")})`} />
        {/* Soft clouds */}
        <ellipse cx="30" cy="30" rx="20" ry="8" fill="#ffffff" fillOpacity="0.8" />
        <ellipse cx="130" cy="35" rx="22" ry="9" fill="#ffffff" fillOpacity="0.85" />
        {/* Stylized cute 3D character */}
        {/* Body */}
        <ellipse cx="80" cy="98" rx="28" ry="24" fill="#0284c7" />
        {/* Head */}
        <circle cx="80" cy="62" r="26" fill={`url(#${gid("cute-head")})`} />
        {/* Cheeks */}
        <circle cx="63" cy="70" r="5" fill="#f43f5e" fillOpacity="0.5" />
        <circle cx="97" cy="70" r="5" fill="#f43f5e" fillOpacity="0.5" />
        {/* Big expressive Pixar eyes */}
        <ellipse cx="70" cy="58" rx="7" ry="9" fill="#ffffff" />
        <ellipse cx="90" cy="58" rx="7" ry="9" fill="#ffffff" />
        <circle cx="71" cy="58" r="4.5" fill="#0f172a" />
        <circle cx="89" cy="58" r="4.5" fill="#0f172a" />
        <circle cx="73" cy="56" r="2" fill="#ffffff" />
        <circle cx="91" cy="56" r="2" fill="#ffffff" />
        {/* Smile */}
        <path d="M74 74 Q80 80 86 74" stroke="#7c2d12" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    );
  }

  // 8. Dark Fantasy / Gothic
  if (s.includes("dark fantasy") || s.includes("gothic")) {
    return (
      <svg viewBox="0 0 160 120" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={gid("goth-bg")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#180d28" />
            <stop offset="60%" stopColor="#3b0764" />
            <stop offset="100%" stopColor="#090514" />
          </linearGradient>
          <radialGradient id={gid("bloodmoon")} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="70%" stopColor="#881337" />
            <stop offset="100%" stopColor="#4c0519" />
          </radialGradient>
        </defs>
        <rect width="160" height="120" fill={`url(#${gid("goth-bg")})`} />
        {/* Giant Blood Moon */}
        <circle cx="80" cy="46" r="28" fill={`url(#${gid("bloodmoon")})`} />
        {/* Castle Spire Silhouette */}
        <polygon points="80,18 73,42 87,42" fill="#090514" />
        <rect x="73" y="42" width="14" height="40" fill="#090514" />
        <polygon points="50,45 45,65 55,65" fill="#090514" />
        <rect x="45" y="65" width="10" height="30" fill="#090514" />
        <polygon points="110,48 105,68 115,68" fill="#090514" />
        <rect x="105" y="68" width="10" height="30" fill="#090514" />
        {/* Fog / Cliffs */}
        <path d="M0 88 Q40 78 80 88 Q120 78 160 88 L160 120 L0 120 Z" fill="#02010a" />
        <path d="M0 96 Q50 88 100 98 Q140 90 160 100 L160 120 L0 120 Z" fill="#2e1065" fillOpacity="0.4" />
        {/* Flying ravens */}
        <path d="M40 30 Q44 26 48 30 Q52 26 56 30" stroke="#000000" strokeWidth="1.5" fill="none" />
        <path d="M115 28 Q118 25 121 28 Q124 25 127 28" stroke="#000000" strokeWidth="1.5" fill="none" />
      </svg>
    );
  }

  // 9. Dramatic Lighting / Chiaroscuro
  if (s.includes("dramatic lighting") || s.includes("lighting")) {
    return (
      <svg viewBox="0 0 160 120" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={gid("beam")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fef08a" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="160" height="120" fill="#09090b" />
        {/* High contrast dramatic light beam */}
        <polygon points="0,0 45,0 160,110 110,120" fill={`url(#${gid("beam")})`} />
        {/* Lit statue/subject silhouette */}
        <polygon points="90,40 100,55 94,80 106,120 74,120 84,78 80,55" fill="#f8fafc" />
        <polygon points="74,40 85,55 80,80 74,120 60,120 70,78 68,55" fill="#18181b" />
        {/* Floating dust motes */}
        <circle cx="50" cy="35" r="1.5" fill="#fef08a" />
        <circle cx="80" cy="65" r="1.5" fill="#fef08a" />
        <circle cx="110" cy="90" r="1" fill="#fef08a" />
      </svg>
    );
  }

  // 10. Highly Detailed / Intricate
  if (s.includes("highly detailed") || s.includes("detailed") || s.includes("cyberpunk")) {
    return (
      <svg viewBox="0 0 160 120" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={gid("circuit")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#042f2e" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
        </defs>
        <rect width="160" height="120" fill={`url(#${gid("circuit")})`} />
        {/* Circuit / geometric grid lines */}
        <path d="M20 20 L60 20 L80 40 L120 40 L140 60" stroke="#14b8a6" strokeWidth="1.5" fill="none" strokeOpacity="0.8" />
        <path d="M10 80 L50 80 L70 60 L110 60 L130 90 L150 90" stroke="#06b6d4" strokeWidth="1.5" fill="none" strokeOpacity="0.8" />
        <path d="M80 10 L80 40 M80 80 L80 110" stroke="#2dd4bf" strokeWidth="1" strokeOpacity="0.5" />
        <circle cx="60" cy="20" r="3" fill="#2dd4bf" />
        <circle cx="120" cy="40" r="3" fill="#2dd4bf" />
        <circle cx="70" cy="60" r="3" fill="#38bdf8" />
        <circle cx="130" cy="90" r="3" fill="#38bdf8" />
        {/* Center glowing core / fractal */}
        <circle cx="80" cy="60" r="18" stroke="#14b8a6" strokeWidth="1.5" fill="none" />
        <circle cx="80" cy="60" r="10" stroke="#06b6d4" strokeWidth="1" fill="none" />
        <circle cx="80" cy="60" r="5" fill="#5eead4" />
      </svg>
    );
  }

  // 11. Horror / Dark Cinematic Horror
  if (s.includes("horror")) {
    return (
      <svg viewBox="0 0 160 120" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={gid("horror-sky")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#050505" />
            <stop offset="60%" stopColor="#1a0404" />
            <stop offset="100%" stopColor="#000000" />
          </linearGradient>
        </defs>
        <rect width="160" height="120" fill={`url(#${gid("horror-sky")})`} />
        {/* Eerie pale moon */}
        <circle cx="110" cy="35" r="18" fill="#e2e8f0" fillOpacity="0.85" />
        <circle cx="106" cy="33" r="18" fill="#1a0404" />
        {/* Barren dead tree silhouette */}
        <path d="M50 120 L52 75 L38 55 M52 75 L62 58 L58 45 M62 58 L72 50 M45 65 L32 68" stroke="#09090b" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        {/* Creeping red fog */}
        <path d="M0 90 Q40 80 80 95 Q120 75 160 90 L160 120 L0 120 Z" fill="#450a0a" fillOpacity="0.65" />
        <path d="M0 100 Q50 90 100 102 Q130 92 160 105 L160 120 L0 120 Z" fill="#000000" fillOpacity="0.8" />
        {/* Glowing red sinister eyes */}
        <ellipse cx="88" cy="82" rx="2" ry="1.5" fill="#ef4444" />
        <ellipse cx="96" cy="82" rx="2" ry="1.5" fill="#ef4444" />
      </svg>
    );
  }

  // 12. Romantic / Soft Romantic / Love
  if (s.includes("romantic") || s.includes("love") || s.includes("bokeh")) {
    return (
      <svg viewBox="0 0 160 120" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={gid("romance-bg")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="50%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#fed7aa" />
          </linearGradient>
        </defs>
        <rect width="160" height="120" fill={`url(#${gid("romance-bg")})`} />
        {/* Shimmering Bokeh Orbs */}
        <circle cx="35" cy="40" r="18" fill="#ffffff" fillOpacity="0.35" />
        <circle cx="75" cy="25" r="12" fill="#ffffff" fillOpacity="0.45" />
        <circle cx="125" cy="50" r="22" fill="#ffffff" fillOpacity="0.3" />
        <circle cx="50" cy="85" r="15" fill="#ffffff" fillOpacity="0.4" />
        <circle cx="105" cy="85" r="25" fill="#ffffff" fillOpacity="0.35" />
        {/* Heart bokeh symbol */}
        <path d="M80 68 C80 62, 70 55, 62 62 C52 72, 80 90, 80 90 C80 90, 108 72, 98 62 C90 55, 80 62, 80 68 Z" fill="#ffffff" fillOpacity="0.65" />
      </svg>
    );
  }

  // 13. Motivation / Inspirational / Epic / Sunrise
  if (s.includes("motivation") || s.includes("inspirational") || s.includes("epic") || s.includes("sunrise")) {
    return (
      <svg viewBox="0 0 160 120" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={gid("inspire-bg")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="45%" stopColor="#ea580c" />
            <stop offset="70%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#fef08a" />
          </linearGradient>
        </defs>
        <rect width="160" height="120" fill={`url(#${gid("inspire-bg")})`} />
        {/* Sun bursting rays */}
        <polygon points="80,70 0,20 15,10" fill="#fef08a" fillOpacity="0.4" />
        <polygon points="80,70 40,0 60,0" fill="#fef08a" fillOpacity="0.4" />
        <polygon points="80,70 100,0 120,0" fill="#fef08a" fillOpacity="0.4" />
        <polygon points="80,70 160,20 145,10" fill="#fef08a" fillOpacity="0.4" />
        <circle cx="80" cy="70" r="18" fill="#fef08a" />
        {/* Majestic mountain ridge with figure */}
        <polygon points="0,120 40,75 80,52 120,78 160,120" fill="#0f172a" />
        {/* Triumphant climber on peak */}
        <circle cx="80" cy="46" r="2" fill="#f8fafc" />
        <path d="M80 48 L80 52 M77 49 L83 49" stroke="#f8fafc" strokeWidth="1" />
      </svg>
    );
  }

  // 14. Folklore / Traditional Khmer / Temple
  if (s.includes("khmer") || s.includes("folklore") || s.includes("temple") || s.includes("gold")) {
    return (
      <svg viewBox="0 0 160 120" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={gid("khmer-bg")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7f1d1d" />
            <stop offset="60%" stopColor="#991b1b" />
            <stop offset="100%" stopColor="#450a0a" />
          </linearGradient>
          <linearGradient id={gid("gold-grad")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#a16207" />
          </linearGradient>
        </defs>
        <rect width="160" height="120" fill={`url(#${gid("khmer-bg")})`} />
        {/* Ornate Angkor Wat towers silhouette */}
        {/* Center Tower */}
        <path d="M80 20 Q78 35 74 50 Q72 70 70 95 L90 95 Q88 70 86 50 Q82 35 80 20 Z" fill={`url(#${gid("gold-grad")})`} />
        {/* Left Tower */}
        <path d="M55 35 Q53 50 50 65 Q48 80 46 95 L64 95 Q62 80 60 65 Q57 50 55 35 Z" fill={`url(#${gid("gold-grad")})`} />
        {/* Right Tower */}
        <path d="M105 35 Q103 50 100 65 Q98 80 96 95 L114 95 Q112 80 110 65 Q107 50 105 35 Z" fill={`url(#${gid("gold-grad")})`} />
        {/* Traditional border ornamentation */}
        <rect x="10" y="10" width="140" height="100" fill="none" stroke={`url(#${gid("gold-grad")})`} strokeWidth="1.5" strokeDasharray="4 2" />
        <circle cx="80" cy="100" r="14" fill={`url(#${gid("gold-grad")})`} />
        <circle cx="80" cy="100" r="8" fill="#7f1d1d" />
      </svg>
    );
  }

  // 15. Philosophy / Contemplative / Minimalist Surreal
  if (s.includes("philosophy") || s.includes("surreal") || s.includes("contemplative") || s.includes("zen")) {
    return (
      <svg viewBox="0 0 160 120" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={gid("zen-bg")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f1f5f9" />
            <stop offset="60%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
        </defs>
        <rect width="160" height="120" fill={`url(#${gid("zen-bg")})`} />
        {/* Horizon lake water reflection */}
        <line x1="0" y1="75" x2="160" y2="75" stroke="#94a3b8" strokeWidth="1" />
        {/* Zen balancing stone cairn */}
        <ellipse cx="80" cy="72" rx="24" ry="6" fill="#334155" />
        <ellipse cx="80" cy="62" rx="18" ry="5.5" fill="#475569" />
        <ellipse cx="80" cy="53" rx="13" ry="4.5" fill="#64748b" />
        <ellipse cx="80" cy="45" rx="8" ry="3.5" fill="#94a3b8" />
        <circle cx="80" cy="38" r="3" fill="#cbd5e1" />
        {/* Water ripples */}
        <ellipse cx="80" cy="78" rx="35" ry="3" stroke="#e2e8f0" strokeWidth="1" fill="none" />
        <ellipse cx="80" cy="84" rx="50" ry="4" stroke="#e2e8f0" strokeWidth="0.8" fill="none" />
        {/* Solitary floating sphere / sun */}
        <circle cx="125" cy="35" r="10" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
      </svg>
    );
  }

  // 16. Kid Story / Children / Cute Illustration
  if (s.includes("kid") || s.includes("children") || s.includes("cute")) {
    return (
      <svg viewBox="0 0 160 120" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={gid("kid-sky")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#bae6fd" />
            <stop offset="100%" stopColor="#fef08a" />
          </linearGradient>
        </defs>
        <rect width="160" height="120" fill={`url(#${gid("kid-sky")})`} />
        {/* Cute rolling hills */}
        <path d="M-20 120 Q30 75 90 120 Z" fill="#86efac" />
        <path d="M60 120 Q120 70 180 120 Z" fill="#4ade80" />
        {/* Smiling sun */}
        <circle cx="35" cy="35" r="16" fill="#facc15" />
        <circle cx="30" cy="33" r="2" fill="#713f12" />
        <circle cx="40" cy="33" r="2" fill="#713f12" />
        <path d="M31 39 Q35 43 39 39" stroke="#713f12" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* Cute cloud */}
        <ellipse cx="110" cy="35" rx="18" ry="9" fill="#ffffff" />
        <ellipse cx="125" cy="32" rx="14" ry="11" fill="#ffffff" />
        {/* Whimsical stars */}
        <circle cx="75" cy="22" r="2" fill="#fbbf24" />
        <circle cx="95" cy="18" r="1.5" fill="#fbbf24" />
        <circle cx="145" cy="28" r="2" fill="#fbbf24" />
      </svg>
    );
  }

  // 17. Fog / Moody Fog
  if (s.includes("fog") || s.includes("mist")) {
    return (
      <svg viewBox="0 0 160 120" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={gid("fog-bg")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
        </defs>
        <rect width="160" height="120" fill={`url(#${gid("fog-bg")})`} />
        {/* Pine trees layered in mist */}
        <polygon points="30,40 22,65 38,65" fill="#475569" />
        <polygon points="80,30 70,60 90,60" fill="#334155" />
        <polygon points="130,35 120,62 140,62" fill="#475569" />
        {/* Rolling fog bands */}
        <ellipse cx="50" cy="65" rx="60" ry="14" fill="#94a3b8" fillOpacity="0.45" />
        <ellipse cx="120" cy="75" rx="65" ry="16" fill="#cbd5e1" fillOpacity="0.4" />
        <polygon points="50,55 40,90 60,90" fill="#1e293b" />
        <polygon points="105,50 95,85 115,85" fill="#1e293b" />
        <ellipse cx="80" cy="95" rx="90" ry="20" fill="#f1f5f9" fillOpacity="0.45" />
      </svg>
    );
  }

  // Fallback: Harmonic procedural SVG preview tailored to any custom style tag
  // We hash the style string to reliably pick a color harmony and motif
  const hash = s.split("").reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0);
  const palettes = [
    { from: "#4f46e5", to: "#06b6d4", accent: "#a5f3fc" },
    { from: "#db2777", to: "#f59e0b", accent: "#fef08a" },
    { from: "#059669", to: "#10b981", accent: "#a7f3d0" },
    { from: "#7c3aed", to: "#ec4899", accent: "#fbcfe8" },
    { from: "#0284c7", to: "#3b82f6", accent: "#bfdbfe" },
    { from: "#d97706", to: "#dc2626", accent: "#fed7aa" },
  ];
  const p = palettes[Math.abs(hash) % palettes.length]!;

  return (
    <svg viewBox="0 0 160 120" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={gid("grad")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={p.from} />
          <stop offset="100%" stopColor={p.to} />
        </linearGradient>
      </defs>
      <rect width="160" height="120" fill={`url(#${gid("grad")})`} />
      {/* Dynamic geometric accents */}
      <circle cx="80" cy="60" r="32" fill="#ffffff" fillOpacity="0.12" />
      <circle cx="80" cy="60" r="22" stroke={p.accent} strokeWidth="1.5" strokeOpacity="0.6" fill="none" strokeDasharray="3 3" />
      <polygon points="80,45 93,68 67,68" fill={p.accent} fillOpacity="0.8" />
      {/* Decorative dots */}
      <circle cx="30" cy="30" r="2.5" fill="#ffffff" fillOpacity="0.4" />
      <circle cx="130" cy="90" r="2.5" fill="#ffffff" fillOpacity="0.4" />
      <circle cx="135" cy="30" r="1.5" fill="#ffffff" fillOpacity="0.3" />
      <circle cx="25" cy="90" r="1.5" fill="#ffffff" fillOpacity="0.3" />
    </svg>
  );
}
