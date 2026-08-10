// SVG-based asset graphics — stroke weight 1.5px, no emojis
// Each icon is a pure SVG component matching the VPP spec

export function SolarIcon({ size = 40, color = '#10B981', className = '' }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 40 40"
      fill="none" stroke={color} strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
    >
      {/* Central sun disc */}
      <circle cx="20" cy="20" r="6" />
      {/* 8 ray-trace lines */}
      <line x1="20" y1="4"    x2="20" y2="10"   />
      <line x1="20" y1="30"   x2="20" y2="36"   />
      <line x1="4"  y1="20"   x2="10" y2="20"   />
      <line x1="30" y1="20"   x2="36" y2="20"   />
      <line x1="7.5"  y1="7.5"  x2="11.8" y2="11.8" />
      <line x1="28.2" y1="28.2" x2="32.5" y2="32.5" />
      <line x1="32.5" y1="7.5"  x2="28.2" y2="11.8" />
      <line x1="11.8" y1="28.2" x2="7.5"  y2="32.5" />
    </svg>
  )
}

export function WindIcon({ size = 40, color = '#10B981', className = '' }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 40 40"
      fill="none" stroke={color} strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
    >
      {/* Tower */}
      <line x1="20" y1="22" x2="20" y2="38" />
      {/* Hub circle */}
      <circle cx="20" cy="20" r="2.5" fill={color} />
      {/* Three blades at 120° apart */}
      {/* Blade 1 — top */}
      <path d="M20 20 C19 14, 16 10, 20 6 C22 10, 22 16, 20 20" />
      {/* Blade 2 — bottom-right */}
      <path d="M20 20 C26 22, 31 21, 34 26 C30 28, 24 26, 20 20" />
      {/* Blade 3 — bottom-left */}
      <path d="M20 20 C14 22, 9 26, 6 22 C8 17, 15 16, 20 20" />
    </svg>
  )
}

export function BatteryIcon({ size = 40, color = '#10B981', soc = 100, className = '' }) {
  // soc = 0–100, fills the battery cell proportionally
  const fillHeight = Math.max(0, Math.min(28, (soc / 100) * 28))
  const fillY      = 34 - fillHeight

  const fillColor =
    soc > 60 ? '#10B981' :
    soc > 25 ? '#F59E0B' : '#EF4444'

  return (
    <svg
      width={size} height={size} viewBox="0 0 40 40"
      fill="none" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
    >
      {/* Positive terminal (top nub) */}
      <rect x="15" y="2" width="10" height="4" rx="1" stroke={color} />
      {/* Battery body outline */}
      <rect x="8" y="6" width="24" height="32" rx="2" stroke={color} />
      {/* SOC fill inside body */}
      <rect
        x="10" y={fillY} width="20" height={fillHeight}
        rx="1" fill={fillColor} opacity="0.85"
      />
      {/* Percentage text */}
      <text
        x="20" y="26"
        textAnchor="middle" dominantBaseline="central"
        fontSize="9" fontWeight="600"
        fill={soc < 30 ? '#EF4444' : color}
        fontFamily="'Josefin Sans', sans-serif"
      >
        {Math.round(soc)}%
      </text>
    </svg>
  )
}

export function InverterIcon({ size = 40, color = '#10B981', className = '' }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 40 40"
      fill="none" stroke={color} strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
    >
      {/* Outer box */}
      <rect x="4" y="8" width="32" height="24" rx="3" />
      {/* Sine wave inside */}
      <path d="M8 20 Q11 14, 14 20 Q17 26, 20 20 Q23 14, 26 20 Q29 26, 32 20" />
      {/* DC input lines */}
      <line x1="10" y1="4"  x2="10" y2="8" />
      <line x1="7"  y1="4"  x2="13" y2="4" />
      <line x1="30" y1="4"  x2="30" y2="8" />
      {/* AC output arrow */}
      <line x1="20" y1="32" x2="20" y2="37" />
      <polyline points="17,35 20,38 23,35" />
    </svg>
  )
}

export function AssetIcon({ type, size, color, soc, className }) {
  switch (type) {
    case 'SOLAR':   return <SolarIcon   size={size} color={color} className={className} />
    case 'WIND':    return <WindIcon    size={size} color={color} className={className} />
    case 'BATTERY': return <BatteryIcon size={size} color={color} soc={soc}  className={className} />
    case 'INVERTER':return <InverterIcon size={size} color={color} className={className} />
    default:        return <SolarIcon   size={size} color={color} className={className} />
  }
}
