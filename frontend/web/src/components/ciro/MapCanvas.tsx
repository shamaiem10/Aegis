import { motion } from "framer-motion";

interface MapCanvasProps {
  variant?: "calm" | "alert" | "before" | "after";
  showHeat?: boolean;
  showRoute?: boolean;
}

// Stylized vector "smart city" map — Google-Maps-ish
export function MapCanvas({ variant = "calm", showHeat = true, showRoute = false }: MapCanvasProps) {
  const isAlert = variant === "alert" || variant === "before";

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #EAF4F1 0%, #DCEEFF 40%, #E8F5E9 100%)",
        }}
      />

      {/* parks / green blocks */}
      <div className="absolute left-[10%] top-[18%] h-16 w-20 rounded-[14px] bg-[#C8E6C9]/80" />
      <div className="absolute right-[8%] top-[55%] h-14 w-16 rounded-[12px] bg-[#C8E6C9]/70" />
      <div className="absolute left-[35%] bottom-[12%] h-10 w-24 rounded-[10px] bg-[#C8E6C9]/60" />

      {/* water */}
      <div className="absolute -right-6 top-[8%] h-24 w-24 rounded-full bg-[#BBDEFB]/70 blur-[1px]" />

      {/* building blocks */}
      {[
        { l: 22, t: 42, w: 18, h: 14 },
        { l: 48, t: 32, w: 14, h: 18 },
        { l: 66, t: 48, w: 16, h: 12 },
        { l: 30, t: 68, w: 20, h: 14 },
        { l: 60, t: 72, w: 14, h: 12 },
      ].map((b, i) => (
        <div
          key={i}
          className="absolute rounded-md bg-white/70 shadow-[0_2px_6px_rgba(60,80,120,0.08)]"
          style={{ left: `${b.l}%`, top: `${b.t}%`, width: `${b.w}%`, height: `${b.h}%` }}
        />
      ))}

      {/* roads (svg) */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 400" preserveAspectRatio="none">
        <defs>
          <linearGradient id="road" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        <path d="M-20 80 Q 80 120 180 100 T 360 140" stroke="url(#road)" strokeWidth="10" fill="none" />
        <path d="M40 -20 Q 60 120 120 220 T 180 420" stroke="url(#road)" strokeWidth="10" fill="none" />
        <path d="M-20 280 Q 120 240 220 280 T 360 260" stroke="url(#road)" strokeWidth="9" fill="none" />
        <path d="M260 -20 Q 240 140 220 240 T 200 420" stroke="url(#road)" strokeWidth="8" fill="none" />

        {/* traffic flow lines */}
        <path
          d="M-20 80 Q 80 120 180 100 T 360 140"
          stroke={variant === "after" ? "#4ADE80" : isAlert ? "#FF6B6B" : "#60A5FA"}
          strokeWidth="2.5"
          fill="none"
          strokeDasharray="6 6"
          className="animate-flow"
          opacity="0.9"
        />
        <path
          d="M40 -20 Q 60 120 120 220 T 180 420"
          stroke={variant === "after" ? "#4ADE80" : "#60A5FA"}
          strokeWidth="2"
          fill="none"
          strokeDasharray="6 6"
          className="animate-flow"
          opacity="0.7"
        />

        {showRoute && (
          <path
            d="M30 360 Q 100 300 160 220 T 280 80"
            stroke="#0EA5E9"
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
            strokeDasharray="2 5"
            className="animate-flow"
          />
        )}
      </svg>

      {/* heat overlay */}
      {showHeat && isAlert && (
        <>
          <div
            className="absolute left-[42%] top-[38%] h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(255,107,107,0.55) 0%, rgba(255,107,107,0) 70%)",
            }}
          />
          <motion.div
            className="absolute left-[42%] top-[38%] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-alert"
            animate={{ scale: [1, 1.4, 1], opacity: [1, 0.7, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          >
            <span className="absolute inset-0 rounded-full bg-alert opacity-60 animate-ping" />
          </motion.div>
        </>
      )}

      {/* normal markers */}
      {!isAlert && (
        <>
          <div className="absolute left-[28%] top-[58%] h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.2)]" />
          <div className="absolute left-[68%] top-[40%] h-3 w-3 rounded-full bg-sky-500 shadow-[0_0_0_4px_rgba(14,165,233,0.2)]" />
          <motion.div
            className="absolute left-[50%] top-[50%] h-3 w-3 rounded-full bg-emerald-500"
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </>
      )}

      {/* subtle glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(255,255,255,0.3)_100%)]" />
    </div>
  );
}
