
import React, { useState, useEffect } from "react";
import { supabase } from './lib/supabaseClient';
import type { Session, User } from '@supabase/supabase-js';


// Define TypeScript interfaces based on the database schema
interface Profile {
  id: string;
  name: string;
  role: string;
  created_at: string;
  email?: string;
  avatar_url?: string;
}

interface Location {
  id: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
}

interface AvailabilitySlot {
  id: string;
  profile_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location_id?: string;
}

interface Tournament {
  id: string;
  name: string;
  season: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface Division {
  id: string;
  tournament_id: string;
  name: string;
  color?: string;
}

interface Registration {
  id: string;
  tournament_id: string;
  division_id: string;
  profile_id: string;
  seed?: number;
  created_at: string;
}

interface Match {
  id: string;
  tournament_id: string;
  division_id: string;
  date: string;
  time?: string;
  location_id?: string;
  status: string;
  player1: string;
  player2: string;
  player1_sets_won: number;
  player2_sets_won: number;
  player1_games_won: number;
  player2_games_won: number;
  player1_had_pint: boolean;
  player2_had_pint: boolean;
  player1_pints: number;
  player2_pints: number;
  created_by: string;
  created_at: string;
}

interface MatchSet {
  id: string;
  match_id: string;
  set_number: number;
  p1_games: number;
  p2_games: number;
}

interface Standings {
  profile_id: string;
  tournament_id: string;
  division_id: string;
  wins: number;
  losses: number;
  sets_won: number;
  sets_lost: number;
  games_won: number;
  games_lost: number;
  set_diff: number;
  pints: number;
  points: number;
  name?: string;
}

// Helper function to convert data URI to Blob
const dataURItoBlob = (dataURI: string) => {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  
  return new Blob([ab], {type: mimeString});
};

function dataURLtoFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type: mime });
}


const App = () => {
  // Initialize all state with proper types
  const [session, setSession] = useState<any>(null);
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null); 
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [pendingAvatarPreview, setPendingAvatarPreview] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [selectedPlayerAvailability, setSelectedPlayerAvailability] = useState<AvailabilitySlot[]>([]);  
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchSets, setMatchSets] = useState<MatchSet[]>([]);
  const [standings, setStandings] = useState<Standings[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<Division | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Profile | null>(null);
  const [selectedMatchForResult, setSelectedMatchForResult] = useState<Match | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [loginView, setLoginView] = useState(true);
  const [newUser, setNewUser] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    profilePic: '', 
    locations: [] as string[], 
    availability: {} as Record<string, string[]>,
    tournaments: [] as string[],
    division: ''
  });
  const [newMatch, setNewMatch] = useState({ 
    player1: '', 
    player2: '', 
    sets: [{ score1: '', score2: '' }], 
    division: '', 
    tournament: '',
    hadPint: false, 
    pintsCount: '1',
    location: '', 
    date: '', 
    time: '' 
  });
  const [showMap, setShowMap] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newRegistration, setNewRegistration] = useState({ tournamentId: '', divisionId: '' }); 
  const [registrationStep, setRegistrationStep] = useState(1);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [showAvailability, setShowAvailability] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [editUser, setEditUser] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    profilePic: '',
    tournaments: [] as string[],
    division: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const timeSlots = ['Morning (07:00-12:00)', 'Afternoon (12:00-18:00)', 'Evening (18:00-22:00)'];
  const locationsList = ['South', 'Southeast', 'Southwest', 'North', 'Northeast', 'Northwest', 'Central', 'West', 'East'];

const normalizeMatches = (rows: any[] = []) =>
  rows.map(r => ({
    ...r,
    // toma primero home/away; si no existen, cae a player1_id/player2_id; si tampoco, usa player1/player2
    player1: r.home_player_id ?? r.player1_id ?? r.player1,
    player2: r.away_player_id ?? r.player2_id ?? r.player2,
  }));

  const abbreviateLocation = (location: string) => {
    const abbreviations: Record<string, string> = {
      'South': 'S',
      'Southeast': 'SE',
      'Southwest': 'SW',
      'North': 'N',
      'Northeast': 'NE',
      'Northwest': 'NW',
      'Central': 'C',
      'West': 'W',
      'East': 'E'
    };
    return abbreviations[location] || location;
  };

  function parseDateSafe(d: string | Date): Date {
    if (d instanceof Date) return d;
    const clean = String(d).split('|')[0].trim(); // por si llega “fecha | algo”
    const dt = new Date(clean);
    if (!isNaN(dt.getTime())) return dt;
    const m = clean.match(/^(\d{4})-(\d{2})-(\d{2})/); // YYYY-MM-DD
    return m ? new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`) : new Date();
  }

  function dateKey(val: string | Date) {
    const d = parseDateSafe(val);
    return d.toISOString().slice(0, 10); // 'YYYY-MM-DD'
  }
 
  function setsLineFor(m: Match, perspectiveId?: string) {
    const sets = matchSets
      .filter(s => s.match_id === m.id)
      .sort((a, b) => a.set_number - b.set_number);

    // Si aún no hay detalle guardado, cae a totales de games
    if (sets.length === 0) return `${m.player1_games_won}-${m.player2_games_won}`;

    // Si paso un 'perspectiveId', muestro el marcador desde ese jugador
    const invert = perspectiveId && m.player1 !== perspectiveId;
    return sets
      .map(s => invert ? `${s.p2_games}-${s.p1_games}` : `${s.p1_games}-${s.p2_games}`)
      .join(' ');
  }


  // EFECTO 1: Cargar todos los datos públicos UNA SOLA VEZ al iniciar la app.
  useEffect(() => {
    const loadPublicData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Usamos Promise.all para cargar todo en paralelo y mejorar la velocidad
        const [
          tournamentsRes,
          divisionsRes,
          profilesRes,
          matchesRes,
          standingsRes,
          locationsRes,
          registrationsRes,
          matchSetsRes,
        ] = await Promise.all([
          supabase.from('tournaments').select('*').order('start_date', { ascending: false }),
          supabase.from('divisions').select('*'),
          supabase.from('profiles').select('*'),
          supabase.from('matches').select('*'),
          supabase.from('v_standings').select('*'),
          supabase.from('locations').select('*'),
          supabase.from('tournament_registrations').select('*'),
          supabase.from('match_sets').select('*'),
        ]);

        // Verificamos errores en cada respuesta
        if (tournamentsRes.error) throw tournamentsRes.error;
        if (divisionsRes.error) throw divisionsRes.error;
        if (profilesRes.error) throw profilesRes.error;
        if (matchesRes.error) throw matchesRes.error;
        if (standingsRes.error) throw standingsRes.error;
        if (locationsRes.error) throw locationsRes.error;
        if (registrationsRes.error) throw registrationsRes.error;
        if (matchSetsRes.error) throw matchSetsRes.error;

        // Actualizamos el estado con los datos públicos
        setTournaments(tournamentsRes.data || []);
        setDivisions(divisionsRes.data || []);
        setProfiles(profilesRes.data || []);
        setMatches(normalizeMatches(matchesRes.data));
        setStandings(standingsRes.data || []);
        setLocations(locationsRes.data || []);
        setRegistrations(registrationsRes.data || []);
        setMatchSets(matchSetsRes.data || []);

      } catch (err: any) {
        setError(`Failed to load initial data: ${err.message}`);
        console.error('Error loading public data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPublicData();
  }, []); // El array vacío [] asegura que esto solo se ejecute UNA VEZ.

  // EFECTO 2: Manejar la sesión del usuario de forma reactiva.
  useEffect(() => {
    let mounted = true;

    (async () => {
      // 1) Sesión actual
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      setSession(session);

      // Si usas sessionUser en otras partes, mantenlo sincronizado
      const { data: userRes } = await supabase.auth.getUser();
      if (!mounted) return;
      setSessionUser(userRes.user ?? null);

      setLoading(false);

      if (session?.user) {
        await loadInitialData(session.user.id);
        await ensurePendingRegistration(session.user.id); // <-- agrega esto
      }

    })();

    // 2) Suscripción a cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setSessionUser(newSession?.user ?? null);

        if (newSession?.user) {
          await loadInitialData(newSession.user.id);
          await ensurePendingRegistration(newSession.user.id); // <-- aquí también
        } else {
          setLoading(false);
        }
      }
    );


    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // EFECTO 3: Sincronizar el estado de la UI (currentUser y loginView) con la sesión.
  useEffect(() => {
    // Este efecto se ejecuta cada vez que 'session' o 'profiles' cambian.
    if (session?.user && profiles.length > 0) {
      // Si hay una sesión y ya tenemos los perfiles cargados...
      const userProfile = profiles.find(p => p.id === session.user.id);
      setCurrentUser(userProfile || null);
      // Ya no es necesario mostrar la vista de login.
      setLoginView(false);
    } else if (!session?.user) {
      // Si no hay sesión, reseteamos el usuario y mostramos la vista de login.
      setCurrentUser(null);
      setLoginView(true);
    }
  }, [session, profiles]); // Dependencias clave para la sincronización.
  // Load all initial data from Supabase
  const loadInitialData = async (userId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch all required data
      const [tournamentsRes, divisionsRes, locationsRes, profilesRes, 
        registrationsRes, matchesRes, standingsRes, matchSetsRes, availabilityRes] = 
        await Promise.all([
          supabase.from('tournaments').select('*').order('start_date', { ascending: false }),
          supabase.from('divisions').select('*'),
          supabase.from('locations').select('*'),
          supabase.from('profiles').select('*'),
          supabase.from('tournament_registrations').select('*'),
          supabase.from('matches').select('*'),
          supabase.from('v_standings').select('*'),
          supabase.from('match_sets').select('*'),
          supabase.from('availability').select('*').eq('profile_id', userId)
        ]);

      // Handle errors
      if (tournamentsRes.error) throw tournamentsRes.error;
      if (divisionsRes.error) throw divisionsRes.error;
      if (locationsRes.error) throw locationsRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (registrationsRes.error) throw registrationsRes.error;
      if (matchesRes.error) throw matchesRes.error;
      if (standingsRes.error) throw standingsRes.error;
      if (matchSetsRes.error) throw matchSetsRes.error;
      if (availabilityRes.error) throw availabilityRes.error;

      // Set state
      setTournaments(tournamentsRes.data as Tournament[]);
      setDivisions(divisionsRes.data as Division[]);
      setLocations(locationsRes.data as Location[]);
      setProfiles(profilesRes.data as Profile[]);
      setRegistrations(registrationsRes.data as Registration[]);
      setMatches(normalizeMatches(matchesRes.data as any[]));
      setStandings(standingsRes.data as Standings[]);
      setMatchSets(matchSetsRes.data || []);
      setAvailabilitySlots(availabilityRes.data as AvailabilitySlot[]);
      
      // Set current user
      const user = profilesRes.data.find(p => p.id === userId);
      setCurrentUser(user || null);
      
      console.log('Data loaded successfully', {
        tournaments: tournamentsRes.data.length,
        divisions: divisionsRes.data.length,
        locations: locationsRes.data.length,
        profiles: profilesRes.data.length,
        currentUser: user?.name
      });
    } catch (err: any) {
      setError(err.message);
      console.error('Error loading ', err);
    } finally {
      setLoading(false);
    }
  };

  // Keep newMatch.division and newMatch.tournament in sync with current view
  useEffect(() => {
    if (selectedDivision) {
      setNewMatch(prev => ({ ...prev, division: selectedDivision.name }));
    }
    if (selectedTournament) {
      setNewMatch(prev => ({ ...prev, tournament: selectedTournament.name }));
    }
  }, [selectedDivision, selectedTournament]);

  useEffect(() => {
    if (!selectedPlayer) {
      setSelectedPlayerAvailability([]);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('availability')
        .select('*')
        .eq('profile_id', selectedPlayer.id);
      if (!error) setSelectedPlayerAvailability(data || []);
    })();
  }, [selectedPlayer?.id]);

  
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // --- PASO 1: Nombre + Email ---
    if (registrationStep === 1) {
      if (!newUser.name || !newUser.email) {
        alert('Please fill in your name and email to continue.');
        return;
      }
      // (opcional) evitar duplicados por email en profiles
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', newUser.email);
      if (existing && existing.length > 0) {
        alert('An account with this email already exists. Please log in.');
        return;
      }
      setRegistrationStep(2);
      return;
    }

    // --- PASO 2: Foto + preferencias ---
    if (registrationStep === 2) {
      if (!pendingAvatarFile && !newUser.profilePic) {
        alert('Please upload a profile picture.');
        return;
      }
      setRegistrationStep(3);
      return;
    }

    // --- PASO 3: Crear auth user, perfil, subir avatar y registrar en torneo/división ---
    if (registrationStep === 3) {
      setLoading(true);
      setError(null);

      try {
        const emailUsed = (newUser.email || '').trim();
        const tournamentId = newUser.tournaments[0] || null; // <-- ya es UUID
        const divisionId   = newUser.division || null;       // <-- ya es UUID
        if (!tournamentId || !divisionId) {
          throw new Error('Missing tournament or division selection.');
        }
        if (!newUser.password) {
          throw new Error('Missing password.');
        }

        // 1) Crear usuario en Auth
        const { data: authData, error: signUpErr } = await supabase.auth.signUp({
          email: newUser.email,
          password: newUser.password,
          options: { data: { name: newUser.name } },
        });
        if (signUpErr) throw signUpErr;

        if (!authData.session) {
          // Guarda lo elegido para completarlo después del login
          localStorage.setItem(
            'pending_registration',
            JSON.stringify({ tournament_id: tournamentId, division_id: divisionId })
          );

          alert('Te enviamos un correo de confirmación. Luego vuelve al Login para inciar sesión.');

          // Vuelve a la pantalla de login
          setLoginView(true);
          setRegistrationStep(1);
          setLoading(false);
          return;
        }

        const uid = authData.user?.id;
        if (!uid) throw new Error('Could not get new user id after sign up.');

        // 2) PERFIL (upsert por id)
        const { error: profErr } = await supabase
          .from('profiles')
          .upsert(
            { id: uid, name: newUser.name, email: newUser.email, role: 'player' },
            { onConflict: 'id' }
          );
        if (profErr) throw profErr;

        // 3) SUBIR AVATAR (si hay archivo o dataURL)
        let fileToUpload: File | null = null;
        if (pendingAvatarFile) {
          fileToUpload = pendingAvatarFile;
        } else if (newUser.profilePic) {
          // convierte el dataURL guardado en un File
          fileToUpload = dataURLtoFile(newUser.profilePic, 'avatar.jpg');
        }
        if (fileToUpload) {
          const path = `${uid}.jpg`;
          const up = await supabase.storage
            .from('avatars')
            .upload(path, fileToUpload, { upsert: true });
          if (up.error) throw up.error;

          const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
          const { error: upd } = await supabase
            .from('profiles')
            .update({ avatar_url: pub.publicUrl })
            .eq('id', uid);
          if (upd) throw upd;
        }

        // 4) REGISTRAR en torneo/división (RLS: profile_id debe ser auth.uid())
        const { error: regErr } = await supabase
          .from('tournament_registrations')
          .insert({
            profile_id: uid,
            tournament_id: tournamentId,
            division_id: divisionId,
          })
          .single();
        if (regErr) throw regErr;

        // Limpieza y éxito
        setPendingAvatarFile(null);
        setPendingAvatarPreview(null);
        setNewUser({
          name: '',
          email: '',
          password: '',
          profilePic: '',
          locations: [],
          availability: {},
          tournaments: [],
          division: ''
        });
        setRegistrationStep(1);
        alert('Listo! Verifica tú correo y vuelve a entrar');
        // Cerrar cualquier sesión que haya quedado abierta tras signUp
        await supabase.auth.signOut();

        // Volver a la pantalla de Login
        setLoginView(true);
        setRegistrationStep(1);

        // Resetear el formulario pero dejando el email pre-llenado para el Login
        setNewUser({
          name: '',
          email: emailUsed, // <- queda listo en el login
          password: '',
          profilePic: '',
          locations: [],
          availability: {},
          tournaments: [],
          division: ''
        });

        return;        
      } catch (err: any) {
        console.error('Registration failed ->', err);
        alert(`Registration failed: ${err.message ?? err}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null); // Limpiamos errores previos
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: newUser.email,
        password: newUser.password
      });
      
      if (error) throw error;
      
      // El useEffect [session, profiles] se encargará de ocultar la vista de login.
      // Ya no necesitamos setLoginView(false) aquí.
      
      // Limpiamos solo los campos de login del formulario.
      setNewUser(prev => ({ ...prev, email: '', password: '' }));

    } catch (err: any) {
      setError(`Login failed: ${err.message}`);
      alert('Invalid credentials. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarSelectDuringSignup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    setPendingAvatarFile(f);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPendingAvatarPreview(dataUrl);
      setNewUser(prev => ({ ...prev, profilePic: dataUrl })); // <-- asegura preview y validación
    };
    reader.readAsDataURL(f);
  };

  const handlePasswordReset = async () => {
    // 1. Pedir al usuario su correo electrónico
    const email = prompt("Please enter your email address to reset your password:");
    
    // 2. Verificar si el usuario ingresó un correo
    if (!email) {
      return; // El usuario canceló o no escribió nada
    }

    setLoading(true);
    try {
      // 3. Llamar a la función de Supabase para enviar el correo de reseteo
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin, // URL a la que volverá el usuario después de cambiar la clave
      });

      if (error) throw error;

      // 4. Informar al usuario que revise su correo
      alert("Password reset link has been sent! Please check your email.");

    } catch (err: any) {
      alert(`Error: ${err.message}`);
      console.error("Password reset error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTournament = async () => {
    if (!newRegistration.tournamentId || !newRegistration.divisionId) {
      return alert('Please select a tournament and a division.');
    }
    if (!currentUser) {
      return alert('Could not find current user. Please log in again.');
    }

    setLoading(true);
    try {
      // La política de seguridad que ya creamos ("Allow user to insert their own registration")
      // funcionará perfectamente para esta acción.
      const { error } = await supabase.from('tournament_registrations').insert({
        profile_id: currentUser.id,
        tournament_id: newRegistration.tournamentId,
        division_id: newRegistration.divisionId,
      });

      if (error) throw error;

      alert('Successfully registered for the new tournament!');
      setShowJoinModal(false);
      setNewRegistration({ tournamentId: '', divisionId: '' });
      // Opcional: Recargar los datos de registros para que la UI se actualice
      const { data } = await supabase.from('tournament_registrations').select('*');
      if (data) setRegistrations(data as Registration[]);

    } catch (err: any) {
      alert(`Error joining tournament: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const ensurePendingRegistration = async (userId: string) => {
    const raw = localStorage.getItem('pending_registration');
    if (!raw) return;

    const pending = JSON.parse(raw) as { tournament_id: string; division_id: string };
    if (!pending?.tournament_id || !pending?.division_id) {
      localStorage.removeItem('pending_registration');
      return;
    }

    // ¿Ya existe?
    const { data: exists } = await supabase
      .from('tournament_registrations')
      .select('id')
      .eq('profile_id', userId)
      .eq('tournament_id', pending.tournament_id)
      .eq('division_id', pending.division_id)
      .maybeSingle();

    if (!exists) {
      const { error: insErr } = await supabase.from('tournament_registrations').insert({
        profile_id: userId,
        tournament_id: pending.tournament_id,
        division_id: pending.division_id
      }).single();
      if (insErr) {
        console.error('Auto-registration insert failed:', insErr);
        return; // deja el localStorage para reintentar en el próximo login
      }
    }

    // Limpia y refresca UI
    localStorage.removeItem('pending_registration');
    const { data: regs } = await supabase.from('tournament_registrations').select('*');
    if (regs) setRegistrations(regs as Registration[]);
  };


  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setLoginView(true);
    setSelectedDivision(null);
    setSelectedPlayer(null);
    setShowMap(false);
    setSelectedTournament(null);
    setEditProfile(false);
  };

  function openEditProfile() {
    const fallbackUrl = session?.user?.id
      ? supabase.storage.from('avatars').getPublicUrl(`${session.user.id}.jpg`).data.publicUrl
      : '';

    setEditUser(u => ({ ...u, profilePic: currentUser?.avatar_url || '' })); // <- usa la foto guardada
    setPendingAvatarPreview(currentUser?.avatar_url || '');                  // <- muestra preview
    setEditProfile(true);
  }


  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError(null);

    try {
      const uid = session?.user?.id;
      if (!uid) {
        setProfileError('No active session.');
        setSavingProfile(false);
        return;
      }

      // 1) Subir avatar si el usuario seleccionó archivo
      let newAvatarUrl: string | undefined;
      if (pendingAvatarFile) {
        const path = `${uid}.jpg`;
        const up = await supabase.storage
          .from('avatars')
          .upload(path, pendingAvatarFile, { upsert: true });
        if (up.error) throw up.error;

        const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
        newAvatarUrl = pub.publicUrl;
      }

      // 2) Actualizar perfil (nombre + avatar_url)
      const { error: upErr } = await supabase
        .from('profiles')
        .update({
          name: editUser.name,
          avatar_url: newAvatarUrl ?? currentUser?.avatar_url ?? null,
        })
        .eq('id', uid);
      if (upErr) throw upErr;

      // 3) (Opcional) Cambiar contraseña si el usuario escribió una
      if (editUser.password && editUser.password.trim().length > 0) {
        const { error: pwErr } = await supabase.auth.updateUser({
          password: editUser.password,
        });
        if (pwErr) throw pwErr;
      }

      // 4) Refrescar datos del usuario actual y cerrar modal
      const { data: fresh } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single();
      if (fresh) setCurrentUser(fresh as Profile);

      setPendingAvatarFile(null);
      setPendingAvatarPreview(null);
      setEditProfile(false);
      setProfileError(null);
    } catch (err: any) {
      console.error('save profile error:', err);
      setProfileError(err?.message ?? 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };


  const copyToClipboardFallback = (text: string) => {
    if (typeof window !== 'undefined') {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        alert('Message is too long for WhatsApp sharing. It has been copied to your clipboard. Please paste it manually into WhatsApp.');
      } catch (err) {
        alert('Could not copy to clipboard. Please manually copy the message and paste into WhatsApp.');
      }
      document.body.removeChild(textArea);
    }
  };

  function safeShareOnWhatsApp(message: string) {
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    // Si existe Web Share API intentamos compartir el texto
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      (navigator as any)
        .share({ text: message })
        .catch(() => {
          if (typeof window !== 'undefined') window.open(url, '_blank');
        });
    } else {
      if (typeof window !== 'undefined') window.open(url, '_blank');
    }
  }


  function divisionIcon(name: string) {
    const map: Record<string, string> = {
      'Diamante': '💎',
      'Oro': '🥇',
      'Plata': '🥈',
      'Bronce': '🥉',
      'Cobre': '⚜️',
      'Hierro': '⚙️',
      'Elite': '⭐',
    };
    return map[name] || '🎾';
  }

  function tituloFechaEs(iso: string) {
    // Acepta 'YYYY-MM-DD' o timestamps 'YYYY-MM-DDTHH:mm:ss±ZZ:ZZ'
    const clean = iso.includes('T') ? iso : `${iso}T00:00:00`;
    const d = new Date(clean);
    if (Number.isNaN(d.getTime())) return iso; // fallback seguro

    const s = d.toLocaleDateString('es-CL', {
      weekday: 'long', day: 'numeric', month: 'long'
    }).replaceAll(' de ', ' ');
    const title = s.split(',')[0];
    return title.charAt(0).toUpperCase() + title.slice(1); // “Lunes 22 septiembre”
  }


  const shareAllScheduledMatches = () => {
    if (!selectedTournament) {
      alert('Please select a tournament first');
      return;
    }

    const all = matches
      .filter(m => m.tournament_id === selectedTournament.id && m.status === 'scheduled')
      .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (all.length === 0) {
      alert('No scheduled matches to share');
      return;
    }

    // Agrupar por fecha
    const grouped: Record<string, Match[]> = {};
    all.forEach(m => {
      const key = dateKey(m.date);
      (grouped[key] ??= []).push(m);
    });


    let msg = '';
    Object.keys(grouped).sort().forEach(date => {
      msg += `${tituloFechaEs(date)}\n`;
      grouped[date].forEach(m => {
        const p1 = profiles.find(p => p.id === m.player1)?.name || '';
        const p2 = profiles.find(p => p.id === m.player2)?.name || '';
        const divName = divisions.find(d => d.id === m.division_id)?.name || '';
        const icon = divisionIcon(divName);
        const loc = locations.find(l => l.id === m.location_id)?.name || '';
        const time = m.time ? ` – ${m.time}` : '';
        const extra = (loc || time) ? ` ${loc}${time ? ` ${time}` : ''}` : '';
        msg += `• ${p1} vs ${p2} ${icon}${extra}\n`;
      });
      msg += '\n';
    });
    msg = msg.trim();

    safeShareOnWhatsApp(msg); // usa tu helper
  };


  const copyTableToClipboard = () => {
    if (!selectedTournament) {
      alert('Primero elige un torneo');
      return;
    }
    
    // Get all scheduled matches for the tournament
    const allScheduled = matches
      .filter(match => 
        match.tournament_id === selectedTournament.id && 
        match.status === 'scheduled'
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    if (allScheduled.length === 0) {
      alert('No scheduled matches to copy');
      return;
    }
    
    let table = `*Pinta Post Championship - Partidos Programados*\n\n`;
    
    // Create a formatted table
    allScheduled.forEach(match => {
      const date = match.date;
      const time = match.time || '';
      const player1 = profiles.find(p => p.id === match.player1)?.name || '';
      const player2 = profiles.find(p => p.id === match.player2)?.name || '';
      const players = `${player1} vs ${player2}`;
      const division = divisions.find(d => d.id === match.division_id)?.name || '';
      const location = locations.find(l => l.id === match.location_id)?.name || '';
      
      // Format the row with fixed width
      table += `| ${date.padEnd(10)} | ${time.padEnd(10)} | ${players.padEnd(30)} | ${division.padEnd(10)} | ${location.padEnd(20)} |\n`;
    });
    
    table += `\nCopied from Pinta Post Championship Tennis League`;
    
    // Copy to clipboard
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(table)
        .then(() => {
          alert('Upcoming matches table copied to clipboard!');
        })
        .catch(() => {
          // Fallback for older browsers
          copyToClipboardFallback(table);
        });
    } else {
      copyToClipboardFallback(table);
    }
  };

  const handleAddMatch = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1) Validación sets
    const validSets = newMatch.sets.filter(s =>
      s.score1 !== '' && s.score2 !== '' &&
      !isNaN(parseInt(s.score1)) && !isNaN(parseInt(s.score2))
    );
    if (validSets.length === 0) {
      alert('Please enter valid scores for at least one set');
      return;
    }

    // 2) Validación jugadores (IDs)
    const player1Id = newMatch.player1;
    const player2Id = newMatch.player2;
    if (!player1Id || !player2Id) {
      alert('Please select both players');
      return;
    }

    // Asegura que existan en la división actual
    const playersInDiv = getDivisionPlayers(selectedDivision!.id, selectedTournament!.id);
    const isValidP1 = playersInDiv.some(p => p.id === player1Id);
    const isValidP2 = playersInDiv.some(p => p.id === player2Id);
    if (!isValidP1 || !isValidP2) {
      alert('Selected players are not in this division/tournament');
      return;
    }

    // 3) IDs de torneo/división desde la vista actual (no por nombre)
    const tournamentId = selectedTournament!.id;
    const divisionId   = selectedDivision!.id;

    // 4) Location opcional
    let locationId: string | null = null;
    if (newMatch.location) {
      const loc = locations.find(l => l.name === newMatch.location);
      locationId = loc?.id || null;
    }

    // 5) Cálculos de sets y games
    let p1SetsWon = 0, p2SetsWon = 0, p1Games = 0, p2Games = 0;
    newMatch.sets.forEach(s => {
      const a = parseInt(s.score1), b = parseInt(s.score2);
      if (!isNaN(a) && !isNaN(b)) {
        if (a > b) p1SetsWon++; else if (b > a) p2SetsWon++;
        p1Games += a; p2Games += b;
      }
    });

    // 6) Pintas (usa string -> number)
    const pints = newMatch.hadPint ? Number(newMatch.pintsCount) : 0;

    setLoading(true);
    try {
      // 7) Insert del match
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .insert({
          tournament_id: tournamentId,
          division_id: divisionId,
          date: newMatch.date || new Date().toISOString().split('T')[0],
          time: newMatch.time,
          location_id: locationId,
          status: 'played',
          home_player_id: player1Id,
          away_player_id: player2Id,
          player1_sets_won: p1SetsWon,
          player2_sets_won: p2SetsWon,
          player1_games_won: p1Games,
          player2_games_won: p2Games,
          player1_had_pint: newMatch.hadPint,
          player2_had_pint: newMatch.hadPint,
          player1_pints: pints,
          player2_pints: pints,
          created_by: session?.user.id,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      if (matchError) throw matchError;

      // 8) Insert de sets
      for (let i = 0; i < newMatch.sets.length; i++) {
        const s = newMatch.sets[i];
        if (s.score1 !== '' && s.score2 !== '') {
          const { error: setErr } = await supabase.from('match_sets').insert({
            match_id: matchData.id,
            set_number: i + 1,
            p1_games: parseInt(s.score1),
            p2_games: parseInt(s.score2),
          });
          if (setErr) throw setErr;
        }
      }

      await loadInitialData(session?.user.id);
      setNewMatch(prev => ({
        ...prev,
        player1: '',
        player2: '',
        sets: [{ score1: '', score2: '' }],
        hadPint: false,
        pintsCount: '1',
        location: '',
        date: '',
        time: ''
      }));
      setSelectedMatchForResult(null);
      alert('Match result added successfully!');
    } catch (err: any) {
      setError(err.message);
      alert(`Error adding match: ${err.message}`);
      console.error('Match creation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const addSet = () => {
    setNewMatch(prev => ({
      ...prev,
      sets: [...prev.sets, { score1: '', score2: '' }]
    }));
  };

  const removeSet = (index: number) => {
    if (newMatch.sets.length > 1) {
      const newSets = newMatch.sets.filter((_, i) => i !== index);
      setNewMatch(prev => ({ ...prev, sets: newSets }));
    }
  };

  const updateSetScore = (index: number, field: 'score1' | 'score2', value: string) => {
    const newSets = [...newMatch.sets];
    newSets[index][field] = value;
    setNewMatch(prev => ({ ...prev, sets: newSets }));
  };

  const getDivisionPlayers = (divisionId: string, tournamentId: string) => {
    if (!divisionId || !tournamentId) return [];
    
    // Get all registrations for this division and tournament
    const divisionRegistrations = registrations.filter(r => 
      r.division_id === divisionId && r.tournament_id === tournamentId
    );
    
    // Map to profiles
    return divisionRegistrations
      .map(reg => profiles.find(p => p.id === reg.profile_id))
      .filter((p): p is Profile => p !== undefined);
  };

  const getDivisionMatches = (divisionId: string, tournamentId: string) => {
    if (!divisionId || !tournamentId) return [];
    
    return matches.filter(match => 
      match.division_id === divisionId && 
      match.tournament_id === tournamentId
    );
  };

  const getScheduledMatches = (divisionId: string, tournamentId: string) => {
    if (!divisionId || !tournamentId) return [];
    
    return matches.filter(match => 
      match.division_id === divisionId && 
      match.tournament_id === tournamentId &&
      match.status === 'scheduled'
    );
  };

  const getHeadToHeadResult = (divisionId: string, tournamentId: string, playerAId: string, playerBId: string) => {
    const divisionMatches = getDivisionMatches(divisionId, tournamentId);
    const h2hMatches = divisionMatches.filter(match => 
      (match.player1 === playerAId && match.player2 === playerBId) ||
      (match.player1 === playerBId && match.player2 === playerAId)
    );
    
    if (h2hMatches.length === 0) return null;
    
    // Count wins
    let playerAWins = 0;
    let playerBWins = 0;
    
    h2hMatches.forEach(match => {
      if (match.player1 === playerAId && match.player1_sets_won > match.player2_sets_won) {
        playerAWins++;
      } else if (match.player2 === playerAId && match.player2_sets_won > match.player1_sets_won) {
        playerAWins++;
      } else {
        playerBWins++;
      }
    });
    
    return {
      winner: playerAWins > playerBWins ? playerAId : playerBId,
      playerAWins,
      playerBWins
    };
  };

  const calculatePlayerStats = (divisionId: string, tournamentId: string, playerId: string) => {
    const playerName = profiles.find(p => p.id === playerId)?.name || 'Player';
    
    // Busca las estadísticas pre-calculadas desde la vista v_standings
    const playerStandings = standings.find(s => 
      s.division_id === divisionId && 
      s.tournament_id === tournamentId && 
      s.profile_id === playerId
    );

    if (playerStandings) {
      return {
        name: playerName,
        points: playerStandings.points,
        matchesPlayed: playerStandings.wins + playerStandings.losses,
        matchesWon: playerStandings.wins,
        matchesDrawn: 0, // No hay empates
        matchesLost: playerStandings.losses,
        setsWon: playerStandings.sets_won,
        setsLost: playerStandings.sets_lost,
        setsDifference: playerStandings.set_diff,
        pints: playerStandings.pints,
        // Los partidos agendados y pendientes aún necesitan un cálculo aparte
        matchesScheduled: matches.filter(m => m.status === 'scheduled' && (m.player1 === playerId || m.player2 === playerId)).length,
        matchesPending: 0, // La lógica del fixture pendiente iría aquí
      };
    }

    // Si no hay standings, devuelve un objeto vacío
    return { name: playerName, points: 0, matchesPlayed: 0, matchesScheduled: 0, matchesPending: 0, matchesWon: 0, matchesDrawn: 0, matchesLost: 0, setsWon: 0, setsLost: 0, setsDifference: 0, pints: 0 };
  };

  const getPlayerMatches = (divisionId: string, tournamentId: string, playerId: string) => {
    if (!divisionId || !tournamentId || !playerId) {
      return {
        played: [] as Match[],
        scheduled: [] as Match[],
        upcoming: [] as Profile[]
      };
    }
    
    const divisionMatches = getDivisionMatches(divisionId, tournamentId);
    const scheduled = getScheduledMatches(divisionId, tournamentId);
    
    const playerMatches = {
      played: divisionMatches.filter(match => 
        (match.player1 === playerId || match.player2 === playerId) &&
        match.status === 'played'
      ),
      scheduled: scheduled.filter(match => 
        (match.player1 === playerId || match.player2 === playerId) && 
        match.status === 'scheduled'
      )
    };

    const players = getDivisionPlayers(divisionId, tournamentId);
    const opponents = players.filter(player => player.id !== playerId);

    const upcoming = opponents.filter(opponent => {
      return !playerMatches.played.some(match => 
        (match.player1 === playerId && match.player2 === opponent.id) ||
        (match.player1 === opponent.id && match.player2 === playerId)
      ) && !playerMatches.scheduled.some(match =>
        (match.player1 === playerId && match.player2 === opponent.id) ||
        (match.player1 === opponent.id && match.player2 === playerId)
      );
    });

    return { ...playerMatches, upcoming };
  };

  const getDivisionHighlights = (divisionName: string, tournamentName: string) => {
    // Different highlights for PPC Cup divisions
    if (tournamentName.includes('PPC Cup')) {
      const highlights: Record<string, string> = {
        'Elite': 'Top players competing for the PPC Cup championship title.',
        'Standard': 'Intermediate players looking to test their skills in the cup format.',
        'Beginner': 'New players getting their first taste of competitive play in the cup.'
      };
      return highlights[divisionName] || 'Exciting division with passionate players.';
    }
    
    const highlights: Record<string, string> = {
      'Oro': 'The elite players who dominate with powerful serves and aggressive baseline play.',
      'Plata': 'Highly skilled players with excellent all-around game and competitive spirit.',
      'Bronce': 'Solid players improving rapidly with strong fundamentals and consistency.',
      'Cobre': 'Developing players showing great potential and passion for the game.',
      'Hierro': 'Newcomers and enthusiasts learning the game with enthusiasm and dedication.'
    };
    return highlights[divisionName] || 'Exciting division with passionate players.';
  };

  const getNearbyCourts = () => {
    return [
      { id: 1, name: "Central Park Tennis Courts", distance: "0.5 miles", rating: 4.8, type: "Public" },
      { id: 2, name: "Riverside Sports Complex", distance: "1.2 miles", rating: 4.5, type: "Private" },
      { id: 3, name: "University Tennis Center", distance: "2.1 miles", rating: 4.7, type: "Semi-Private" },
      { id: 4, name: "Green Valley Racquet Club", distance: "3.0 miles", rating: 4.9, type: "Private" },
      { id: 5, name: "Community Sports Park", distance: "1.8 miles", rating: 4.3, type: "Public" }
    ];
  };

  const toggleLocation = (location: string) => {
    setNewUser(prev => ({
      ...prev,
      locations: prev.locations.includes(location)
        ? prev.locations.filter(loc => loc !== location)
        : [...prev.locations, location]
    }));
  };

  const toggleAvailability = (day: string, timeSlot: string) => {
    setNewUser(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: prev.availability[day]?.includes(timeSlot)
          ? prev.availability[day].filter(slot => slot !== timeSlot)
          : [...(prev.availability[day] || []), timeSlot]
      }
    }));
  };

  const toggleTournament = (tournament: string) => {
    setNewUser(prev => ({
      ...prev,
      tournaments: prev.tournaments.includes(tournament)
        ? prev.tournaments.filter(t => t !== tournament)
        : [...prev.tournaments, tournament]
    }));
  };

  function handleProfilePicUpload(e: any) {
    const file = e?.target?.files?.[0];
    if (!file) return;

    setPendingAvatarFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPendingAvatarPreview(dataUrl);
      // mantenemos profilePic para que tu UI actual siga mostrando la imagen
      setNewUser((prev: any) => ({ ...prev, profilePic: dataUrl }));
    };
    reader.readAsDataURL(file);
  }




  const handleEditProfile = () => {
    if (!currentUser) return;

    const { data: { publicUrl } } =
      supabase.storage.from('avatars').getPublicUrl(`${currentUser.id}.jpg`);

    setEditUser({
      name: currentUser.name,
      email: currentUser.email ?? '',
      password: '',
      profilePic: publicUrl || '',
      tournaments: [],
      division: ''
    });
    setEditProfile(true);
    
  };


  const saveProfileChanges = async () => {
    if (editUser.name) {
      try {
        setLoading(true);
        
        // Update profile name
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ name: editUser.name })
          .eq('id', currentUser?.id);
          
        if (profileError) throw profileError;
        
        // Refresh data
        loadInitialData(session?.user.id);
        
        setEditProfile(false);
      } catch (err: any) {
        setError(err.message);
        alert(`Error saving profile: ${err.message}`);
        console.error('Profile update error:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const isAdmin = currentUser?.role === 'admin';

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 via-emerald-600 to-lime-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading application data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 via-emerald-600 to-lime-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            onClick={() => { setError(null); if (session?.user) loadInitialData(session.user.id); }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (loginView) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 via-emerald-600 to-lime-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Pinta Post Championship</h1>
            <p className="text-gray-600">Tennis League</p>
          </div>

          {registrationStep === 1 ? (
            <>
              <div className="border-t pt-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">Login</h2>
                <form onSubmit={handleLogin}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                      <input
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                      <input
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition duration-200"
                    >
                      Login
                    </button>

                    <div className="text-center mt-4">
                      <button
                        type="button" // Importante que sea "button" para no enviar el formulario
                        onClick={handlePasswordReset}
                        className="text-sm text-gray-600 hover:text-gray-900 hover:underline focus:outline-none"
                      >
                        Forgot your password?
                      </button>
                    </div>

                  </div>
                </form>
                
                <div className="mt-4 text-sm text-center text-gray-600">
                </div>
              </div>

              <div className="mb-6 text-center">
                <h2 className="text-2xl font-semibold text-gray-800 mb-6">Create Account</h2>
                <form onSubmit={handleRegister}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                      <input
                        type="text"
                        value={newUser.name}
                        onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                      <input
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition duration-200"
                    >
                      Continue
                    </button>
                    <p>Utiliza Nombre + Apellido, y correo personal</p>
                  </div>
                </form>
              </div>

            </>
          ) : registrationStep === 2 ? (
            <div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">Complete Your Profile</h2>
              <form onSubmit={handleRegister}>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Profile Picture</label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      {(pendingAvatarPreview || editUser.profilePic) ? (
                        <img
                          src={pendingAvatarPreview || editUser.profilePic}
                          alt="Profile preview"
                          className="mx-auto h-24 w-24 rounded-full object-cover"
                        />
                      ) : (
                        <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4 4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}

                      <div className="mt-4">
                        <label className="cursor-pointer bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition duration-200">
                          Upload Photo
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              setPendingAvatarFile(f);
                              const r = new FileReader();
                              r.onload = () => setPendingAvatarPreview(String(r.result || ''));
                              r.readAsDataURL(f);
                            }}
                          />
                        </label>
                      </div>
                      <p className="mt-2 text-sm text-gray-500">PNG/JPG hasta 5MB</p>
                    </div>

                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Locations</label>
                    <div className="grid grid-cols-2 gap-2">
                      {locationsList.map(location => (
                        <label key={location} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={newUser.locations.includes(location)}
                            onChange={() => toggleLocation(location)}
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{location}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
                    <div className="border rounded-lg overflow-hidden">
                      {/* Mobile responsive table with horizontal scrolling */}
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Day</th>
                              {timeSlots.map(slot => (
                                <th key={slot} className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">{slot}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {days.map(day => (
                              <tr key={day}>
                                <td className="px-4 py-2 text-sm font-medium text-gray-900">{day}</td>
                                {timeSlots.map(slot => (
                                  <td key={slot} className="px-4 py-2 text-center">
                                    <input
                                      type="checkbox"
                                      checked={newUser.availability[day]?.includes(slot) || false}
                                      onChange={() => toggleAvailability(day, slot)}
                                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-gray-500 text-center md:text-left">
                      * All time slots are visible on mobile with horizontal scrolling
                    </p>
                  </div>

                  <div className="flex space-x-4">
                    <button
                      type="button"
                      onClick={() => setRegistrationStep(1)}
                      className="flex-1 bg-gray-500 text-white py-3 rounded-lg font-semibold hover:bg-gray-600 transition duration-200"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition duration-200"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              </form>
            </div>
          ) : (
            <div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">Join Tournament</h2>
              <form onSubmit={handleRegister}>
                <div className="space-y-6">


                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Tournament</label>
                    <select
                      value={newUser.tournaments[0] || ''} // CORRECTO: El estado ahora guarda el ID
                      onChange={(e) => {
                        setNewUser({
                          ...newUser,
                          tournaments: e.target.value ? [e.target.value] : [], // Guarda solo el ID
                          division: '' // Resetea la división al cambiar de torneo
                        });
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Tournament</option>
                      {tournaments
                        .filter(t => t.status === 'active') // Opcional: Muestra solo torneos activos
                        .map(tournament => (
                          // CORRECTO: El valor de la opción ahora es el ID del torneo
                          <option key={tournament.id} value={tournament.id}>
                            {tournament.name}
                          </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Division</label>
                    <select
                      value={newUser.division} // CORRECTO: El estado ahora guarda el ID
                      onChange={(e) => {
                        setNewUser({...newUser, division: e.target.value}); // Guarda el ID
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                      disabled={!newUser.tournaments[0]} // Se mantiene deshabilitado hasta elegir torneo
                    >
                      <option value="">
                        {newUser.tournaments[0] ? 'Select Division' : 'Select a tournament first'}
                      </option>
                      {divisions
                        // CORRECTO: Filtro simple y directo usando el ID del torneo guardado en el estado
                        .filter(d => d.tournament_id === newUser.tournaments[0])
                        .map(division => (
                          // CORRECTO: El valor de la opción ahora es el ID de la división
                          <option key={division.id} value={division.id}>
                            {division.name}
                          </option>
                      ))}
                    </select>
                  </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                      <input
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        required
                      />
                      <p>Utiliza una clave simple con más de 6 caracteres</p>
                    </div>

                  <div className="flex space-x-4">
                    <button
                      type="button"
                      onClick={() => setRegistrationStep(2)}
                      className="flex-1 bg-gray-500 text-white py-3 rounded-lg font-semibold hover:bg-gray-600 transition duration-200"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition duration-200"
                    >
                      Complete Registration
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (editProfile) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-gray-800">Edit Profile</h2>
            <button
              onClick={() => setEditProfile(false)}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
              <input
                type="text"
                value={editUser.name}
                onChange={(e) => setEditUser(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={editUser.email ?? ''}   // importante: fallback a ''
                onChange={(e) => setEditUser(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
            </div>

            {/* Password (opcional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New Password (optional)</label>
              <input
                type="password"
                value={editUser.password}
                onChange={(e) => setEditUser(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Leave blank to keep current"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Avatar */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Profile Picture</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                {editUser.profilePic ? (
                  <img
                    src={editUser.profilePic}
                    alt="Preview"
                    className="mx-auto h-24 w-24 rounded-full object-cover"
                  />
                ) : (
                  <p className="text-sm text-gray-500">No image selected</p>
                )}
                <div className="mt-4">
                  <label className="cursor-pointer bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition">
                    Upload Photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePicUpload}  // <- usa el handler nuevo
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={savingProfile}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition"
            >
              {savingProfile ? 'Saving...' : 'Save'}
            </button>

            {/* Error */}
            {profileError && (
              <p className="text-red-600 text-sm mt-2">{profileError}</p>
            )}
          </form>

        </div>
      </div>
    );
  }


  if (showMap) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 via-emerald-600 to-lime-700">
        <header className="bg-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-4xl font-bold text-gray-800">Pinta Post Championship</h1>
                <p className="text-gray-600">Find Nearby Tennis Courts</p>
              </div>
              <button
                onClick={() => setShowMap(false)}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition duration-200"
              >
                Back to Tournament
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Nearby Tennis Courts</h2>
            
            <div className="mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">PPC Recommended Courts</h3>
                <p className="text-blue-700 text-sm">These are the most popular courts among PPC players, featuring excellent facilities and convenient booking options.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {getNearbyCourts().map(court => (
                <div key={court.id} className="border rounded-lg p-6 hover:shadow-md transition duration-200">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">{court.name}</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Distance:</span>
                      <span className="font-medium">{court.distance}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Rating:</span>
                      <span className="font-medium text-yellow-600">{'★'.repeat(Math.floor(court.rating)) + '☆'.repeat(5 - Math.floor(court.rating))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type:</span>
                      <span className="font-medium">{court.type}</span>
                    </div>
                  </div>
                  <button className="w-full mt-4 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition duration-200">
                    Book Court
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <div className="bg-gray-100 h-96 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="mt-4 text-gray-600">Interactive map would be displayed here</p>
                  <p className="text-sm text-gray-500">Showing tennis courts within 5 miles radius</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedTournament) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 via-emerald-600 to-lime-700">
        <header className="bg-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-4xl font-bold text-gray-800">Pinta Post Championship</h1>
                <p className="text-gray-600">Tennis League</p>
              </div>
              {currentUser && (
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="font-semibold text-gray-800">{currentUser.name}</p>
                    <p className="text-sm text-gray-600">
                      {registrations
                        .filter(r => r.profile_id === currentUser.id)
                        .map(r => tournaments.find(t => t.id === r.tournament_id)?.name)
                        .filter(Boolean)
                        .join(', ') || 'No tournaments'}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition duration-200"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-4">Welcome to the Pinta Post Championship</h2>
            <p className="text-white text-lg opacity-90">Select a tournament to view divisions and player details</p>
            
            <button
              onClick={() => setShowJoinModal(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition duration-200 mt-4" // Añadimos un margen superior
            >
              Join a New Tournament
            </button>
          </div>

            {/* Tournament Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {tournaments.map(tournament => {
              // Get tournament registrations
              const tournamentRegistrations = registrations.filter(r => r.tournament_id === tournament.id);
              
              // Get tournament matches
              const tournamentMatches = matches.filter(m => m.tournament_id === tournament.id);
              
              // Calculate total pints for the tournament
              const totalPints = tournamentMatches.reduce((sum, match) => 
                sum + (match.player1_had_pint ? match.player1_pints : 0) + 
                (match.player2_had_pint ? match.player2_pints : 0), 0
              );
              
              // Get all scheduled matches for the tournament
              const allScheduled = tournamentMatches.filter(m => m.status === 'scheduled');
              
              return (
                <div 
                  key={tournament.id} 
                  className="bg-white rounded-xl shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition duration-300" 
                  onClick={() => setSelectedTournament(tournament)}
                >
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{tournament.name}</h3>
                    <p className="text-gray-600 mb-4">Compete in our premier tennis championship</p>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{tournamentRegistrations.length}</div>
                        <div className="text-sm text-gray-600">Players</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{tournamentMatches.length}</div>
                        <div className="text-sm text-gray-600">Matches</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">{totalPints}</div>
                        <div className="text-sm text-gray-600">Total Pintas</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-orange-600">{allScheduled.length}</div>
                        <div className="text-sm text-gray-600">Upcoming Matches</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        {showJoinModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Join a New Tournament</h2>
              <div className="space-y-4">
                {/* Selector de Torneo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Tournament</label>
                  <select
                    value={newRegistration.tournamentId}
                    onChange={(e) => setNewRegistration({ tournamentId: e.target.value, divisionId: '' })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select...</option>
                    {tournaments.filter(t => t.status === 'active').map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                
                {/* Selector de División */}
                {newRegistration.tournamentId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Division</label>
                    <select
                      value={newRegistration.divisionId}
                      onChange={(e) => setNewRegistration(prev => ({ ...prev, divisionId: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                    >
                      <option value="">Select...</option>
                      {divisions.filter(d => d.tournament_id === newRegistration.tournamentId).map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                {/* Botones de acción */}
                <div className="flex space-x-4 pt-4">
                  <button onClick={() => setShowJoinModal(false)} className="flex-1 bg-gray-500 text-white py-3 rounded-lg font-semibold">Cancel</button>
                  <button onClick={handleJoinTournament} className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold">Join</button>
                </div>
              </div>
            </div>
          </div>
        )}

          {/* Set Match Button */}
          <div className="text-center mt-8">
            <button
              onClick={() => setShowMap(true)}
              className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition duration-200 text-lg"
            >
              Find Tennis Courts
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (selectedTournament && !selectedDivision) {
    // Tournament View with all divisions
    const tournamentDivisions = divisions.filter(d => d.tournament_id === selectedTournament.id);
    
    const divisionsData = tournamentDivisions.map(division => {
      const players = getDivisionPlayers(division.id, selectedTournament.id) || [];
      const divisionMatches = getDivisionMatches(division.id, selectedTournament.id) || [];
      const scheduled = getScheduledMatches(division.id, selectedTournament.id) || [];
      
      // standings de la división
      const divisionStandings = standings.filter(
        s => s.division_id === division.id && s.tournament_id === selectedTournament.id
      );

      // líder por puntos
      const leaderRow = divisionStandings.length > 0
        ? [...divisionStandings].sort((a, b) => b.points - a.points)[0]
        : null;
      const leader = leaderRow
        ? profiles.find(p => p.id === leaderRow.profile_id) || null
        : null;

      // top pintas (fila con más pintas)
      const topRow = divisionStandings.reduce(
        (acc, s) => (acc == null || s.pints > acc.pints ? s : acc),
        null as (typeof divisionStandings[number]) | null
      );
      const topPints =
        topRow
          ? {
              profile_id: topRow.profile_id,
              name: profiles.find(p => p.id === topRow.profile_id)?.name || 'N/A',
              pints: topRow.pints,
            }
          : null;

      return {
        division,
        players: players.length,
        gamesPlayed: divisionMatches.length,
        scheduledMatches: scheduled.length,
        winner: leader ? leader.name : 'N/A',
        totalPints: divisionStandings.reduce((sum, s) => sum + s.pints, 0),
        leader,
        topPints,             // <-- guardamos nombre + pints
        playersList: players
      };

    });

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 via-emerald-600 to-lime-700">
        <header className="bg-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <button
                  onClick={() => setSelectedTournament(null)}
                  className="text-green-600 hover:text-green-800 font-semibold mb-2"
                >
                  ← Back to Tournaments
                </button>
                <h1 className="text-4xl font-bold text-gray-800">{selectedTournament.name}</h1>
                <p className="text-gray-600">All divisions and player details</p>
              </div>
              
              {currentUser && (
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="font-semibold text-gray-800">{currentUser.name}</p>
                    <p className="text-sm text-gray-600">
                      Division: {
                        registrations
                          .filter(r => r.profile_id === currentUser.id && r.tournament_id === selectedTournament.id)
                          .map(r => divisions.find(d => d.id === r.division_id)?.name)
                          .filter(Boolean) 
                          .join(', ') || 'N/A'
                      }
                    </p>
                  </div>
                  <button
                    onClick={openEditProfile}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition duration-200"
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={handleLogout}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition duration-200"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {editProfile && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Edit Profile</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <input
                    type="text"
                    value={editUser.name ?? ''}
                    onChange={(e) => setEditUser({...editUser, name: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />

                  <input
                    type="email"
                    value={editUser.email ?? ''}              // ← así no queda vacío por TS
                    onChange={(e) => setEditUser(v => ({ ...v, email: e.target.value }))}
                  />

                  <input
                    type="password"
                    value={editUser.password ?? ''}           // contraseña nueva (opcional)
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={editUser.email}
                    disabled
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                  <input
                    type="password"
                    value={editUser.password}
                    onChange={(e) => setEditUser({...editUser, password: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Profile Picture</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                    {editUser.profilePic ? (
                      <img src={editUser.profilePic} alt="Profile" className="mx-auto h-20 w-20 rounded-full object-cover mb-2" />
                    ) : (
                      <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4 4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    <label className="cursor-pointer bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition duration-200 inline-block mt-2">
                      Change Photo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProfilePicUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
                
                <div className="flex space-x-4 pt-4">
                  <button
                    onClick={() => setEditProfile(false)}
                    className="flex-1 bg-gray-500 text-white py-3 rounded-lg font-semibold hover:bg-gray-600 transition duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveProfileChanges}
                    className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition duration-200"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Tournament Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Tournament Summary</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600">{divisionsData.reduce((sum, d) => sum + d.players, 0)}</div>
                  <div className="text-sm text-gray-600">Total Players</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-green-600">{divisionsData.reduce((sum, d) => sum + d.gamesPlayed, 0)}</div>
                  <div className="text-sm text-gray-600">Total Games Played</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-purple-600">{divisionsData.reduce((sum, d) => sum + d.totalPints, 0)}</div>
                  <div className="text-sm text-gray-600">Total Pintas Consumidas</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-orange-600">{divisionsData.length}</div>
                  <div className="text-sm text-gray-600">Divisions</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Division Winners</h3>
              <div className="space-y-4">
                {divisionsData.map(d => (
                  <div key={d.division.id} className="border rounded-lg p-3">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-800">{d.division.name}</span>
                      <span className="text-sm text-gray-600">Líder: {d.leader ? d.leader.name : 'N/A'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Division Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {divisionsData.map(({ division, players, gamesPlayed, scheduledMatches, winner, totalPints, leader, topPints }) => (
              <div 
                key={division.id} 
                className="bg-white rounded-xl shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition duration-300" 
                onClick={() => setSelectedDivision(division)}
              >
                <div className="p-6">
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">{division.name}</h3>
                  <p className="text-gray-600 mb-4">{getDivisionHighlights(division.name, selectedTournament.name)}</p>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{players}</div>
                      <div className="text-sm text-gray-600">Players</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{gamesPlayed}</div>
                      <div className="text-sm text-gray-600">Matches</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">{totalPints}</div>
                      <div className="text-sm text-gray-600">Total Pintas</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">{topPints ? Number(topPints.pints) : 0}</div>
                      <div className="text-sm text-gray-600">Pintas Máximas</div>
                    </div>
                  </div>

                  {topPints && (
                    <div className="bg-blue-50 p-3 rounded-lg mb-4">
                      <div className="text-sm text-blue-800">Jugador con Más Pintas</div>
                      <div className="font-semibold text-blue-900">{topPints.name}</div>
                      <div className="text-sm text-blue-700">{Number(topPints.pints)} pintas</div>
                    </div>
                  )}
                  
                  {leader && (
                    <div className="bg-yellow-50 p-3 rounded-lg mb-4">
                      <div className="text-sm text-yellow-800">Líder Actual</div>
                      <div className="font-semibold text-yellow-900">{leader.name}</div>
                      <div className="text-sm text-yellow-700">
                        {standings.find(s => s.profile_id === leader.id && s.division_id === division.id)?.points || 0} puntos
                      </div>
                    </div>
                  )}
                  
                  {/* Match Status Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 font-semibold">Partidos</div>
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Player</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">GP</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">GS</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">GN</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {players > 0 ? (
                          Array.from({ length: 3 }).map((_, index) => {
                            const standingsForDivision = standings.filter(s => 
                              s.division_id === division.id && s.tournament_id === selectedTournament.id
                            );
                            
                            const sortedStandings = standingsForDivision.sort((a, b) => b.points - a.points);
                            const standing = sortedStandings[index];
                            const player = profiles.find(p => p.id === standing?.profile_id);
                            
                            if (standing && player) {
                              return (
                                <tr key={player.id} className="text-sm">
                                  <td className="px-4 py-2 font-medium text-gray-900">{player.name}</td>
                                  <td className="px-4 py-2 text-center">{standing.wins + standing.losses}</td>
                                  <td className="px-4 py-2 text-center">{0}</td>
                                  <td className="px-4 py-2 text-center">{0}</td>
                                </tr>
                              );
                            }
                            return null;
                          }).filter(Boolean)
                        ) : (
                          <tr>
                            <td colSpan="4" className="px-4 py-2 text-center text-gray-500">No players yet</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Upcoming Matches Section */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800">Partidos Programados - {selectedTournament.name}</h3>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={copyTableToClipboard}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition duration-200 flex items-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 11h8" />
                  </svg>
                  Copy Table
                </button>
                <button
                  type="button"
                  onClick={shareAllScheduledMatches}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition duration-200 flex items-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-1.164.94-1.164-.173-.298-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004c-1.03 0-2.018-.183-2.955-.51-.05-.018-.099-.037-.148-.055-1.753-.73-3.251-2.018-4.199-3.602l-.123-.214-8.254 3.032.133.194c3.105 4.51 8.178 7.154 13.58 7.154 2.029 0 3.979-.354 5.771-1.007 1.792-.654 3.333-1.644 4.53-2.916 1.197-1.273 1.986-2.783 2.26-4.417.275-1.635.099-3.347-.526-4.889-.625-1.543-1.665-2.843-3.022-3.796-1.357-.952-2.963-1.514-4.664-1.514h-.004c-1.724 0-3.35.573-4.68 1.601l-1.368 1.033 2.868 3.725 1.349-1.017c.557.371 1.158.654 1.802.843.644.189 1.318.284 2.02.284.571 0 1.133-.075 1.671-.223a5.04 5.04 0 001.395-.606 3.575 3.575 0 001.046-1.098c.31-.47.468-1.007.468-1.612 0-.578-.14-1.107-.42-1.596-.28-.489-.698-.891-1.255-1.207-.557-.316-1.22-.474-1.99-.474-.933 0-1.77.337-2.512 1.01l-1.368 1.207-1.37-1.17c-.604-.51-1.355-.872-2.166-1.081-.811-.209-1.65-.228-2.479-.055-1.07.228-2.03.85-2.72 1.774-.69.925-1.05 2.036-1.05 3.219 0 .67.128 1.318.385 1.914.258.595.614 1.125 1.07 1.57 1.713 1.6 4.083 2.577 6.567 2.577.41 0 .815-.027 1.213-.081.398-.055.788-.138 1.17-.248l.004-.002z"/>
                  </svg>
                  Compartir todo
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Players</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Division</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {matches
                    .filter(match => 
                      match.tournament_id === selectedTournament.id && 
                      match.status === 'scheduled'
                    )
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map(match => {
                      const player1 = profiles.find(p => p.id === match.player1)?.name || '';
                      const player2 = profiles.find(p => p.id === match.player2)?.name || '';
                      const division = divisions.find(d => d.id === match.division_id)?.name || '';
                      const location = locations.find(l => l.id === match.location_id)?.name || '';
                      
                      return (
                        <tr key={match.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{match.date}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{player1} vs {player2}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{match.time}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{division}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{location}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Photo Gallery */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">Tournament Highlights</h3>
            <p className="text-gray-600 text-center">No photos available yet. Start adding matches to create highlights!</p>
          </div>

          {/* Set Match Button */}
          <div className="text-center mt-8">
            <button
              onClick={() => setShowMap(true)}
              className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition duration-200 text-lg"
            >
              Find Tennis Courts
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Division View
  if (selectedTournament && selectedDivision) {
    const players = getDivisionPlayers(selectedDivision.id, selectedTournament.id) || [];

    // Stats solo de quienes tienen partidos (como antes)
    const divisionStats = standings
      .filter(s => s.division_id === selectedDivision.id && s.tournament_id === selectedTournament.id)
      .map(s => ({
        ...s,
        name: profiles.find(p => p.id === s.profile_id)?.name || ''
      }));

    // Mapa rápido por id para mezclar stats con el roster completo
    const statsById = new Map(divisionStats.map(s => [s.profile_id, s]));

    // Filas finales: TODOS los inscritos con stats (0 si no tienen partidos)
    const rosterRows = players.map(p => {
      const s = statsById.get(p.id);
      return {
        profile_id: p.id,
        name: p.name,
        points: s?.points ?? 0,
        wins: s?.wins ?? 0,
        losses: s?.losses ?? 0,
        sets_won: s?.sets_won ?? 0,
        sets_lost: s?.sets_lost ?? 0,
        set_diff: s?.set_diff ?? 0,
        pints: s?.pints ?? 0,
      };
    })
    // orden principal por puntos, secundario por nombre
    .sort((a, b) => (b.points - a.points) || a.name.localeCompare(b.name));

    // Para compatibilidad con código más abajo
    const divisionStandings = divisionStats;

    // Líder y top pintas ahora salen del roster mezclado (incluye 0s)
    const leader = rosterRows[0] ?? null;
    const topPintsPlayer = rosterRows.reduce(
      (max, r) => (max == null || r.pints > max.pints ? r : max),
      null as null | typeof rosterRows[number]
    );


    // Get all scheduled matches for this division
    const pendingMatches = matches.filter(match => 
      match.division_id === selectedDivision.id && 
      match.tournament_id === selectedTournament.id && 
      match.status === 'pending'
    );

    const confirmedMatches = matches.filter(match => 
      match.division_id === selectedDivision.id && 
      match.tournament_id === selectedTournament.id && 
      match.status === 'played'
    );

    // Player Profile View
    if (selectedPlayer) {
      const player = players.find(p => p.id === selectedPlayer.id);
      const playerStats = divisionStandings.find(s => s.profile_id === selectedPlayer.id) || {
        name: selectedPlayer.name,
        points: 0,
        wins: 0,
        losses: 0,
        sets_won: 0,
        sets_lost: 0,
        set_diff: 0,
        pints: 0
      };
      
      const playerMatches = getPlayerMatches(selectedDivision.id, selectedTournament.id, selectedPlayer.id);
      
      // Calculate upcoming matches against all other players
      const divisionPlayers = getDivisionPlayers(selectedDivision.id, selectedTournament.id);
      const allOpponents = divisionPlayers.filter(p => p.id !== selectedPlayer.id);
      
      const upcomingMatches = allOpponents.filter(opponent => {
        return !playerMatches.played.some(match => 
          (match.player1 === selectedPlayer.id && match.player2 === opponent.id) ||
          (match.player1 === opponent.id && match.player2 === selectedPlayer.id)
        ) && !playerMatches.scheduled.some(match =>
          (match.player1 === selectedPlayer.id && match.player2 === opponent.id) ||
          (match.player1 === opponent.id && match.player2 === selectedPlayer.id)
        );
      });
      
      return (
        <div className="min-h-screen bg-gradient-to-br from-green-500 via-emerald-600 to-lime-700">
          <header className="bg-white shadow-lg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="flex justify-between items-center">
                <div>
                  <button
                    onClick={() => setSelectedPlayer(null)}
                    className="text-green-600 hover:text-green-800 font-semibold mb-2"
                  >
                    ← Back to {selectedDivision.name} Division
                  </button>
                  <h1 className="text-4xl font-bold text-gray-800">{selectedPlayer.name}</h1>
                  <p className="text-gray-600">Player Profile</p>
                </div>
                {currentUser && (
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="font-semibold text-gray-800">{currentUser.name}</p>
                      <p className="text-sm text-gray-600">Division: {currentUser.division} {currentUser.role === 'admin' && '(Admin)'}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition duration-200"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Player Profile */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="text-center mb-6">
                    <div className="w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-green-100">
                      <img
                        src={
                          selectedPlayer.avatar_url
                            || supabase.storage.from('avatars').getPublicUrl(`${selectedPlayer.id}.jpg`).data.publicUrl
                            || ''
                        }
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />

                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mt-4">{selectedPlayer.name}</h2>
                    <p className="text-gray-600">{selectedDivision.name} Division</p>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-blue-800 mb-2">Availability</h3>
                      <div className="space-y-2">
                        {days.map(day => (
                          <div key={day} className="flex justify-between">
                            <span className="text-gray-700 font-medium">{day}:</span>
                            <div className="flex flex-wrap justify-end gap-1">
                              {selectedPlayerAvailability
                                .filter(slot => slot.day_of_week === days.indexOf(day))
                                .map(slot => {
                                  let timeSlot = '';
                                  if (slot.start_time === '07:00') timeSlot = 'Morning (07:00-12:00)';
                                  else if (slot.start_time === '12:00') timeSlot = 'Afternoon (12:00-18:00)';
                                  else timeSlot = 'Evening (18:00-22:00)';
                                  return (
                                    <span key={slot.id} className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                                      {timeSlot}
                                    </span>
                                  );
                                })}

                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-gray-800 mb-2">Locations</h3>
                      <div className="flex flex-wrap gap-2">
                        {locationsList.map(location => (
                          <span key={location} className="bg-gray-100 text-gray-800 text-sm px-3 py-1 rounded-full">
                            {abbreviateLocation(location)}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-yellow-800 mb-2">Tournaments & Division</h3>
                      <div className="space-y-2">
                        <div>
                          <span className="font-medium text-gray-700">Division:</span>
                          <span className="ml-1 font-medium">{selectedDivision.name}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Tournaments:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                              {selectedTournament.name}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Player Stats */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">Player Statistics</h2>
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{playerStats.points}</div>
                      <div className="text-sm text-gray-600">Points</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{playerStats.wins + playerStats.losses}</div>
                      <div className="text-sm text-gray-600">Matches Played</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">{playerStats.pints}</div>
                      <div className="text-sm text-gray-600">Pintas</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">{playerStats.sets_won}</div>
                      <div className="text-sm text-gray-600">Sets Won</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{playerStats.set_diff}</div>
                      <div className="text-sm text-gray-600">Sets Diff</div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MP</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">W</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">D</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">L</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SW</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SL</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SD</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pintas</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        <tr className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                playerStats.points === divisionStandings[0]?.points ? 'bg-yellow-400 text-yellow-800' :
                                playerStats.points === divisionStandings[1]?.points ? 'bg-gray-300 text-gray-800' :
                                playerStats.points === divisionStandings[2]?.points ? 'bg-orange-300 text-orange-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {divisionStandings.findIndex(s => s.profile_id === selectedPlayer.id) + 1}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                            {selectedPlayer.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">{playerStats.points}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{playerStats.wins + playerStats.losses}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">{playerStats.wins}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">0</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">{playerStats.losses}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{playerStats.sets_won}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{playerStats.sets_lost}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{playerStats.set_diff}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className="text-lg">🍻</span>
                              <span className="ml-1 text-sm font-medium">{playerStats.pints}</span>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Match History */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">Match History</h2>
                  
                  {playerMatches.played.length > 0 ? (
                    <div className="space-y-4">
                      {playerMatches.played.map((match, index) => {
                        const player1 = profiles.find(p => p.id === match.player1);
                        const player2 = profiles.find(p => p.id === match.player2);
                        const opponent = player1?.id === selectedPlayer.id ? player2 : player1;
                        
                        return (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-semibold text-gray-800">
                                  {opponent?.name}
                                </h4>
                                <p className="text-sm text-gray-600">{selectedDivision.name} Division</p>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold text-blue-600">{match.date}</div>
                                <div className="text-sm text-gray-600">
                                  {setsLineFor(match, selectedPlayer.id)}
                                </div>
                              </div>
                            </div>
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Location:</span> {locations.find(l => l.id === match.location_id)?.name || ''}
                            </div>
                            {(match.player1_had_pint || match.player2_had_pint) && (
                              <div className="mt-1 text-sm text-purple-600 flex items-center">
                                <span className="text-lg">🍻</span>
                                <span className="ml-1">Tomaron {match.player1_pints} pintas cada uno</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No match history available
                    </div>
                  )}
                </div>

                {/* Upcoming Matches */}
                {upcomingMatches.length > 0 && (
                  <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">Upcoming Matches</h2>
                    
                    <div className="space-y-4">
                      {upcomingMatches.map((opponent, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="font-semibold text-gray-800">{opponent.name}</h4>
                              <p className="text-sm text-gray-600">{selectedDivision.name} Division</p>
                            </div>
                            <button 
                              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition duration-200"
                              onClick={() => {
                                // Schedule a match with this opponent
                                setNewMatch({
                                  player1: selectedPlayer.name,
                                  player2: opponent.name,
                                  sets: [{ score1: '', score2: '' }],
                                  division: selectedDivision.name,
                                  tournament: selectedTournament.name,
                                  hadPint: false,
                                  pintsCount: '1',
                                  location: '',
                                  date: '',
                                  time: ''
                                });
                                setSelectedDivision(null);
                                setSelectedTournament(null);
                              }}
                            >
                              Schedule Match
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Head-to-Head Matches */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">Head-to-Head Matches</h2>
                  
                  {divisionPlayers.length > 1 ? (
                    <div className="space-y-6">
                      {divisionPlayers.filter(p => p.id !== selectedPlayer.id).map(opponent => {
                        const h2hMatches = playerMatches.played.filter(match => 
                          (match.player1 === selectedPlayer.id && match.player2 === opponent.id) ||
                          (match.player1 === opponent.id && match.player2 === selectedPlayer.id)
                        );
                        
                        if (h2hMatches.length === 0) return null;
                        
                        // Calculate head-to-head stats
                        let wins = 0;
                        let losses = 0;
                        let totalSetsWon = 0;
                        let totalSetsLost = 0;
                        
                        h2hMatches.forEach(match => {
                          if (match.player1 === selectedPlayer.id) {
                            totalSetsWon += match.player1_sets_won;
                            totalSetsLost += match.player2_sets_won;
                            if (match.player1_sets_won > match.player2_sets_won) wins++;
                            else losses++;
                          } else {
                            totalSetsWon += match.player2_sets_won;
                            totalSetsLost += match.player1_sets_won;
                            if (match.player2_sets_won > match.player1_sets_won) wins++;
                            else losses++;
                          }
                        });
                        
                        return (
                          <div key={opponent.id} className="border rounded-lg p-4">
                            <div className="flex justify-between items-center mb-4">
                              <h3 className="font-semibold text-gray-800 text-lg">{opponent.name}</h3>
                              <div className="bg-gray-50 px-3 py-1 rounded-lg">
                                <span className="text-green-600 font-medium">{wins}W</span> - 
                                <span className="text-red-600 font-medium">{losses}L</span>
                              </div>
                            </div>
                            
                            <div className="space-y-3 mb-4">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Total Sets:</span>
                                <span className="font-medium">{totalSetsWon}-{totalSetsLost}</span>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              {h2hMatches.map((match, index) => {
                                const player1 = profiles.find(p => p.id === match.player1);
                                const player2 = profiles.find(p => p.id === match.player2);
                                
                                return (
                                  <div key={index} className="border-t pt-2">
                                    <div className="flex justify-between">
                                      <div>
                                        <p className="text-sm font-medium">{player1?.name} vs {player2?.name}</p>
                                        <p className="text-xs text-gray-500">{match.date} | {locations.find(l => l.id === match.location_id)?.name || ''}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-sm font-medium">
                                          {setsLineFor(match)}
                                        </p>
                                        {(match.player1_had_pint || match.player2_had_pint) && (
                                          <p className="text-xs text-purple-600 flex items-center justify-end">
                                            <span className="text-lg">🍻</span>
                                            <span className="ml-1">{match.player1_pints}</span>
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No head-to-head matches available
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 via-emerald-600 to-lime-700">
        <header className="bg-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <button
                  onClick={() => setSelectedDivision(null)}
                  className="text-green-600 hover:text-green-800 font-semibold mb-2"
                >
                  ← Back to {selectedTournament.name}
                </button>
                <h1 className="text-4xl font-bold text-gray-800">Pinta Post Championship</h1>
                <p className="text-gray-600">{getDivisionHighlights(selectedDivision.name, selectedTournament.name)}</p>
              </div>
              {currentUser && (
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="font-semibold text-gray-800">{currentUser.name}</p>
                    <p className="text-sm text-gray-600">Division: {currentUser.division} {currentUser.role === 'admin' && '(Admin)'}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition duration-200"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            {/* Division Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-2xl font-bold text-gray-800 mb-6">Resumen de la División</h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Players:</span>
                    <span className="font-bold text-blue-600">{players.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Partidos Jugados:</span>
                    <span className="font-bold text-green-600">{confirmedMatches.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Partidos Pendientes:</span>
                    <span className="font-bold text-yellow-600">{pendingMatches.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Partidos Confirmados:</span>
                    <span className="font-bold text-green-600">{confirmedMatches.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Pintas:</span>
                    <span className="font-bold text-purple-600">{divisionStandings.reduce((sum, s) => sum + s.pints, 0)}</span>
                  </div>
                </div>

                {leader && (
                  <div className="mt-6 bg-yellow-50 p-4 rounded-lg">
                    <div className="text-sm text-yellow-800">Líder Actual</div>
                    <div className="font-semibold text-yellow-900">{leader.name}</div>
                    <div className="text-sm text-yellow-700">{leader.points} puntos</div>
                  </div>
                )}

                {topPintsPlayer && (
                  <div className="mt-4 bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm text-blue-800">Jugador con Más Pintas</div>
                    <div className="font-semibold text-blue-900">{topPintsPlayer.name}</div>
                    <div className="text-sm text-blue-700">{topPintsPlayer.pints} pintas</div>
                  </div>
                )}
              </div>
            </div>

            {/* Player Standings */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-800">Player Standings</h2>
                  <p className="text-gray-600">Click on a player's name to view their match history</p>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MP</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">W</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">D</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">L</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SW</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SL</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SD</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pintas</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {rosterRows.length > 0 ? (
                        rosterRows.map((stats, index) => {
                          const player = profiles.find(p => p.id === stats.profile_id);
                          if (!player) return null;
                          return (
                            <tr 
                              key={stats.profile_id} 
                              className="hover:bg-gray-50 cursor-pointer" 
                              onClick={() => setSelectedPlayer(player)}
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                    index === 0 ? 'bg-yellow-400 text-yellow-800' :
                                    index === 1 ? 'bg-gray-300 text-gray-800' :
                                    index === 2 ? 'bg-orange-300 text-orange-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {index + 1}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 hover:text-green-700 cursor-pointer">
                                {player.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">{stats.points}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stats.wins + stats.losses}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">{stats.wins}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">0</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">{stats.losses}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{stats.sets_won}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{stats.sets_lost}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{stats.set_diff}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <span className="text-lg">🍻</span>
                                  <span className="ml-1 text-sm font-medium">{stats.pints}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={11} className="px-6 py-4 text-center text-gray-500">
                            No players in this division yet
                          </td>
                        </tr>
                      )}

                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Create Match Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Add Match Result */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Agregar Resultado del Partido</h3>
              <form onSubmit={handleAddMatch} className="space-y-4">

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Jugador 1</label>
                    <select
                      value={newMatch.player1} // Ahora guardará el ID del jugador
                      onChange={(e) => setNewMatch({...newMatch, player1: e.target.value, player2: ''})} // Reseteamos player2 al cambiar player1
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Player</option>
                      {players.map(player => (
                        <option key={player.id} value={player.id}>{player.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Jugador 2</label>
                    <select
                      value={newMatch.player2} // Ahora guardará el ID del jugador
                      onChange={(e) => setNewMatch({...newMatch, player2: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                      disabled={!newMatch.player1} // Se deshabilita si no se ha elegido Jugador 1
                    >
                      <option value="">Select Player</option>
                      {/* El filtro ahora compara por ID, que es más seguro y correcto */}
                      {players.filter(p => p.id !== newMatch.player1).map(player => (
                        <option key={player.id} value={player.id}>{player.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-semibold text-gray-800">Sets del Partido</h4>
                    <div className="space-x-2">
                      <button
                        type="button"
                        onClick={addSet}
                        className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                      >
                        Add Set
                      </button>
                    </div>
                  </div>
                  
                  {newMatch.sets.map((set, index) => (
                    <div key={index} className="flex items-center space-x-4 mb-3 last:mb-0">
                      <span className="text-sm font-medium text-gray-700 w-8">Set {index + 1}</span>
                      <input
                        type="number"
                        value={set.score1}
                        onChange={(e) => updateSetScore(index, 'score1', e.target.value)}
                        placeholder="0"
                        className="w-16 px-3 py-2 border border-gray-300 rounded text-center"
                        min="0"
                        required={index === 0}
                      />
                      <span className="text-gray-400">-</span>
                      <input
                        type="number"
                        value={set.score2}
                        onChange={(e) => updateSetScore(index, 'score2', e.target.value)}
                        placeholder="0"
                        className="w-16 px-3 py-2 border border-gray-300 rounded text-center"
                        min="0"
                        required={index === 0}
                      />
                      {newMatch.sets.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSet(index)}
                          className="text-red-600 hover:text-red-800 ml-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="hadPint"
                      checked={newMatch.hadPint}
                      onChange={(e) => setNewMatch({...newMatch, hadPint: e.target.checked})}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <label htmlFor="hadPint" className="ml-2 text-sm text-gray-700">
                      Se tomaron una Pinta post?
                    </label>
                  </div>
                  
                  {newMatch.hadPint && (
                    <div className="ml-6 space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Cuántas se tomaron cada uno (en promedio)?
                      </label>
                      <div className="flex items-center">
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={newMatch.pintsCount}
                          onChange={(e) => setNewMatch({...newMatch, pintsCount: e.target.value})}
                          className="w-20 px-3 py-2 border border-gray-300 rounded text-center"
                        />
                        <span className="ml-2 text-gray-600">pintas</span>
                      </div>
                      <p className="text-xs text-gray-500">Ingresa el número promedio de pintas que cada jugador tomó</p>
                    </div>
                  )}
                </div>
                
                <button
                  type="submit"
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition duration-200"
                >
                  Agregar Resultado del Partido
                </button>
              </form>
            </div>

            {/* Schedule Match */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Programar un Partido</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();

                // Validaciones mínimas
                if (!newMatch.player1) {
                  alert('Please select Player 1');
                  return;
                }
                if (!newMatch.location) {
                  alert('Please enter a location');
                  return;
                }
                if (!newMatch.date) {
                  alert('Please select a date');
                  return;
                }
                if (!newMatch.time) {
                  alert('Please select a time');
                  return;
                }

                // Evitar duplicados programados entre los mismos jugadores
                const duplicate = matches.some(m => {
                  const samePlayers =
                    (m.player1 === newMatch.player1 && m.player2 === newMatch.player2) ||
                    (m.player1 === newMatch.player2 && m.player2 === newMatch.player1);

                  return samePlayers &&
                        m.division_id === selectedDivision!.id &&
                        m.tournament_id === selectedTournament!.id &&
                        m.status === 'scheduled';
                });
                if (duplicate) {
                  alert('A match between these players is already scheduled in this division.');
                  return;
                }

                // Resolver location_id por nombre
                const locationId = locations.find(l => l.name === newMatch.location)?.id || null;

                // Status según haya segundo jugador o no
                const status = newMatch.player2 ? 'scheduled' : 'pending';

                try {
                  setLoading(true);

                  const { data: inserted, error } = await supabase
                    .from('matches')
                    .insert({
                      tournament_id: selectedTournament!.id,
                      division_id: selectedDivision!.id,
                      date: newMatch.date,
                      time: newMatch.time,
                      location_id: locationId,
                      status,
                      // usar columnas reales de tu tabla
                      home_player_id: newMatch.player1,
                      away_player_id: newMatch.player2 || null,
                      // iniciales
                      player1_sets_won: 0,
                      player2_sets_won: 0,
                      player1_games_won: 0,
                      player2_games_won: 0,
                      player1_had_pint: false,
                      player2_had_pint: false,
                      player1_pints: 0,
                      player2_pints: 0,
                      created_by: session?.user.id,
                      created_at: new Date().toISOString(),
                    })
                    .select()
                    .single();

                  if (error) throw error;

                  // Refrescar todo para que el resto vea el partido
                  await loadInitialData(session?.user.id);

                  alert(
                    status === 'scheduled'
                      ? '¡Partido programado! Ambos jugadores confirmaron.'
                      : '¡Partido publicado! Queda pendiente para que otro jugador se una.'
                  );

                  // Reset del formulario (conserva div/tournament en estado global)
                  setNewMatch(prev => ({
                    ...prev,
                    player1: '',
                    player2: '',
                    sets: [{ score1: '', score2: '' }],
                    hadPint: false,
                    pintsCount: '1',
                    location: '',
                    date: '',
                    time: ''
                  }));
                } catch (err: any) {
                  console.error('schedule match error:', err);
                  alert(`Error scheduling match: ${err.message}`);
                } finally {
                  setLoading(false);
                }
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Jugador 1</label>
                  {/* Jugador 1 */}
                  <select
                    value={newMatch.player1}
                    onChange={(e) => setNewMatch({...newMatch, player1: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Player</option>
                    {players.map(player => (
                      <option key={player.id} value={player.id}>{player.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Jugador 2 (Opcional)</label>
                  {/* Jugador 2 (Opcional) */}
                  <select
                    value={newMatch.player2}
                    onChange={(e) => setNewMatch({...newMatch, player2: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Anyone can join (Pending)</option>
                    {players.filter(p => p.id !== newMatch.player1).map(player => (
                      <option key={player.id} value={player.id}>{player.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <input
                    type="text"
                    value={newMatch.location}
                    onChange={(e) => setNewMatch({...newMatch, location: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                    placeholder="Enter court location"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                    <input
                      type="date"
                      value={newMatch.date}
                      onChange={(e) => setNewMatch({...newMatch, date: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
                    <select
                      value={newMatch.time}
                      onChange={(e) => setNewMatch({...newMatch, time: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Time</option>
                      <option value="Morning (07:00-12:00)">Morning (07:00-12:00)</option>
                      <option value="Afternoon (12:00-18:00)">Afternoon (12:00-18:00)</option>
                      <option value="Evening (18:00-22:00)">Evening (18:00-22:00)</option>
                      <option value="To Be Confirmed">To Be Confirmed</option>
                    </select>
                  </div>
                </div>
                
                <button
                  type="submit"
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition duration-200"
                >
                  Programar Partido
                </button>
              </form>
            </div>
          </div>

          {/* Pending Matches */}
          {pendingMatches.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Partidos Pendientes</h3>
              <p className="text-gray-600 mb-4">These matches are waiting for a second player to join. Click "Join Match" to participate.</p>
              
              <div className="space-y-4">
                {pendingMatches.map(match => {
                  const player1 = profiles.find(p => p.id === match.player1);
                  
                  return (
                    <div key={match.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-800">{player1?.name} is looking for a match</h4>
                          <p className="text-sm text-gray-600">{selectedDivision.name}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-blue-600">{match.date}</div>
                          <div className="text-sm text-gray-600">{match.time}</div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Location:</span> {locations.find(l => l.id === match.location_id)?.name || ''}
                      </div>
                      {currentUser?.id !== match.player1 && (
                        <button 
                          type="button"
                          className="mt-2 w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition duration-200 text-sm"
                          onClick={() => {
                            // Confirm match with current user
                            const updatedMatch = {
                              ...match,
                              player2: currentUser?.id,
                              status: 'scheduled'
                            };
                            
                            setMatches(prev => prev.map(m => 
                              m.id === match.id ? updatedMatch : m
                            ));
                            
                            alert(`You have joined ${player1?.name}'s match! The match is now confirmed.`);
                          }}
                        >
                          Unirse al Partido
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* All Upcoming Matches Section - Now at the bottom of the page */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800">Todos los Partidos Programados</h3>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={copyTableToClipboard}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition duration-200 flex items-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 11h8" />
                  </svg>
                  Copy Table
                </button>
                <button
                  type="button"
                  onClick={shareAllScheduledMatches}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition duration-200 flex items-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-1.164.94-1.164-.173-.298-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004c-1.03 0-2.018-.183-2.955-.51-.05-.018-.099-.037-.148-.055-1.753-.73-3.251-2.018-4.199-3.602l-.123-.214-8.254 3.032.133.194c3.105 4.51 8.178 7.154 13.58 7.154 2.029 0 3.979-.354 5.771-1.007 1.792-.654 3.333-1.644 4.53-2.916 1.197-1.273 1.986-2.783 2.26-4.417.275-1.635.099-3.347-.526-4.889-.625-1.543-1.665-2.843-3.022-3.796-1.357-.952-2.963-1.514-4.664-1.514h-.004c-1.724 0-3.35.573-4.68 1.601l-1.368 1.033 2.868 3.725 1.349-1.017c.557.371 1.158.654 1.802.843.644.189 1.318.284 2.02.284.571 0 1.133-.075 1.671-.223a5.04 5.04 0 001.395-.606 3.575 3.575 0 001.046-1.098c.31-.47.468-1.007.468-1.612 0-.578-.14-1.107-.42-1.596-.28-.489-.698-.891-1.255-1.207-.557-.316-1.22-.474-1.99-.474-.933 0-1.77.337-2.512 1.01l-1.368 1.207-1.37-1.17c-.604-.51-1.355-.872-2.166-1.081-.811-.209-1.65-.228-2.479-.055-1.07.228-2.03.85-2.72 1.774-.69.925-1.05 2.036-1.05 3.219 0 .67.128 1.318.385 1.914.258.595.614 1.125 1.07 1.57 1.713 1.6 4.083 2.577 6.567 2.577.41 0 .815-.027 1.213-.081.398-.055.788-.138 1.17-.248l.004-.002z"/>
                  </svg>
                  Compartir todo
                </button>
              </div>
            </div>
            
            {/* Grouped matches by date */}
            {confirmedMatches.length > 0 ? (
              <div className="space-y-6">
                {Object.entries(
                  confirmedMatches.reduce((acc, match) => {
                    const key = dateKey(match.date);
                    (acc[key] ??= []).push(match);
                    return acc;
                  }, {} as Record<string, Match[]>)
                ).sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime()).map(([date, matchesForDate]) => (
                  <div key={date} className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 font-semibold text-lg">
                      {tituloFechaEs(date)}
                    </div>
                    
                    <div className="divide-y divide-gray-200">
                      {['Morning (07:00-12:00)', 'Afternoon (12:00-18:00)', 'Evening (18:00-22:00)'].map(timeSlot => {
                        const matchesForTime = matchesForDate.filter(match => 
                          match.time?.includes(timeSlot.split(' ')[0])
                        );
                        
                        if (matchesForTime.length === 0) return null;
                        
                        return (
                          <div key={timeSlot} className="p-4">
                            <h4 className="font-medium text-gray-700 mb-3">{timeSlot}</h4>
                            <div className="space-y-3">
                              {matchesForTime.map(match => {
                                const player1 = profiles.find(p => p.id === match.player1);
                                const player2 = profiles.find(p => p.id === match.player2);
                                const location = locations.find(l => l.id === match.location_id);
                                
                                return (
                                  <div key={match.id} className="border rounded-lg p-3">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <h5 className="font-semibold text-gray-800">{player1?.name} vs {player2?.name}</h5>
                                        <p className="text-sm text-gray-600">{selectedDivision.name} Division</p>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-sm font-medium text-gray-800">{location?.name || ''}</div>
                                        {match.player1_had_pint && (
                                          <div className="mt-1 text-sm text-purple-600 flex items-center justify-end">
                                            <span className="text-lg">🍻</span>
                                            <span className="ml-1">{match.player1_pints}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No upcoming matches scheduled for this division
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};
export default App;

