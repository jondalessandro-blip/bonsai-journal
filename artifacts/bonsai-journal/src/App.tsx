import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Route, Switch, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import CollectionPage from "@/pages/CollectionPage";
import TreeDetailPage from "@/pages/TreeDetailPage";
import NewTreePage from "@/pages/NewTreePage";
import StatsPage from "@/pages/StatsPage";
import LandingPage from "@/pages/LandingPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

// REQUIRED — resolves the key from window.location.hostname so the same build
// serves multiple Clerk custom domains. Do not inline the env var directly.
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — empty in dev (intentional), auto-set in prod. Do NOT gate on NODE_ENV.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Clerk passes full paths; wouter's setLocation prepends the base — strip it.
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(125, 25%, 35%)",
    colorForeground: "hsl(24, 20%, 20%)",
    colorMutedForeground: "hsl(24, 10%, 45%)",
    colorDanger: "hsl(0, 60%, 50%)",
    colorBackground: "hsl(40, 33%, 96%)",
    colorInput: "hsl(30, 15%, 85%)",
    colorInputForeground: "hsl(24, 20%, 20%)",
    colorNeutral: "hsl(30, 15%, 85%)",
    fontFamily: "Outfit, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[hsl(40,33%,98%)] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-sm border border-[hsl(30,15%,85%)]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "font-serif text-[hsl(24,20%,20%)]",
    headerSubtitle: "text-[hsl(24,10%,45%)]",
    socialButtonsBlockButtonText: "text-[hsl(24,20%,20%)]",
    formFieldLabel: "text-[hsl(24,20%,20%)]",
    footerActionLink: "text-[hsl(125,25%,35%)] hover:text-[hsl(125,25%,28%)]",
    footerActionText: "text-[hsl(24,10%,45%)]",
    dividerText: "text-[hsl(24,10%,45%)]",
    identityPreviewEditButton: "text-[hsl(125,25%,35%)]",
    formFieldSuccessText: "text-[hsl(125,25%,35%)]",
    alertText: "text-[hsl(24,20%,20%)]",
    logoBox: "mb-2",
    logoImage: "h-10 w-10",
    socialButtonsBlockButton: "border border-[hsl(30,15%,85%)] bg-[hsl(40,33%,98%)] hover:bg-[hsl(35,20%,90%)]",
    formButtonPrimary: "bg-[hsl(125,25%,35%)] hover:bg-[hsl(125,25%,28%)] text-[hsl(40,33%,98%)]",
    formFieldInput: "bg-[hsl(30,15%,85%)] text-[hsl(24,20%,20%)] border-[hsl(30,15%,80%)]",
    footerAction: "bg-transparent",
    dividerLine: "bg-[hsl(30,15%,85%)]",
    alert: "border-[hsl(30,15%,85%)]",
    otpCodeFieldInput: "bg-[hsl(30,15%,85%)] text-[hsl(24,20%,20%)] border-[hsl(30,15%,80%)]",
    formFieldRow: "",
    main: "",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

// Invalidate React Query cache when signed-in user changes
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

// Protected route — redirects to sign-in when signed out
function Protected({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-in">{children}</Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

// "/" shows the landing page for signed-out users, collection for signed-in
function HomeRoute() {
  return (
    <>
      <Show when="signed-in">
        <Layout>
          <CollectionPage />
        </Layout>
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRoute} />
      {/* REQUIRED — /*? optional wildcard matches bare URL and Clerk OAuth sub-paths */}
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/trees/new">
        <Protected>
          <Layout>
            <NewTreePage />
          </Layout>
        </Protected>
      </Route>
      <Route path="/trees/:id">
        {(params) => (
          <Protected>
            <Layout>
              <TreeDetailPage />
            </Layout>
          </Protected>
        )}
      </Route>
      <Route path="/stats">
        <Protected>
          <Layout>
            <StatsPage />
          </Layout>
        </Protected>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to your Bonsai Journal",
          },
        },
        signUp: {
          start: {
            title: "Start your journal",
            subtitle: "Create an account to track your trees",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
