import { AlertTriangle, Shield, ShieldAlert, ShieldCheck, Info } from "lucide-react";

const severityConfig: Record<string, { icon: typeof Shield; className: string; label: string }> = {
  critical: { icon: ShieldAlert, className: "text-severity-critical bg-severity-critical/10 border-severity-critical/30", label: "Critical" },
  high: { icon: AlertTriangle, className: "text-severity-high bg-severity-high/10 border-severity-high/30", label: "High" },
  medium: { icon: Shield, className: "text-severity-medium bg-severity-medium/10 border-severity-medium/30", label: "Medium" },
  low: { icon: ShieldCheck, className: "text-severity-low bg-severity-low/10 border-severity-low/30", label: "Low" },
  info: { icon: Info, className: "text-severity-info bg-severity-info/10 border-severity-info/30", label: "Info" },
};

export function SeverityBadge({ severity }: { severity: string }) {
  const config = severityConfig[severity] || severityConfig.info;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold border ${config.className}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

export function RiskScoreGauge({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 75) return "text-severity-critical";
    if (score >= 50) return "text-severity-high";
    if (score >= 25) return "text-severity-medium";
    return "text-severity-low";
  };

  const getLabel = () => {
    if (score >= 75) return "Critical";
    if (score >= 50) return "High";
    if (score >= 25) return "Medium";
    return "Low";
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`text-4xl font-mono font-bold ${getColor()}`}>
        {score}
      </div>
      <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{getLabel()} Risk</div>
      <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mt-1">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            score >= 75 ? "bg-severity-critical" : score >= 50 ? "bg-severity-high" : score >= 25 ? "bg-severity-medium" : "bg-severity-low"
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    pending: "text-muted-foreground bg-muted",
    crawling: "text-primary bg-primary/10 animate-pulse-glow",
    analyzing: "text-accent bg-accent/10 animate-pulse-glow",
    completed: "text-success bg-success/10",
    failed: "text-destructive bg-destructive/10",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold ${config[status] || config.pending}`}>
      {status}
    </span>
  );
}
