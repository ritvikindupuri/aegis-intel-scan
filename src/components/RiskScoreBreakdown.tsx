import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ShieldAlert, Shield, ShieldCheck, Info } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { Finding } from "@/lib/api";

const SEVERITY_WEIGHTS: Record<string, { points: number; label: string; color: string; bgColor: string; icon: typeof Shield }> = {
  critical: { points: 25, label: "Critical", color: "text-severity-critical", bgColor: "bg-severity-critical", icon: ShieldAlert },
  high: { points: 15, label: "High", color: "text-severity-high", bgColor: "bg-severity-high", icon: AlertTriangle },
  medium: { points: 8, label: "Medium", color: "text-severity-medium", bgColor: "bg-severity-medium", icon: Shield },
  low: { points: 3, label: "Low", color: "text-severity-low", bgColor: "bg-severity-low", icon: ShieldCheck },
  info: { points: 1, label: "Info", color: "text-severity-info", bgColor: "bg-severity-info", icon: Info },
};

interface RiskScoreBreakdownProps {
  score: number;
  findings: Finding[];
}

export function RiskScoreBreakdown({ score, findings }: RiskScoreBreakdownProps) {
  const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) {
    const sev = f.severity.toLowerCase();
    if (counts[sev] !== undefined) counts[sev]++;
  }

  const contributions = Object.entries(SEVERITY_WEIGHTS).map(([sev, config]) => {
    const count = counts[sev] || 0;
    const rawPoints = count * config.points;
    return { severity: sev, ...config, count, rawPoints };
  });

  const rawTotal = contributions.reduce((sum, c) => sum + c.rawPoints, 0);
  const activeContributions = contributions.filter(c => c.count > 0);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
          <Shield className="h-3.5 w-3.5 text-primary" />
          Risk Score Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Score visual bar */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className={`font-mono font-bold text-2xl ${
              score >= 75 ? "text-severity-critical" :
              score >= 50 ? "text-severity-high" :
              score >= 25 ? "text-severity-medium" : "text-severity-low"
            }`}>
              {score}<span className="text-sm text-muted-foreground font-normal ml-1">/ 100</span>
            </span>
            <span className={`text-xs font-semibold uppercase tracking-wider ${
              score >= 75 ? "text-severity-critical" :
              score >= 50 ? "text-severity-high" :
              score >= 25 ? "text-severity-medium" : "text-severity-low"
            }`}>
              {score >= 75 ? "Critical" : score >= 50 ? "High" : score >= 25 ? "Medium" : "Low"} Risk
            </span>
          </div>
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                score >= 75 ? "bg-severity-critical" : score >= 50 ? "bg-severity-high" : score >= 25 ? "bg-severity-medium" : "bg-severity-low"
              }`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>

        {/* Bar chart */}
        {contributions.some(c => c.count > 0) && (
          <div className="space-y-2">
            <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Point Contribution</div>
            <div className="flex items-end gap-2 h-28 pt-2">
              {contributions.map(c => {
                const maxPts = Math.max(...contributions.map(x => x.rawPoints), 1);
                const heightPct = c.rawPoints > 0 ? Math.max((c.rawPoints / maxPts) * 100, 8) : 0;
                return (
                  <div key={c.severity} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                    {c.rawPoints > 0 && (
                      <span className={`text-[10px] font-mono font-bold ${c.color}`}>{c.rawPoints}</span>
                    )}
                    <div
                      className={`w-full rounded-t-md transition-all duration-700 ${c.rawPoints > 0 ? c.bgColor + ' opacity-80' : 'bg-secondary'}`}
                      style={{ height: c.rawPoints > 0 ? `${heightPct}%` : '4px' }}
                    />
                    <span className={`text-[9px] font-medium ${c.rawPoints > 0 ? c.color : 'text-muted-foreground/50'}`}>
                      {c.label.slice(0, 4)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Contributions */}
        <div className="space-y-1.5">
          {activeContributions.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-3">No findings detected.</div>
          ) : (
            activeContributions.map(({ severity, label, color, count, rawPoints, points, icon: Icon }) => (
              <div key={severity} className="flex items-center justify-between py-1.5 px-3 rounded-md hover:bg-secondary/50 transition-colors">
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-3.5 w-3.5 ${color}`} />
                  <span className={`font-medium text-xs ${color}`}>{label}</span>
                  <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded font-mono">{count}</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs">
                  <span className="text-muted-foreground">{count} × {points}</span>
                  <span className="text-foreground font-semibold w-8 text-right">{rawPoints}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Total */}
        {activeContributions.length > 0 && rawTotal > 100 && (
          <div className="text-[10px] text-muted-foreground text-right font-mono">
            Raw total: <span className="line-through">{rawTotal}</span> → capped at 100
          </div>
        )}

        {/* Severity level definitions */}
        <div className="space-y-2 pt-1">
          <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">How Severity is Determined</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {[
              { sev: "Critical", color: "text-severity-critical", desc: "Exposed configs, database tools, sensitive data leaks" },
              { sev: "High", color: "text-severity-high", desc: "Missing CSP, exposed admin panels, open redirects" },
              { sev: "Medium", color: "text-severity-medium", desc: "Missing HSTS/X-Frame-Options, XSS input vectors" },
              { sev: "Low", color: "text-severity-low", desc: "Outdated libraries, excessive external dependencies" },
            ].map(({ sev, color, desc }) => (
              <div key={sev} className="flex items-start gap-2 py-1.5 px-2.5 rounded-md bg-secondary/30">
                <span className={`text-[10px] font-bold ${color} shrink-0 mt-0.5`}>{sev}</span>
                <span className="text-[10px] text-muted-foreground leading-relaxed">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scoring methodology - collapsed */}
        <details className="group">
          <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform text-[10px]">▶</span>
            Scoring formula
          </summary>
          <div className="mt-2 text-[11px] text-muted-foreground leading-relaxed p-3 rounded-lg bg-secondary/40 border border-border space-y-1.5">
            <div>Risk = Σ (count × weight), capped at 100</div>
            <div className="font-mono text-[10px] text-foreground/70">
              Critical=25 · High=15 · Medium=8 · Low=3 · Info=1
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
