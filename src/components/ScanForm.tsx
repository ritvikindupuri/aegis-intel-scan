import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Globe, Loader2, ShieldAlert, ShieldX, ShieldCheck, Gauge, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { startScan, evaluateDomain, getUserQuota } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

export function ScanForm({ onScanStarted }: { onScanStarted?: () => void }) {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [policyStatus, setPolicyStatus] = useState<{ policy: string; reason: string } | null>(null);
  const [quota, setQuota] = useState<{ scansToday: number; dailyLimit: number } | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    getUserQuota().then(setQuota);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) return;

    if (!consentGiven) {
      toast({
        title: "Consent required",
        description: "You must acknowledge the safe-scanning policy before initiating a scan.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setPolicyStatus(null);

    try {
      // Step 1: Evaluate domain policy
      const evaluation = await evaluateDomain(domain.trim());
      setPolicyStatus({ policy: evaluation.policy, reason: evaluation.reason });

      if (!evaluation.allowed) {
        const isBlocked = evaluation.policy === 'block';
        toast({
          title: isBlocked ? "Domain Blocked" : "Domain Under Review",
          description: isBlocked 
            ? evaluation.reason 
            : `${evaluation.reason}`,
          variant: "destructive",
          duration: 8000,
          action: (
            <ToastAction altText="Go to Policies" onClick={() => navigate("/policies")}>
              Go to Policies
            </ToastAction>
          ),
        });
        setLoading(false);
        return;
      }

      // Step 2: Proceed with scan
      const { scanId } = await startScan(domain.trim());
      toast({ title: "Scan initiated", description: `Crawling ${domain}...` });
      onScanStarted?.();
      // Refresh quota after scan
      getUserQuota().then(setQuota);
      navigate(`/scan/${scanId}`);
    } catch (err: any) {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
      // Refresh quota in case it was a rate limit error
      getUserQuota().then(setQuota);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl space-y-2">
      <form onSubmit={handleSubmit} className="flex gap-2 w-full">
        <div className="relative flex-1">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={domain}
            onChange={e => { setDomain(e.target.value); setPolicyStatus(null); }}
            placeholder="Enter domain (e.g. example.com)"
            className="pl-10 bg-secondary border-border font-mono text-sm h-10"
            disabled={loading}
          />
        </div>
        <Button type="submit" disabled={loading || !domain.trim()} className="gap-2 h-10 px-5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? "Evaluating..." : "Scan"}
        </Button>
      </form>

      {/* Safe-Scanning Consent */}
      <div className="flex items-start gap-2 px-1">
        <Checkbox
          id="scan-consent"
          checked={consentGiven}
          onCheckedChange={(checked) => setConsentGiven(checked === true)}
          className="mt-0.5"
        />
        <label htmlFor="scan-consent" className="text-[11px] text-muted-foreground leading-tight cursor-pointer select-none">
          <span className="font-medium text-foreground/70">Safe-Scanning Policy:</span>{" "}
          I confirm I have authorization to scan this domain and will use results only for legitimate security assessment.
          Scans are rate-limited to {quota?.dailyLimit ?? 10}/day and subject to{" "}
          <button
            type="button"
            onClick={() => navigate("/policies")}
            className="text-primary hover:underline font-medium"
          >
            AI domain policy review
          </button>.
        </label>
      </div>

      {quota && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <Gauge className="h-3 w-3" />
          <span>
            {quota.scansToday}/{quota.dailyLimit} scans used today
          </span>
          {quota.scansToday >= quota.dailyLimit && (
            <span className="text-destructive font-medium ml-1">— Limit reached</span>
          )}
        </div>
      )}

      {policyStatus && (
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
          policyStatus.policy === 'allow' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' :
          policyStatus.policy === 'block' ? 'bg-red-500/5 border-red-500/20 text-red-400' :
          'bg-amber-500/5 border-amber-500/20 text-amber-400'
        }`}>
          {policyStatus.policy === 'allow' ? <ShieldCheck className="h-3.5 w-3.5 shrink-0" /> :
           policyStatus.policy === 'block' ? <ShieldX className="h-3.5 w-3.5 shrink-0" /> :
           <ShieldAlert className="h-3.5 w-3.5 shrink-0" />}
          <span>{policyStatus.reason}</span>
        </div>
      )}
    </div>
  );
}
