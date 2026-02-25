import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ShieldAlert, Shield, ShieldCheck, Info } from "lucide-react";
import type { Finding } from "@/lib/api";

const SEVERITY_WEIGHTS: Record<string, { points: number; label: string; color: string; icon: typeof Shield }> = {
  critical: { points: 25, label: "Critical", color: "text-severity-critical", icon: ShieldAlert },
  high: { points: 15, label: "High", color: "text-severity-high", icon: AlertTriangle },
  medium: { points: 8, label: "Medium", color: "text-severity-medium", icon: Shield },
  low: { points: 3, label: "Low", color: "text-severity-low", icon: ShieldCheck },
  info: { points: 1, label: "Info", color: "text-severity-info", icon: Info },
};

interface RiskScoreBreakdownProps {
  score: number;
  findings: Finding[];
}

export function RiskScoreBreakdown({ score, findings }: RiskScoreBreakdownProps) {
  // Count findings by severity
  const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) {
    const sev = f.severity.toLowerCase();
    if (counts[sev] !== undefined) counts[sev]++;
  }

  // Calculate contribution per severity
  const contributions = Object.entries(SEVERITY_WEIGHTS).map(([sev, config]) => {
    const count = counts[sev] || 0;
    const rawPoints = count * config.points;
    return { severity: sev, ...config, count, rawPoints };
  }).filter(c => c.count > 0);

  const rawTotal = contributions.reduce((sum, c) => sum + c.rawPoints, 0);
  const wasCapped = rawTotal > 100;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-xs font-medium flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
          <Shield className="h-3.5 w-3.5 text-primary" />
          Risk Score Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Formula explanation */}
        <div className="text-xs text-muted-foreground leading-relaxed p-3 rounded-lg bg-secondary/50 border border-border">
          The risk score is calculated by summing weighted severity points from all findings:
          <span className="font-mono text-foreground"> Critical (25) · High (15) · Medium (8) · Low (3) · Info (1)</span>, capped at 100.
        </div>

        {/* Contributions table */}
        <div className="space-y-2">
          {contributions.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-2">No findings to calculate risk from.</div>
          ) : (
            contributions.map(({ severity, label, color, count, rawPoints, points, icon: Icon }) => (
              <div key={severity} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Icon className={`h-3.5 w-3.5 ${color}`} />
                  <span className={`font-medium text-xs ${color}`}>{label}</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs">
                  <span className="text-muted-foreground">
                    {count} × {points}pts
                  </span>
                  <span className="text-foreground font-semibold w-8 text-right">
                    {rawPoints}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Total */}
        <div className="border-t border-border pt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">
            Total{wasCapped && " (capped)"}
          </span>
          <div className="flex items-center gap-2">
            {wasCapped && (
              <span className="text-[10px] text-muted-foreground font-mono line-through">{rawTotal}</span>
            )}
            <span className={`font-mono font-bold text-lg ${
              score >= 75 ? "text-severity-critical" :
              score >= 50 ? "text-severity-high" :
              score >= 25 ? "text-severity-medium" : "text-severity-low"
            }`}>
              {score}
              <span className="text-xs text-muted-foreground font-normal"> / 100</span>
            </span>
          </div>
        </div>

        {/* Risk level explanation */}
        <div className="text-[11px] text-muted-foreground border-t border-border pt-3 space-y-1">
          <div className="font-medium text-foreground text-xs mb-1.5">Severity Levels</div>
          <div><span className="text-severity-critical font-semibold">Critical (75–100):</span> Exposed configs, database tools, or sensitive data leaks</div>
          <div><span className="text-severity-high font-semibold">High (50–74):</span> Missing CSP, exposed admin panels, open redirects</div>
          <div><span className="text-severity-medium font-semibold">Medium (25–49):</span> Missing HSTS/X-Frame-Options, XSS input points, CMS risks</div>
          <div><span className="text-severity-low font-semibold">Low (1–24):</span> Outdated libraries, high external dependency count</div>
        </div>
      </CardContent>
    </Card>
  );
}
