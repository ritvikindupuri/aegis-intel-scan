import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Loader2, UserPlus, LogIn } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import threatLensLogo from "@/assets/threatlens-logo.png";

type AuthMode = "signin" | "signup";

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Listen for auth state changes first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        await handlePostAuth(session);
      }
    });

    // Then check existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        await handlePostAuth(session);
      }
      setChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handlePostAuth = async (session: any) => {
    // Check if user has a profile (i.e., has signed up)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (profile) {
      // Existing user — let them in
      navigate("/", { replace: true });
    } else {
      // Check localStorage for signup intent
      const intent = localStorage.getItem('auth_intent');

      if (intent === 'signup') {
        // Create profile for new user
        const { error } = await supabase.from('profiles').insert({
          user_id: session.user.id,
          email: session.user.email,
          display_name: session.user.user_metadata?.full_name || session.user.email,
          avatar_url: session.user.user_metadata?.avatar_url || null,
        });
        localStorage.removeItem('auth_intent');

        if (error) {
          toast({ title: "Registration failed", description: error.message, variant: "destructive" });
          await supabase.auth.signOut();
        } else {
          toast({ title: "Account created", description: "Welcome to ThreatLens!" });
          navigate("/", { replace: true });
        }
      } else {
        // Tried to sign in without an account
        toast({
          title: "No account found",
          description: "You need to sign up first before signing in.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        localStorage.removeItem('auth_intent');
      }
    }
  };

  const handleGoogle = async (authMode: AuthMode) => {
    setLoading(true);
    localStorage.setItem('auth_intent', authMode);
    try {
      const isCustomDomain =
        !window.location.hostname.includes("lovable.app") &&
        !window.location.hostname.includes("lovableproject.com");

      if (isCustomDomain) {
        // Bypass auth-bridge for custom domains (Netlify, etc.)
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth`,
            skipBrowserRedirect: true,
          },
        });
        if (error) throw error;
        if (data?.url) {
          const oauthUrl = new URL(data.url);
          const allowedHosts = ["accounts.google.com"];
          if (!allowedHosts.some((host) => oauthUrl.hostname === host)) {
            throw new Error("Invalid OAuth redirect URL");
          }
          window.location.href = data.url;
          return;
        }
      } else {
        const { error } = await lovable.auth.signInWithOAuth("google", {
          redirect_uri: window.location.origin,
        });
        if (error) {
          toast({ title: "Authentication failed", description: error.message, variant: "destructive" });
        }
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

              <Button
                onClick={() => handleGoogle(mode)}
                disabled={loading}
                className="w-full gap-2 h-11"
                variant="outline"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                )}
                {loading
                  ? "Processing..."
                  : mode === "signin"
                    ? "Sign in with Google"
                    : "Sign up with Google"}
              </Button>
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
