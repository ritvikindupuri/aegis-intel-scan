import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, ShieldCheck, ShieldAlert, ShieldX, Plus, Trash2, Bot, Clock, Globe, BarChart3, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/components/PageTransition";
import { formatDistanceToNow } from "date-fns";
import {
  getBenchmarkEntries, verifyBenchmark, computeBenchmarkMetrics,
  type BenchmarkEntry, type BenchmarkMetrics,
} from "@/lib/api";

interface DomainPolicy {
  id: string;
  domain: string;
  policy_type: string;
  reason: string | null;
  ai_evaluated: boolean;
  created_at: string;
}

interface AuditEntry {
  id: string;
  domain: string;
  action: string;
  reason: string | null;
  created_at: string;
}

const policyColors: Record<string, string> = {
  allow: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  block: "bg-red-500/10 text-red-400 border-red-500/30",
  review: "bg-amber-500/10 text-amber-400 border-amber-500/30",
};

const policyIcons: Record<string, typeof Shield> = {
  allow: ShieldCheck,
  block: ShieldX,
  review: ShieldAlert,
};

const Policies = () => {
  const [policies, setPolicies] = useState<DomainPolicy[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState("");
  const [newPolicy, setNewPolicy] = useState<string>("allow");
  const [newReason, setNewReason] = useState("");
  const { toast } = useToast();

  // Benchmarking state
  const [benchmarks, setBenchmarks] = useState<BenchmarkEntry[]>([]);
  const [metrics, setMetrics] = useState<BenchmarkMetrics | null>(null);
  const [loadingBenchmarks, setLoadingBenchmarks] = useState(true);

  const fetchData = async () => {
    const [policiesRes, auditRes] = await Promise.all([
      supabase.from('domain_policies').select('*').order('created_at', { ascending: false }),
      supabase.from('scan_audit_log').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    setPolicies((policiesRes.data || []) as unknown as DomainPolicy[]);
    setAuditLog((auditRes.data || []) as unknown as AuditEntry[]);
    setLoading(false);
  };

  const fetchBenchmarks = async () => {
    try {
      const entries = await getBenchmarkEntries();
      setBenchmarks(entries);
      setMetrics(computeBenchmarkMetrics(entries));
    } catch { /* empty */ } finally {
      setLoadingBenchmarks(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchBenchmarks();
  }, []);

  const addPolicy = async () => {
    if (!newDomain.trim()) return;
    const clean = newDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('domain_policies').insert({
      domain: clean,
      policy_type: newPolicy,
      reason: newReason || null,
      ai_evaluated: false,
      user_id: user.id,
    });
    if (error) {
      toast({ title: "Error", description: error.message.includes('duplicate') ? "Domain already has a policy" : error.message, variant: "destructive" });
    } else {
      toast({ title: "Policy added", description: `${clean} → ${newPolicy}` });
      setNewDomain(""); setNewReason("");
      fetchData();
    }
  };

  const deletePolicy = async (id: string) => {
    await supabase.from('domain_policies').delete().eq('id', id);
    setPolicies(p => p.filter(x => x.id !== id));
    toast({ title: "Policy removed" });
  };

  const updatePolicy = async (id: string, policy_type: string) => {
    await supabase.from('domain_policies').update({ policy_type }).eq('id', id);
    setPolicies(p => p.map(x => x.id === id ? { ...x, policy_type } : x));
    toast({ title: "Policy updated" });
  };

  const handleVerify = async (id: string, groundTruth: string) => {
    try {
      await verifyBenchmark(id, groundTruth);
      toast({ title: "Benchmark verified" });
      fetchBenchmarks();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const stats = {
    allow: policies.filter(p => p.policy_type === 'allow').length,
    block: policies.filter(p => p.policy_type === 'block').length,
    review: policies.filter(p => p.policy_type === 'review').length,
    aiEvaluated: policies.filter(p => p.ai_evaluated).length,
  };

  const formatPct = (n: number) => `${(n * 100).toFixed(1)}%`;

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="initial" animate="animate">
      <motion.div variants={fadeInUp}>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Domain Policies & Benchmarking
        </h1>
        <p className="text-sm text-muted-foreground mt-1">AI-powered allowlist, abuse prevention controls, and continuous accuracy benchmarking</p>
      </motion.div>

      {/* Stats */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Allowed", value: stats.allow, icon: ShieldCheck, color: "text-emerald-400" },
          { label: "Blocked", value: stats.block, icon: ShieldX, color: "text-red-400" },
          { label: "Under Review", value: stats.review, icon: ShieldAlert, color: "text-amber-400" },
          { label: "AI Evaluated", value: stats.aiEvaluated, icon: Bot, color: "text-primary" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary">
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div>
                <div className="text-lg font-mono font-bold">{value}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <motion.div variants={fadeInUp}>
        <Tabs defaultValue="policies">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="policies" className="gap-2">
              <Globe className="h-4 w-4" /> Policies
            </TabsTrigger>
            <TabsTrigger value="benchmarks" className="gap-2">
              <BarChart3 className="h-4 w-4" /> Benchmarking
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <Clock className="h-4 w-4" /> Audit Log
            </TabsTrigger>
          </TabsList>

          {/* Policies Tab */}
          <TabsContent value="policies" className="space-y-4 mt-4">
            {/* Safe-Scanning Policy Card */}
            <Card className="bg-card border-border border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-primary flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5" /> Safe-Scanning Policy
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                <p>ThreatLens enforces a multi-layered safe-scanning policy to prevent misuse:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><span className="text-foreground/80 font-medium">AI Domain Gatekeeper</span> — Every domain is evaluated by Gemini AI before scanning. Military, critical infrastructure, and healthcare domains are automatically blocked.</li>
                  <li><span className="text-foreground/80 font-medium">Rate Limiting</span> — Each user is limited to {10} scans per day to prevent automated abuse.</li>
                  <li><span className="text-foreground/80 font-medium">Consent Requirement</span> — Users must explicitly acknowledge they have authorization to scan the target domain before each scan.</li>
                  <li><span className="text-foreground/80 font-medium">Immutable Audit Trail</span> — Every domain evaluation (approved, blocked, flagged) is logged and cannot be modified or deleted.</li>
                  <li><span className="text-foreground/80 font-medium">Manual Override</span> — Analysts can manually allow, block, or review domains below. AI decisions can be overridden for operational flexibility.</li>
                  <li><span className="text-foreground/80 font-medium">Continuous Benchmarking</span> — AI policy decisions are tracked and verified against analyst ground truth to measure precision and recall over time.</li>
                </ul>
              </CardContent>
            </Card>

            {/* Add Policy */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Plus className="h-3.5 w-3.5 text-primary" /> Add Manual Policy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={newDomain}
                    onChange={e => setNewDomain(e.target.value)}
                    placeholder="domain.com"
                    className="bg-secondary border-border font-mono text-sm flex-1"
                  />
                  <Select value={newPolicy} onValueChange={setNewPolicy}>
                    <SelectTrigger className="w-[130px] bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="allow">Allow</SelectItem>
                      <SelectItem value="block">Block</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={newReason}
                    onChange={e => setNewReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className="bg-secondary border-border text-sm flex-1"
                  />
                  <Button onClick={addPolicy} disabled={!newDomain.trim()} className="gap-2">
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Policies List */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-primary" /> Domain Policies ({policies.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
                ) : policies.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">No policies yet. The AI agent will create them automatically when domains are scanned.</div>
                ) : (
                  <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                    {policies.map(p => {
                      const Icon = policyIcons[p.policy_type] || Shield;
                      return (
                        <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors group">
                          <div className="flex items-center gap-3 min-w-0">
                            <Icon className={`h-4 w-4 shrink-0 ${p.policy_type === 'allow' ? 'text-emerald-400' : p.policy_type === 'block' ? 'text-red-400' : 'text-amber-400'}`} />
                            <div className="min-w-0">
                              <div className="font-mono text-sm truncate">{p.domain}</div>
                              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                {p.ai_evaluated && <Bot className="h-2.5 w-2.5" />}
                                {p.reason || 'No reason provided'}
                                <span className="opacity-50">· {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className={`text-[10px] ${policyColors[p.policy_type]}`}>
                              {p.policy_type.toUpperCase()}
                            </Badge>
                            <Select value={p.policy_type} onValueChange={(v) => updatePolicy(p.id, v)}>
                              <SelectTrigger className="h-7 w-[90px] text-xs bg-secondary border-border opacity-0 group-hover:opacity-100 transition-opacity">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="allow">Allow</SelectItem>
                                <SelectItem value="block">Block</SelectItem>
                                <SelectItem value="review">Review</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => deletePolicy(p.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Benchmarking Tab */}
          <TabsContent value="benchmarks" className="space-y-4 mt-4">
            {/* Explainer Card */}
            <Card className="bg-card border-border border-primary/20">
              <CardContent className="p-4 text-xs text-muted-foreground space-y-1.5">
                <p className="text-foreground/90 font-medium text-sm">How does AI Benchmarking work?</p>
                <p>Every time the AI evaluates a domain, its decision is logged here. You — the analyst — provide the <span className="text-foreground font-medium">correct answer</span> (ground truth). The system then compares AI decisions against your answers to calculate accuracy.</p>
                <p>This lets the team measure <span className="text-foreground font-medium">how often the AI gets it right</span> and where it makes mistakes, so the scanning policy can be improved over time.</p>
              </CardContent>
            </Card>

            {/* Metrics Overview */}
            {metrics && metrics.verified > 0 && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <BarChart3 className="h-3.5 w-3.5 text-primary" /> AI Performance Scorecard
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Overall accuracy with progress bar */}
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-medium">Overall Accuracy</span>
                      <span className="text-2xl font-mono font-bold text-primary">{formatPct(metrics.accuracy)}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${Math.min(metrics.accuracy * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      The AI agreed with analyst verdicts in <span className="font-mono text-foreground/80">{metrics.verified > 0 ? Math.round(metrics.accuracy * metrics.verified) : 0}</span> out of <span className="font-mono text-foreground/80">{metrics.verified}</span> verified evaluations.
                      {metrics.unverified > 0 && <> There {metrics.unverified === 1 ? 'is' : 'are'} <span className="text-amber-400 font-mono">{metrics.unverified}</span> still awaiting your review.</>}
                    </p>
                  </div>

                  {/* Per-class breakdown — analyst-friendly labels */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Breakdown by Decision Type</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {([
                        { cls: 'allow', label: 'Allow', icon: ShieldCheck, color: 'text-emerald-400', barColor: 'bg-emerald-400', desc: 'Safe domains the AI approved' },
                        { cls: 'block', label: 'Block', icon: ShieldX, color: 'text-red-400', barColor: 'bg-red-400', desc: 'Dangerous domains the AI rejected' },
                        { cls: 'review', label: 'Review', icon: ShieldAlert, color: 'text-amber-400', barColor: 'bg-amber-400', desc: 'Ambiguous domains flagged for review' },
                      ] as const).map(({ cls, label, icon: Icon, color, barColor, desc }) => {
                        const prec = metrics.precision[cls];
                        const rec = metrics.recall[cls];
                        return (
                          <div key={cls} className="p-3 rounded-lg bg-secondary/30 space-y-2.5">
                            <div className="flex items-center gap-2">
                              <Icon className={`h-4 w-4 ${color}`} />
                              <span className="text-sm font-medium">{label}</span>
                            </div>
                            <div className="space-y-1.5">
                              <div>
                                <div className="flex justify-between text-[11px] mb-0.5">
                                  <span className="text-muted-foreground" title="When AI says this, how often is it correct?">Precision <span className="opacity-60">(correctness)</span></span>
                                  <span className="font-mono text-foreground/80">{formatPct(prec)}</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                                  <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${Math.min(prec * 100, 100)}%` }} />
                                </div>
                              </div>
                              <div>
                                <div className="flex justify-between text-[11px] mb-0.5">
                                  <span className="text-muted-foreground" title="Of all domains that should be this, how many did the AI catch?">Recall <span className="opacity-60">(coverage)</span></span>
                                  <span className="font-mono text-foreground/80">{formatPct(rec)}</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                                  <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${Math.min(rec * 100, 100)}%` }} />
                                </div>
                              </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-relaxed">{desc}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Confusion matrix — with analyst-friendly header */}
                   <div className="space-y-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Where does the AI get it wrong?</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
                      <span>📊 <strong className="text-foreground/80">Rows</strong> = AI's decision</span>
                      <span className="hidden sm:inline text-border">|</span>
                      <span>📋 <strong className="text-foreground/80">Columns</strong> = Analyst's verdict</span>
                      <span className="hidden sm:inline text-border">|</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500/20 border border-emerald-500/40" />
                        <span className="text-emerald-400">Correct</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500/20 border border-red-500/40" />
                        <span className="text-red-400">Mistake</span>
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="text-xs w-full">
                        <thead>
                          <tr>
                            <th className="text-left p-2 text-muted-foreground font-medium">AI decided ↓ \ Correct answer →</th>
                            {['Allow', 'Block', 'Review'].map(gt => (
                              <th key={gt} className="p-2 text-center text-muted-foreground font-medium">{gt}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {['allow', 'block', 'review'].map(ai => (
                            <tr key={ai} className="border-t border-border/30">
                              <td className="p-2 font-medium capitalize">{ai}</td>
                              {['allow', 'block', 'review'].map(gt => {
                                const val = metrics.confusionMatrix[ai]?.[gt] || 0;
                                const isCorrect = ai === gt;
                                return (
                                  <td key={gt} className={`p-2 text-center font-mono text-sm ${isCorrect && val > 0 ? 'text-emerald-400 font-bold bg-emerald-400/5' : val > 0 ? 'text-red-400 font-semibold bg-red-400/5' : 'text-muted-foreground/30'}`}>
                                    {val}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Show empty state when no verifications yet */}
            {metrics && metrics.verified === 0 && (
              <Card className="bg-card border-border border-dashed border-amber-500/30">
                <CardContent className="p-6 text-center space-y-2">
                  <BarChart3 className="h-8 w-8 text-amber-400 mx-auto" />
                  <p className="text-sm font-medium">No accuracy data yet</p>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Verify at least one AI evaluation below by clicking the correct decision. Once you do, precision, recall, and accuracy metrics will appear here.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Pending verifications */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> AI Evaluations — Verify Ground Truth
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  Each row represents an AI domain policy decision. Set the correct "ground truth" label to track precision/recall over time.
                </p>
                {loadingBenchmarks ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
                ) : benchmarks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No AI evaluations yet. Scan a domain to generate benchmark entries automatically.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                    {benchmarks.map(b => (
                      <div key={b.id} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors group">
                        <div className="flex items-center gap-3 min-w-0">
                          <Bot className="h-3.5 w-3.5 text-primary shrink-0" />
                          <div className="min-w-0">
                            <div className="font-mono text-sm truncate">{b.domain}</div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                              AI said: <Badge variant="outline" className={`text-[9px] ml-1 ${policyColors[b.ai_policy]}`}>{b.ai_policy.toUpperCase()}</Badge>
                              {b.ground_truth && (
                                <>
                                  <span className="mx-1">→ Verified:</span>
                                  <Badge variant="outline" className={`text-[9px] ${policyColors[b.ground_truth]}`}>{b.ground_truth.toUpperCase()}</Badge>
                                  <CheckCircle2 className="h-3 w-3 text-emerald-400 ml-1" />
                                </>
                              )}
                              <span className="opacity-50 ml-1">· {formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}</span>
                            </div>
                          </div>
                        </div>
                        {!b.ground_truth && (
                          <div className="flex items-center gap-1 shrink-0">
                            {['allow', 'block', 'review'].map(gt => (
                              <Button
                                key={gt}
                                variant="outline"
                                size="sm"
                                className={`h-6 text-[10px] px-2 ${gt === b.ai_policy ? 'border-primary/40' : ''}`}
                                onClick={() => handleVerify(b.id, gt)}
                              >
                                {gt}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit" className="space-y-4 mt-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-primary" /> Scan Audit Log
                </CardTitle>
              </CardHeader>
              <CardContent>
                {auditLog.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">No scan attempts logged yet.</div>
                ) : (
                  <div className="space-y-1 max-h-[400px] overflow-y-auto">
                    {auditLog.map(entry => (
                      <div key={entry.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/30 transition-colors text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${entry.action === 'approved' ? 'bg-emerald-400' : entry.action === 'blocked' ? 'bg-red-400' : 'bg-amber-400'}`} />
                          <span className="font-mono truncate">{entry.domain}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-muted-foreground max-w-[200px] truncate">{entry.reason}</span>
                          <Badge variant="outline" className={`text-[9px] ${entry.action === 'approved' ? policyColors.allow : entry.action === 'blocked' ? policyColors.block : policyColors.review}`}>
                            {entry.action.toUpperCase()}
                          </Badge>
                          <span className="text-muted-foreground opacity-50">{formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  );
};

export default Policies;
