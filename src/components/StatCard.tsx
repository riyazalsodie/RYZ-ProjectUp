import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent?: boolean;
  index?: number;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, hint, icon: Icon, accent }) => {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300",
        accent
          ? "border-primary/20 bg-gradient-to-br from-primary/[0.12] via-[#030906] to-[#020403] hover:border-primary/35"
          : "border-white/[0.06] bg-[#030604] hover:border-white/[0.12]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-500">{label}</p>
          <p className="mt-2 truncate text-xl font-semibold tracking-tight text-white tabular">{value}</p>
          {hint ? <p className="mt-1 truncate text-[10px] text-neutral-500">{hint}</p> : null}
        </div>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors",
            accent
              ? "border-primary/25 bg-primary/15 text-primary shadow-[0_0_18px_-6px_rgba(0,255,136,0.6)]"
              : "border-white/[0.07] bg-white/[0.04] text-neutral-500 group-hover:text-neutral-300"
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={1.9} />
        </div>
      </div>
      <div
        className={cn(
          "pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full blur-3xl transition-opacity duration-300",
          accent ? "bg-primary/20" : "bg-white/[0.03] group-hover:bg-primary/[0.06]"
        )}
      />
    </div>
  );
};
