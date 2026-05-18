'use client';

export default function ScoreRing({ score = 0, size = 120, strokeWidth = 8, label = '' }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#f43f5e';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
        <span style={{ fontSize: size * 0.28, fontWeight: 800, color: '#1a1a2e', fontFamily: 'Space Grotesk' }}>{score}%</span>
        {label && <span style={{ fontSize: 10, color: '#6b7280', marginTop: -2 }}>{label}</span>}
      </div>
    </div>
  );
}
