export function HomeSkeleton() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <div className="h-8 w-40 bg-muted rounded-md animate-pulse" />
        <div className="h-4 w-64 bg-muted rounded-md mt-2 animate-pulse" />
      </div>
      <div className="flex flex-col gap-8">
        {[1, 2, 3].map((i) => (
          <section key={i} className="bg-card rounded-2xl shadow-card">
            <div className="px-6 pt-5 pb-3 flex items-center justify-between">
              <div className="h-6 w-32 bg-muted rounded-md animate-pulse" />
              <div className="h-4 w-16 bg-muted rounded-md animate-pulse" />
            </div>
            <div className="px-6 pb-3">
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((j) => (
                  <div
                    key={j}
                    className="h-10 bg-muted rounded-md animate-pulse"
                    style={{ flex: Math.random() * 3 + 1.5 }}
                  />
                ))}
              </div>
            </div>
            <div className="px-6 pb-5">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                {[1, 2, 3, 4, 5, 6].map((j) => (
                  <div key={j} className="border border-border/25 rounded-xl bg-muted/30 px-5 py-4">
                    <div className="h-5 bg-muted rounded-md w-3/4 animate-pulse" />
                    <div className="h-3 bg-muted rounded-md w-1/4 mt-2 animate-pulse" />
                    <div className="h-4 bg-muted rounded-md w-full mt-2 animate-pulse" />
                    <div className="h-4 bg-muted rounded-md w-2/3 mt-1 animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

export function DailySkeleton() {
  return (
    <main className="max-w-5xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-8 border-b border-border/30 pb-6">
        <div className="flex items-center gap-4">
          <div className="h-4 w-12 bg-muted rounded animate-pulse" />
          <div className="h-4 w-16 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-8 w-24 bg-muted rounded-md animate-pulse" />
      </div>
      <article className="bg-card rounded-2xl shadow-card p-8 space-y-6">
        <div className="h-8 w-64 bg-muted rounded-md animate-pulse" />
        <div className="h-4 w-48 bg-muted rounded-md animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 bg-muted rounded-md animate-pulse" style={{ width: `${85 - i * 10}%` }} />
          ))}
        </div>
        <div className="h-6 w-32 bg-muted rounded-md mt-8 animate-pulse" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-border/25 rounded-lg p-4">
              <div className="h-5 bg-muted rounded-md w-3/4 animate-pulse" />
              <div className="h-4 bg-muted rounded-md w-full mt-2 animate-pulse" />
              <div className="h-4 bg-muted rounded-md w-2/3 mt-1 animate-pulse" />
            </div>
          ))}
        </div>
      </article>
    </main>
  );
}
