import { Navbar } from "./Navbar";
import { FeedbackButton } from "./FeedbackButton";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col relative selection:bg-primary/20 selection:text-primary">
      {/* Texture overlay */}
      <div className="pointer-events-none fixed inset-0 z-[-1] opacity-[0.03] mix-blend-multiply dark:mix-blend-overlay dark:opacity-[0.02]" 
           style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}>
      </div>
      
      <Navbar />
      
      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-6 lg:p-8">
        {children}
      </main>

      <FeedbackButton />
    </div>
  );
}
