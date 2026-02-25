import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Globe, Loader2, ShieldAlert, ShieldX, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { startScan, evaluateDomain } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

export function ScanForm({ onScanStarted }: { onScanStarted?: () => void }) {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [policyStatus, setPolicyStatus] = useState<{ policy: string; reason: string } | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) return;

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
      navigate(`/scan/${scanId}`);
    } catch (err: any) {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
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
