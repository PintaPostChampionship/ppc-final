import React from 'react';
import type { Tournament, Division, Registration } from '../types';

interface NavTournamentsSectionProps {
  tournaments: Tournament[];
  divisions: Division[];
  registrations: Registration[];
  onSelectTournament: (t: Tournament) => void;
  onSelectDivision: (t: Tournament, d: Division) => void;
}

export function NavTournamentsSection({ tournaments, divisions, registrations, onSelectTournament, onSelectDivision }: NavTournamentsSectionProps) {
  const [expanded, setExpanded] = React.useState<string | null>(
    tournaments.length === 1 ? tournaments[0].id : null
  );

  return (
    <div className="px-1 py-1">
      <p className="text-white/40 text-[10px] font-semibold uppercase tracking-wider px-3 mb-1">Torneos activos</p>
      {tournaments.map(t => {
        const divs = divisions.filter(d =>
          registrations.some(r => r.tournament_id === t.id && r.division_id === d.id)
        ).sort((a, b) => a.name.localeCompare(b.name));

        const isOpen = expanded === t.id;

        return (
          <div key={t.id}>
            <button
              onClick={() => {
                if (divs.length === 0) { onSelectTournament(t); return; }
                setExpanded(isOpen ? null : t.id);
              }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl hover:bg-white/10 transition text-left"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-base shrink-0">🏆</span>
                <span className="text-white text-sm font-medium truncate">{t.name}</span>
              </div>
              {divs.length > 0 && (
                <svg
                  className={`w-4 h-4 text-white/50 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
              )}
            </button>

            {isOpen && divs.length > 0 && (
              <div className="ml-4 mb-1 space-y-0.5 border-l border-white/10 pl-3">
                {divs.map(d => (
                  <button
                    key={d.id}
                    onClick={() => onSelectDivision(t, d)}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/10 transition text-left"
                  >
                    {d.color && (
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: d.color }}
                      />
                    )}
                    <span className="text-white/80 text-sm truncate">{d.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
