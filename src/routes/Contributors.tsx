import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Code2, ExternalLink, GitCommit, GitPullRequest, Heart, LoaderCircle, ShieldCheck, Sparkles, Trophy, Users } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";

export interface GitHubContributor {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
  type: string;
}

const FALLBACK_CONTRIBUTORS: GitHubContributor[] = [
  {
    id: 72372613,
    login: "nannndev",
    avatar_url: "https://avatars.githubusercontent.com/u/72372613?v=4",
    html_url: "https://github.com/nannndev",
    contributions: 120,
    type: "User",
  },
];

export default function Contributors() {
  const [contributors, setContributors] = useState<GitHubContributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetch("https://api.github.com/repos/nannndev/codetype/contributors?per_page=100")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: GitHubContributor[]) => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setContributors(data);
        } else if (isMounted) {
          setContributors(FALLBACK_CONTRIBUTORS);
        }
      })
      .catch((err) => {
        console.warn("Unable to fetch GitHub contributors, using fallback list:", err);
        if (isMounted) {
          setError(true);
          setContributors(FALLBACK_CONTRIBUTORS);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const totalContributions = contributors.reduce((sum, c) => sum + c.contributions, 0);

  return (
    <div className="workspace-shell min-h-screen bg-background transition-colors duration-300">
      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <Header />
        <Link to="/" className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to typing
        </Link>

        {/* Header Section */}
        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-600 dark:text-sky-400">
              <Users className="size-3.5" /> Open Source Heroes
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Codey Contributors</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Codey is made possible by amazing open-source contributors. Thank you to everyone who contributed code, bug reports, and features!
            </p>
          </div>

          <Button asChild variant="outline" className="shrink-0">
            <a href="https://github.com/nannndev/codetype" target="_blank" rel="noopener noreferrer">
              <Code2 className="size-4" />
              <span>GitHub Repo</span>
              <ExternalLink className="size-3.5 opacity-70" />
            </a>
          </Button>
        </header>

        {/* Quick Stats Grid */}
        <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <div className="rounded-xl border bg-card/80 p-4 backdrop-blur-sm">
            <Users className="mb-3 size-5 text-sky-500" />
            <div className="text-2xl font-bold tabular-nums">{loading ? "..." : contributors.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Contributors</div>
          </div>

          <div className="rounded-xl border bg-card/80 p-4 backdrop-blur-sm">
            <GitCommit className="mb-3 size-5 text-amber-500" />
            <div className="text-2xl font-bold tabular-nums">{loading ? "..." : totalContributions}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Contributions / Commits</div>
          </div>

          <div className="col-span-2 rounded-xl border bg-card/80 p-4 backdrop-blur-sm lg:col-span-1">
            <ShieldCheck className="mb-3 size-5 text-emerald-500" />
            <div className="text-2xl font-bold text-foreground">Open Source</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">License: MIT</div>
          </div>
        </section>

        {/* Contributors List */}
        <main className="animate-fade-in-up space-y-8">
          <section className="overflow-hidden rounded-2xl border bg-card/80 backdrop-blur-sm">
            <div className="border-b px-6 py-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <span>Contributors Hall of Fame</span>
                  {error && (
                    <span className="rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-500">
                      Offline / Static List
                    </span>
                  )}
                </h2>
                <p className="text-xs text-muted-foreground">Ranked by contributions to the Codey repository</p>
              </div>
              <a
                href="https://github.com/nannndev/codetype/graphs/contributors"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                GitHub Stats <ExternalLink className="size-3" />
              </a>
            </div>

            {loading ? (
              <div className="grid h-48 place-items-center">
                <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
                {contributors.map((contributor, index) => {
                  const isLead = contributor.login.toLowerCase() === "nannndev";
                  return (
                    <a
                      key={contributor.id}
                      href={contributor.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative flex items-center gap-4 rounded-xl border border-border/70 bg-muted/20 p-4 transition-all hover:border-sky-500/40 hover:bg-muted/50 hover:shadow-md"
                    >
                      <div className="relative">
                        <img
                          src={contributor.avatar_url}
                          alt={contributor.login}
                          className="size-12 rounded-full border-2 border-background object-cover"
                        />
                        {isLead ? (
                          <div className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-amber-500 text-slate-950 shadow" title="Lead Maintainer">
                            <Trophy className="size-3 fill-current" />
                          </div>
                        ) : index < 3 ? (
                          <div className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-sky-500 text-slate-950 shadow" title={`Top ${index + 1} Contributor`}>
                            <Sparkles className="size-3 fill-current" />
                          </div>
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="truncate text-sm font-bold group-hover:text-sky-500 transition-colors">
                            {contributor.login}
                          </h3>
                          <ExternalLink className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>

                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground tabular-nums">
                            {contributor.contributions} {contributor.contributions === 1 ? "commit" : "commits"}
                          </span>
                          <span>&bull;</span>
                          <span>{isLead ? "Core Maintainer" : "Contributor"}</span>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </section>

          {/* Join as Contributor Section */}
          <section className="rounded-2xl border bg-card/80 p-6 backdrop-blur-sm">
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <GitPullRequest className="size-5 text-sky-500" />
              <span>Want to Contribute to Codey?</span>
            </h3>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              We welcome code snippets for new programming languages, bug fixes, UI improvements, and feature suggestions!
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <a
                href="https://github.com/nannndev/codetype/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col justify-between rounded-xl border bg-muted/30 p-4 transition-colors hover:border-sky-500/40 hover:bg-muted/60"
              >
                <div>
                  <h4 className="font-bold text-sm group-hover:text-sky-500 transition-colors flex items-center justify-between">
                    <span>1. Find an Issue</span>
                    <ExternalLink className="size-3.5 text-muted-foreground" />
                  </h4>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Browse open issues or report bugs and feature requests.
                  </p>
                </div>
                <span className="mt-4 text-[11px] font-semibold text-sky-500">View Issues &rarr;</span>
              </a>

              <a
                href="https://github.com/nannndev/codetype/pulls"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col justify-between rounded-xl border bg-muted/30 p-4 transition-colors hover:border-emerald-500/40 hover:bg-muted/60"
              >
                <div>
                  <h4 className="font-bold text-sm group-hover:text-emerald-500 transition-colors flex items-center justify-between">
                    <span>2. Submit a PR</span>
                    <ExternalLink className="size-3.5 text-muted-foreground" />
                  </h4>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Fork the repository, make changes, and open a Pull Request.
                  </p>
                </div>
                <span className="mt-4 text-[11px] font-semibold text-emerald-500">Submit Pull Request &rarr;</span>
              </a>

              <Link
                to="/donate"
                className="group flex flex-col justify-between rounded-xl border bg-muted/30 p-4 transition-colors hover:border-amber-500/40 hover:bg-muted/60"
              >
                <div>
                  <h4 className="font-bold text-sm group-hover:text-amber-500 transition-colors flex items-center justify-between">
                    <span>3. Support Project</span>
                    <Heart className="size-3.5 text-rose-500 fill-rose-500/20" />
                  </h4>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Support the maintainers via Saweria or Buy Me a Coffee.
                  </p>
                </div>
                <span className="mt-4 text-[11px] font-semibold text-amber-500">Donate & Support &rarr;</span>
              </Link>
            </div>
          </section>
        </main>
      </div>
      <Footer />
    </div>
  );
}
