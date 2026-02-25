import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getScans, getFindings, type Scan, type Finding } from "@/lib/api";
import { SeverityBadge, StatusBadge } from "@/components/SeverityBadge";
import { GitCompareArrows, Globe, Plus, Minus, ArrowRight, AlertTriangle, Cpu, Link2, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/components/PageTransition";

interface ComparisonData {
  scan: Scan;
  findings: Finding[];
  urls: string[];
  technologies: string[];
}

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

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="initial" animate="animate">
      <motion.div variants={fadeInUp}>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <GitCompareArrows className="h-5 w-5 text-primary" />
          Scan Comparison
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Compare two scans side-by-side to track changes</p>
      </motion.div>

      {/* Scan selectors */}
      <motion.div variants={fadeInUp} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Baseline Scan (A)</CardTitle>
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
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <StatusBadge status={dataA.scan.status} />
                <span className="font-mono">Risk: {dataA.scan.risk_score}</span>
                <span>· {dataA.findings.length} findings</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Comparison Scan (B)</CardTitle>
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
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <StatusBadge status={dataB.scan.status} />
                <span className="font-mono">Risk: {dataB.scan.risk_score}</span>
                <span>· {dataB.findings.length} findings</span>
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
          {/* Risk score comparison */}
          <motion.div variants={fadeInUp}>
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-accent" /> Risk Score Change
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center gap-6">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Scan A</div>
                    <div className={`text-3xl font-mono font-bold ${
                      dataA.scan.risk_score >= 75 ? "text-severity-critical" :
                      dataA.scan.risk_score >= 50 ? "text-severity-high" :
                      dataA.scan.risk_score >= 25 ? "text-severity-medium" : "text-severity-low"
                    }`}>{dataA.scan.risk_score}</div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Scan B</div>
                    <div className={`text-3xl font-mono font-bold ${
                      dataB.scan.risk_score >= 75 ? "text-severity-critical" :
                      dataB.scan.risk_score >= 50 ? "text-severity-high" :
                      dataB.scan.risk_score >= 25 ? "text-severity-medium" : "text-severity-low"
                    }`}>{dataB.scan.risk_score}</div>
                  </div>
                  <div className="ml-4 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Delta</div>
                    {(() => {
                      const delta = dataB.scan.risk_score - dataA.scan.risk_score;
                      return (
                        <div className={`text-2xl font-mono font-bold ${
                          delta > 0 ? "text-severity-critical" : delta < 0 ? "text-success" : "text-muted-foreground"
                        }`}>
                          {delta > 0 ? `+${delta}` : delta}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Vulnerability changes */}
          {findingDiff && (
            <motion.div variants={fadeInUp} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wider text-severity-critical flex items-center gap-1.5">
                    <Plus className="h-3 w-3" /> New Vulnerabilities ({findingDiff.newVulns.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-60 overflow-y-auto">
                  {findingDiff.newVulns.length === 0 ? (
                    <p className="text-xs text-muted-foreground">None</p>
                  ) : findingDiff.newVulns.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <SeverityBadge severity={f.severity} />
                      <span className="text-xs truncate">{f.title}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wider text-success flex items-center gap-1.5">
                    <Minus className="h-3 w-3" /> Resolved ({findingDiff.resolved.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-60 overflow-y-auto">
                  {findingDiff.resolved.length === 0 ? (
                    <p className="text-xs text-muted-foreground">None</p>
                  ) : findingDiff.resolved.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <SeverityBadge severity={f.severity} />
                      <span className="text-xs truncate line-through text-muted-foreground">{f.title}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3" /> Persistent ({findingDiff.persistent.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-60 overflow-y-auto">
                  {findingDiff.persistent.length === 0 ? (
                    <p className="text-xs text-muted-foreground">None</p>
                  ) : findingDiff.persistent.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <SeverityBadge severity={f.severity} />
                      <span className="text-xs truncate">{f.title}</span>
                    </div>
                  ))}
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
                    <Cpu className="h-3.5 w-3.5 text-primary" /> Technology Changes
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {techDiff.added.map(t => (
                    <span key={t} className="px-2 py-1 rounded-md bg-success/10 text-success text-xs font-mono flex items-center gap-1">
                      <Plus className="h-3 w-3" /> {t}
                    </span>
                  ))}
                  {techDiff.removed.map(t => (
                    <span key={t} className="px-2 py-1 rounded-md bg-destructive/10 text-destructive text-xs font-mono flex items-center gap-1">
                      <Minus className="h-3 w-3" /> {t}
                    </span>
                  ))}
                  {techDiff.unchanged.map(t => (
                    <span key={t} className="px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-mono">{t}</span>
                  ))}
                  {techDiff.added.length === 0 && techDiff.removed.length === 0 && (
                    <span className="text-xs text-muted-foreground">No technology changes detected</span>
                  )}
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
                </CardHeader>
                <CardContent>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {urlDiff.added.length === 0 ? (
                      <p className="text-xs text-muted-foreground">None</p>
                    ) : urlDiff.added.slice(0, 30).map((url, i) => (
                      <div key={i} className="text-xs font-mono text-success/80 truncate">{url}</div>
                    ))}
                    {urlDiff.added.length > 30 && (
                      <div className="text-xs text-muted-foreground">...and {urlDiff.added.length - 30} more</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wider text-destructive flex items-center gap-1.5">
                    <Minus className="h-3 w-3" /> Removed Endpoints ({urlDiff.removed.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {urlDiff.removed.length === 0 ? (
                      <p className="text-xs text-muted-foreground">None</p>
                    ) : urlDiff.removed.slice(0, 30).map((url, i) => (
                      <div key={i} className="text-xs font-mono text-destructive/80 truncate line-through">{url}</div>
                    ))}
                    {urlDiff.removed.length > 30 && (
                      <div className="text-xs text-muted-foreground">...and {urlDiff.removed.length - 30} more</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </>
      )}

      {!scanAId && !scanBId && !loading && (
        <motion.div variants={fadeInUp}>
          <Card className="bg-card border-border">
            <CardContent className="p-12 text-center text-muted-foreground">
              <GitCompareArrows className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm">Select two completed scans above to compare their results</p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
};

export default Compare;
