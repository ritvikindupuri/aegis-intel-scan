import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  getScanSchedules, createScanSchedule, toggleSchedule, deleteSchedule,
  getApiKeys, createApiKey, deleteApiKey,
  type ScanSchedule, type ApiKey,
} from "@/lib/api";
import {
  Calendar, Key, Plus, Trash2, Copy, Clock, Globe, Shield, Loader2,
} from "lucide-react";

const Settings = () => {
  const { toast } = useToast();

  // Schedules state
  const [schedules, setSchedules] = useState<ScanSchedule[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [newFrequency, setNewFrequency] = useState("weekly");
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [addingSchedule, setAddingSchedule] = useState(false);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [creatingKey, setCreatingKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  useEffect(() => {
    loadSchedules();
    loadApiKeys();
  }, []);

  const loadSchedules = async () => {
    try {
      const data = await getScanSchedules();
      setSchedules(data);
    } catch { /* empty */ } finally {
      setLoadingSchedules(false);
    }
  };

  const loadApiKeys = async () => {
    try {
      const data = await getApiKeys();
      setApiKeys(data);
    } catch { /* empty */ } finally {
      setLoadingKeys(false);
    }
  };

  const handleAddSchedule = async () => {
    if (!newDomain.trim()) return;
    setAddingSchedule(true);
    try {
      await createScanSchedule(newDomain.trim(), newFrequency);
      toast({ title: "Schedule created", description: `${newDomain} will be scanned ${newFrequency}` });
      setNewDomain("");
      loadSchedules();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingSchedule(false);
    }
  };

  const handleToggleSchedule = async (id: string, enabled: boolean) => {
    try {
      await toggleSchedule(id, enabled);
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, enabled } : s));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      await deleteSchedule(id);
      setSchedules(prev => prev.filter(s => s.id !== id));
      toast({ title: "Schedule deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    try {
      const result = await createApiKey(newKeyName.trim());
      setRevealedKey(result.key);
      setNewKeyName("");
      loadApiKeys();
      toast({ title: "API key created", description: "Copy your key now — it won't be shown again." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreatingKey(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    try {
      await deleteApiKey(id);
      setApiKeys(prev => prev.filter(k => k.id !== id));
      toast({ title: "API key deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <motion.div
      className="space-y-6 max-w-4xl mx-auto"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div variants={fadeInUp}>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage scheduled scans and API access.</p>
      </motion.div>

      <motion.div variants={fadeInUp}>
        <Tabs defaultValue="schedules">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="schedules" className="gap-2">
              <Calendar className="h-4 w-4" /> Scheduled Scans
            </TabsTrigger>
            <TabsTrigger value="api-keys" className="gap-2">
              <Key className="h-4 w-4" /> API Keys
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedules" className="space-y-4 mt-4">
            {/* Add new schedule */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Add Recurring Scan</h3>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={newDomain}
                    onChange={e => setNewDomain(e.target.value)}
                    placeholder="example.com"
                    className="pl-10 font-mono text-sm"
                  />
                </div>
                <Select value={newFrequency} onValueChange={setNewFrequency}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Biweekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleAddSchedule} disabled={addingSchedule || !newDomain.trim()} className="gap-2">
                  {addingSchedule ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add
                </Button>
              </div>
            </Card>

            {/* Schedule list */}
            {loadingSchedules ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : schedules.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground text-sm">
                No scheduled scans yet. Add one above to automate recurring reconnaissance.
              </Card>
            ) : (
              <div className="space-y-2">
                {schedules.map(s => (
                  <Card key={s.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium truncate">{s.domain}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{s.frequency}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Next: {new Date(s.next_run_at).toLocaleDateString()}
                        </span>
                        {s.last_run_at && (
                          <span>Last: {new Date(s.last_run_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={s.enabled}
                        onCheckedChange={checked => handleToggleSchedule(s.id, checked)}
                      />
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteSchedule(s.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="api-keys" className="space-y-4 mt-4">
            {/* API docs preview */}
            <Card className="p-4 bg-secondary/30 border-dashed">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4" /> REST API Reference
              </h3>
              <div className="text-xs text-muted-foreground space-y-1 font-mono">
                <p><span className="text-emerald-400">POST</span> /api-gateway — Start scan: {`{"domain": "example.com"}`}</p>
                <p><span className="text-blue-400">GET</span> /api-gateway/scan/:id — Get scan details</p>
                <p><span className="text-blue-400">GET</span> /api-gateway/scan/:id/findings — Get findings</p>
                <p><span className="text-blue-400">GET</span> /api-gateway/scans — List recent scans</p>
                <p className="text-muted-foreground/60 mt-2">Header: x-api-key: tl_your_key_here</p>
              </div>
            </Card>

            {/* Create new key */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Generate API Key</h3>
              <div className="flex gap-2">
                <Input
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  placeholder="Key name (e.g. CI/CD Pipeline)"
                  className="text-sm"
                />
                <Button onClick={handleCreateKey} disabled={creatingKey || !newKeyName.trim()} className="gap-2">
                  {creatingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Generate
                </Button>
              </div>
            </Card>

            {/* Revealed key warning */}
            {revealedKey && (
              <Card className="p-4 border-amber-500/30 bg-amber-500/5">
                <p className="text-xs text-amber-400 font-semibold mb-2">⚠️ Copy this key now — it won't be shown again</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono bg-background/50 px-3 py-2 rounded break-all">{revealedKey}</code>
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(revealedKey)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => setRevealedKey(null)}>
                  Dismiss
                </Button>
              </Card>
            )}

            {/* Key list */}
            {loadingKeys ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : apiKeys.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground text-sm">
                No API keys yet. Generate one to enable programmatic access.
              </Card>
            ) : (
              <div className="space-y-2">
                {apiKeys.map(k => (
                  <Card key={k.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Key className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">{k.name}</span>
                        <code className="text-xs text-muted-foreground font-mono">{k.key_prefix}</code>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Created: {new Date(k.created_at).toLocaleDateString()}
                        {k.last_used_at && ` · Last used: ${new Date(k.last_used_at).toLocaleDateString()}`}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteKey(k.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  );
};

export default Settings;