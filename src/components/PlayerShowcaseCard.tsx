import React from 'react';
import type { Profile, PlayerCard } from '../types';
import { capitaliseFirst, divisionLogoSrc, uiName } from '../lib/displayUtils';
import { getAgeFromBirthDate } from '../lib/playerUtils';

interface PlayerShowcaseCardProps {
  player: Profile;
  avatarUrl: string;
  hasAvatar: boolean;
  playerCard: Partial<PlayerCard>;
  firstLeagueTournamentName: string;
  lastLeagueResult: string;
  currentDivisionName: string;
}

export function PlayerShowcaseCard({
  player,
  avatarUrl,
  hasAvatar,
  playerCard,
  firstLeagueTournamentName,
  lastLeagueResult,
  currentDivisionName,
}: PlayerShowcaseCardProps) {
  const fullRacket = [playerCard.racket_brand, playerCard.racket_model]
    .filter(Boolean).join(' ').trim();

  const computedAge =
    getAgeFromBirthDate(playerCard.birth_date) ??
    playerCard.age ??
    null;

  const profileItems = [
    { label: 'Edad', value: computedAge != null ? `${computedAge} años` : '—', icon: '📅' },
    { label: 'Nacionalidad', value: capitaliseFirst(playerCard.nationality),                  icon: '🌍' },
    { label: 'Inicio PPC',   value: firstLeagueTournamentName || '—',                         icon: '🏁' },
    { label: 'Resultado',    value: lastLeagueResult || '—',                                  icon: '🏆' },
    { label: 'Juego',        value: capitaliseFirst(playerCard.dominant_hand),                icon: '🖐️' },
    { label: 'Revés',        value: capitaliseFirst(playerCard.backhand_style),               icon: '↔️' },
  ];

  const aboutItems = [
    { label: 'Objetivo PPC',        value: playerCard.ppc_objective || '—',                                                   icon: '🎯', bg: 'rgba(20,184,166,0.18)',  border: 'rgba(20,184,166,0.28)' },
    { label: 'Arma secreta',        value: playerCard.favourite_shot || '—',                                                   icon: '✨', bg: 'rgba(59,130,246,0.16)',  border: 'rgba(59,130,246,0.26)' },
    { label: 'Superficie favorita', value: capitaliseFirst(playerCard.favourite_surface),                                      icon: '🏟️', bg: 'rgba(16,185,129,0.16)',  border: 'rgba(16,185,129,0.26)' },
    { label: 'Ídolo',               value: playerCard.favourite_player || '—',                                                 icon: '⭐', bg: 'rgba(245,158,11,0.16)',  border: 'rgba(245,158,11,0.26)' },
    { label: 'Raqueta',             value: fullRacket || '—',                                                                  icon: '🎾', bg: 'rgba(34,197,94,0.16)',  border: 'rgba(34,197,94,0.26)' },
    { label: 'Inicio en tenis',     value: playerCard.tennis_start_year != null ? String(playerCard.tennis_start_year) : '—', icon: '📍', bg: 'rgba(6,182,212,0.16)',  border: 'rgba(6,182,212,0.26)' },
  ];

  const divisionLogo = currentDivisionName ? divisionLogoSrc(currentDivisionName) : '/ppc-logo.png';

  const balls = [
    { size: 56, top: '4%',  left: '-2%',   rotate: 12,  opacity: 0.50 },
    { size: 32, top: '28%', left: '0.5%',  rotate: -20, opacity: 0.80 },
    { size: 48, top: '70%', left: '-1.5%', rotate: 38,  opacity: 0.60 },
    { size: 36, top: '90%', left: '1%',    rotate: -8,  opacity: 0.90 },
    { size: 42, top: '60%', left: '93%',   rotate: 25,  opacity: 0.50 },
    { size: 30, top: '80%', left: '96%',   rotate: -30, opacity: 0.25 },
    { size: 50, top: '92%', left: '88%',   rotate: 48,  opacity: 0.60 },
  ];

  const AVATAR = 180;

  return (
    <div
      className="relative overflow-hidden rounded-[24px]"
      style={{
        background: 'linear-gradient(145deg, #21425d 0%, #28516d 35%, #2d6267 68%, #356a58 100%)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.30)',
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-[3px] z-10"
        style={{ background: 'linear-gradient(90deg,#34d399,#10b981,#6ee7b7,#fbbf24)' }}
      />

      {balls.map((b, i) => (
        <div
          key={i}
          className="pointer-events-none absolute select-none"
          style={{
            top: b.top,
            left: b.left,
            opacity: b.opacity,
            transform: `rotate(${b.rotate}deg)`,
            zIndex: 0,
            filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.18))',
          }}
        >
          <svg width={b.size} height={b.size} viewBox="0 0 60 60" fill="none">
            <circle cx="30" cy="30" r="28" fill="#c8e830" stroke="#9bb820" strokeWidth="2"/>
            <path d="M10 22 Q30 14 50 22" stroke="white" strokeWidth="2.8" fill="none" strokeLinecap="round" opacity="0.6"/>
            <path d="M10 38 Q30 46 50 38" stroke="white" strokeWidth="2.8" fill="none" strokeLinecap="round" opacity="0.6"/>
          </svg>
        </div>
      ))}

      {hasAvatar && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
          <img
            src={avatarUrl}
            alt=""
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              height: '100%',
              width: '45%',
              objectFit: 'cover',
              objectPosition: 'center top',
              opacity: 0.40,
              maskImage:
                'linear-gradient(to left, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.52) 42%, transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to left, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.52) 42%, transparent 100%)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to right, rgba(23,50,74,0.60) 0%, rgba(23,50,74,0.40) 24%, rgba(23,50,74,0.20) 48%, rgba(23,50,74,0.10) 70%, rgba(23,50,74,0.02) 100%)',
            }}
          />
        </div>
      )}

      <div className="relative z-10 p-5 sm:p-6">
        <div className="psc-header mb-4 flex items-start justify-between gap-4">
          <div
            className="psc-name-block"
            style={{
              maxWidth: '52%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <h2
              className="text-white uppercase text-center"
              style={{
                fontFamily: "'Bebas Neue', 'Arial Black', Impact, sans-serif",
                fontSize: 'clamp(2.45rem, 6vw, 4.35rem)',
                fontWeight: 400,
                letterSpacing: '0.05em',
                lineHeight: 0.9,
                margin: 0,
                textShadow: '0 3px 14px rgba(0,0,0,0.65)',
              }}
            >
              {uiName(player.name)}
            </h2>

            {playerCard.nickname && (
              <p
                style={{
                  fontFamily: "'Great Vibes', 'Cormorant Garamond', 'Playfair Display', Georgia, serif",
                  fontSize: 'clamp(1.7rem, 3.6vw, 2.45rem)',
                  fontStyle: 'normal',
                  fontWeight: 400,
                  color: '#d8fff1',
                  letterSpacing: '0.01em',
                  lineHeight: 0.95,
                  marginTop: '0.1rem',
                  marginBottom: 0,
                  textAlign: 'center',
                  textShadow: '0 2px 10px rgba(0,0,0,0.28)',
                }}
              >
                &ldquo;{playerCard.nickname}&rdquo;
              </p>
            )}
          </div>

          <div className="psc-division-mark flex shrink-0 flex-col items-center gap-1">

              <img
                src={divisionLogo}
                alt={`División ${currentDivisionName || 'PPC'}`}
                style={{ width: 62, height: 62, objectFit: 'contain' }}
              />

            <span
              style={{
                fontSize: '0.58rem',
                fontWeight: 700,
                letterSpacing: '0.13em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.68)',
                textAlign: 'center',
              }}
            >
              División {currentDivisionName || '—'}
            </span>
          </div>
        </div>

        <div
          className="psc-profile-shell mb-3 rounded-xl p-3"
          style={{
            width: '64%',
            background: 'linear-gradient(90deg, rgba(15,35,52,0.12) 0%, rgba(15,35,52,0.06) 58%, rgba(15,35,52,0.00) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(3px)',
          }}
        >
          <div className="mb-3 flex items-center gap-2">
            <span style={{ fontSize: '1.3rem' }}>🎾</span>
            <span
              className="font-bold uppercase text-white"
              style={{ fontSize: '0.85rem', letterSpacing: '0.20em' }}
            >
              Perfil Tenístico
            </span>
            <div
              className="ml-2 h-px flex-1 rounded-full"
              style={{ background: 'linear-gradient(90deg,rgba(52,211,153,0.65),transparent)' }}
            />
          </div>

          <div className="psc-profile-body flex gap-4 items-center">
            <div
              className="psc-avatar-wrap shrink-0"
              style={{
                width: 'min(180px, 52vw)',
                height: 'min(180px, 52vw)',
              }}
            >
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    background: 'rgba(52,211,153,0.24)',
                    filter: 'blur(14px)',
                  }}
                />
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: '3px solid rgba(110,231,183,0.62)',
                    boxShadow: '0 8px 28px rgba(0,0,0,0.55)',
                  }}
                >
                  {hasAvatar ? (
                    <img
                      src={avatarUrl}
                      alt={player.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        height: '100%',
                        background: 'rgba(255,255,255,0.07)',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.58rem',
                          color: 'rgba(255,255,255,0.50)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.10em'
                        }}
                      >
                        Sin foto
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div
              className="psc-profile-grid grid gap-2"
              style={{
                width: 'min(430px, 100%)',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gridAutoRows: '1fr',
              }}
            >
              {profileItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.10)',
                  }}
                >
                  <span style={{ fontSize: '1.55rem', lineHeight: 1, flexShrink: 0 }}>
                    {item.icon}
                  </span>

                  <div className="flex flex-col min-w-0 flex-1">
                    <span
                      className="psc-item-label"
                      style={{
                        fontSize: '0.60rem',
                        fontWeight: 700,
                        letterSpacing: '0.10em',
                        textTransform: 'uppercase',
                        color: 'rgba(220,255,245,0.78)',
                        lineHeight: 1.2,
                      }}
                    >
                      {item.label}
                    </span>
                    <span
                      className="psc-item-value"
                      style={{
                        fontSize: '0.86rem',
                        fontWeight: 600,
                        lineHeight: 1.25,
                        color: item.label === 'Resultado' ? '#fcd34d' : '#ffffff',
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {item.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          className="rounded-xl p-3"
          style={{
            background: 'rgba(0,0,0,0.16)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="mb-3 flex items-center gap-2">
            <span style={{ fontSize: '1.3rem' }}>😎</span>
            <span
              className="font-bold uppercase text-white"
              style={{ fontSize: '0.88rem', letterSpacing: '0.20em' }}
            >
              Conoce al Jugador
            </span>
            <div
              className="ml-2 h-px flex-1 rounded-full"
              style={{ background: 'linear-gradient(90deg,rgba(251,191,36,0.65),transparent)' }}
            />
          </div>

          <div
            className="psc-about-grid grid gap-2"
            style={{ gridTemplateColumns: 'repeat(3,1fr)', gridAutoRows: '1fr' }}
          >
            {aboutItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2"
                style={{ background: item.bg, border: `1px solid ${item.border}` }}
              >
                <span style={{ fontSize: '1.6rem', lineHeight: 1, flexShrink: 0 }}>
                  {item.icon}
                </span>

                <div className="flex flex-col min-w-0 flex-1">
                  <span
                    className="psc-item-label"
                    style={{
                      fontSize: '0.54rem',
                      fontWeight: 700,
                      letterSpacing: '0.09em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.50)',
                      lineHeight: 1.2,
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    className="psc-item-value"
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      lineHeight: 1.25,
                      color: '#ffffff',
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {item.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {!hasAvatar && (
          <div
            className="absolute right-4 top-4 z-20 rounded-full px-3 py-1"
            style={{
              border: '1px solid rgba(251,191,36,0.40)',
              background: 'rgba(251,191,36,0.14)',
              fontSize: '0.58rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(253,230,138,0.90)',
            }}
          >
            Foto pendiente
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 900px) {
          .psc-profile-shell {
            width: 100% !important;
          }

          .psc-profile-grid {
            width: 100% !important;
          }
        }

        @media (max-width: 640px) {
          .psc-header {
            align-items: flex-start !important;
            gap: 12px !important;
          }

          .psc-name-block {
            max-width: 68% !important;
            align-items: flex-start !important;
          }

          .psc-name-block h2 {
            font-size: clamp(2rem, 9vw, 3rem) !important;
            text-align: left !important;
            line-height: 0.92 !important;
          }

          .psc-name-block p {
            font-size: clamp(1.35rem, 6vw, 2rem) !important;
            text-align: left !important;
            line-height: 0.95 !important;
            margin-top: 0.05rem !important;
          }

          .psc-division-mark img {
            width: 52px !important;
            height: 52px !important;
          }

          .psc-division-mark span {
            font-size: 0.50rem !important;
            letter-spacing: 0.10em !important;
          }

          .psc-profile-shell {
            width: 100% !important;
            padding: 0.9rem !important;
          }

          .psc-profile-body {
            flex-direction: column !important;
            align-items: center !important;
            gap: 14px !important;
          }

          .psc-avatar-wrap {
            align-self: center !important;
          }

          .psc-profile-grid {
            width: 100% !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .psc-about-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 560px) {
          .psc-profile-grid > div .psc-item-value,
          .psc-about-grid > div .psc-item-value {
            font-size: 0.8rem !important;
            line-height: 1.12 !important;
          }

          .psc-profile-grid > div .psc-item-label,
          .psc-about-grid > div .psc-item-label {
            font-size: 0.38rem !important;
            letter-spacing: 0.045em !important;
            line-height: 1.02 !important;
          }
        }

        @media (max-width: 480px) {
          .psc-header {
            gap: 10px !important;
          }

          .psc-name-block {
            max-width: 66% !important;
          }

          .psc-name-block h2 {
            font-size: clamp(1.8rem, 8.2vw, 2.7rem) !important;
            letter-spacing: 0.03em !important;
          }

          .psc-name-block p {
            font-size: clamp(1.25rem, 5.8vw, 1.8rem) !important;
          }

          .psc-profile-shell {
            padding: 0.8rem !important;
          }

          .psc-profile-grid {
            gap: 0.7rem !important;
          }

          .psc-profile-grid > div {
            padding: 0.85rem 0.8rem !important;
            min-height: 84px !important;
            align-items: center !important;
          }

          .psc-profile-grid > div span:first-child {
            font-size: 1.3rem !important;
          }

          .psc-profile-grid > div > div {
            gap: 0.1rem !important;
          }

          .psc-about-grid {
            gap: 0.7rem !important;
          }

          .psc-about-grid > div {
            padding: 0.95rem 0.9rem !important;
            min-height: 104px !important;
            align-items: center !important;
          }

          .psc-about-grid > div span:first-child {
            font-size: 1.3rem !important;
          }

          .psc-about-grid > div > div {
            gap: 0.12rem !important;
          }

          .psc-profile-grid > div .psc-item-label,
          .psc-about-grid > div .psc-item-label {
            font-size: 0.36rem !important;
            letter-spacing: 0.03em !important;
            line-height: 1.00 !important;
          }
          .psc-profile-grid > div .psc-item-value,
          .psc-about-grid > div .psc-item-value {
            font-size: 1.20rem !important;
            line-height: 1.10 !important;
          }
        }

        @media (max-width: 460px) {
          .psc-profile-grid {
            grid-template-columns: 1fr !important;
          }

          .psc-about-grid {
            grid-template-columns: 1fr !important;
          }

          .psc-name-block {
            max-width: 64% !important;
          }

          .psc-division-mark img {
            width: 46px !important;
            height: 46px !important;
          }
        }
      `}</style>
    </div>
  );
}
