import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getScan, getFindings, generateReport, type Scan, type Finding } from "@/lib/api";
import { SeverityBadge, RiskScoreGauge, StatusBadge } from "@/components/SeverityBadge";
import { Globe, FileCode, Link2, FormInput, Cpu, Shield, Loader2, FileText, AlertTriangle, ExternalLink, RefreshCw, Code } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

const ScanDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [scan, setScan] = useState<Scan | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    if (!id) return;
    try {
      const [s, f] = await Promise.all([getScan(id), getFindings(id)]);
      setScan(s);
      setFindings(f);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  // Poll while not completed
  useEffect(() => {
    if (!scan || scan.status === 'completed' || scan.status === 'failed') return;
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [scan?.status]);

  const handleGenerateReport = async () => {
    if (!id) return;
    setReportLoading(true);
    try {
      const report = await generateReport(id);
      setScan(prev => prev ? { ...prev, ai_report: report } : prev);
      toast({ title: "Report generated" });
    } catch (err: any) {
      toast({ title: "Report failed", description: err.message, variant: "destructive" });
    } finally {
      setReportLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!scan) {
    return <div className="text-center py-20 text-muted-foreground">Scan not found</div>;
  }

  const parsed = scan.parsed_data || {};
  const enrichment = scan.enrichment || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-mono font-bold">{scan.domain}</h1>
            <StatusBadge status={scan.status} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Scanned {formatDistanceToNow(new Date(scan.created_at), { addSuffix: true })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-1">
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
          {scan.status === 'completed' && !scan.ai_report && (
            <Button size="sm" onClick={handleGenerateReport} disabled={reportLoading} className="gap-1">
              {reportLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
              Generate AI Report
            </Button>
          )}
        </div>
      </div>

      {/* Progress for in-progress scans */}
      {(scan.status === 'crawling' || scan.status === 'analyzing') && (
        <Card className="border-primary/30 border-glow">
          <CardContent className="p-6 flex items-center gap-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <div>
              <div className="font-medium">
                {scan.status === 'crawling' ? 'Crawling target...' : 'Analyzing threats...'}
              </div>
              <div className="text-sm text-muted-foreground">This may take a moment</div>
            </div>
          </CardContent>
        </Card>
      )}

      {scan.status === 'failed' && (
        <Card className="border-destructive/30">
          <CardContent className="p-6 text-destructive">
            <AlertTriangle className="h-5 w-5 mb-2" />
            <div className="font-medium">Scan Failed</div>
            <div className="text-sm">{scan.error_message || "Unknown error"}</div>
          </CardContent>
        </Card>
      )}

      {scan.status === 'completed' && (
        <>
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <RiskScoreGauge score={scan.risk_score} />
              </CardContent>
            </Card>
            {[
              { label: "URLs Found", value: scan.urls_found, icon: Link2 },
              { label: "Vulnerabilities", value: scan.vulnerabilities_found, icon: AlertTriangle },
              { label: "Technologies", value: (scan.technologies || []).length, icon: Cpu },
              { label: "JS Files", value: (parsed.jsFiles || []).length, icon: FileCode },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label} className="bg-card border-border">
                <CardContent className="p-4 flex flex-col items-center gap-1">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <div className="text-2xl font-mono font-bold">{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Enrichment */}
          {enrichment.whois && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Domain Enrichment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs block">Registrar</span>
                    <span className="font-mono">{enrichment.whois.registrar}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Hosting</span>
                    <span className="font-mono">{enrichment.hosting?.provider}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">ASN</span>
                    <span className="font-mono">{enrichment.hosting?.asn}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Surface Size</span>
                    <span className="font-mono capitalize">{enrichment.riskFactors?.surfaceSize}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          <Tabs defaultValue="findings" className="space-y-4">
            <TabsList className="bg-secondary">
              <TabsTrigger value="findings" className="gap-1 text-xs">
                <AlertTriangle className="h-3 w-3" /> Findings ({findings.length})
              </TabsTrigger>
              <TabsTrigger value="surface" className="gap-1 text-xs">
                <Globe className="h-3 w-3" /> Attack Surface
              </TabsTrigger>
              <TabsTrigger value="report" className="gap-1 text-xs">
                <FileText className="h-3 w-3" /> AI Report
              </TabsTrigger>
              <TabsTrigger value="raw" className="gap-1 text-xs">
                <Code className="h-3 w-3" /> Raw Data
              </TabsTrigger>
            </TabsList>

            {/* Findings Tab */}
            <TabsContent value="findings">
              {findings.length === 0 ? (
                <Card className="bg-card border-border">
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <Shield className="h-8 w-8 mx-auto mb-2 text-success" />
                    No vulnerabilities detected
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {findings.map(f => (
                    <Card key={f.id} className="bg-card border-border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <SeverityBadge severity={f.severity} />
                              <span className="text-xs text-muted-foreground font-mono">{f.category}</span>
                            </div>
                            <h3 className="font-medium text-sm">{f.title}</h3>
                            <p className="text-xs text-muted-foreground mt-1">{f.description}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Attack Surface Tab */}
            <TabsContent value="surface" className="space-y-4">
              {/* Technologies */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Cpu className="h-4 w-4" /> Technologies
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {(scan.technologies || []).map((t: string) => (
                      <span key={t} className="px-2 py-1 rounded bg-primary/10 text-primary text-xs font-mono">{t}</span>
                    ))}
                    {(scan.technologies || []).length === 0 && <span className="text-xs text-muted-foreground">None detected</span>}
                  </div>
                </CardContent>
              </Card>

              {/* Security Headers */}
              {parsed.securityHeaders && (
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Shield className="h-4 w-4" /> Security Headers
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(parsed.securityHeaders).map(([header, value]) => (
                        <div key={header} className="flex items-center justify-between text-sm">
                          <span className="font-mono text-xs">{header}</span>
                          <span className={`text-xs font-mono ${value === 'Not Set' ? 'text-severity-high' : 'text-success'}`}>
                            {value as string}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* URLs */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Link2 className="h-4 w-4" /> Discovered URLs ({(parsed.urls || []).length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {(parsed.urls || []).slice(0, 50).map((url: string, i: number) => (
                      <div key={i} className="text-xs font-mono text-muted-foreground truncate hover:text-foreground transition-colors flex items-center gap-1">
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        {url}
                      </div>
                    ))}
                    {(parsed.urls || []).length > 50 && (
                      <div className="text-xs text-muted-foreground pt-2">...and {(parsed.urls || []).length - 50} more</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* JS Files */}
              {(parsed.jsFiles || []).length > 0 && (
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <FileCode className="h-4 w-4" /> JavaScript Files ({(parsed.jsFiles || []).length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {(parsed.jsFiles || []).map((f: string, i: number) => (
                        <div key={i} className="text-xs font-mono text-muted-foreground truncate">{f}</div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Forms */}
              {(parsed.forms || []).length > 0 && (
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <FormInput className="h-4 w-4" /> Forms ({(parsed.forms || []).length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(parsed.forms || []).map((form: any, i: number) => (
                        <div key={i} className="p-3 rounded bg-secondary text-xs font-mono">
                          <div><span className="text-muted-foreground">Action:</span> {form.action || '(none)'}</div>
                          <div><span className="text-muted-foreground">Method:</span> {form.method}</div>
                          <div><span className="text-muted-foreground">Inputs:</span> {form.inputs.join(', ')}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* AI Report Tab */}
            <TabsContent value="report">
              {scan.ai_report ? (
                <Card className="bg-card border-border">
                  <CardContent className="p-6 prose prose-invert prose-sm max-w-none">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
                      {scan.ai_report.split('\n').map((line, i) => {
                        if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-foreground mt-6 mb-2">{line.replace('## ', '')}</h2>;
                        if (line.startsWith('### ')) return <h3 key={i} className="text-base font-semibold text-foreground mt-4 mb-1">{line.replace('### ', '')}</h3>;
                        if (line.startsWith('- ')) return <div key={i} className="pl-4 text-muted-foreground">• {line.replace('- ', '')}</div>;
                        if (line.startsWith('**')) return <div key={i} className="font-semibold text-foreground">{line.replace(/\*\*/g, '')}</div>;
                        if (line.trim() === '') return <div key={i} className="h-2" />;
                        return <div key={i} className="text-muted-foreground">{line}</div>;
                      })}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-card border-border">
                  <CardContent className="p-8 text-center">
                    <FileText className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-4">No AI report generated yet.</p>
                    <Button onClick={handleGenerateReport} disabled={reportLoading} className="gap-2">
                      {reportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                      Generate Threat Intelligence Report
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Raw Data Tab */}
            <TabsContent value="raw">
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <pre className="text-xs font-mono text-muted-foreground overflow-auto max-h-96 whitespace-pre-wrap">
                    {JSON.stringify(scan.raw_crawl_data, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default ScanDetail;
