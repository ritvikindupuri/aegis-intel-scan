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
  getElasticsearchConfig, saveElasticsearchConfig, deleteElasticsearchConfig,
  type ScanSchedule, type ApiKey, type UserElasticsearchConfig,
} from "@/lib/api";
import {
  Calendar, Key, Plus, Trash2, Copy, Clock, Globe, Shield, Loader2, Database, Eye, EyeOff, CheckCircle2,
} from "lucide-react";

const ApiExample = ({ label, code, onCopy }: { label: string; code: string; onCopy: (t: string) => void }) => (
  <div className="mb-3">
    <p className="text-xs text-muted-foreground mb-1">{label}</p>
    <div className="relative group">
      <pre className="text-xs font-mono bg-background/60 border border-border/50 rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all">{code}</pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-1.5 right-1.5 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onCopy(code)}
      >
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  </div>
);

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

  // Elasticsearch config state
  const [esConfig, setEsConfig] = useState<UserElasticsearchConfig | null>(null);
  const [loadingEs, setLoadingEs] = useState(true);
  const [savingEs, setSavingEs] = useState(false);
  const [esUrl, setEsUrl] = useState("");
  const [esUsername, setEsUsername] = useState("");
  const [esPassword, setEsPassword] = useState("");
  const [esEnabled, setEsEnabled] = useState(true);
  const [showEsPassword, setShowEsPassword] = useState(false);

  useEffect(() => {
    loadSchedules();
    loadApiKeys();
    loadEsConfig();
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

  const loadEsConfig = async () => {
    try {
      const config = await getElasticsearchConfig();
      setEsConfig(config);
      if (config) {
        setEsUrl(config.elasticsearch_url);
        setEsUsername(config.elasticsearch_username);
        setEsPassword(config.elasticsearch_password);
        setEsEnabled(config.enabled);
      }
    } catch { /* empty */ } finally {
      setLoadingEs(false);
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

  const handleSaveEsConfig = async () => {
    if (!esUrl.trim() || !esUsername.trim() || !esPassword.trim()) {
      toast({ title: "Missing fields", description: "All Elasticsearch fields are required.", variant: "destructive" });
      return;
    }
    setSavingEs(true);
    try {
      await saveElasticsearchConfig({
        elasticsearch_url: esUrl.trim(),
        elasticsearch_username: esUsername.trim(),
        elasticsearch_password: esPassword.trim(),
        enabled: esEnabled,
      });
      await loadEsConfig();
      toast({ title: "Elasticsearch configured", description: "Your cluster settings have been saved. New scans will sync automatically." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingEs(false);
    }
  };

  const handleDeleteEsConfig = async () => {
    try {
      await deleteElasticsearchConfig();
      setEsConfig(null);
      setEsUrl("");
      setEsUsername("");
      setEsPassword("");
      setEsEnabled(true);
      toast({ title: "Elasticsearch disconnected", description: "Your cluster configuration has been removed." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
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
        <p className="text-muted-foreground text-sm mt-1">Manage scheduled scans, API access, and integrations.</p>
      </motion.div>

      <motion.div variants={fadeInUp}>
        <Tabs defaultValue="schedules">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="schedules" className="gap-2">
              <Calendar className="h-4 w-4" /> Schedules
            </TabsTrigger>
            <TabsTrigger value="api-keys" className="gap-2">
              <Key className="h-4 w-4" /> API Keys
            </TabsTrigger>
            <TabsTrigger value="elasticsearch" className="gap-2">
              <Database className="h-4 w-4" /> Elasticsearch
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
            {/* About section */}
            <Card className="p-5 bg-secondary/20 border-dashed">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Shield className="h-4 w-4 text-primary" /> Programmatic API Access
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                The ThreatLens REST API lets you integrate security scanning into your existing workflows —
                CI/CD pipelines, automation scripts, SIEMs, or custom dashboards. Generate an API key below,
                then use it to trigger scans, retrieve results, and pull findings without ever opening the web UI.
                All requests are authenticated via the <code className="text-foreground/80 bg-secondary px-1 py-0.5 rounded">x-api-key</code> header.
              </p>

              <h4 className="text-xs font-semibold text-foreground/80 mb-2">Available Endpoints</h4>
              <div className="text-xs text-muted-foreground space-y-1.5 font-mono mb-4">
                <p><span className="text-emerald-400 font-semibold">POST</span> /api-gateway — Start a new scan for a domain</p>
                <p><span className="text-blue-400 font-semibold">GET</span>&nbsp; /api-gateway/scan/:id — Retrieve scan details (status, risk score, technologies)</p>
                <p><span className="text-blue-400 font-semibold">GET</span>&nbsp; /api-gateway/scan/:id/findings — List all findings for a scan (CVEs, misconfigs, etc.)</p>
                <p><span className="text-blue-400 font-semibold">GET</span>&nbsp; /api-gateway/scans — List your recent scans (supports <code className="text-foreground/60">?limit=</code> query param)</p>
              </div>

              <h4 className="text-xs font-semibold text-foreground/80 mb-2">Example Usage</h4>
              <ApiExample
                label="1. Start a scan:"
                code={`curl -X POST https://vlyjdhbblbqeqrdaxglc.supabase.co/functions/v1/api-gateway/scan \\\n  -H "Content-Type: application/json" \\\n  -H "x-api-key: tl_your_key_here" \\\n  -d '${JSON.stringify({ domain: "example.com" })}'`}
                onCopy={copyToClipboard}
              />
              <ApiExample
                label="2. Get scan results:"
                code={`curl -H "x-api-key: tl_your_key_here" \\\n  https://vlyjdhbblbqeqrdaxglc.supabase.co/functions/v1/api-gateway/scan/SCAN_ID_HERE`}
                onCopy={copyToClipboard}
              />
              <ApiExample
                label="3. Fetch findings (CVEs, misconfigurations):"
                code={`curl -H "x-api-key: tl_your_key_here" \\\n  https://vlyjdhbblbqeqrdaxglc.supabase.co/functions/v1/api-gateway/scan/SCAN_ID_HERE/findings`}
                onCopy={copyToClipboard}
              />

              <div className="mt-4 p-3 rounded-md bg-primary/5 border border-primary/10">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-primary">Permissions:</span> Each key is granted <code className="bg-secondary px-1 py-0.5 rounded text-foreground/70">scan:create</code>, <code className="bg-secondary px-1 py-0.5 rounded text-foreground/70">scan:read</code>, and <code className="bg-secondary px-1 py-0.5 rounded text-foreground/70">findings:read</code> by default. Keys are hashed with SHA-256 — we never store the raw key.
                </p>
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

          <TabsContent value="elasticsearch" className="space-y-4 mt-4">
            {/* Info card */}
            <Card className="p-5 bg-secondary/20 border-dashed">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Database className="h-4 w-4 text-primary" /> Elasticsearch Integration
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Connect your own Elastic Cloud cluster to enable full-text search across all findings,
                Kibana dashboards for threat analytics, and automatic sync of scan results. Your credentials
                are stored securely and used exclusively for your account. Each user maintains their own
                independent Elasticsearch cluster — no data is shared between accounts.
              </p>
            </Card>

            {/* Config form */}
            {loadingEs ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Cluster Configuration</h3>
                  {esConfig && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      <span className="text-xs text-success font-medium">Connected</span>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Elasticsearch URL</label>
                    <Input
                      value={esUrl}
                      onChange={e => setEsUrl(e.target.value)}
                      placeholder="https://your-cluster.es.us-central1.gcp.cloud.es.io:443"
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Username</label>
                      <Input
                        value={esUsername}
                        onChange={e => setEsUsername(e.target.value)}
                        placeholder="elastic"
                        className="font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Password</label>
                      <div className="relative">
                        <Input
                          type={showEsPassword ? "text" : "password"}
                          value={esPassword}
                          onChange={e => setEsPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="font-mono text-sm pr-10"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full w-10"
                          onClick={() => setShowEsPassword(!showEsPassword)}
                        >
                          {showEsPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <p className="text-sm font-medium">Enable sync</p>
                      <p className="text-xs text-muted-foreground">Automatically sync completed scans to your cluster</p>
                    </div>
                    <Switch checked={esEnabled} onCheckedChange={setEsEnabled} />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    onClick={handleSaveEsConfig}
                    disabled={savingEs || !esUrl.trim() || !esUsername.trim() || !esPassword.trim()}
                    className="gap-2"
                  >
                    {savingEs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                    {esConfig ? "Update Configuration" : "Connect Cluster"}
                  </Button>
                  {esConfig && (
                    <Button variant="outline" className="gap-2 text-destructive hover:text-destructive" onClick={handleDeleteEsConfig}>
                      <Trash2 className="h-4 w-4" />
                      Disconnect
                    </Button>
                  )}
                </div>
              </Card>
            )}

            {/* Setup guide */}
            <Card className="p-5 bg-secondary/10">
              <h4 className="text-xs font-semibold text-foreground/80 mb-3">Setup Guide</h4>
              <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Create a free Elastic Cloud account at <code className="text-foreground/70 bg-secondary px-1 py-0.5 rounded">cloud.elastic.co</code></li>
                <li>Create a deployment — any region works. The free tier is sufficient for getting started.</li>
                <li>Copy the <strong className="text-foreground/80">Elasticsearch endpoint URL</strong> from your deployment details.</li>
                <li>Use the <strong className="text-foreground/80">elastic</strong> superuser credentials, or create a dedicated API user.</li>
                <li>Paste the credentials above and click <strong className="text-foreground/80">Connect Cluster</strong>.</li>
                <li>Run a scan — data will automatically sync to your three indices: <code className="text-foreground/70 bg-secondary px-1 py-0.5 rounded">threatlens-scans</code>, <code className="text-foreground/70 bg-secondary px-1 py-0.5 rounded">threatlens-findings</code>, <code className="text-foreground/70 bg-secondary px-1 py-0.5 rounded">threatlens-audit</code>.</li>
                <li>Open Kibana from your Elastic Cloud dashboard to build visualizations and alerts.</li>
              </ol>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  );
};

export default Settings;
