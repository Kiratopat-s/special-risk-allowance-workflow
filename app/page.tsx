import Link from "next/link";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Zap, Lock, CheckCircle } from "lucide-react";

export default async function Home() {
  const session = await auth();

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-zinc-200 via-background to-background" />

        <div className="container max-w-7xl mx-auto px-4 py-24 md:py-32 lg:py-40">
          <div className="flex flex-col items-center text-center space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-4 py-1.5 text-sm font-medium text-muted-foreground">
              <Shield className="mr-2 h-4 w-4" />
              Enterprise-Ready Authentication
            </div>

            {/* Main heading */}
            <div className="space-y-4 max-w-4xl">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                <span className="block">Next.js 16</span>
                <span className="block text-muted-foreground">
                  Enterprise Starter
                </span>
              </h1>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl">
                A production-ready foundation with Keycloak SSO integration,
                shadcn/ui components, and a complete user profile management
                flow. Built for teams who value security and elegance.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              {session?.user ? (
                <Button asChild size="lg" className="group">
                  <Link href="/profile">
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              ) : (
                <Button asChild size="lg" className="group">
                  <Link href="/api/auth/signin">
                    Sign In via SSO
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              )}
              <Button variant="outline" size="lg" asChild>
                <Link
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on GitHub
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t border-border/40 bg-muted/30">
        <div className="container max-w-7xl mx-auto px-4 py-24">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Built for the Enterprise
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Everything you need to build secure, scalable applications with
              best-in-class developer experience.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="group relative rounded-2xl border border-border/60 bg-card p-8 transition-all hover:border-border hover:shadow-lg">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Keycloak SSO</h3>
              <p className="text-muted-foreground">
                Enterprise-grade authentication with Auth.js v5 and Keycloak
                provider. JWT tokens, refresh handling, and session management
                built-in.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group relative rounded-2xl border border-border/60 bg-card p-8 transition-all hover:border-border hover:shadow-lg">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">
                React 19 & Server Actions
              </h3>
              <p className="text-muted-foreground">
                Leverage the latest React features with Next.js App Router.
                Server Components and Server Actions for optimal performance.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group relative rounded-2xl border border-border/60 bg-card p-8 transition-all hover:border-border hover:shadow-lg">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CheckCircle className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Type-Safe Forms</h3>
              <p className="text-muted-foreground">
                React Hook Form with Zod validation for bulletproof form
                handling. Full TypeScript support with strict mode enabled.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="border-t border-border/40">
        <div className="container max-w-7xl mx-auto px-4 py-24">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl font-bold tracking-tight">Tech Stack</h2>
            <p className="text-muted-foreground">
              Powered by industry-leading technologies
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-4 md:gap-6">
            {[
              "Next.js 16",
              "React 19",
              "TypeScript",
              "Tailwind CSS",
              "shadcn/ui",
              "Auth.js v5",
              "Keycloak",
              "React Hook Form",
              "Zod",
            ].map((tech) => (
              <div
                key={tech}
                className="rounded-full border border-border/60 bg-card px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
              >
                {tech}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border/40 bg-muted/30">
        <div className="container max-w-7xl mx-auto px-4 py-24">
          <div className="mx-auto max-w-2xl text-center space-y-6">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to Get Started?
            </h2>
            <p className="text-lg text-muted-foreground">
              Sign in with your enterprise credentials and explore the full
              capabilities of this starter template.
            </p>
            {session?.user ? (
              <Button asChild size="lg" className="group">
                <Link href="/profile">
                  View Your Profile
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="group">
                <Link href="/api/auth/signin">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
