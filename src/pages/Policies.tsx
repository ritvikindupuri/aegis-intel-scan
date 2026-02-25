import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldCheck, ShieldAlert, ShieldX, Plus, Trash2, Bot, Clock, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/components/PageTransition";
import { formatDistanceToNow } from "date-fns";

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

  const fetchData = async () => {
    const [policiesRes, auditRes] = await Promise.all([
      supabase.from('domain_policies').select('*').order('created_at', { ascending: false }),
      supabase.from('scan_audit_log').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    setPolicies((policiesRes.data || []) as unknown as DomainPolicy[]);
    setAuditLog((auditRes.data || []) as unknown as AuditEntry[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

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

  const stats = {
    allow: policies.filter(p => p.policy_type === 'allow').length,
    block: policies.filter(p => p.policy_type === 'block').length,
    review: policies.filter(p => p.policy_type === 'review').length,
    aiEvaluated: policies.filter(p => p.ai_evaluated).length,
  };

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="initial" animate="animate">
      <motion.div variants={fadeInUp}>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Domain Policies
        </h1>
        <p className="text-sm text-muted-foreground mt-1">AI-powered allowlist to prevent misuse of scanning capabilities</p>
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

      {/* Add Policy */}
      <motion.div variants={fadeInUp}>
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
      </motion.div>

      {/* Policies List */}
      <motion.div variants={fadeInUp}>
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
      </motion.div>

      {/* Audit Log */}
      <motion.div variants={fadeInUp}>
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
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
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
      </motion.div>
    </motion.div>
  );
};

export default Policies;
