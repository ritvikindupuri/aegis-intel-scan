import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getScans, getFindings, type Scan, type Finding } from "@/lib/api";
import { SeverityBadge, StatusBadge } from "@/components/SeverityBadge";
import {
  GitCompareArrows, Globe, Plus, Minus, ArrowRight, ArrowUp, ArrowDown,
  AlertTriangle, Cpu, Link2, Loader2, Shield, ShieldAlert, ShieldCheck,
  TrendingUp, TrendingDown, Equal, Calendar, Hash, Bug, CheckCircle2,
  Info, ExternalLink, EyeOff, Eye
} from "lucide-react";
import { AiChatPanel } from "@/components/AiChatPanel";
import { format, formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/components/PageTransition";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

interface ComparisonData {
  scan: Scan;
  findings: Finding[];
  urls: string[];
  technologies: string[];
}

const severityOrder = ["critical", "high", "medium", "low", "info"];

const getSeverityCounts = (findings: Finding[]) => {
  const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  findings.forEach(f => {
    const s = f.severity.toLowerCase();
    if (s in counts) counts[s]++;
  });
  return counts;
};

const getCategoryCounts = (findings: Finding[]) => {
  const counts: Record<string, number> = {};
  findings.forEach(f => {
    counts[f.category] = (counts[f.category] || 0) + 1;
  });
  return counts;
};

const DeltaIndicator = ({ value, inverted = false }: { value: number; inverted?: boolean }) => {
  if (value === 0) return (
    <span className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground">
      <Equal className="h-3 w-3" /> 0
    </span>
  );
  const isPositive = value > 0;
  const isGood = inverted ? isPositive : !isPositive;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-mono font-semibold ${isGood ? "text-success" : "text-severity-critical"}`}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isPositive ? `+${value}` : value}
    </span>
  );
};

const StatCard = ({ label, valueA, valueB, icon: Icon, inverted = false, tooltip }: {
  label: string; valueA: number; valueB: number; icon: any; inverted?: boolean; tooltip?: string;
}) => {
  const delta = valueB - valueA;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-secondary/50 border border-border/50">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Icon className="h-3 w-3" /> {label}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-mono font-bold text-foreground">{valueA}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
              <span className="text-lg font-mono font-bold text-foreground">{valueB}</span>
              <DeltaIndicator value={delta} inverted={inverted} />
            </div>
          </div>
        </TooltipTrigger>
        {tooltip && <TooltipContent><p className="text-xs max-w-[200px]">{tooltip}</p></TooltipContent>}
      </Tooltip>
    </TooltipProvider>
  );
};

const Compare = () => {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanAId, setScanAId] = useState("");
  const [scanBId, setScanBId] = useState("");
  const [dataA, setDataA] = useState<ComparisonData | null>(null);
  const [dataB, setDataB] = useState<ComparisonData | null>(null);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    getScans().then(s => {
      setScans(s.filter(sc => sc.status === "completed"));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!scanAId || !scanBId || scanAId === scanBId) {
      setDataA(null);
      setDataB(null);
      return;
    }
    const load = async () => {
      setComparing(true);
      try {
        const [sA, sB] = scans.filter(s => s.id === scanAId || s.id === scanBId);
        const scanA = sA.id === scanAId ? sA : sB;
        const scanB = sA.id === scanBId ? sA : sB;
        const [fA, fB] = await Promise.all([getFindings(scanAId), getFindings(scanBId)]);
        setDataA({
          scan: scanA,
          findings: fA,
          urls: (scanA.parsed_data?.urls || []) as string[],
          technologies: (scanA.technologies || []) as string[],
        });
        setDataB({
          scan: scanB,
          findings: fB,
          urls: (scanB.parsed_data?.urls || []) as string[],
          technologies: (scanB.technologies || []) as string[],
        });
      } catch (e) {
        console.error(e);
      } finally {
        setComparing(false);
      }
    };
    load();
  }, [scanAId, scanBId, scans]);

  const diffArrays = (a: string[], b: string[]) => {
    const setA = new Set(a);
    const setB = new Set(b);
    return {
      added: b.filter(x => !setA.has(x)),
      removed: a.filter(x => !setB.has(x)),
      unchanged: a.filter(x => setB.has(x)),
    };
  };

  const diffFindings = (a: Finding[], b: Finding[]) => {
    const titlesA = new Set(a.map(f => f.title));
    const titlesB = new Set(b.map(f => f.title));
    return {
      newVulns: b.filter(f => !titlesA.has(f.title)),
      resolved: a.filter(f => !titlesB.has(f.title)),
      persistent: b.filter(f => titlesA.has(f.title)),
    };
  };

  const urlDiff = dataA && dataB ? diffArrays(dataA.urls, dataB.urls) : null;
  const techDiff = dataA && dataB ? diffArrays(dataA.technologies, dataB.technologies) : null;
  const findingDiff = dataA && dataB ? diffFindings(dataA.findings, dataB.findings) : null;

  const severityA = dataA ? getSeverityCounts(dataA.findings) : null;
  const severityB = dataB ? getSeverityCounts(dataB.findings) : null;

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="initial" animate="animate">
      {/* Header */}
      <motion.div variants={fadeInUp}>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <GitCompareArrows className="h-5 w-5 text-primary" />
          Scan Comparison
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select two completed scans to perform delta analysis — identify new risks, resolved issues, and infrastructure changes between scan intervals.
        </p>
      </motion.div>

      {/* Scan selectors */}
      <motion.div variants={fadeInUp} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Scan A selector */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-primary" />
              Baseline Scan (A)
            </CardTitle>
            <p className="text-[10px] text-muted-foreground/70">The earlier scan to compare against — your known-good state.</p>
          </CardHeader>
          <CardContent>
            <Select value={scanAId} onValueChange={setScanAId}>
              <SelectTrigger className="bg-secondary border-border font-mono text-sm">
                <SelectValue placeholder="Select baseline scan..." />
              </SelectTrigger>
              <SelectContent>
                {scans.map(s => (
                  <SelectItem key={s.id} value={s.id} disabled={s.id === scanBId}>
                    <span className="font-mono text-xs">{s.domain}</span>
                    <span className="text-muted-foreground text-xs ml-2">
                      {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {dataA && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Globe className="h-3 w-3" />
                  <span className="font-mono font-medium text-foreground">{dataA.scan.domain}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(dataA.scan.created_at), "MMM d, yyyy HH:mm")}</span>
                  <span className="flex items-center gap-1"><Shield className="h-3 w-3" />Risk: <span className="font-mono font-semibold text-foreground">{dataA.scan.risk_score}</span></span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Bug className="h-3 w-3" />{dataA.findings.length} findings</span>
                  <span className="flex items-center gap-1"><Link2 className="h-3 w-3" />{dataA.urls.length} endpoints</span>
                  <span className="flex items-center gap-1"><Cpu className="h-3 w-3" />{dataA.technologies.length} techs</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scan B selector */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-accent" />
              Comparison Scan (B)
            </CardTitle>
            <p className="text-[10px] text-muted-foreground/70">The newer scan — changes are computed relative to the baseline.</p>
          </CardHeader>
          <CardContent>
            <Select value={scanBId} onValueChange={setScanBId}>
              <SelectTrigger className="bg-secondary border-border font-mono text-sm">
                <SelectValue placeholder="Select comparison scan..." />
              </SelectTrigger>
              <SelectContent>
                {scans.map(s => (
                  <SelectItem key={s.id} value={s.id} disabled={s.id === scanAId}>
                    <span className="font-mono text-xs">{s.domain}</span>
                    <span className="text-muted-foreground text-xs ml-2">
                      {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {dataB && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Globe className="h-3 w-3" />
                  <span className="font-mono font-medium text-foreground">{dataB.scan.domain}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(dataB.scan.created_at), "MMM d, yyyy HH:mm")}</span>
                  <span className="flex items-center gap-1"><Shield className="h-3 w-3" />Risk: <span className="font-mono font-semibold text-foreground">{dataB.scan.risk_score}</span></span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Bug className="h-3 w-3" />{dataB.findings.length} findings</span>
                  <span className="flex items-center gap-1"><Link2 className="h-3 w-3" />{dataB.urls.length} endpoints</span>
                  <span className="flex items-center gap-1"><Cpu className="h-3 w-3" />{dataB.technologies.length} techs</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {comparing && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {dataA && dataB && !comparing && (
        <>
          {/* Executive Summary */}
          <motion.div variants={fadeInUp}>
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Info className="h-3.5 w-3.5 text-primary" /> Executive Summary
                </CardTitle>
                <p className="text-[10px] text-muted-foreground/70">
                  High-level delta between baseline and comparison scans. Green = improvement, Red = regression.
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard
                    label="Risk Score"
                    valueA={dataA.scan.risk_score ?? 0}
                    valueB={dataB.scan.risk_score ?? 0}
                    icon={Shield}
                    tooltip="Overall risk score (0–100). A decrease means the target's security posture improved."
                  />
                  <StatCard
                    label="Findings"
                    valueA={dataA.findings.length}
                    valueB={dataB.findings.length}
                    icon={Bug}
                    tooltip="Total vulnerability findings detected. Fewer findings = better posture."
                  />
                  <StatCard
                    label="Endpoints"
                    valueA={dataA.urls.length}
                    valueB={dataB.urls.length}
                    icon={Link2}
                    inverted
                    tooltip="Discovered endpoints/URLs. More endpoints may indicate an expanded attack surface."
                  />
                  <StatCard
                    label="Technologies"
                    valueA={dataA.technologies.length}
                    valueB={dataB.technologies.length}
                    icon={Cpu}
                    inverted
                    tooltip="Detected technology stack size. Changes may indicate infrastructure updates."
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Risk score comparison */}
          <motion.div variants={fadeInUp}>
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-accent" /> Risk Score Change
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const scoreA = dataA.scan.risk_score ?? 0;
                  const scoreB = dataB.scan.risk_score ?? 0;
                  const delta = scoreB - scoreA;
                  const getRiskLabel = (s: number) => s >= 75 ? "Critical" : s >= 50 ? "High" : s >= 25 ? "Medium" : "Low";
                  const getRiskColor = (s: number) => s >= 75 ? "text-severity-critical" : s >= 50 ? "text-severity-high" : s >= 25 ? "text-severity-medium" : "text-severity-low";
                  const getRiskBg = (s: number) => s >= 75 ? "bg-severity-critical/10 border-severity-critical/20" : s >= 50 ? "bg-severity-high/10 border-severity-high/20" : s >= 25 ? "bg-severity-medium/10 border-severity-medium/20" : "bg-severity-low/10 border-severity-low/20";

                  // Build explanation of what changed
                  const drivers: string[] = [];
                  if (severityA && severityB) {
                    const critDelta = severityB.critical - severityA.critical;
                    const highDelta = severityB.high - severityA.high;
                    const medDelta = severityB.medium - severityA.medium;
                    if (critDelta > 0) drivers.push(`${critDelta} new critical finding${critDelta > 1 ? 's' : ''} detected`);
                    if (critDelta < 0) drivers.push(`${Math.abs(critDelta)} critical finding${Math.abs(critDelta) > 1 ? 's' : ''} no longer detected`);
                    if (highDelta > 0) drivers.push(`${highDelta} new high finding${highDelta > 1 ? 's' : ''} detected`);
                    if (highDelta < 0) drivers.push(`${Math.abs(highDelta)} high finding${Math.abs(highDelta) > 1 ? 's' : ''} no longer detected`);
                    if (medDelta > 0) drivers.push(`${medDelta} new medium finding${medDelta > 1 ? 's' : ''} detected`);
                    if (medDelta < 0) drivers.push(`${Math.abs(medDelta)} medium finding${Math.abs(medDelta) > 1 ? 's' : ''} no longer detected`);
                  }
                  if (findingDiff) {
                    if (findingDiff.newVulns.length > 0 && drivers.length === 0) drivers.push(`${findingDiff.newVulns.length} new finding(s) appeared`);
                    if (findingDiff.resolved.length > 0 && drivers.length === 0) drivers.push(`${findingDiff.resolved.length} finding(s) no longer detected`);
                  }

                  return (
                    <div className="space-y-4">
                      {/* Visual score comparison */}
                      <div className="flex items-center justify-center gap-4 md:gap-8">
                        <div className={`text-center p-4 rounded-lg border ${getRiskBg(scoreA)} min-w-[120px]`}>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Baseline (A)</div>
                          <div className={`text-4xl font-mono font-bold ${getRiskColor(scoreA)}`}>{scoreA}</div>
                          <div className={`text-xs font-semibold mt-1 ${getRiskColor(scoreA)}`}>{getRiskLabel(scoreA)} Risk</div>
                        </div>

                        <div className="flex flex-col items-center gap-1">
                          <ArrowRight className="h-5 w-5 text-muted-foreground" />
                          <div className={`text-2xl font-mono font-bold px-3 py-1 rounded-md ${
                            delta > 0 ? "text-severity-critical bg-severity-critical/10" : 
                            delta < 0 ? "text-success bg-success/10" : "text-muted-foreground bg-secondary"
                          }`}>
                            {delta > 0 ? `+${delta}` : delta === 0 ? "±0" : delta}
                          </div>
                          <div className={`text-[10px] font-medium ${
                            delta > 0 ? "text-severity-critical" : delta < 0 ? "text-success" : "text-muted-foreground"
                          }`}>
                            {delta > 0 ? "RISK INCREASED" : delta < 0 ? "RISK DECREASED" : "NO CHANGE"}
                          </div>
                        </div>

                        <div className={`text-center p-4 rounded-lg border ${getRiskBg(scoreB)} min-w-[120px]`}>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Current (B)</div>
                          <div className={`text-4xl font-mono font-bold ${getRiskColor(scoreB)}`}>{scoreB}</div>
                          <div className={`text-xs font-semibold mt-1 ${getRiskColor(scoreB)}`}>{getRiskLabel(scoreB)} Risk</div>
                        </div>
                      </div>

                      {/* What drove the change */}
                      {drivers.length > 0 && (
                        <div className="bg-secondary/50 rounded-lg p-3 border border-border/50">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">What drove this change</p>
                          <ul className="space-y-1">
                            {drivers.map((d, i) => (
                              <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                                <span className="text-primary mt-0.5">•</span>
                                <span>{d}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Risk score interpretation */}
                      <div className="bg-secondary/30 rounded-lg p-3 border border-border/30">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-semibold">How to read this</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Risk scores are computed from weighted findings: <span className="font-mono text-foreground">Critical×25 + High×15 + Medium×8 + Low×3 + Info×1</span>, capped at 100. 
                          {delta > 0 
                            ? " The increase suggests new weaknesses were discovered in the target's attack surface since the baseline scan."
                            : delta < 0 
                            ? " The decrease indicates some previously detected weaknesses are no longer visible — this could mean the target patched, reconfigured, or the findings are now behind authentication."
                            : " No change means the target's observable attack surface remained stable between scans."}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Severity breakdown comparison */}
                {severityA && severityB && (
                  <>
                    <Separator className="my-4" />
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Severity Breakdown</p>
                        <p className="text-[10px] text-muted-foreground/70">How many findings per severity level changed between scans.</p>
                      </div>
                      {/* Column headers */}
                      <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground/50 px-1">
                        <div className="w-16" />
                        <div className="w-16 text-center">Scan A</div>
                        <div className="flex-1" />
                        <div className="w-16 text-center">Scan B</div>
                        <div className="w-16 text-right">Change</div>
                      </div>
                      {severityOrder.map(sev => {
                        const a = severityA[sev];
                        const b = severityB[sev];
                        const delta = b - a;
                        return (
                          <div key={sev} className="flex items-center gap-3 py-1.5 px-1 rounded-md hover:bg-secondary/30 transition-colors">
                            <div className="w-16">
                              <SeverityBadge severity={sev} />
                            </div>
                            <div className="w-16 text-center text-sm font-mono font-bold text-muted-foreground">{a}</div>
                            <div className="flex-1 flex items-center justify-center">
                              <ArrowRight className="h-3 w-3 text-muted-foreground/30" />
                            </div>
                            <div className={`w-16 text-center text-sm font-mono font-bold ${
                              delta > 0 ? "text-severity-critical" : delta < 0 ? "text-success" : "text-foreground"
                            }`}>{b}</div>
                            <div className="w-16 text-right">
                              <DeltaIndicator value={delta} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Vulnerability changes */}
          {findingDiff && (
            <motion.div variants={fadeInUp}>
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <ShieldAlert className="h-3.5 w-3.5 text-severity-high" /> Finding Delta
                  </CardTitle>
                  <p className="text-[10px] text-muted-foreground/70">
                    Findings matched by title across scans. "Newly Detected" = in current scan only. "No Longer Detected" = in baseline only (not confirmed fixed). "Still Present" = in both.
                  </p>
                </CardHeader>
                <CardContent>
                  {/* Scan reference labels */}
                  <div className="flex flex-wrap items-center gap-4 mb-4 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <span className="uppercase tracking-wider font-semibold">Baseline (A):</span>
                      <span className="font-mono text-foreground">{dataA.scan.domain}</span>
                      <span className="text-muted-foreground/70">({format(new Date(dataA.scan.created_at), "MMM d, yyyy")})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-accent" />
                      <span className="uppercase tracking-wider font-semibold">Current (B):</span>
                      <span className="font-mono text-foreground">{dataB.scan.domain}</span>
                      <span className="text-muted-foreground/70">({format(new Date(dataB.scan.created_at), "MMM d, yyyy")})</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     {/* Newly Detected */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-wider text-severity-critical flex items-center gap-1.5 font-semibold">
                          <Plus className="h-3 w-3" /> Newly Detected ({findingDiff.newVulns.length})
                        </span>
                        {findingDiff.newVulns.length > 0 && (
                          <span className="text-[10px] text-severity-critical/70 bg-severity-critical/10 px-1.5 py-0.5 rounded">Investigate</span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground/70 -mt-1">
                        Issues that appeared in scan B but weren't in scan A — these are new risks to investigate.
                      </p>
                      <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                        {findingDiff.newVulns.length === 0 ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
                            <ShieldCheck className="h-4 w-4 text-success" />
                            No new vulnerabilities
                          </div>
                        ) : findingDiff.newVulns.map((f, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-severity-critical/5 border border-severity-critical/10">
                            <SeverityBadge severity={f.severity} />
                            <div className="min-w-0">
                              <span className="text-xs font-medium block truncate">{f.title}</span>
                              <span className="text-[10px] text-muted-foreground">{f.category}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* No Longer Detected */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-wider text-success flex items-center gap-1.5 font-semibold">
                          <EyeOff className="h-3 w-3" /> No Longer Detected ({findingDiff.resolved.length})
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground/70 -mt-1">
                        Issues found in scan A but missing from scan B — possibly fixed, but <span className="font-semibold text-muted-foreground">not confirmed</span>.
                      </p>
                      <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                        {findingDiff.resolved.length === 0 ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
                            <ShieldCheck className="h-4 w-4 text-success" />
                            All baseline findings still detected
                          </div>
                        ) : findingDiff.resolved.map((f, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-success/5 border border-success/10">
                            <SeverityBadge severity={f.severity} />
                            <div className="min-w-0">
                              <span className="text-xs text-muted-foreground block truncate">{f.title}</span>
                              <span className="text-[10px] text-muted-foreground">{f.category}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Still Present */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-semibold">
                          <Eye className="h-3 w-3" /> Still Present ({findingDiff.persistent.length})
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground/70 -mt-1">
                        Issues found in both scans — these haven't been resolved yet.
                      </p>
                      <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                        {findingDiff.persistent.length === 0 ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
                            No overlapping findings
                          </div>
                        ) : findingDiff.persistent.map((f, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-secondary/50 border border-border/50">
                            <SeverityBadge severity={f.severity} />
                            <div className="min-w-0">
                              <span className="text-xs block truncate">{f.title}</span>
                              <span className="text-[10px] text-muted-foreground">{f.category}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Technology changes */}
          {techDiff && (
            <motion.div variants={fadeInUp}>
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Cpu className="h-3.5 w-3.5 text-primary" /> Technology Stack Changes
                  </CardTitle>
                  <p className="text-[10px] text-muted-foreground/70">
                    Infrastructure diff — added technologies expand the attack surface; removed ones may indicate decommissioning.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {techDiff.added.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-success mb-1.5 font-medium">Added ({techDiff.added.length})</p>
                        <div className="flex flex-wrap gap-2">
                          {techDiff.added.map(t => (
                            <span key={t} className="px-2 py-1 rounded-md bg-success/10 text-success text-xs font-mono flex items-center gap-1 border border-success/20">
                              <Plus className="h-3 w-3" /> {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {techDiff.removed.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-destructive mb-1.5 font-medium">Removed ({techDiff.removed.length})</p>
                        <div className="flex flex-wrap gap-2">
                          {techDiff.removed.map(t => (
                            <span key={t} className="px-2 py-1 rounded-md bg-destructive/10 text-destructive text-xs font-mono flex items-center gap-1 border border-destructive/20">
                              <Minus className="h-3 w-3" /> {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {techDiff.unchanged.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">Unchanged ({techDiff.unchanged.length})</p>
                        <div className="flex flex-wrap gap-2">
                          {techDiff.unchanged.map(t => (
                            <span key={t} className="px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-mono">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {techDiff.added.length === 0 && techDiff.removed.length === 0 && techDiff.unchanged.length === 0 && (
                      <span className="text-xs text-muted-foreground">No technologies detected in either scan</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Endpoint changes */}
          {urlDiff && (
            <motion.div variants={fadeInUp} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wider text-success flex items-center gap-1.5">
                    <Plus className="h-3 w-3" /> New Endpoints ({urlDiff.added.length})
                  </CardTitle>
                  <p className="text-[10px] text-muted-foreground/70">
                    URLs discovered in Scan B but absent from Scan A — potential new attack vectors.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {urlDiff.added.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-3 text-center">No new endpoints</p>
                    ) : urlDiff.added.slice(0, 30).map((url, i) => (
                      <div key={i} className="text-xs font-mono text-success/80 truncate flex items-center gap-1">
                        <Plus className="h-2.5 w-2.5 flex-shrink-0" /> {url}
                      </div>
                    ))}
                    {urlDiff.added.length > 30 && (
                      <div className="text-xs text-muted-foreground pt-1">...and {urlDiff.added.length - 30} more</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wider text-destructive flex items-center gap-1.5">
                    <Minus className="h-3 w-3" /> Removed Endpoints ({urlDiff.removed.length})
                  </CardTitle>
                  <p className="text-[10px] text-muted-foreground/70">
                    URLs present in Scan A but missing from Scan B — may indicate decommissioned services.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {urlDiff.removed.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-3 text-center">No removed endpoints</p>
                    ) : urlDiff.removed.slice(0, 30).map((url, i) => (
                      <div key={i} className="text-xs font-mono text-destructive/80 truncate line-through flex items-center gap-1">
                        <Minus className="h-2.5 w-2.5 flex-shrink-0" /> {url}
                      </div>
                    ))}
                    {urlDiff.removed.length > 30 && (
                      <div className="text-xs text-muted-foreground pt-1">...and {urlDiff.removed.length - 30} more</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* AI Analyst for Compare */}
          <motion.div variants={fadeInUp}>
            <AiChatPanel
              context="compare"
              contextData={{
                scanA: { domain: dataA.scan.domain, risk_score: dataA.scan.risk_score, created_at: dataA.scan.created_at, findings_count: dataA.findings.length, endpoints_count: dataA.urls.length, technologies: dataA.technologies },
                scanB: { domain: dataB.scan.domain, risk_score: dataB.scan.risk_score, created_at: dataB.scan.created_at, findings_count: dataB.findings.length, endpoints_count: dataB.urls.length, technologies: dataB.technologies },
                delta: {
                  risk_score_change: (dataB.scan.risk_score ?? 0) - (dataA.scan.risk_score ?? 0),
                  new_findings: findingDiff?.newVulns.map(f => ({ title: f.title, severity: f.severity, category: f.category })) ?? [],
                  no_longer_detected: findingDiff?.resolved.map(f => ({ title: f.title, severity: f.severity, category: f.category })) ?? [],
                  still_present: findingDiff?.persistent.map(f => ({ title: f.title, severity: f.severity, category: f.category })) ?? [],
                  tech_added: techDiff?.added ?? [],
                  tech_removed: techDiff?.removed ?? [],
                  endpoints_added: urlDiff?.added.length ?? 0,
                  endpoints_removed: urlDiff?.removed.length ?? 0,
                },
              }}
              domain={dataA.scan.domain}
            />
          </motion.div>

          {urlDiff && urlDiff.unchanged.length > 0 && (
            <motion.div variants={fadeInUp}>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
                <Equal className="h-3 w-3" />
                <span>{urlDiff.unchanged.length} endpoints unchanged between scans</span>
              </div>
            </motion.div>
          )}
        </>
      )}

      {!scanAId && !scanBId && !loading && (
        <motion.div variants={fadeInUp}>
          <Card className="bg-card border-border">
            <CardContent className="p-12 text-center text-muted-foreground">
              <GitCompareArrows className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm font-medium">Select two completed scans above to compare</p>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-md mx-auto">
                Choose a baseline (A) and comparison (B) scan to generate a delta analysis covering risk scores, vulnerability changes, technology drift, and endpoint discovery.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
};

export default Compare;
