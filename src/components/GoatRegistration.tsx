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
          {/* Top accent */}
          <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />

          <div className="px-6 sm:px-8 py-8 text-center">
            <p className="text-sm font-semibold text-emerald-700 uppercase tracking-wider mb-2">
              En memoria de
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1">
              Andrea Vivaldi
            </h1>
            <p className="text-xl sm:text-2xl font-semibold text-emerald-700 mb-4">
              1 Point Slam
            </p>
            <p className="text-gray-500 text-sm">
              Viernes 22 de Agosto, 2026 • Londres
            </p>
          </div>
        </div>
      </div>

      {/* About section */}
      <div className="max-w-3xl mx-auto px-4 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 sm:px-8 py-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Sobre el torneo</h2>
          <p className="text-gray-700 text-sm leading-relaxed mb-4">
            Este torneo se juega en honor a la memoria de <strong>Andrea Vivaldi</strong>, profesor de tenis en Londres
            y un referente para nuestra comunidad. El formato es simple y emocionante: <strong>32 jugadores</strong> compiten
            en brackets eliminatorios donde <strong>cada partido se define en un solo punto</strong>. El que gana el punto
            avanza a la siguiente ronda. La gran final se jugará en las canchas de pasto.
          </p>

          <h3 className="text-sm font-bold text-gray-900 mb-2">Consideraciones</h3>
          <ul className="text-sm text-gray-700 space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 mt-0.5">•</span>
              <span>Llevar zapatillas adecuadas para pasto</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 mt-0.5">•</span>
              <span>Estar atento para cuando sea tu turno — los partidos van rápido</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 mt-0.5">•</span>
              <span><strong>Activar notificaciones</strong> en la web para recibir el aviso cuando te toque</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 mt-0.5">•</span>
              <span>Respetar los tiempos — si no estás presente, se avanza sin ti</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Andrea's story (placeholder) */}
      <div className="max-w-3xl mx-auto px-4 mb-8">
        <div className="bg-emerald-50/60 rounded-2xl border border-emerald-100 px-6 sm:px-8 py-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Andrea Vivaldi</h2>
          <p className="text-gray-700 text-sm leading-relaxed italic">
            Andrea fue profesor de tenis en Londres y dejó una huella profunda en todos los que tuvieron la suerte de
            compartir cancha con él. Este torneo es un homenaje a su pasión por el deporte y a la comunidad que ayudó a construir.
          </p>
          <p className="text-gray-500 text-xs mt-3">
            Más detalles sobre su historia próximamente.
          </p>
        </div>
      </div>

      {/* Stats + Registration */}
      <div className="max-w-3xl mx-auto px-4 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 sm:px-8 py-6">
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
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition active:scale-[0.98]"
                >
                  {joining ? 'Inscribiendo...' : mainList.length >= MAX_PLAYERS ? '📋 Unirme a lista de espera' : '🎾 Participar en el torneo'}
                </button>
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
