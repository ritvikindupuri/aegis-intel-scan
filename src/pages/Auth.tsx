import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Loader2, UserPlus, LogIn, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import threatLensLogo from "@/assets/threatlens-logo.png";

type AuthMode = "signin" | "signup";

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        await handlePostAuth(session);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        await handlePostAuth(session);
      }
      setChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handlePostAuth = async (session: any) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (profile) {
      navigate("/", { replace: true });
    } else {
      const { error } = await supabase.from('profiles').insert({
        user_id: session.user.id,
        email: session.user.email,
        display_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
        avatar_url: session.user.user_metadata?.avatar_url || null,
      });

      if (error) {
        const { data: retryProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (retryProfile) {
          navigate("/", { replace: true });
        } else {
          toast({ title: "Registration failed", description: error.message, variant: "destructive" });
          await supabase.auth.signOut();
        }
      } else {
        toast({ title: "Welcome to ThreatLens!", description: "Your account has been created." });
        navigate("/", { replace: true });
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Missing fields", description: "Please enter email and password.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({
          title: "Check your email",
          description: "We sent you a confirmation link. Please verify your email to continue.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      toast({ title: "Authentication failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.08)_0%,transparent_60%)]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="flex flex-col items-center gap-4 mb-6">
          <img src={threatLensLogo} alt="ThreatLens" className="h-14 w-14 rounded-full" />
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-gradient-primary">Threat</span>Lens
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Threat intelligence & attack surface mapping
            </p>
          </div>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-6 space-y-5">
            {/* Tab Switcher */}
            <div className="flex rounded-lg bg-secondary p-1 gap-1">
              <button
                onClick={() => setMode("signin")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  mode === "signin"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign In
              </button>
              <button
                onClick={() => setMode("signup")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  mode === "signup"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Sign Up
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-muted-foreground text-center">
                {mode === "signin"
                  ? "Sign in to your existing ThreatLens account"
                  : "Create a new ThreatLens account to get started"}
              </p>

              <form onSubmit={handleEmailAuth} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="h-10"
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full gap-2 h-11">
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  {loading
                    ? "Processing..."
                    : mode === "signin"
                      ? "Sign in with Email"
                      : "Sign up with Email"}
                </Button>
              </form>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1">
              <Shield className="h-3 w-3 shrink-0" />
              <span>Your account will be protected by AI-powered domain policies</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Auth;
