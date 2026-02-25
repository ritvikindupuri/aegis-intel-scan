import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { getScans, deleteScan, type Scan } from "@/lib/api";
import { StatusBadge } from "@/components/SeverityBadge";
import { Globe, ArrowRight, Clock, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/components/PageTransition";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

const History = () => {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    getScans().then(setScans).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string, domain: string) => {
    setDeleting(id);
    try {
      await deleteScan(id);
      setScans((prev) => prev.filter((s) => s.id !== id));
      toast({ title: "Scan deleted", description: `Removed scan for ${domain}` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="initial" animate="animate">
      <motion.div variants={fadeInUp}>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Scan History
        </h1>
        <p className="text-sm text-muted-foreground mt-1">All previous reconnaissance scans</p>
      </motion.div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : scans.length === 0 ? (
        <motion.div variants={fadeInUp}>
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center text-muted-foreground">
              No scans yet. <Link to="/scan" className="text-primary hover:underline">Start one</Link>.
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {scans.map((scan, i) => (
            <motion.div
              key={scan.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
            >
              <Card className="bg-card border-border hover:border-primary/30 transition-all duration-200 card-hover">
                <CardContent className="p-4 flex items-center justify-between">
                  <Link to={`/scan/${scan.id}`} className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer">
                    <div className="p-1.5 rounded-md bg-secondary">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-mono text-sm truncate">{scan.domain}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(scan.created_at), { addSuffix: true })} · {scan.urls_found} URLs · {scan.vulnerabilities_found} findings
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={scan.status} />
                    {scan.status === 'completed' && (
                      <span className={`font-mono text-sm font-bold ${
                        scan.risk_score >= 75 ? "text-severity-critical" :
                        scan.risk_score >= 50 ? "text-severity-high" :
                        scan.risk_score >= 25 ? "text-severity-medium" : "text-severity-low"
                      }`}>{scan.risk_score}</span>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={(e) => e.stopPropagation()}
                          disabled={deleting === scan.id}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete scan?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the scan for <span className="font-mono font-semibold text-foreground">{scan.domain}</span> and all its findings. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(scan.id, scan.domain)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default History;
