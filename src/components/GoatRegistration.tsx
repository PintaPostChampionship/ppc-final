import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { uiName } from '../lib/displayUtils';
import type { Profile } from '../types';

const TOURNAMENT_ID = '2606f3ec-6145-47b0-9536-3e91ac04b02d';
const DIVISION_ID = '3fa1f7f3-d557-42d4-b7c5-9424f6672b38';
const MAX_PLAYERS = 32;

// Profile IDs that can send alerts (admins + designated organizers)
const ALERT_ALLOWED_IDS = [
  'fb045715-86c6-48fc-88dc-c784fa5ed2bc', // Javier
];

interface GoatRegistrationProps {
  currentUser: Profile | null;
  onBack: () => void;
}

interface Participant {
  id: string;
  profile_id: string;
  name: string;
  avatar_url?: string;
  created_at: string;
  status: string;
  seed?: number | null;
}

export function GoatRegistration({ currentUser, onBack }: GoatRegistrationProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [alertingId, setAlertingId] = useState<string | null>(null);
  const [alertSentId, setAlertSentId] = useState<string | null>(null);
  const [hasReadTribute, setHasReadTribute] = useState(false);

  const canSendAlerts = currentUser?.role === 'admin' || ALERT_ALLOWED_IDS.includes(currentUser?.id ?? '');

  const sendAlert = async (targetProfileId: string, targetName: string) => {
    if (!currentUser) return;
    setAlertingId(targetProfileId);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const resp = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          targetUserId: targetProfileId,
          title: '🎾 Te toca jugar!',
          body: 'Tu partido en el 1 Point Slam comienza pronto. ¡Acércate a la cancha!',
          url: `${window.location.origin}/#registro-1-punto`,
        }),
      });
      if (resp.ok) {
        setAlertSentId(targetProfileId);
        setTimeout(() => setAlertSentId(null), 2000);
      } else {
        alert(`No se pudo enviar la notificación a ${uiName(targetName)}. ¿Tiene notificaciones activadas?`);
      }
    } catch {
      alert('Error enviando notificación.');
    } finally {
      setAlertingId(null);
    }
  };

  const fetchParticipants = async () => {
    const { data, error } = await supabase
      .from('tournament_registrations')
      .select('id, profile_id, created_at, status, seed')
      .eq('tournament_id', TOURNAMENT_ID)
      .eq('division_id', DIVISION_ID)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching participants:', error);
      setLoading(false);
      return;
    }

    const profileIds = (data || []).map(r => r.profile_id).filter(Boolean);
    let profilesMap: Record<string, Profile> = {};

    if (profileIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', profileIds);
      if (profiles) {
        profiles.forEach(p => { profilesMap[p.id] = p as Profile; });
      }
    }

    const mapped: Participant[] = (data || []).map(r => ({
      id: r.id,
      profile_id: r.profile_id,
      name: profilesMap[r.profile_id]?.name || 'Jugador',
      avatar_url: profilesMap[r.profile_id]?.avatar_url || undefined,
      created_at: r.created_at,
      status: r.status || 'active',
      seed: r.seed,
    }));

    setParticipants(mapped);
    setLoading(false);
  };

  useEffect(() => { fetchParticipants(); }, []);

  const activeParticipants = participants.filter(p => p.status === 'active');
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
          <div className="h-1.5 bg-gradient-to-r from-yellow-400 via-emerald-500 to-yellow-400" />
          <div className="px-6 sm:px-8 py-8 text-center">
            <p className="text-sm font-semibold text-emerald-700 uppercase tracking-wider mb-2">
              En memoria de Andrea Vivaldi
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1">
              Copa Andrea Vivaldi
            </h1>
            <p className="text-xl sm:text-2xl font-semibold text-emerald-700 mb-4">
              Golden Point Slam
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-50 border border-yellow-200 text-sm text-yellow-800 font-medium">
              <span>📅</span>
              <span>Sábado 22 de Agosto, 2026</span>
              <span className="text-yellow-400">•</span>
              <span>Finales PPC</span>
            </div>
            <p className="text-gray-400 text-xs mt-3">
              Se invita a todos los participantes a vestir una prenda o accesorio amarillo 💛
            </p>
          </div>
        </div>
      </div>

      {/* Andrea Vivaldi — Tribute section */}
      <div className="max-w-3xl mx-auto px-4 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Hero photo */}
          <div className="flex justify-center p-6 pb-0">
            <div className="relative w-64 sm:w-72 aspect-[3/4] rounded-xl overflow-hidden shadow-md">
              <img
                src="/Andrea-Vivaldi/foto-1.jpeg"
                alt="Andrea Vivaldi"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="px-6 sm:px-8 py-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">¿Por qué este torneo?</h2>
            <div className="text-gray-700 text-sm leading-relaxed space-y-3">
              <p>
                La Copa Andrea Vivaldi se juega en honor al tenis y en memoria de un gran aficionado que nos
                dejó a temprana edad este año.
              </p>
              <p>
                Andrea fue un apasionado por el tenis. A pesar de tener dos masters en ingeniería espacial
                de Imperial College y haber trabajado para la Agencia Espacial Europea, decidió dedicarse
                100% al tenis por amor al juego.
              </p>
              <p>
                Para Andrea, el tenis no era solo competir, sino <strong>conectar</strong> — compartiendo un
                principio fundamental de la PPC. Fue profesor de algunos de los participantes del Pinta Post
                Championship, viendo varios partidos a través del Twitch de la PPC e incluso tomando nota en
                pequeños ajustes para aplicar en sus pupilos.
              </p>
              <p>
                Aunque muchos no lo conocieron, probablemente él supo de varios dentro de esta comunidad como
                un gran fanático del concepto PPC.
              </p>
              <p className="font-medium text-gray-900">
                Este torneo va en su honor de la forma en que mejor sabemos: entre amigos y amigas, en un gran evento
                y disfrutando de un tremendo día de tenis y competencia.
              </p>
            </div>

            {/* Photo gallery */}
            <div className="mt-6 grid grid-cols-3 gap-2">
              <div className="aspect-[3/4] rounded-lg overflow-hidden">
                <img
                  src="/Andrea-Vivaldi/foto-2.jpeg"
                  alt="Andrea Vivaldi"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="aspect-[3/4] rounded-lg overflow-hidden">
                <img
                  src="/Andrea-Vivaldi/foto-3.jpeg"
                  alt="Andrea Vivaldi"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="aspect-[3/4] rounded-lg overflow-hidden">
                <img
                  src="/Andrea-Vivaldi/foto-4.jpeg"
                  alt="Andrea Vivaldi"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bases del Torneo */}
      <div className="max-w-3xl mx-auto px-4 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 sm:px-8 py-6">
          <h2 className="text-lg font-bold text-gray-900 mb-5">Bases del Torneo</h2>

          {/* Fecha y horario */}
          <div className="mb-5">
            <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">1</span>
              Fecha y Horario
            </h3>
            <div className="text-sm text-gray-700 leading-relaxed space-y-2 ml-7">
              <p>
                Los partidos se jugarán el día de las Finales, <strong>sábado 22 de agosto</strong>, entre
                los sets y post partido de las finales oficiales a jugarse ese día.
              </p>
              <p>
                Quienes lleguen a fases avanzadas, jugarán su partido en el soñado <strong>pasto</strong>.
              </p>
              <p className="text-amber-700 font-medium">
                ⚠️ El torneo comienza a las 11:00. Se pide puntualidad — si no estás presente, se avanza sin ti.
              </p>
              <p>
                🔔 <strong>Activar notificaciones</strong> en la web para recibir el aviso cuando te toque jugar.
              </p>
            </div>
          </div>

          {/* Reglas */}
          <div className="mb-5">
            <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">2</span>
              Reglas
            </h3>
            <div className="text-sm text-gray-700 leading-relaxed ml-7">
              <p className="mb-2">El formato es directo y sin rodeos:</p>
              <ul className="space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 mt-0.5">•</span>
                  <span>Cada partido se decide a <strong>UN solo punto</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 mt-0.5">•</span>
                  <span>Quien gana el punto, avanza a la siguiente ronda</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 mt-0.5">•</span>
                  <span>Quien pierde el punto, queda eliminado y a disfrutar del evento!</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Inicio del partido */}
          <div className="mb-5">
            <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">3</span>
              Inicio del Partido
            </h3>
            <div className="text-sm text-gray-700 leading-relaxed ml-7 space-y-2">
              <p>
                Antes de comenzar el punto, la elección del lado o del servicio se decide de forma rápida y tradicional:
              </p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                <p><strong>Cachipún</strong> (Piedra, Papel o Tijera) — a la primera.</p>
                <p><strong>La Elección:</strong> El ganador elige si desea sacar o recibir. Quien recibe elige lado.</p>
              </div>
            </div>
          </div>

          {/* Reglamento */}
          <div className="mb-5">
            <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">4</span>
              Reglamento
            </h3>
            <div className="text-sm text-gray-700 leading-relaxed ml-7">
              <p className="mb-2">El punto se juega bajo las reglas estándar del tenis:</p>
              <ul className="space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 mt-0.5">•</span>
                  <span><strong>Dos saques:</strong> El jugador que sirve dispone de primer y segundo servicio</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 mt-0.5">•</span>
                  <span><strong>Let:</strong> Si el saque toca la red y entra en el cuadro, se repite ese servicio</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">⚠️</span>
                  <span><strong>Indumentaria:</strong> Uso de zapatillas de tenis es <strong>OBLIGATORIO</strong>. Quien no tenga zapatillas adecuadas, NO podrá jugar.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Trofeo y Fair Play */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">5</span>
              Trofeo y Fair Play
            </h3>
            <div className="text-sm text-gray-700 leading-relaxed ml-7 space-y-1.5">
              <p>🏆 El ganador será galardonado con un trofeo exclusivo y será parte de la premiación oficial PPC.</p>
              <p>💛 Se invita a todos los participantes a vestir una prenda o accesorio amarillo en honor a Andrea.</p>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-emerald-700 font-semibold text-sm">¡Que gane el mejor punto! 🎾✨</p>
          </div>
        </div>
      </div>

      {/* Stats + Registration */}
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
                <div className="text-2xl font-bold text-amber-600">{waitlist.length}</div>
                <div className="text-xs text-gray-500">Espera</div>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex justify-between text-[11px] text-gray-400 mb-1">
              <span>{mainList.length} / {MAX_PLAYERS}</span>
              <span>{mainList.length >= MAX_PLAYERS ? 'Completo' : `${MAX_PLAYERS - mainList.length} restantes`}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${Math.min((mainList.length / MAX_PLAYERS) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Action button */}
          {currentUser ? (
            <div className="flex flex-col items-center gap-3">
              {!isRegistered ? (
                <>
                  {/* Acknowledgment checkbox */}
                  <label className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 transition w-full max-w-sm">
                    <input
                      type="checkbox"
                      checked={hasReadTribute}
                      onChange={(e) => setHasReadTribute(e.target.checked)}
                      className="mt-0.5 w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 shrink-0"
                    />
                    <span className="text-sm text-gray-700 leading-snug">
                      He leído sobre Andrea y las bases del torneo. Confirmo mi participación en su honor.
                    </span>
                  </label>

                  <button
                    onClick={handleJoin}
                    disabled={joining || !hasReadTribute}
                    className={`px-6 py-3 rounded-xl font-semibold shadow-sm transition active:scale-[0.98] ${
                      hasReadTribute
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    } disabled:opacity-50`}
                  >
                    {joining ? 'Inscribiendo...' : mainList.length >= MAX_PLAYERS ? '📋 Unirme a lista de espera' : '🎾 Confirmar participación'}
                  </button>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium">
                    ✅ {isInWaitlist ? 'Estás en la lista de espera' : 'Estás inscrito'}
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

              {/* Notification reminder */}
              <p className="text-xs text-gray-400 mt-2 text-center max-w-xs">
                🔔 Recuerda activar notificaciones (Menú → Notificaciones) para que te avisemos cuando sea tu turno.
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-gray-500">
                Inicia sesión en <a href={window.location.origin} className="text-emerald-600 font-medium underline">ppctennis.vercel.app</a> para inscribirte.
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
              <h2 className="text-base font-bold text-gray-900 mb-3">
                Participantes ({mainList.length}/{MAX_PLAYERS})
              </h2>

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
                      {canSendAlerts && (
                        <button
                          onClick={() => sendAlert(p.profile_id, p.name)}
                          disabled={alertingId === p.profile_id}
                          className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs transition ${
                            alertSentId === p.profile_id
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                              : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 active:scale-95'
                          } disabled:opacity-50`}
                          title={`Notificar a ${uiName(p.name)}`}
                        >
                          {alertingId === p.profile_id ? '·' : alertSentId === p.profile_id ? '✓' : '🔔'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Waitlist */}
            {waitlist.length > 0 && (
              <div>
                <h2 className="text-base font-bold text-amber-700 mb-3">
                  Lista de Espera ({waitlist.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {waitlist.map((p, i) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl bg-amber-50/50 border border-amber-100 px-4 py-3"
                    >
                      <span className="text-xs font-bold text-amber-500 w-5 text-right">{i + 1}</span>
                      <img
                        src={p.avatar_url || '/default-avatar.png'}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover ring-1 ring-amber-200 opacity-80"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/default-avatar.png'; }}
                      />
                      <span className="text-sm font-medium text-gray-700 truncate">{uiName(p.name)}</span>
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
