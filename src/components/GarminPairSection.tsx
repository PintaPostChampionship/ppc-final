import { useState, useEffect, useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "../types";

interface GarminPairSectionProps {
  currentUser: Profile;
  supabase: SupabaseClient;
}

export default function GarminPairSection({ currentUser, supabase }: GarminPairSectionProps) {
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPaired, setIsPaired] = useState(!!currentUser.garmin_paired_at);
  const [countdown, setCountdown] = useState(0);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) {
        setPairingCode(null);
        setExpiresAt(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  // Poll to check if pairing was completed (while code is active)
  useEffect(() => {
    if (!pairingCode || !expiresAt) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("garmin_paired_at")
        .eq("id", currentUser.id)
        .single();
      if (data?.garmin_paired_at) {
        setIsPaired(true);
        setPairingCode(null);
        setExpiresAt(null);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [pairingCode, expiresAt, currentUser.id, supabase]);

  const generateCode = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("Sesión expirada. Recarga la página.");
        return;
      }

      const resp = await fetch("/api/garmin-pair", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "generate" }),
      });

      const result = await resp.json();
      if (resp.ok && result.code) {
        setPairingCode(result.code);
        setExpiresAt(new Date(Date.now() + (result.expires_in_seconds || 600) * 1000));
        setCountdown(result.expires_in_seconds || 600);
      } else {
        setError(result.error || "Error al generar código");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Already paired state
  if (isPaired) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 bg-emerald-500/20 rounded-xl p-3 border border-emerald-400/30">
          <span className="text-lg">✅</span>
          <div>
            <p className="text-white font-semibold text-sm">Vinculado</p>
            <p className="text-white/60 text-xs">Tu reloj Garmin está conectado con tu cuenta.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href="https://apps.garmin.com/apps/54b355b9-097a-4192-a115-48107e4269c8"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center py-2.5 rounded-xl bg-white/10 text-white/80 text-xs font-medium hover:bg-white/20 transition border border-white/10"
          >
            📥 App en Connect IQ
          </a>
          <button
            onClick={() => { setIsPaired(false); }}
            className="py-2.5 px-4 rounded-xl bg-white/5 text-white/50 text-xs hover:bg-white/10 transition"
          >
            Re-vincular
          </button>
        </div>
      </div>
    );
  }

  // Showing pairing code
  if (pairingCode) {
    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-5 text-center">
          <p className="text-gray-500 text-xs font-medium mb-2 uppercase tracking-wide">Código de vinculación</p>
          <p className="text-4xl font-black text-emerald-700 tracking-[0.3em] font-mono">
            {pairingCode}
          </p>
          <p className="text-gray-400 text-xs mt-2">
            Expira en {minutes}:{seconds.toString().padStart(2, "0")}
          </p>
        </div>
        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
          <p className="text-white/80 text-xs leading-relaxed">
            <strong>En tu reloj Garmin:</strong> Abre PPC Tennis → "Vincular con PPC" → se abrirá una pantalla en tu teléfono → ingresa este código.
          </p>
        </div>
        <button
          onClick={generateCode}
          className="w-full py-2.5 rounded-xl bg-white/10 text-white/70 text-xs font-medium hover:bg-white/20 transition"
        >
          🔄 Generar nuevo código
        </button>
      </div>
    );
  }

  // Default: generate code button
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={generateCode}
          disabled={loading}
          className="flex-1 py-3 rounded-xl bg-white text-emerald-700 font-bold text-sm hover:bg-emerald-50 disabled:opacity-50 transition"
        >
          {loading ? "Generando..." : "🔗 Vincular reloj"}
        </button>
        <a
          href="https://apps.garmin.com/apps/54b355b9-097a-4192-a115-48107e4269c8"
          target="_blank"
          rel="noopener noreferrer"
          className="py-3 px-4 rounded-xl bg-white/10 text-white/80 text-sm font-medium hover:bg-white/20 transition border border-white/10 flex items-center"
        >
          📥
        </a>
      </div>
      {error && <p className="text-red-300 text-xs">{error}</p>}
      <p className="text-white/50 text-xs">
        ¿No tienes la app? Descárgala gratis desde Connect IQ Store en tu teléfono.
      </p>
    </div>
  );
}
