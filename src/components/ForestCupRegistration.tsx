import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { uiName } from '../lib/displayUtils';
import { isCalibrationTournamentByName } from '../lib/tournamentUtils';
import type { Profile, Tournament, Division, Registration, Match } from '../types';

const TOURNAMENT_ID = 'ce2b5e25-ff7b-4222-bf4c-c70aa8f5c6a2';
const DIVISION_ID = '7a167e82-cc76-4a06-aac7-108601a5ffea';
const MAX_PLAYERS = 16;
const CLOSE_DATE_LABEL = '26 de noviembre, 2026';

interface ForestCupRegistrationProps {
  currentUser: Profile | null;
  tournaments: Tournament[];
  divisions: Division[];
  registrations: Registration[];
  matches: Match[];
  onBack: () => void;
}

interface Participant {
  id: string;
  profile_id: string;
  name: string;
  avatar_url?: string;
  created_at: string;
  status: string;
  priority: number; // % de partidos jugados en liga activa (0-100)
}

export function ForestCupRegistration({
  currentUser,
  tournaments,
  divisions,
  registrations,
  matches,
  onBack,
}: ForestCupRegistrationProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [hasRead, setHasRead] = useState(false);

  // Calcula el % de partidos de liga jugados por un jugador en la temporada regular ACTIVA.
  // % = partidos jugados / partidos esperados (n-1) de su división activa de liga.
  // Si está en más de una liga activa (no debería), toma el promedio ponderado por partidos esperados.
  const computePriority = (profileId: string): number => {
    const activeLeagueTournamentIds = tournaments
      .filter(t => t.status === 'active' && (t.format === 'league' || !t.format) && !isCalibrationTournamentByName(t.name))
      .map(t => t.id);

    let totalExpected = 0;
    let totalPlayed = 0;

    for (const tId of activeLeagueTournamentIds) {
      // Registración del jugador en esta liga activa
      const reg = registrations.find(
        r => r.tournament_id === tId && r.profile_id === profileId && r.status !== 'retired'
      );
      if (!reg) continue;

      // Tamaño de la división (jugadores activos) → partidos esperados = n-1
      const divActiveCount = registrations.filter(
        r => r.tournament_id === tId && r.division_id === reg.division_id && r.status !== 'retired'
      ).length;
      const expected = Math.max(0, divActiveCount - 1);

      // Partidos de liga jugados por el jugador en esa división
      const played = matches.filter(m =>
        m.tournament_id === tId &&
        m.division_id === reg.division_id &&
        m.status === 'played' &&
        !m.phase &&
        (m.home_player_id === profileId || m.away_player_id === profileId)
      ).length;

      totalExpected += expected;
      totalPlayed += played;
    }

    if (totalExpected <= 0) return 0;
    return Math.min(100, Math.round((totalPlayed / totalExpected) * 100));
  };

  const fetchParticipants = async () => {
    const { data, error } = await supabase
      .from('tournament_registrations')
      .select('id, profile_id, created_at, status')
      .eq('tournament_id', TOURNAMENT_ID)
      .eq('division_id', DIVISION_ID)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching participants:', error);
      setLoading(false);
      return;
    }

    const profileIds = (data || []).map(r => r.profile_id).filter(Boolean);
    const profilesMap: Record<string, Profile> = {};

    if (profileIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', profileIds);
      if (profs) profs.forEach(p => { profilesMap[p.id] = p as Profile; });
    }

    const mapped: Participant[] = (data || []).map(r => ({
      id: r.id,
      profile_id: r.profile_id,
      name: profilesMap[r.profile_id]?.name || 'Jugador',
      avatar_url: profilesMap[r.profile_id]?.avatar_url || undefined,
      created_at: r.created_at,
      status: r.status || 'active',
      priority: computePriority(r.profile_id),
    }));

    setParticipants(mapped);
    setLoading(false);
  };

  useEffect(() => { fetchParticipants(); }, []);

  // Ordenar activos por prioridad (% desc). Desempate: quién se inscribió primero.
  const activeParticipants = participants
    .filter(p => p.status === 'active')
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return (a.created_at || '').localeCompare(b.created_at || '');
    });

  const mainList = activeParticipants.slice(0, MAX_PLAYERS);
  const waitlist = activeParticipants.slice(MAX_PLAYERS);

  const isRegistered = currentUser
    ? participants.some(p => p.profile_id === currentUser.id && p.status === 'active')
    : false;
  const isInWaitlist = currentUser
    ? waitlist.some(p => p.profile_id === currentUser.id)
    : false;

  const handleJoin = async () => {
    if (!currentUser) return;
    setJoining(true);
    try {
      const { error } = await supabase.from('tournament_registrations').insert({
        profile_id: currentUser.id,
        tournament_id: TOURNAMENT_ID,
        division_id: DIVISION_ID,
      });
      if (error) {
        if (error.code === '23505') alert('Ya estás inscrito en este torneo.');
        else throw error;
      }
      await fetchParticipants();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!currentUser) return;
    if (!confirm('¿Estás seguro que quieres abandonar el torneo?')) return;
    setLeaving(true);
    try {
      const reg = participants.find(p => p.profile_id === currentUser.id && p.status === 'active');
      if (!reg) return;
      const { error } = await supabase
        .from('tournament_registrations')
        .update({ status: 'retired' })
        .eq('id', reg.id);
      if (error) throw error;
      await fetchParticipants();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLeaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-gray-50">
      {/* Header */}
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-4">
        <button
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-900 font-medium transition"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver al inicio
        </button>
      </div>

      {/* Hero */}
      <div className="max-w-3xl mx-auto px-4 mb-8">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-emerald-400 via-green-500 to-emerald-400" />
          <div className="px-6 sm:px-8 py-8 text-center">
            <p className="text-sm font-semibold text-emerald-700 uppercase tracking-wider mb-2">
              Inscripciones abiertas
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1">
              Forest Cup
            </h1>
            <p className="text-xl sm:text-2xl font-semibold text-emerald-700 mb-4">
              Edición 1
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 font-medium">
              <span>📅</span>
              <span>Cierre de inscripciones: {CLOSE_DATE_LABEL}</span>
            </div>
            <p className="text-gray-400 text-xs mt-3">
              Torneo abierto para hombres y mujeres · 16 cupos
            </p>
          </div>
        </div>
      </div>

      {/* Bases del torneo */}
      <div className="max-w-3xl mx-auto px-4 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 sm:px-8 py-6">
          <h2 className="text-lg font-bold text-gray-900 mb-5">Sobre el torneo</h2>

          <div className="space-y-4">
            {/* Quiénes participan */}
            <div className="flex gap-3">
              <div className="shrink-0 w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-lg">🏆</div>
              <div className="text-sm leading-relaxed">
                <p className="font-semibold text-gray-900">¿Quiénes pueden participar?</p>
                <p className="text-gray-600">
                  TOD@S l@s pepecin@s, sin importar su división. La idea es que tengamos cruces divisionales
                  y que cualquiera pueda terminar levantando la copa.
                </p>
              </div>
            </div>

            {/* Fecha límite */}
            <div className="flex gap-3">
              <div className="shrink-0 w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-lg">📅</div>
              <div className="text-sm leading-relaxed">
                <p className="font-semibold text-gray-900">Fecha límite de inscripción</p>
                <p className="text-gray-600">26 de noviembre.</p>
              </div>
            </div>

            {/* Sorteo */}
            <div className="flex gap-3">
              <div className="shrink-0 w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-lg">🎲</div>
              <div className="text-sm leading-relaxed">
                <p className="font-semibold text-gray-900">Sorteo del cuadro</p>
                <p className="text-gray-600">27 de noviembre, durante el Social PPC.</p>
              </div>
            </div>

            {/* Cupos */}
            <div className="flex gap-3">
              <div className="shrink-0 w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-lg">👥</div>
              <div className="text-sm leading-relaxed">
                <p className="font-semibold text-gray-900">Cupos</p>
                <p className="text-gray-600">Máximo 16 jugadores/as.</p>
              </div>
            </div>

            {/* Final */}
            <div className="flex gap-3">
              <div className="shrink-0 w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-lg">🏁</div>
              <div className="text-sm leading-relaxed">
                <p className="font-semibold text-gray-900">Final</p>
                <p className="text-gray-600">
                  Por confirmar si se juega el 20 de marzo en el Finals Day. Si no fuera posible, el torneo
                  deberá terminar justo antes para poder hacer la premiación.
                </p>
              </div>
            </div>

            {/* Importante */}
            <div className="flex gap-3 rounded-xl bg-amber-50 border border-amber-200 p-3">
              <div className="shrink-0 w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-lg">⚠️</div>
              <div className="text-sm leading-relaxed">
                <p className="font-semibold text-amber-900">Importante</p>
                <p className="text-amber-800">
                  Al ser eliminación directa, cada partido cuenta. Será responsabilidad de cada jugador/a
                  contactar a su rival y coordinar su partido dentro de los plazos establecidos.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-emerald-700 font-semibold text-sm">
              ¡Inscríbete y veamos quién se queda con la primera Forest Cup! 🌳🔥
            </p>
          </div>
        </div>
      </div>

      {/* Inscripción */}
      <div className="max-w-3xl mx-auto px-4 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 sm:px-8 py-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 text-center">Inscripción</h2>

          {/* Stats */}
          <div className="flex justify-center gap-8 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{mainList.length}</div>
              <div className="text-xs text-gray-500">Inscritos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">{Math.max(MAX_PLAYERS - mainList.length, 0)}</div>
              <div className="text-xs text-gray-500">Cupos</div>
            </div>
            {waitlist.length > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{waitlist.length}</div>
                <div className="text-xs text-gray-500">Lista de espera</div>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex justify-between text-[11px] text-gray-400 mb-1">
              <span>{mainList.length} / {MAX_PLAYERS}</span>
              <span>{mainList.length >= MAX_PLAYERS ? 'Cupos llenos' : `${MAX_PLAYERS - mainList.length} restantes`}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${Math.min((mainList.length / MAX_PLAYERS) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Action */}
          {currentUser ? (
            <div className="flex flex-col items-center gap-3">
              {!isRegistered ? (
                <>
                  <label className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 transition w-full max-w-sm">
                    <input
                      type="checkbox"
                      checked={hasRead}
                      onChange={(e) => setHasRead(e.target.checked)}
                      className="mt-0.5 w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 shrink-0"
                    />
                    <span className="text-sm text-gray-700 leading-snug">
                      Entiendo que los cupos son limitados y que la prioridad se asigna según mi actividad en la
                      temporada regular. Confirmo mi inscripción.
                    </span>
                  </label>

                  <button
                    onClick={handleJoin}
                    disabled={joining || !hasRead}
                    className={`px-6 py-3 rounded-xl font-semibold shadow-sm transition active:scale-[0.98] ${
                      hasRead
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    } disabled:opacity-50`}
                  >
                    {joining ? 'Inscribiendo...' : '🎾 Confirmar inscripción'}
                  </button>
                </>
              ) : (
                <>
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium ${
                    isInWaitlist
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}>
                    {isInWaitlist ? '⚠️ Estás en lista de espera' : '✅ Estás inscrito'}
                  </div>
                  <button
                    onClick={handleLeave}
                    disabled={leaving}
                    className="text-xs text-red-500 hover:text-red-700 underline underline-offset-2 transition disabled:opacity-50"
                  >
                    {leaving ? 'Saliendo...' : 'Abandonar'}
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-gray-500">
                Inicia sesión en{' '}
                <a href={window.location.origin} className="text-emerald-600 font-medium underline">ppctennis.vercel.app</a>{' '}
                para inscribirte.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Participants list */}
      <div className="max-w-3xl mx-auto px-4 pb-12">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Main list */}
            <div className="mb-8">
              <h2 className="text-base font-bold text-gray-900 mb-1">
                Inscritos ({mainList.length}/{MAX_PLAYERS})
              </h2>
              <p className="text-xs text-gray-500 mb-3">
                Ordenados por actividad en la temporada regular (más partidos jugados = mayor prioridad).
                Los primeros {MAX_PLAYERS} tienen cupo confirmado.
              </p>

              {mainList.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
                  <p className="text-gray-500 text-sm">Aún no hay inscritos. ¡Sé el primero!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {mainList.map((p, i) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl bg-white border border-gray-100 shadow-sm px-4 py-3"
                    >
                      <span className="text-xs font-bold text-gray-400 w-5 text-right">{i + 1}</span>
                      <img
                        src={p.avatar_url || '/default-avatar.png'}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover ring-1 ring-gray-200"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/default-avatar.png'; }}
                      />
                      <span className="text-sm font-medium text-gray-900 truncate flex-1">{uiName(p.name)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Waitlist (rojo) */}
            {waitlist.length > 0 && (
              <div>
                <h2 className="text-base font-bold text-red-600 mb-1">
                  Lista de Espera ({waitlist.length})
                </h2>
                <p className="text-xs text-gray-500 mb-3">
                  Superan el cupo de {MAX_PLAYERS}. Entrarán si se libera un lugar o según su actividad al cierre.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {waitlist.map((p, i) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl bg-red-50/60 border border-red-200 px-4 py-3"
                    >
                      <span className="text-xs font-bold text-red-500 w-5 text-right">{MAX_PLAYERS + i + 1}</span>
                      <img
                        src={p.avatar_url || '/default-avatar.png'}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover ring-1 ring-red-200 opacity-80"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/default-avatar.png'; }}
                      />
                      <span className="text-sm font-medium text-red-900/80 truncate">{uiName(p.name)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
