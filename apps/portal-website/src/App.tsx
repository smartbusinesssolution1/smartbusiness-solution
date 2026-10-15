import { useState } from "react";
import { useAuth } from "./context/AuthContext";

function App() {
  const { user, tenants, isLoading, login, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            SmartBusinessSolutions
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {user ? "Logged in session" : "Sign in to access your portal"}
          </p>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-neutral-500 animate-pulse">
            Checking session...
          </div>
        ) : user ? (
          <div className="space-y-4">
            <div className="bg-neutral-50 border border-neutral-200 rounded-md p-3.5 text-sm space-y-1">
              <div className="font-medium text-neutral-800">{user.fullName}</div>
              <div className="text-neutral-500">{user.email}</div>
              {tenants.length > 0 && (
                <div className="pt-2 flex flex-wrap gap-1.5 items-center">
                  <span className="text-xs text-neutral-400">Tenants:</span>
                  {tenants.map((t) => (
                    <span
                      key={t.tenantId}
                      className="px-2 py-0.5 rounded text-xs bg-primary-50 text-primary-700 border border-primary-200"
                    >
                      {t.tenantName} ({t.role})
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <span className="px-3 py-1 rounded-md text-sm text-white bg-primary-600">
                Approved
              </span>
              <span className="px-3 py-1 rounded-md text-sm text-white bg-warning-500">
                Pending
              </span>
              <span className="px-3 py-1 rounded-md text-sm text-white bg-danger-600">
                Voided
              </span>
              <span className="px-3 py-1 rounded-md text-sm text-white bg-success-600">
                Printed
              </span>
            </div>

            <button
              onClick={() => logout()}
              className="w-full mt-2 py-2 px-4 rounded-md border border-neutral-300 text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wide mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wide mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 px-4 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default App;