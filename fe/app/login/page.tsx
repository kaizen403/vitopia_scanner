"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AlertCircle, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (data.success) {
        if (data.role === "scanner") {
          localStorage.setItem("gateId", data.gateId);
          localStorage.setItem("gateSecret", password);
        }
        router.push("/");
        router.refresh();
      } else {
        setError(data.error || "Invalid credentials");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image
            src="https://vitopia.vitap.ac.in/_next/image?url=%2Fvitopia-color.webp&w=256&q=75"
            alt="VITopia"
            width={240}
            height={75}
            className="h-16 w-auto mx-auto mb-6"
            unoptimized
          />
          <h1 className="font-heading text-3xl tracking-wide text-white mb-2">
            SCANNER LOGIN
          </h1>
          <p className="text-[#99A1AF] text-sm">
            Enter your credentials to access the scanner
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-xs text-[#99A1AF] uppercase tracking-wider mb-2"
            >
              Gate ID (e.g. M-01)
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toUpperCase())}
              placeholder="M-01 or F-01"
              required
              disabled={loading}
              autoComplete="username"
              className="w-full px-4 py-3 bg-[#0a0a0a] border-2 border-[#1a1a1a] rounded-xl text-white placeholder:text-[#555] outline-none transition-all focus:border-[#9AE600] focus:ring-1 focus:ring-[#9AE600]/30 disabled:opacity-40"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs text-[#99A1AF] uppercase tracking-wider mb-2"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              disabled={loading}
              autoComplete="current-password"
              className="w-full px-4 py-3 bg-[#0a0a0a] border-2 border-[#1a1a1a] rounded-xl text-white placeholder:text-[#555] outline-none transition-all focus:border-[#9AE600] focus:ring-1 focus:ring-[#9AE600]/30 disabled:opacity-40"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#9AE600] text-black rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed glow-primary"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <p className="text-center text-[#99A1AF] text-xs mt-8">
          VITopia &apos;26 Entry Scanner · built by <em className="italic">AIR</em>
        </p>
      </div>
    </div>
  );
}
