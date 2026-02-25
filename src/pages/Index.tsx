import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, AlertTriangle, Cpu, Clock, ArrowRight, Search, Shield } from "lucide-react";
import { ScanForm } from "@/components/ScanForm";
import { StatusBadge, RiskScoreGauge, SeverityBadge } from "@/components/SeverityBadge";
import { getScans, type Scan } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import spectraLogo from "@/assets/spectra-logo.png";

const Dashboard = () => {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScans = async () => {
    try {
      const data = await getScans();
      setScans(data);
    } catch (err) {
      console.error("Failed to fetch scans:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchScans(); }, []);

  const totalScans = scans.length;
  const totalVulns = scans.reduce((sum, s) => sum + (s.vulnerabilities_found || 0), 0);
  const avgRisk = totalScans ? Math.round(scans.reduce((sum, s) => sum + (s.risk_score || 0), 0) / totalScans) : 0;
  const uniqueDomains = new Set(scans.map(s => s.domain)).size;

  const techCounts: Record<string, number> = {};
  for (const s of scans) {
    for (const t of (s.technologies || [])) {
      techCounts[t] = (techCounts[t] || 0) + 1;
    }
  }
  const topTechs = Object.entries(techCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const s of scans) {
    if (s.risk_score >= 75) severityCounts.critical++;
    else if (s.risk_score >= 50) severityCounts.high++;
    else if (s.risk_score >= 25) severityCounts.medium++;
    else if (s.risk_score > 0) severityCounts.low++;
    else severityCounts.info++;
  }

  const recentScans = scans.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="flex flex-col items-center text-center gap-5 py-10">
        <img src={spectraLogo} alt="Spectra" className="h-14 w-14 rounded-xl" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-gradient-primary">Spec</span>tra
          </h1>
          <p className="text-muted-foreground mt-2 max-w-lg text-sm leading-relaxed">
            Automated threat intelligence & attack surface mapping. Enter a domain to begin reconnaissance.
          </p>
        </div>
        <ScanForm onScanStarted={fetchScans} />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Scans", value: totalScans, icon: Search, color: "text-primary" },
          { label: "Domains", value: uniqueDomains, icon: Globe, color: "text-primary" },
          { label: "Vulnerabilities", value: totalVulns, icon: AlertTriangle, color: "text-accent" },
          { label: "Avg Risk", value: avgRisk, icon: Shield, color: avgRisk >= 50 ? "text-severity-high" : "text-severity-low" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-card border-border card-hover">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary">
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <div className="text-2xl font-mono font-bold tracking-tight">{value}</div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Recent Scans */}
        <Card className="md:col-span-2 bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-primary" />
              Recent Scans
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
            ) : recentScans.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No scans yet. Start your first scan above.</div>
            ) : (
              <div className="divide-y divide-border">
                {recentScans.map(scan => (
                  <Link key={scan.id} to={`/scan/${scan.id}`} className="flex items-center justify-between p-4 hover:bg-secondary/40 transition-all duration-200 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-1.5 rounded-md bg-secondary">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-mono text-sm truncate">{scan.domain}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(scan.created_at), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusBadge status={scan.status} />
                      {scan.status === 'completed' && (
                        <span className={`font-mono text-sm font-bold ${
                          scan.risk_score >= 75 ? "text-severity-critical" :
                          scan.risk_score >= 50 ? "text-severity-high" :
                          scan.risk_score >= 25 ? "text-severity-medium" : "text-severity-low"
                        }`}>{scan.risk_score}</span>
                      )}
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-medium flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-accent" />
                Risk Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {Object.entries(severityCounts).map(([sev, count]) => (
                <div key={sev} className="flex items-center justify-between">
                  <SeverityBadge severity={sev} />
                  <span className="font-mono text-sm text-muted-foreground">{count}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-medium flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                <Cpu className="h-3.5 w-3.5 text-primary" />
                Technologies
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topTechs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No data yet</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {topTechs.map(([tech, count]) => (
                    <span key={tech} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary text-[11px] font-mono text-secondary-foreground">
                      {tech}
                      <span className="text-muted-foreground">({count})</span>
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
