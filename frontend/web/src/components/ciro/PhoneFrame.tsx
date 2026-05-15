import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface PhoneFrameProps {
  children: ReactNode;
  label: string;
  index: number;
}

// 6.7" phone aspect ~ 19.5:9 → 390x844 logical
export function PhoneFrame({ children, label, index }: PhoneFrameProps) {
  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.05}
      whileDrag={{ scale: 1.02, zIndex: 50 }}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, type: "spring", stiffness: 80, damping: 18 }}
      className="flex flex-col items-center gap-3 cursor-grab active:cursor-grabbing"
    >
      <div className="text-[11px] font-medium tracking-[0.2em] uppercase text-ink-soft/70">
        0{index + 1} · {label}
      </div>
      <div
        className="relative rounded-[3rem] p-[10px] shadow-float"
        style={{
          background: "linear-gradient(145deg, #1a1f2e 0%, #2a2f3e 100%)",
          width: 320,
          height: 670,
        }}
      >
        {/* Side buttons */}
        <div className="absolute -left-[3px] top-32 h-12 w-[3px] rounded-l bg-neutral-700" />
        <div className="absolute -left-[3px] top-48 h-20 w-[3px] rounded-l bg-neutral-700" />
        <div className="absolute -right-[3px] top-40 h-16 w-[3px] rounded-r bg-neutral-700" />

        <div
          className="relative h-full w-full overflow-hidden rounded-[2.4rem] bg-background"
          style={{ isolation: "isolate" }}
        >
          {/* Notch */}
          <div className="absolute left-1/2 top-2 z-50 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
          {/* Status bar */}
          <div className="absolute inset-x-0 top-0 z-40 flex items-center justify-between px-7 pt-2.5 text-[10px] font-semibold text-ink">
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <span className="text-[9px]">●●●●</span>
              <span>5G</span>
              <span className="ml-1 inline-block h-2 w-3 rounded-[2px] border border-ink/70">
                <span className="block h-full w-[80%] rounded-[1px] bg-ink" />
              </span>
            </span>
          </div>

          <div className="h-full w-full overflow-y-auto scrollbar-hide pt-9">
            {children}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
