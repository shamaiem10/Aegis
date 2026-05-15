import { motion } from "framer-motion";
import { crises as fallbackCrises, type Crisis } from "./data";

interface CityMapProps {
  /** When set (e.g. from live API), overrides built-in demo pins. */
  crisesData?: Crisis[];
  height?: number | string;
  selectedTypes?: string[];
  showTraffic?: boolean;
  showResources?: boolean;
  onPinClick?: (c: Crisis) => void;
  highlightId?: string;
  variant?: "full" | "compact";
}

const sevColor = (s: number) =>
  s >= 8 ? "#E11D48" : s >= 5 ? "#F59E0B" : "#EAB308";

export function CityMap({
  crisesData,
  height = 520, selectedTypes, showTraffic = true, showResources = true,
  onPinClick, highlightId, variant = "full",
}: CityMapProps) {
  const pinSet = crisesData ?? fallbackCrises;
  const visible = pinSet.filter(c => !selectedTypes?.length || selectedTypes.includes(c.type));

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-white shadow-soft" style={{ height }}>
      {/* Base */}
      <div className="absolute inset-0"
           style={{ background: "linear-gradient(135deg,#EAF4F1 0%,#DCEEFF 38%,#E8F5E9 100%)" }} />

      {/* Soft grid */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.35]" viewBox="0 0 800 520" preserveAspectRatio="none">
        <defs>
          <pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" stroke="#9DB7C7" strokeWidth="0.4" fill="none" />
          </pattern>
        </defs>
        <rect width="800" height="520" fill="url(#g)" />
      </svg>

      {/* Parks */}
      <div className="absolute left-[6%] top-[10%] h-[18%] w-[22%] rounded-3xl bg-[#C8E6C9]/80" />
      <div className="absolute right-[8%] top-[58%] h-[20%] w-[18%] rounded-3xl bg-[#C8E6C9]/70" />
      <div className="absolute left-[40%] bottom-[6%] h-[12%] w-[26%] rounded-3xl bg-[#C8E6C9]/60" />
      {/* Lake */}
      <div className="absolute right-[2%] top-[6%] h-[22%] w-[22%] rounded-[40%] bg-[#BBDEFB]/80 blur-[1px]" />

      {/* Building blocks */}
      {[
        [16, 38, 8, 7], [28, 32, 7, 8], [44, 30, 9, 10], [60, 36, 7, 7],
        [74, 44, 9, 8], [22, 56, 8, 7], [36, 60, 9, 8], [54, 64, 8, 9],
        [16, 76, 8, 7], [40, 78, 9, 7], [62, 78, 7, 8],
      ].map(([l, t, w, h], i) => (
        <div key={i} className="absolute rounded-md bg-white/75 shadow-[0_1px_4px_rgba(60,80,120,0.12)]"
             style={{ left: `${l}%`, top: `${t}%`, width: `${w}%`, height: `${h}%` }} />
      ))}

      {/* Roads */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 800 520" preserveAspectRatio="none">
        <defs>
          <linearGradient id="road" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        {/* arterials */}
        <path d="M-20 140 Q 200 180 400 150 T 820 200" stroke="url(#road)" strokeWidth="14" fill="none" />
        <path d="M-20 360 Q 220 320 440 360 T 820 340" stroke="url(#road)" strokeWidth="12" fill="none" />
        <path d="M120 -20 Q 160 200 200 320 T 240 540" stroke="url(#road)" strokeWidth="11" fill="none" />
        <path d="M520 -20 Q 500 220 540 340 T 560 540" stroke="url(#road)" strokeWidth="11" fill="none" />
        <path d="M-20 240 L 820 260" stroke="url(#road)" strokeWidth="6" fill="none" opacity="0.7" />

        {showTraffic && (
          <>
            <path d="M-20 140 Q 200 180 400 150 T 820 200"
                  stroke="#F87171" strokeWidth="3" strokeDasharray="6 6"
                  fill="none" opacity="0.75" className="animate-flow" />
            <path d="M-20 360 Q 220 320 440 360 T 820 340"
                  stroke="#60A5FA" strokeWidth="2.5" strokeDasharray="6 6"
                  fill="none" opacity="0.75" className="animate-flow" />
            <path d="M120 -20 Q 160 200 200 320 T 240 540"
                  stroke="#34D399" strokeWidth="2.5" strokeDasharray="6 6"
                  fill="none" opacity="0.75" className="animate-flow" />
          </>
        )}
      </svg>

      {/* Resource units (moving dots) */}
      {showResources && (
        <>
          <motion.div className="absolute h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.25)]"
            animate={{ left: ["12%", "30%", "48%", "30%", "12%"], top: ["28%", "30%", "32%", "30%", "28%"] }}
            transition={{ duration: 18, repeat: Infinity, ease: "linear" }} />
          <motion.div className="absolute h-3 w-3 rounded-full bg-sky-500 shadow-[0_0_0_4px_rgba(14,165,233,0.25)]"
            animate={{ left: ["70%", "55%", "40%", "55%", "70%"], top: ["70%", "65%", "60%", "65%", "70%"] }}
            transition={{ duration: 22, repeat: Infinity, ease: "linear" }} />
          <motion.div className="absolute h-3 w-3 rounded-full bg-purple-500 shadow-[0_0_0_4px_rgba(168,85,247,0.25)]"
            animate={{ left: ["20%", "35%", "55%", "75%", "20%"], top: ["72%", "60%", "52%", "44%", "72%"] }}
            transition={{ duration: 26, repeat: Infinity, ease: "linear" }} />
        </>
      )}

      {/* Pins */}
      {visible.map((c) => {
        const color = sevColor(c.severity);
        const radiusPx = Math.max(60, Math.min(220, c.radiusKm * 35));
        const isHi = highlightId === c.id;
        return (
          <div key={c.id} className="absolute" style={{ left: `${c.pin.x}%`, top: `${c.pin.y}%` }}>
            {/* radius */}
            <div
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                width: radiusPx, height: radiusPx,
                background: `radial-gradient(circle, ${color}55 0%, ${color}11 60%, transparent 75%)`,
                border: `1px dashed ${color}80`,
              }}
            />
            {/* pulse */}
            <motion.span
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ width: 36, height: 36, background: `${color}33` }}
              animate={{ scale: [1, 1.8, 1], opacity: [0.7, 0, 0.7] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            {/* pin */}
            <button
              onClick={() => onPinClick?.(c)}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full text-white shadow-soft transition-transform hover:scale-110"
              style={{
                width: isHi ? 28 : 22, height: isHi ? 28 : 22,
                background: `linear-gradient(135deg,${color},${color}cc)`,
                boxShadow: `0 6px 18px ${color}66`,
              }}
              aria-label={c.type}
            >
              <span className="text-[10px] font-bold leading-none">{c.severity}</span>
            </button>
            {/* label */}
            {variant === "full" && (
              <div className="absolute left-4 top-3 whitespace-nowrap rounded-lg bg-white/95 px-2 py-1 text-[10px] font-semibold text-ink shadow-soft">
                {c.type} · {c.confidence}%
              </div>
            )}
          </div>
        );
      })}

      {/* Top label */}
      <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-semibold text-ink shadow-soft backdrop-blur">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Live · Islamabad Smart City
      </div>
    </div>
  );
}
