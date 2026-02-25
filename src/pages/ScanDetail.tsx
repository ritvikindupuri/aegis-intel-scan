import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getScan, getFindings, generateReport, type Scan, type Finding } from "@/lib/api";
import { SeverityBadge, RiskScoreGauge, StatusBadge } from "@/components/SeverityBadge";
import { RiskScoreBreakdown } from "@/components/RiskScoreBreakdown";
import { exportReportAsPdf } from "@/lib/pdf-export";
import { Globe, FileCode, Link2, FormInput, Cpu, Shield, Loader2, FileText, AlertTriangle, ExternalLink, RefreshCw, Code, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/components/PageTransition";

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

  const handleExportPdf = () => {
    if (!scan) return;
    try {
      exportReportAsPdf(scan, findings);
      toast({ title: "PDF exported", description: "Report downloaded successfully." });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
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
    <motion.div className="space-y-6" variants={staggerContainer} initial="initial" animate="animate">
      {/* Header */}
      <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
          {scan.status === 'completed' && (
            <Button variant="outline" size="sm" onClick={handleExportPdf} className="gap-1">
              <Download className="h-3 w-3" /> Export PDF
            </Button>
          )}
          {scan.status === 'completed' && !scan.ai_report && (
            <Button size="sm" onClick={handleGenerateReport} disabled={reportLoading} className="gap-1">
              {reportLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
              Generate AI Report
            </Button>
          )}
        </div>
      </motion.div>

      {/* Progress for in-progress scans */}
      {(scan.status === 'crawling' || scan.status === 'analyzing') && (
        <motion.div variants={fadeInUp}>
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
        </motion.div>
      )}

      {scan.status === 'failed' && (
        <motion.div variants={fadeInUp}>
          <Card className="border-destructive/30">
            <CardContent className="p-6 text-destructive">
              <AlertTriangle className="h-5 w-5 mb-2" />
              <div className="font-medium">Scan Failed</div>
              <div className="text-sm">{scan.error_message || "Unknown error"}</div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {scan.status === 'completed' && (
        <>
          {/* Stats Row */}
          <motion.div variants={fadeInUp} className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
          </motion.div>

          {/* Risk Score Breakdown */}
          <motion.div variants={fadeInUp}>
            <RiskScoreBreakdown score={scan.risk_score} findings={findings} />
          </motion.div>

          {/* Enrichment */}
          {enrichment.whois && (
            <motion.div variants={fadeInUp}>
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
            </motion.div>
          )}

          {/* Tabs */}
          <motion.div variants={fadeInUp}>
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
                    {findings.map((f, i) => (
                      <motion.div
                        key={f.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.25 }}
                      >
                        <Card className="bg-card border-border">
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
                      </motion.div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Attack Surface Tab */}
              <TabsContent value="surface" className="space-y-4">
                {/* Surface overview stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Endpoints", value: (parsed.endpoints || parsed.urls || []).length, icon: Link2, desc: "Discovered paths" },
                    { label: "JS Files", value: (parsed.jsFiles || []).length, icon: FileCode, desc: "Client-side scripts" },
                    { label: "Forms", value: (parsed.forms || []).length, icon: FormInput, desc: "Input vectors" },
                    { label: "External Deps", value: (parsed.externalDependencies || []).length, icon: ExternalLink, desc: "Third-party resources" },
                  ].map(({ label, value, icon: Icon, desc }) => (
                    <Card key={label} className="bg-card border-border">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-secondary">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="text-lg font-mono font-bold">{value}</div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{desc}</div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Technologies with categories */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xs font-medium flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                      <Cpu className="h-3.5 w-3.5 text-primary" /> Technology Stack
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(scan.technologies || []).length === 0 ? (
                      <span className="text-xs text-muted-foreground">None detected</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {(scan.technologies || []).map((t: string) => (
                          <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-mono border border-primary/20">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
                      Technologies are fingerprinted from response headers, meta tags, JavaScript libraries, and HTML patterns. Known CVEs for detected versions should be cross-referenced.
                    </p>
                  </CardContent>
                </Card>

                {/* Security Headers - enhanced */}
                {parsed.securityHeaders && (
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xs font-medium flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                        <Shield className="h-3.5 w-3.5 text-primary" /> Security Headers
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        {Object.entries(parsed.securityHeaders).map(([header, value]) => {
                          const isSet = value !== 'Not Set';
                          return (
                            <div key={header} className={`flex items-center justify-between text-sm py-1.5 px-3 rounded-md ${isSet ? 'bg-success/5' : 'bg-destructive/5'}`}>
                              <div className="flex items-center gap-2">
                                <div className={`h-1.5 w-1.5 rounded-full ${isSet ? 'bg-success' : 'bg-destructive'}`} />
                                <span className="font-mono text-xs">{header}</span>
                              </div>
                              <span className={`text-xs font-mono ${isSet ? 'text-success' : 'text-destructive'}`}>
                                {isSet ? (value as string).substring(0, 40) + ((value as string).length > 40 ? '…' : '') : 'Missing'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
                        Missing security headers expose the application to clickjacking, XSS, MIME sniffing, and protocol downgrade attacks.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Discovered URLs */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xs font-medium flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                      <Link2 className="h-3.5 w-3.5 text-primary" /> Discovered Endpoints ({(parsed.urls || []).length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-48 overflow-y-auto space-y-0.5 rounded-lg bg-secondary/30 p-2">
                      {(parsed.urls || []).slice(0, 50).map((url: string, i: number) => (
                        <div key={i} className="text-xs font-mono text-muted-foreground truncate hover:text-foreground transition-colors py-0.5 px-2 rounded hover:bg-secondary/60 flex items-center gap-1.5">
                          <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-50" />
                          {url}
                        </div>
                      ))}
                      {(parsed.urls || []).length > 50 && (
                        <div className="text-[11px] text-muted-foreground pt-2 px-2">+ {(parsed.urls || []).length - 50} additional endpoints</div>
                      )}
                    </div>
                    {(parsed.urls || []).length === 0 && <span className="text-xs text-muted-foreground">No endpoints discovered</span>}
                  </CardContent>
                </Card>

                {/* JS Files & Forms side by side */}
                <div className="grid md:grid-cols-2 gap-4">
                  {(parsed.jsFiles || []).length > 0 && (
                    <Card className="bg-card border-border">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xs font-medium flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                          <FileCode className="h-3.5 w-3.5 text-primary" /> JavaScript Files ({(parsed.jsFiles || []).length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="max-h-40 overflow-y-auto space-y-0.5 rounded-lg bg-secondary/30 p-2">
                          {(parsed.jsFiles || []).map((f: string, i: number) => (
                            <div key={i} className="text-xs font-mono text-muted-foreground truncate py-0.5 px-2 hover:text-foreground rounded hover:bg-secondary/60">{f}</div>
                          ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-2">Client-side scripts may expose API keys, internal routes, or debug endpoints.</p>
                      </CardContent>
                    </Card>
                  )}

                  {(parsed.forms || []).length > 0 && (
                    <Card className="bg-card border-border">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xs font-medium flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                          <FormInput className="h-3.5 w-3.5 text-primary" /> Input Vectors ({(parsed.forms || []).length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {(parsed.forms || []).map((form: any, i: number) => (
                            <div key={i} className="p-2.5 rounded-lg bg-secondary/40 border border-border text-xs font-mono space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground text-[10px] uppercase">Action</span>
                                <span className="text-foreground">{form.action || '(self)'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${form.method?.toUpperCase() === 'POST' ? 'bg-accent/20 text-accent' : 'bg-primary/20 text-primary'}`}>
                                  {form.method || 'GET'}
                                </span>
                                <span className="text-muted-foreground">{form.inputs?.join(', ')}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-2">Forms are potential injection points for XSS, SQLi, and CSRF attacks.</p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* External Dependencies */}
                {(parsed.externalDependencies || []).length > 0 && (
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xs font-medium flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                        <ExternalLink className="h-3.5 w-3.5 text-primary" /> External Dependencies ({(parsed.externalDependencies || []).length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-40 overflow-y-auto space-y-0.5 rounded-lg bg-secondary/30 p-2">
                        {(parsed.externalDependencies || []).slice(0, 30).map((dep: string, i: number) => (
                          <div key={i} className="text-xs font-mono text-muted-foreground truncate py-0.5 px-2 hover:text-foreground rounded hover:bg-secondary/60">{dep}</div>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-2">Third-party dependencies increase supply chain attack surface. Verify integrity with SRI hashes.</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* AI Report Tab */}
              <TabsContent value="report">
                {scan.ai_report ? (
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={handleExportPdf} className="gap-1">
                        <Download className="h-3 w-3" /> Download PDF
                      </Button>
                    </div>
                    <Card className="bg-card border-border">
                      <CardContent className="p-6 prose prose-invert prose-sm max-w-none">
                        <div className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
                          {scan.ai_report.split('\n').map((line, i) => {
                            if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-foreground mt-6 mb-2">{line.replace('## ', '').replace(/^\d+\.\s*/, '')}</h2>;
                            if (line.startsWith('### ')) return <h3 key={i} className="text-base font-semibold text-foreground mt-4 mb-1">{line.replace('### ', '').replace(/^\d+\.\d+\s*/, '')}</h3>;
                            if (line.startsWith('- ') || line.startsWith('* ')) return <div key={i} className="pl-4 text-muted-foreground">• {line.replace(/^[-*]\s*/, '').replace(/\*\*/g, '')}</div>;
                            if (line.startsWith('**')) return <div key={i} className="font-semibold text-foreground">{line.replace(/\*\*/g, '')}</div>;
                            if (line.startsWith('---')) return <hr key={i} className="border-border my-4" />;
                            if (line.startsWith('*') && line.endsWith('*')) return <div key={i} className="text-xs text-muted-foreground italic">{line.replace(/\*/g, '')}</div>;
                            if (line.trim() === '') return <div key={i} className="h-2" />;
                            return <div key={i} className="text-muted-foreground">{line.replace(/\*\*/g, '')}</div>;
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
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
          </motion.div>
        </>
      )}
    </motion.div>
  );
};

export default ScanDetail;
