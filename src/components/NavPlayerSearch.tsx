import React from 'react';
import type { Profile, Registration, Tournament, Division } from '../types';

interface NavPlayerSearchProps {
  profiles: Profile[];
  registrations: Registration[];
  tournaments: Tournament[];
  divisions: Division[];
  onSelect: (player: Profile, tournament: Tournament, division: Division) => void;
}

export function NavPlayerSearch({ profiles, registrations, tournaments, divisions, onSelect }: NavPlayerSearchProps) {
  const [query, setQuery] = React.useState('');

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return profiles
      .filter(p => p.name?.toLowerCase().includes(q) || p.nickname?.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, profiles]);

  const getPlayerContext = (player: Profile) => {
    // Prefer active tournaments, then by sort_order descending
    const regs = registrations
      .filter(r => r.profile_id === player.id)
      .sort((a, b) => {
        const ta = tournaments.find(t => t.id === a.tournament_id);
        const tb = tournaments.find(t => t.id === b.tournament_id);
        // Active first
        const aActive = ta?.status === 'active' ? 1 : 0;
        const bActive = tb?.status === 'active' ? 1 : 0;
        if (bActive !== aActive) return bActive - aActive;
        return (tb?.sort_order ?? 0) - (ta?.sort_order ?? 0);
      });
    const reg = regs[0];
    if (!reg) return null;
    const tournament = tournaments.find(t => t.id === reg.tournament_id);
    const division = divisions.find(d => d.id === reg.division_id);
    if (!tournament || !division) return null;
    return { tournament, division };
  };

  return (
    <div className="px-1 py-1">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar jugador..."
          className="w-full bg-white/10 text-white placeholder-white/40 text-sm rounded-xl pl-9 pr-3 py-2.5 border border-white/10 focus:outline-none focus:border-white/30 focus:bg-white/15 transition"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>

      {results.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {results.map(player => {
            const ctx = getPlayerContext(player);
            return (
              <button
                key={player.id}
                onClick={() => {
                  if (!ctx) return;
                  setQuery('');
                  onSelect(player, ctx.tournament, ctx.division);
                }}
                disabled={!ctx}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/10 transition text-left disabled:opacity-40"
              >
                <img
                  src={player.avatar_url || '/default-avatar.png'}
                  onError={e => { (e.currentTarget as HTMLImageElement).src = '/default-avatar.png'; }}
                  alt=""
                  className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-white/20"
                />
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{player.name}</p>
                  {ctx && (
                    <p className="text-white/50 text-[11px] truncate">{ctx.division.name}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {query.trim() && results.length === 0 && (
        <p className="text-white/40 text-xs px-3 py-2">Sin resultados</p>
      )}
    </div>
  );
}
