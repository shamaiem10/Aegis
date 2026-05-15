import { Home, Bell, Sparkles, Network, FileText } from "lucide-react";

const items = [
  { icon: Home, label: "Home" },
  { icon: Bell, label: "Alerts" },
  { icon: Sparkles, label: "Simulation" },
  { icon: Network, label: "Agents" },
  { icon: FileText, label: "Reports" },
];

export function BottomNav({ active = 0 }: { active?: number }) {
  return (
    <div className="absolute inset-x-3 bottom-3 z-30 glass rounded-3xl border border-white/60 px-2 py-2 shadow-soft">
      <div className="flex items-center justify-between">
        {items.map((item, i) => {
          const Icon = item.icon;
          const isActive = i === active;
          return (
            <button
              key={item.label}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 transition-all ${
                isActive ? "bg-mint-grad text-ink shadow-soft" : "text-ink-soft"
              }`}
            >
              <Icon size={16} strokeWidth={isActive ? 2.4 : 2} />
              <span className={`text-[9px] ${isActive ? "font-semibold" : "font-medium"}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
