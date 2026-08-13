import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { uiName } from '../lib/displayUtils';
import { avatarSrc } from '../lib/imageUtils';
import type { Profile } from '../types';

const GOAT_TOURNAMENT_ID = '2606f3ec-6145-47b0-9536-3e91ac04b02d';
const GOAT_DIVISION_ID = '3fa1f7f3-d557-42d4-b7c5-9424f6672b38';
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
          title: '🐐 Te toca jugar!',
          body: 'Tu partido en The G.O.A.T. comienza pronto. ¡Acércate a la cancha!',
          url: `${window.location.origin}/#registro-1-punto`,
        }),
      });
      if (resp.ok) {
        setAlertSentId(targetProfileId);
        setTimeout(() => setAlertSentId(null), 2000);
      } else {
        alert(`No se pudo enviar la notificación a ${uiName(targetName)}. ¿Tiene notificaciones activadas?`);
      }
    } catch (err) {
      alert('Error enviando notificación.');
    } finally {
      setAlertingId(null);
    }
  };

  const fetchParticipants = async () => {
    const { data, error } = await supabase
      .from('tournament_registrations')
      .select('id, profile_id, created_at, status, seed')
      .eq('tournament_id', GOAT_TOURNAMENT_ID)
      .eq('division_id', GOAT_DIVISION_ID)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching participants:', error);
      setLoading(false);
      return;
    }

    // Fetch profiles for those registrations
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

  useEffect(() => {
    fetchParticipants();
  }, []);

  const activeParticipants = participants.filter(p => p.status === 'active');
  const mainList = activeParticipants.slice(0, MAX_PLAYERS);
  const waitlist = activeParticipants.slice(MAX_PLAYERS);

  const isRegistered = currentUser
    ? participants.some(p => p.profile_id === currentUser.id && p.status === 'active')
    : false;

  const isInMainList = currentUser
    ? mainList.some(p => p.profile_id === currentUser.id)
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
        tournament_id: GOAT_TOURNAMENT_ID,
        division_id: GOAT_DIVISION_ID,
      });
      if (error) {
        if (error.code === '23505') {
          alert('Ya estás inscrito en este torneo.');
        } else {
          throw error;
        }
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
      // Find the registration
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-emerald-950 to-gray-900">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.15),transparent_60%)]" />
        <div className="relative max-w-2xl mx-auto px-4 pt-8 pb-6">
          <button
            onClick={onBack}
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </button>

          <div className="text-center mb-6">
            <h1
              className="text-5xl sm:text-6xl font-bold text-white mb-2"
              style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", letterSpacing: '0.04em' }}
            >
              🐐 THE G.O.A.T.
            </h1>
            <p className="text-emerald-300 text-lg font-medium">Torneo Express — 22 de Agosto 2026</p>
            <p className="text-gray-400 text-sm mt-2">
              Brackets de 32 jugadores • Partidos a 1 punto • Un solo día
            </p>
          </div>

          {/* Stats bar */}
          <div className="flex justify-center gap-6 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{mainList.length}</div>
              <div className="text-xs text-gray-400 uppercase tracking-wider">Inscritos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-400">{MAX_PLAYERS - mainList.length}</div>
              <div className="text-xs text-gray-400 uppercase tracking-wider">Cupos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-400">{waitlist.length}</div>
              <div className="text-xs text-gray-400 uppercase tracking-wider">Lista espera</div>
            </div>
          </div>

          {/* Action button */}
          {currentUser ? (
            <div className="flex flex-col items-center gap-4">
              {!isRegistered ? (
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="px-8 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-lg shadow-lg hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 transition-all active:scale-[0.97]"
                >
                  {joining ? 'Inscribiendo...' : mainList.length >= MAX_PLAYERS ? '📋 Unirme a lista de espera' : '🐐 Participar en el torneo'}
                </button>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 font-semibold">
                    ✅ {isInWaitlist ? 'Estás en la lista de espera' : 'Estás inscrito'}
                  </div>
                  <button
                    onClick={handleLeave}
                    disabled={leaving}
                    className="text-sm text-red-400 hover:text-red-300 underline underline-offset-2 transition disabled:opacity-50"
                  >
                    {leaving ? 'Saliendo...' : 'Abandonar torneo'}
                  </button>
                </div>
              )}

              {/* Push notification reminder */}
              <div className="mt-2 px-4 py-3 rounded-xl bg-amber-900/30 border border-amber-700/40 max-w-sm text-center">
                <p className="text-amber-300 text-xs font-medium">
                  🔔 Activa las notificaciones para recibir avisos cuando te toque jugar.
                </p>
                <p className="text-amber-400/70 text-[10px] mt-1">
                  Menú → Activar notificaciones
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-gray-400 text-sm">
                Inicia sesión en <a href={window.location.origin} className="text-emerald-400 underline">ppctennis.vercel.app</a> para inscribirte.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Participants list */}
      <div className="max-w-2xl mx-auto px-4 pb-12">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Main list */}
            <div className="mb-8">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-1.5 h-6 rounded-full bg-emerald-500" />
                Participantes ({mainList.length}/{MAX_PLAYERS})
              </h2>

              {mainList.length === 0 ? (
                <div className="rounded-2xl border border-gray-700/50 bg-gray-800/40 p-8 text-center">
                  <p className="text-gray-400">Aún no hay inscritos. ¡Sé el primero!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {mainList.map((p, i) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl bg-gray-800/60 border border-gray-700/40 px-4 py-3 hover:bg-gray-800/80 transition"
                    >
                      <span className="text-sm font-bold text-gray-500 w-6 text-right">{i + 1}</span>
                      <img
                        src={p.avatar_url || '/default-avatar.png'}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover ring-1 ring-gray-600"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/default-avatar.png'; }}
                      />
                      <span className="text-white font-medium text-sm truncate flex-1">{uiName(p.name)}</span>
                      {canSendAlerts && (
                        <button
                          onClick={() => sendAlert(p.profile_id, p.name)}
                          disabled={alertingId === p.profile_id}
                          className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-semibold transition ${
                            alertSentId === p.profile_id
                              ? 'bg-green-900/50 text-green-400 border border-green-700/40'
                              : 'bg-amber-900/40 text-amber-300 border border-amber-700/40 hover:bg-amber-800/50 active:scale-95'
                          } disabled:opacity-50`}
                          title={`Enviar notificación a ${uiName(p.name)}`}
                        >
                          {alertingId === p.profile_id ? '...' : alertSentId === p.profile_id ? '✓' : '🔔'}
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
                <h2 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-6 rounded-full bg-amber-500" />
                  Lista de Espera ({waitlist.length})
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {waitlist.map((p, i) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl bg-gray-800/40 border border-amber-900/30 px-4 py-3"
                    >
                      <span className="text-sm font-bold text-amber-600 w-6 text-right">{i + 1}</span>
                      <img
                        src={p.avatar_url || '/default-avatar.png'}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover ring-1 ring-gray-600 opacity-80"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/default-avatar.png'; }}
                      />
                      <span className="text-gray-300 font-medium text-sm truncate">{uiName(p.name)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Progress bar */}
            <div className="mt-8">
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>{mainList.length} inscritos</span>
                <span>{MAX_PLAYERS} máximo</span>
              </div>
              <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                  style={{ width: `${Math.min((mainList.length / MAX_PLAYERS) * 100, 100)}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
