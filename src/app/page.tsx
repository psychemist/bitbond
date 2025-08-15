export default function HomePage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">
          Welcome to <span className="text-bitcoin">BitBond</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Accountability Buddy DApp - Stake satoshis on task completion, 
          verified by trusted buddies on Stacks blockchain
        </p>
        <div className="flex justify-center space-x-4 pt-6">
          <div className="px-6 py-3 bg-card border rounded-lg">
            <p className="text-sm text-muted-foreground">Project Status</p>
            <p className="font-semibold text-bitcoin">Phase 1 - Foundation Setup</p>
          </div>
          <div className="px-6 py-3 bg-card border rounded-lg">
            <p className="text-sm text-muted-foreground">Progress</p>
            <p className="font-semibold">Setting up...</p>
          </div>
        </div>
      </div>
    </main>
  )
}