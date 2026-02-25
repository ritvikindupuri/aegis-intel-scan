import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { startScan } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export function ScanForm({ onScanStarted }: { onScanStarted?: () => void }) {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) return;

    setLoading(true);
    try {
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
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-xl">
      <div className="relative flex-1">
        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={domain}
          onChange={e => setDomain(e.target.value)}
          placeholder="Enter domain (e.g. example.com)"
          className="pl-10 bg-secondary border-border font-mono text-sm h-10"
          disabled={loading}
        />
      </div>
      <Button type="submit" disabled={loading || !domain.trim()} className="gap-2 h-10 px-5">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        {loading ? "Scanning..." : "Scan"}
      </Button>
    </form>
  );
}
