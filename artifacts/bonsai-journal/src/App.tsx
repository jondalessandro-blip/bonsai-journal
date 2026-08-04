import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Layout } from '@/components/Layout';
import CollectionPage from '@/pages/CollectionPage';
import TreeDetailPage from '@/pages/TreeDetailPage';
import NewTreePage from '@/pages/NewTreePage';
import StatsPage from '@/pages/StatsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,          // treat data as fresh for 1 min — no refetch on every mount
      gcTime: 5 * 60_000,         // keep unused cache for 5 min
      refetchOnWindowFocus: false, // single-user app; mutations already invalidate manually
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={CollectionPage} />
        <Route path="/trees/new" component={NewTreePage} />
        <Route path="/trees/:id" component={TreeDetailPage} />
        <Route path="/stats" component={StatsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
