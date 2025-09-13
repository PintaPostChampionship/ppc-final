import './index.css'
import React, { useState, useEffect } from "react";

const App = () => {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedMatchForResult, setSelectedMatchForResult] = useState(null);
  const [matches, setMatches] = useState([]);
  const [scheduledMatches, setScheduledMatches] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loginView, setLoginView] = useState(true);
  const [newUser, setNewUser] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    profilePic: '', 
    locations: [], 
    availability: {},
    tournaments: [],
    division: ''
  });
  const [newMatch, setNewMatch] = useState({ 
    player1: '', 
    player2: '', 
    sets: [{ score1: '', score2: '' }], 
    division: '', 
    tournament: '',
    hadPint: false, 
    pintsCount: 1, // Default to 1 pint
    location: '', 
    date: '', 
    time: '' 
  });
  const [showMap, setShowMap] = useState(false);
  const [registrationStep, setRegistrationStep] = useState(1);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [showAvailability, setShowAvailability] = useState(false);
  const [editProfile, setEditProfile] = useState(false);
  const [editUser, setEditUser] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    profilePic: '',
    tournaments: [],
    division: ''
  });

  // Updated tournaments with PPC Cup
  const tournaments = ['PPC Winter 2025/2026', 'WPPC Winter 2025/2026', 'PPC Spring 2026', 'PPC Cup'];
  
  // Division mapping for each tournament
  const tournamentDivisions = {
    'PPC Winter 2025/2026': ['Oro', 'Plata', 'Bronce', 'Cobre', 'Hierro'],
    'WPPC Winter 2025/2026': ['Oro', 'Plata', 'Bronce', 'Cobre', 'Hierro'],
    'PPC Spring 2026': ['Oro', 'Plata', 'Bronce', 'Cobre', 'Hierro'],
    'PPC Cup': ['Elite', 'Standard', 'Beginner']
  };

  const divisions = ['Oro', 'Plata', 'Bronce', 'Cobre', 'Hierro', 'Elite', 'Standard', 'Beginner'];
  const locations = ['South', 'Southeast', 'Southwest', 'North', 'Northeast', 'Northwest', 'Central'];
  const timeSlots = ['Morning (07:00-12:00)', 'Afternoon (12:00-18:00)', 'Evening (18:00-22:00)'];
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Location abbreviations
  const abbreviateLocation = (location) => {
    const abbreviations = {
      'South': 'S',
      'Southeast': 'SE',
      'Southwest': 'SW',
      'North': 'N',
      'Northeast': 'NE',
      'Northwest': 'NW',
      'Central': 'C'
    };
    return abbreviations[location] || location;
  };

  // Initialize with only admin user (without tournament/division)
  useEffect(() => {
    // Try to load from localStorage if available
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const savedUsers = localStorage.getItem('ppc_users');
        const savedMatches = localStorage.getItem('ppc_matches');
        const savedScheduled = localStorage.getItem('ppc_scheduled');
        const savedCurrentUser = localStorage.getItem('ppc_current_user');
        
        if (savedUsers) {
          const parsedUsers = JSON.parse(savedUsers);
          // Ensure all users have tournaments array
          const fixedUsers = parsedUsers.map(user => ({
            ...user,
            tournaments: user.tournaments || []
          }));
          setUsers(fixedUsers);
        } else {
          const adminUser = { 
            id: 1, 
            name: 'Admin User', 
            email: 'admin@ppc.com', 
            password: 'admin123', 
            role: 'admin',
            tournaments: []  // Ensure admin has tournaments array
          };
          setUsers([adminUser]);
          localStorage.setItem('ppc_users', JSON.stringify([adminUser]));
        }
        
        if (savedMatches) setMatches(JSON.parse(savedMatches));
        if (savedScheduled) setScheduledMatches(JSON.parse(savedScheduled));
        if (savedCurrentUser) setCurrentUser(JSON.parse(savedCurrentUser));
      } catch (error) {
        console.error('Error loading from localStorage:', error);
        const adminUser = { 
          id: 1, 
          name: 'Admin User', 
          email: 'admin@ppc.com', 
          password: 'admin123', 
          role: 'admin',
          tournaments: []  // Ensure admin has tournaments array
        };
        setUsers([adminUser]);
      }
    } else {
      const adminUser = { 
        id: 1, 
        name: 'Admin User', 
        email: 'admin@ppc.com', 
        password: 'admin123', 
        role: 'admin',
        tournaments: []  // Ensure admin has tournaments array
      };
      setUsers([adminUser]);
    }
  }, []);

  // Save to localStorage when data changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        // Ensure all users have tournaments array before saving
        const usersToSave = users.map(user => ({
          ...user,
          tournaments: user.tournaments || []
        }));
        localStorage.setItem('ppc_users', JSON.stringify(usersToSave));
      } catch (error) {
        console.error('Error saving users to localStorage:', error);
      }
    }
  }, [users]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('ppc_matches', JSON.stringify(matches));
      } catch (error) {
        console.error('Error saving matches to localStorage:', error);
      }
    }
  }, [matches]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('ppc_scheduled', JSON.stringify(scheduledMatches));
      } catch (error) {
        console.error('Error saving scheduled matches to localStorage:', error);
      }
    }
  }, [scheduledMatches]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem('ppc_current_user', JSON.stringify(currentUser));
      } catch (error) {
        console.error('Error saving current user to localStorage:', error);
      }
    }
  }, [currentUser]);

  // Keep newMatch.division and newMatch.tournament in sync with current view
  useEffect(() => {
    if (selectedDivision) {
      setNewMatch(prev => ({ ...prev, division: selectedDivision }));
    }
    if (selectedTournament) {
      setNewMatch(prev => ({ ...prev, tournament: selectedTournament }));
    }
  }, [selectedDivision, selectedTournament]);

  const handleRegister = (e) => {
    e.preventDefault();
    if (registrationStep === 1) {
      if (newUser.name && newUser.email) {
        const userExists = users.some(u => u.email === newUser.email);
        if (userExists) {
          alert('User with this email already exists! Please login instead.');
          return;
        }
        setRegistrationStep(2);
      }
    } else if (registrationStep === 2) {
      if (!newUser.profilePic) {
        alert('Please upload a profile picture');
        return;
      }
      if (Object.keys(newUser.availability || {}).length === 0) {
        alert('Please set your availability');
        return;
      }
      setRegistrationStep(3);
    } else if (registrationStep === 3) {
      if (newUser.password && newUser.tournaments.length > 0 && newUser.division) {
        // Validate division selection
        if (!divisions.includes(newUser.division)) {
          alert('Please select a valid division');
          return;
        }
        
        // Check tournament capacity for each selected tournament
        for (const tournament of newUser.tournaments) {
          const divisionPlayers = users.filter(u => 
            u.division === newUser.division && 
            (u.tournaments || []).includes(tournament) &&
            u.role !== 'admin'
          );
          
          // For PPC Cup, allow up to 20 players per division
          const capacity = tournament === 'PPC Cup' ? 20 : 12;
          
          if (divisionPlayers.length >= capacity) {
            alert(`Division ${newUser.division} is full for ${tournament}! Please choose another division.`);
            return;
          }
        }

        const user = {
          id: Date.now(),
          ...newUser,
          tournaments: newUser.tournaments || [],
          role: 'player'
        };
        setUsers(prevUsers => [...prevUsers, user]);
        setCurrentUser(user);
        setLoginView(false);
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
      } else {
        alert('Please fill in all required fields including password');
      }
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const user = users.find(u => u.email === newUser.email && u.password === newUser.password);
    if (user) {
      setCurrentUser(user);
      setLoginView(false);
      setNewUser({ name: '', email: '', password: '' });
    } else {
      alert('Invalid credentials! Try admin@ppc.com with password admin123');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setLoginView(true);
    setSelectedDivision(null);
    setSelectedPlayer(null);
    setShowMap(false);
    setSelectedTournament(null);
    setEditProfile(false);
  };

  const safeShareOnWhatsApp = (message) => {
    // WhatsApp message limit is approximately 3000 characters
    const MAX_MESSAGE_LENGTH = 3000;
    
    if (message.length > MAX_MESSAGE_LENGTH) {
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(message)
          .then(() => {
            alert('Message is too long for WhatsApp sharing. It has been copied to your clipboard. Please paste it manually into WhatsApp.');
          })
          .catch(() => {
            // Fallback for older browsers
            copyToClipboardFallback(message);
          });
      } else {
        copyToClipboardFallback(message);
      }
      return;
    }
    
    // Use universal WhatsApp link
    const encodedMessage = encodeURIComponent(message);
    const url = `https://wa.me/?text=${encodedMessage}`;
    
    // Try to open directly using window.location to ensure it's a user gesture
    try {
      if (typeof window !== 'undefined') {
        // Open in new tab with user gesture
        const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
        if (!newWindow || newWindow.closed) {
          // Fallback to direct navigation if popup blocked
          window.location.href = url;
        }
      }
    } catch (error) {
      // Final fallback
      if (typeof window !== 'undefined') {
        window.location.href = url;
      }
    }
  };

  const copyToClipboardFallback = (text) => {
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

  const shareAllScheduledMatches = () => {
    if (!selectedTournament) {
      alert('Please select a tournament first');
      return;
    }
    
    // Get all scheduled matches for the tournament
    const allScheduled = [...scheduledMatches]
      .filter(match => 
        match.tournament === selectedTournament && 
        match.status === 'confirmed'
      )
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    if (allScheduled.length === 0) {
      alert('No scheduled matches to share');
      return;
    }
    
    let message = `Pinta Post Championship - Partidos Programados:\n\n`;
    allScheduled.forEach(match => {
      message += `${match.division} Div\n`;
      message += `${match.date} - ${match.player1} vs ${match.player2}\n`;
      message += `L: ${match.location} | H: ${match.time}\n`;
      if (match.hadPint) {
        message += `P: ${match.pintsCount}\n`;
      }
      message += `\n`;
    });
    
    // Remove the last newline
    message = message.trim();
    
    safeShareOnWhatsApp(message);
  };

  const copyTableToClipboard = () => {
    if (!selectedTournament) {
      alert('Please select a tournament first');
      return;
    }
    
    // Get all scheduled matches for the tournament
    const allScheduled = [...scheduledMatches]
      .filter(match => 
        match.tournament === selectedTournament && 
        match.status === 'confirmed'
      )
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    if (allScheduled.length === 0) {
      alert('No scheduled matches to copy');
      return;
    }
    
    let table = `Pinta Post Championship - Partidos Programados\n`;
    table += `===============================================\n`;
    
    // Create a formatted table
    allScheduled.forEach(match => {
      const date = match.date;
      const time = match.time.split('(')[0].trim();
      const players = `${match.player1} vs ${match.player2}`;
      const division = match.division;
      const location = match.location;
      
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

  const handleAddMatch = (e) => {
    e.preventDefault();
    
    // Validate that we have at least one set with scores
    const validSets = newMatch.sets.filter(set => 
      set.score1 !== '' && set.score2 !== '' && 
      !isNaN(parseInt(set.score1)) && !isNaN(parseInt(set.score2))
    );
    
    if (validSets.length === 0) {
      alert('Please enter valid scores for at least one set');
      return;
    }
    
    // Check required fields
    if (!newMatch.player1 || !newMatch.player2) {
      alert('Please fill in all required fields');
      return;
    }
    
    // Calculate total games won/lost for each player across all sets
    let player1GamesWon = 0;
    let player2GamesWon = 0;
    
    newMatch.sets.forEach(set => {
      if (set.score1 !== '' && set.score2 !== '') {
        const score1 = parseInt(set.score1);
        const score2 = parseInt(set.score2);
        
        player1GamesWon += score1;
        player2GamesWon += score2;
      }
    });

    // Determine match winner based on sets won (not total games)
    let player1SetsWon = 0;
    let player2SetsWon = 0;
    
    newMatch.sets.forEach(set => {
      if (set.score1 !== '' && set.score2 !== '') {
        const score1 = parseInt(set.score1);
        const score2 = parseInt(set.score2);
        
        if (score1 > score2) player1SetsWon++;
        else if (score2 > score1) player2SetsWon++;
      }
    });

    const match = {
      id: Date.now(),
      ...newMatch,
      date: new Date().toISOString().split('T')[0],
      player1GamesWon,
      player2GamesWon,
      player1SetsWon,
      player2SetsWon
    };
    
    // Add the match to results
    setMatches(prevMatches => [...prevMatches, match]);
    
    // Check for matching scheduled match and remove it
    setScheduledMatches(prev => {
      return prev.filter(scheduledMatch => {
        // Check if this is the same match (same players, division, tournament)
        const isSameMatch = 
          scheduledMatch.division === match.division && 
          scheduledMatch.tournament === match.tournament &&
          (
            (scheduledMatch.player1 === match.player1 && scheduledMatch.player2 === match.player2) ||
            (scheduledMatch.player1 === match.player2 && scheduledMatch.player2 === match.player1)
          );
        
        return !isSameMatch;
      });
    });
    
    // Show success message
    alert('Match result added successfully!');
    
    // Reset form while preserving division and tournament
    setNewMatch(prev => ({
      ...prev,
      player1: '',
      player2: '',
      sets: [{ score1: '', score2: '' }],
      hadPint: false,
      pintsCount: 1,
      location: '',
      date: '',
      time: ''
    }));
    
    // Clear the selected match for result entry
    setSelectedMatchForResult(null);
  };

  const addSet = () => {
    setNewMatch(prev => ({
      ...prev,
      sets: [...prev.sets, { score1: '', score2: '' }]
    }));
  };

  const removeSet = (index) => {
    if (newMatch.sets.length > 1) {
      const newSets = newMatch.sets.filter((_, i) => i !== index);
      setNewMatch(prev => ({ ...prev, sets: newSets }));
    }
  };

  const updateSetScore = (index, field, value) => {
    const newSets = [...newMatch.sets];
    newSets[index][field] = value;
    setNewMatch(prev => ({ ...prev, sets: newSets }));
  };

  const getDivisionPlayers = (division, tournament) => {
    if (!division || !tournament) return [];
    
    return users.filter(user => 
      user.division === division && 
      (user.tournaments || []).includes(tournament) &&
      user.role !== 'admin' // Filter out admin users
    ).sort((a, b) => a.name.localeCompare(b.name));
  };

  const getDivisionMatches = (division, tournament) => {
    if (!division || !tournament) return [];
    
    return matches.filter(match => 
      match.division === division && 
      match.tournament === tournament
    );
  };

  const getScheduledMatches = (division, tournament) => {
    if (!division || !tournament) return [];
    
    return scheduledMatches.filter(match => 
      match.division === division && 
      match.tournament === tournament
    );
  };

  const getHeadToHeadResult = (division, tournament, playerA, playerB) => {
    const matches = getDivisionMatches(division, tournament);
    const h2hMatches = matches.filter(match => 
      (match.player1 === playerA && match.player2 === playerB) ||
      (match.player1 === playerB && match.player2 === playerA)
    );
    
    if (h2hMatches.length === 0) return null;
    
    // Count wins
    let playerAWins = 0;
    let playerBWins = 0;
    
    h2hMatches.forEach(match => {
      if (match.player1 === playerA && match.player1SetsWon > match.player2SetsWon) {
        playerAWins++;
      } else if (match.player2 === playerA && match.player2SetsWon > match.player1SetsWon) {
        playerAWins++;
      } else {
        playerBWins++;
      }
    });
    
    return {
      winner: playerAWins > playerBWins ? playerA : playerB,
      playerAWins,
      playerBWins
    };
  };

  const calculatePlayerStats = (division, tournament, playerName) => {
    if (!division || !tournament || !playerName) {
      return {
        name: playerName || '',
        points: 0,
        matchesPlayed: 0,
        matchesScheduled: 0,
        matchesPending: 0,
        matchesWon: 0,
        matchesDrawn: 0,
        matchesLost: 0,
        setsWon: 0,
        setsLost: 0,
        setsDifference: 0,
        pints: 0
      };
    }
    
    const divisionMatches = getDivisionMatches(division, tournament);
    const scheduled = getScheduledMatches(division, tournament);
    
    const stats = {
      name: playerName,
      points: 0,
      matchesPlayed: 0,
      matchesScheduled: 0,
      matchesPending: 0,
      matchesWon: 0,
      matchesDrawn: 0,
      matchesLost: 0,
      setsWon: 0,
      setsLost: 0,
      setsDifference: 0,
      pints: 0
    };

    // Count played matches
    divisionMatches.forEach(match => {
      if (match.player1 === playerName || match.player2 === playerName) {
        stats.matchesPlayed++;
        
        // Count sets won/lost based on total games across all sets
        if (match.player1 === playerName) {
          stats.setsWon += match.player1GamesWon;
          stats.setsLost += match.player2GamesWon;
        } else {
          stats.setsWon += match.player2GamesWon;
          stats.setsLost += match.player1GamesWon;
        }
        
        // Determine match result based on sets won (not total games)
        if (match.player1 === playerName) {
          if (match.player1SetsWon > match.player2SetsWon) {
            stats.matchesWon++;
            stats.points += 3;
          } else if (match.player2SetsWon > match.player1SetsWon) {
            stats.matchesLost++;
          } else {
            stats.matchesDrawn++;
            stats.points += 1;
          }
        } else {
          if (match.player2SetsWon > match.player1SetsWon) {
            stats.matchesWon++;
            stats.points += 3;
          } else if (match.player1SetsWon > match.player2SetsWon) {
            stats.matchesLost++;
          } else {
            stats.matchesDrawn++;
            stats.points += 1;
          }
        }

        // Count pints - now using pintsCount from match
        if (match.hadPint) {
          stats.pints += match.pintsCount;
        }
      }
    });

    // Calculate sets difference
    stats.setsDifference = stats.setsWon - stats.setsLost;
    
    // Count scheduled matches
    scheduled.forEach(match => {
      if ((match.player1 === playerName || match.player2 === playerName) && match.status === 'confirmed') {
        stats.matchesScheduled++;
      }
    });

    // Calculate pending matches (total possible - played - scheduled)
    const divisionPlayers = getDivisionPlayers(division, tournament);
    const totalPossibleMatches = divisionPlayers.length - 1; // Each player plays against everyone else once
    stats.matchesPending = Math.max(0, totalPossibleMatches - stats.matchesPlayed - stats.matchesScheduled);

    return stats;
  };

  const getPlayerMatches = (division, tournament, playerName) => {
    if (!division || !tournament || !playerName) {
      return {
        played: [],
        scheduled: [],
        upcoming: []
      };
    }
    
    const divisionMatches = getDivisionMatches(division, tournament);
    const scheduled = getScheduledMatches(division, tournament);
    
    const playerMatches = {
      played: divisionMatches.filter(match => 
        match.player1 === playerName || match.player2 === playerName
      ),
      scheduled: scheduled.filter(match => 
        (match.player1 === playerName || match.player2 === playerName) && match.status === 'confirmed'
      )
    };

    const players = getDivisionPlayers(division, tournament);
    const opponents = players.filter(player => player.name !== playerName);

    const upcoming = opponents.filter(opponent => {
      return !playerMatches.played.some(match => 
        (match.player1 === playerName && match.player2 === opponent.name) ||
        (match.player1 === opponent.name && match.player2 === playerName)
      ) && !playerMatches.scheduled.some(match =>
        (match.player1 === playerName && match.player2 === opponent.name) ||
        (match.player1 === opponent.name && match.player2 === playerName)
      );
    });

    return { ...playerMatches, upcoming };
  };

  const getDivisionHighlights = (division, tournament) => {
    // Different highlights for PPC Cup divisions
    if (tournament === 'PPC Cup') {
      const highlights = {
        'Elite': 'Top players competing for the PPC Cup championship title.',
        'Standard': 'Intermediate players looking to test their skills in the cup format.',
        'Beginner': 'New players getting their first taste of competitive play in the cup.'
      };
      return highlights[division] || 'Exciting division with passionate players.';
    }
    
    const highlights = {
      'Oro': 'The elite players who dominate with powerful serves and aggressive baseline play.',
      'Plata': 'Highly skilled players with excellent all-around game and competitive spirit.',
      'Bronce': 'Solid players improving rapidly with strong fundamentals and consistency.',
      'Cobre': 'Developing players showing great potential and passion for the game.',
      'Hierro': 'Newcomers and enthusiasts learning the game with enthusiasm and dedication.'
    };
    return highlights[division] || 'Exciting division with passionate players.';
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

  const toggleLocation = (location) => {
    setNewUser(prev => ({
      ...prev,
      locations: prev.locations.includes(location)
        ? prev.locations.filter(loc => loc !== location)
        : [...prev.locations, location]
    }));
  };

  const toggleAvailability = (day, timeSlot) => {
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

  const toggleTournament = (tournament) => {
    setNewUser(prev => ({
      ...prev,
      tournaments: prev.tournaments.includes(tournament)
        ? prev.tournaments.filter(t => t !== tournament)
        : [...prev.tournaments, tournament]
    }));
  };

  const handleProfilePicUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setNewUser(prev => ({ ...prev, profilePic: e.target.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditProfile = () => {
    if (currentUser) {
      setEditUser({
        name: currentUser.name,
        email: currentUser.email,
        password: currentUser.password,
        profilePic: currentUser.profilePic,
        tournaments: currentUser.tournaments || [],
        division: currentUser.division || ''
      });
      setEditProfile(true);
    }
  };

  const saveProfileChanges = () => {
    if (editUser.name && editUser.email && editUser.password) {
      const updatedUsers = users.map(user => 
        user.id === currentUser.id 
          ? { ...user, ...editUser }
          : user
      );
      setUsers(updatedUsers);
      setCurrentUser({ ...currentUser, ...editUser });
      setEditProfile(false);
    }
  };

  const isAdmin = currentUser?.role === 'admin';

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
                  </div>
                </form>
              </div>

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
                  </div>
                </form>
                
                <div className="mt-4 text-sm text-center text-gray-600">
                  <p>Admin credentials: admin@ppc.com / admin123</p>
                </div>
              </div>
            </>
          ) : registrationStep === 2 ? (
            <div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">Complete Your Profile</h2>
              <form onSubmit={handleRegister}>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Profile Picture</label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      {newUser.profilePic ? (
                        <img src={newUser.profilePic} alt="Profile" className="mx-auto h-24 w-24 rounded-full object-cover" />
                      ) : (
                        <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4 4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      <div className="mt-4">
                        <label className="cursor-pointer bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition duration-200">
                          Upload Photo
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleProfilePicUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <p className="mt-2 text-sm text-gray-500">PNG, JPG up to 5MB</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Locations</label>
                    <div className="grid grid-cols-2 gap-2">
                      {locations.map(location => (
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
                                      checked={newUser.availability?.[day]?.includes(slot) || false}
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
                      value={newUser.tournaments[0] || ''}
                      onChange={(e) => {
                        const tournament = e.target.value;
                        if (tournament) {
                          setNewUser({...newUser, tournaments: [tournament]});
                        } else {
                          setNewUser({...newUser, tournaments: []});
                        }
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Tournament</option>
                      {tournaments.map(tournament => (
                        <option key={tournament} value={tournament}>{tournament}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Division</label>
                    <select
                      value={newUser.division}
                      onChange={(e) => {
                        const selectedDivision = e.target.value;
                        // Only update if it's a valid division
                        if (divisions.includes(selectedDivision) || selectedDivision === '') {
                          setNewUser({...newUser, division: selectedDivision});
                        }
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Division</option>
                      {(newUser.tournaments[0] ? tournamentDivisions[newUser.tournaments[0]] : divisions).map(division => {
                        // Check if the first selected tournament has this division full
                        const tournamentPlayers = users.filter(u => 
                          u.division === division && 
                          (u.tournaments || []).includes(newUser.tournaments[0] || '') &&
                          u.role !== 'admin'
                        );
                        
                        // For PPC Cup, allow up to 20 players per division
                        const capacity = newUser.tournaments[0] === 'PPC Cup' ? 20 : 12;
                        
                        return (
                          <option key={division} value={division} disabled={tournamentPlayers.length >= capacity}>
                            {division} {tournamentPlayers.length >= capacity ? '(Full)' : ''}
                          </option>
                        );
                      })}
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
                      placeholder="Enter your password"
                    />
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
                    <p className="text-sm text-gray-600">{currentUser.tournaments?.join(', ') || 'No tournaments'}</p>
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
          </div>

          {/* Tournament Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {tournaments.map(tournament => {
              const tournamentUsers = users.filter(u => 
                (u.tournaments || []).includes(tournament) && u.role !== 'admin'
              );
              const totalMatches = matches.filter(m => m.tournament === tournament).length;
              
              // Calculate total pints for the tournament
              const tournamentMatches = matches.filter(m => m.tournament === tournament);
              const totalPints = tournamentMatches.reduce((sum, match) => sum + (match.hadPint ? match.pintsCount : 0), 0);
              
              // Get all scheduled matches for the tournament
              const allScheduled = scheduledMatches.filter(m => 
                m.tournament === tournament && 
                m.status === 'confirmed'
              );
              
              return (
                <div key={tournament} className="bg-white rounded-xl shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition duration-300" onClick={() => setSelectedTournament(tournament)}>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{tournament}</h3>
                    <p className="text-gray-600 mb-4">Compete in our premier tennis championship</p>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{tournamentUsers.length}</div>
                        <div className="text-sm text-gray-600">Players</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{totalMatches}</div>
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
    const tournamentDivisions = (tournamentDivisions[selectedTournament] || divisions).map(division => {
      const players = getDivisionPlayers(division, selectedTournament) || [];
      const matches = getDivisionMatches(division, selectedTournament) || [];
      const scheduled = getScheduledMatches(division, selectedTournament) || [];
      
      // Calculate stats for each player
      const allStats = players.map(player => calculatePlayerStats(division, selectedTournament, player.name));
      const sortedStats = allStats.sort((a, b) => {
        // Primary: Points
        if (b.points !== a.points) return b.points - a.points;
        
        // Secondary: Sets difference
        if (b.setsDifference !== a.setsDifference) return b.setsDifference - a.setsDifference;
        
        // Tertiary: Head-to-head
        const headToHead = getHeadToHeadResult(division, selectedTournament, a.name, b.name);
        if (headToHead) {
          if (headToHead.winner === a.name) return -1;
          if (headToHead.winner === b.name) return 1;
        }
        
        // Final: Alphabetical
        return a.name.localeCompare(b.name);
      });
      
      const leader = sortedStats.length > 0 ? sortedStats[0] : null;
      
      // Find player with most pints in division
      const topPintsPlayer = sortedStats.length > 0 ? 
        sortedStats.sort((a, b) => b.pints - a.pints)[0] : null;
      
      return {
        division,
        players: players.length,
        gamesPlayed: matches.length,
        scheduledMatches: scheduled.length,
        winner: leader ? leader.name : 'N/A',
        totalPints: sortedStats.reduce((sum, player) => sum + player.pints, 0),
        leader,
        topPintsPlayer,
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
                <h1 className="text-4xl font-bold text-gray-800">Pinta Post Championship</h1>
                <p className="text-gray-600">All divisions and player details</p>
              </div>
              {currentUser && (
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="font-semibold text-gray-800">{currentUser.name}</p>
                    <p className="text-sm text-gray-600">Division: {currentUser.division || 'N/A'}</p>
                  </div>
                  <button
                    onClick={handleEditProfile}
                    className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition duration-200 text-sm"
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
                    value={editUser.name}
                    onChange={(e) => setEditUser({...editUser, name: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={editUser.email}
                    onChange={(e) => setEditUser({...editUser, email: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                              setEditUser({...editUser, profilePic: e.target.result});
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tournaments</label>
                  <div className="grid grid-cols-2 gap-2">
                    {tournaments.map(tournament => (
                      <label key={tournament} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={editUser.tournaments?.includes(tournament) || false}
                          onChange={() => {
                            setEditUser(prev => ({
                              ...prev,
                              tournaments: prev.tournaments?.includes(tournament)
                                ? prev.tournaments.filter(t => t !== tournament)
                                : [...(prev.tournaments || []), tournament]
                            }));
                          }}
                          className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{tournament}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Division</label>
                  <select
                    value={editUser.division}
                    onChange={(e) => setEditUser({...editUser, division: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Select Division</option>
                    {(selectedTournament ? tournamentDivisions[selectedTournament] : divisions).map(division => (
                      <option key={division} value={division}>{division}</option>
                    ))}
                  </select>
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
                  <div className="text-3xl font-bold text-blue-600">{tournamentDivisions.reduce((sum, d) => sum + d.players, 0)}</div>
                  <div className="text-sm text-gray-600">Total Players</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-green-600">{tournamentDivisions.reduce((sum, d) => sum + d.gamesPlayed, 0)}</div>
                  <div className="text-sm text-gray-600">Total Games Played</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-purple-600">{tournamentDivisions.reduce((sum, d) => sum + d.totalPints, 0)}</div>
                  <div className="text-sm text-gray-600">Total Pintas Consumidas</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-orange-600">{tournamentDivisions.length}</div>
                  <div className="text-sm text-gray-600">Divisions</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Division Winners</h3>
              <div className="space-y-4">
                {tournamentDivisions.map(d => (
                  <div key={d.division} className="border rounded-lg p-3">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-800">{d.division}</span>
                      <span className="text-sm text-gray-600">Líder: {d.leader ? d.leader.name : 'N/A'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Division Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {tournamentDivisions.map(({ division, players, gamesPlayed, scheduledMatches, winner, totalPints, leader, topPintsPlayer }) => (
              <div key={division} className="bg-white rounded-xl shadow-lg overflow-hidden cursor-pointer hover:shadow-xl transition duration-300" onClick={() => setSelectedDivision(division)}>
                <div className="p-6">
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">{division}</h3>
                  <p className="text-gray-600 mb-4">{getDivisionHighlights(division, selectedTournament)}</p>
                  
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
                      <div className="text-2xl font-bold text-orange-600">{topPintsPlayer ? topPintsPlayer.pints : 0}</div>
                      <div className="text-sm text-gray-600">Pintas Máximas</div>
                    </div>
                  </div>
                  
                  {leader && (
                    <div className="bg-yellow-50 p-3 rounded-lg mb-4">
                      <div className="text-sm text-yellow-800">Líder Actual</div>
                      <div className="font-semibold text-yellow-900">{leader.name}</div>
                      <div className="text-sm text-yellow-700">{leader.points} puntos</div>
                    </div>
                  )}
                  
                  {topPintsPlayer && (
                    <div className="bg-blue-50 p-3 rounded-lg mb-4">
                      <div className="text-sm text-blue-800">Jugador con Más Pintas</div>
                      <div className="font-semibold text-blue-900">{topPintsPlayer.name}</div>
                      <div className="text-sm text-blue-700">{topPintsPlayer.pints} pintas</div>
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
                            const playerIndex = index;
                            const player = getDivisionPlayers(division, selectedTournament)[playerIndex];
                            const stats = player ? calculatePlayerStats(division, selectedTournament, player.name) : null;
                            
                            if (stats) {
                              return (
                                <tr key={player?.id || index} className="text-sm">
                                  <td className="px-4 py-2 font-medium text-gray-900">{stats.name}</td>
                                  <td className="px-4 py-2 text-center">{stats.matchesPlayed}</td>
                                  <td className="px-4 py-2 text-center">{stats.matchesScheduled}</td>
                                  <td className="px-4 py-2 text-center">{stats.matchesPending}</td>
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
              <h3 className="text-2xl font-bold text-gray-800">Partidos Programados - {selectedTournament}</h3>
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
                  {scheduledMatches
                    .filter(match => 
                      match.tournament === selectedTournament && 
                      match.status === 'confirmed'
                    )
                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                    .map(match => (
                      <tr key={match.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{match.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{match.player1} vs {match.player2}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{match.time}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{match.division}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{match.location}</td>
                      </tr>
                    ))}
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
    const players = getDivisionPlayers(selectedDivision, selectedTournament) || [];
    const allStats = players.map(player => calculatePlayerStats(selectedDivision, selectedTournament, player.name));
    
    // Sort players using the new ranking criteria
    const sortedStats = allStats.sort((a, b) => {
      // Primary: Points
      if (b.points !== a.points) return b.points - a.points;
      
      // Secondary: Sets difference
      if (b.setsDifference !== a.setsDifference) return b.setsDifference - a.setsDifference;
      
      // Tertiary: Head-to-head
      const headToHead = getHeadToHeadResult(selectedDivision, selectedTournament, a.name, b.name);
      if (headToHead) {
        if (headToHead.winner === a.name) return -1;
        if (headToHead.winner === b.name) return 1;
      }
      
      // Final: Alphabetical
      return a.name.localeCompare(b.name);
    });
    
    const leader = sortedStats.length > 0 ? sortedStats[0] : null;
    
    // Find player with most pints in division
    const topPintsPlayer = sortedStats.length > 0 ? 
      sortedStats.sort((a, b) => b.pints - a.pints)[0] : null;

    // Get all scheduled matches for this division
    const pendingMatches = scheduledMatches.filter(match => 
      match.division === selectedDivision && 
      match.tournament === selectedTournament && 
      match.status === 'pending'
    );

    const confirmedMatches = scheduledMatches.filter(match => 
      match.division === selectedDivision && 
      match.tournament === selectedTournament && 
      match.status === 'confirmed'
    );

    // Player Profile View
    if (selectedPlayer) {
      const player = players.find(p => p.name === selectedPlayer);
      const playerStats = calculatePlayerStats(selectedDivision, selectedTournament, selectedPlayer);
      const playerMatches = getPlayerMatches(selectedDivision, selectedTournament, selectedPlayer);
      
      // Calculate upcoming matches against all other players
      const divisionPlayers = getDivisionPlayers(selectedDivision, selectedTournament);
      const allOpponents = divisionPlayers.filter(p => p.name !== selectedPlayer);
      
      const upcomingMatches = allOpponents.filter(opponent => {
        return !playerMatches.played.some(match => 
          (match.player1 === selectedPlayer && match.player2 === opponent.name) ||
          (match.player1 === opponent.name && match.player2 === selectedPlayer)
        ) && !playerMatches.scheduled.some(match =>
          (match.player1 === selectedPlayer && match.player2 === opponent.name) ||
          (match.player1 === opponent.name && match.player2 === selectedPlayer)
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
                    ← Back to {selectedDivision} Division
                  </button>
                  <h1 className="text-4xl font-bold text-gray-800">{selectedPlayer}</h1>
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
                      {player?.profilePic ? (
                        <img src={player.profilePic} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <span className="text-4xl text-gray-500">👤</span>
                        </div>
                      )}
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mt-4">{selectedPlayer}</h2>
                    <p className="text-gray-600">{selectedDivision} Division</p>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-blue-800 mb-2">Availability</h3>
                      <div className="space-y-2">
                        {days.map(day => (
                          <div key={day} className="flex justify-between">
                            <span className="text-gray-700 font-medium">{day}:</span>
                            <div className="flex flex-wrap justify-end gap-1">
                              {player?.availability && player.availability[day] && player.availability[day].length > 0 ? (
                                player.availability[day].map(slot => (
                                  <span key={slot} className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                                    {slot}
                                  </span>
                                ))
                              ) : (
                                <span className="text-gray-400 text-sm">Not available</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-gray-800 mb-2">Locations</h3>
                      <div className="flex flex-wrap gap-2">
                        {player?.locations && player.locations.length > 0 ? (
                          player.locations.map(location => (
                            <span key={location} className="bg-gray-100 text-gray-800 text-sm px-3 py-1 rounded-full">
                              {abbreviateLocation(location)}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400 text-sm">No locations set</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-yellow-800 mb-2">Tournaments & Division</h3>
                      <div className="space-y-2">
                        <div>
                          <span className="font-medium text-gray-700">Division:</span>
                          <span className="ml-1 font-medium">{player?.division}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Tournaments:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {player?.tournaments && player.tournaments.length > 0 ? (
                              player.tournaments.map(tournament => (
                                <span key={tournament} className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                                  {tournament}
                                </span>
                              ))
                            ) : (
                              <span className="text-gray-400 text-sm">No tournaments joined</span>
                            )}
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
                      <div className="text-2xl font-bold text-green-600">{playerStats.matchesPlayed}</div>
                      <div className="text-sm text-gray-600">Matches Played</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">{playerStats.pints}</div>
                      <div className="text-sm text-gray-600">Pintas</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">{playerStats.setsWon}</div>
                      <div className="text-sm text-gray-600">Sets Won</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{playerStats.setsDifference}</div>
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
                                playerStats.points === sortedStats[0]?.points ? 'bg-yellow-400 text-yellow-800' :
                                playerStats.points === sortedStats[1]?.points ? 'bg-gray-300 text-gray-800' :
                                playerStats.points === sortedStats[2]?.points ? 'bg-orange-300 text-orange-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {sortedStats.findIndex(s => s.name === selectedPlayer) + 1}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                            {selectedPlayer}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">{playerStats.points}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{playerStats.matchesPlayed}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">{playerStats.matchesWon}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">{playerStats.matchesDrawn}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">{playerStats.matchesLost}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{playerStats.setsWon}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{playerStats.setsLost}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{playerStats.setsDifference}</td>
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
                      {playerMatches.played.map((match, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-semibold text-gray-800">
                                {match.player1 === selectedPlayer ? match.player2 : match.player1}
                              </h4>
                              <p className="text-sm text-gray-600">{match.division} Division</p>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-blue-600">{match.date}</div>
                              <div className="text-sm text-gray-600">
                                {match.player1GamesWon}-{match.player2GamesWon}
                              </div>
                            </div>
                          </div>
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">Location:</span> {match.location}
                          </div>
                          {match.hadPint && (
                            <div className="mt-1 text-sm text-purple-600 flex items-center">
                              <span className="text-lg">🍻</span>
                              <span className="ml-1">Tomaron {match.pintsCount} pintas cada uno</span>
                            </div>
                          )}
                        </div>
                      ))}
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
                              <p className="text-sm text-gray-600">{selectedDivision} Division</p>
                            </div>
                            <button 
                              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition duration-200"
                              onClick={() => {
                                // Schedule a match with this opponent
                                setNewMatch({
                                  player1: selectedPlayer,
                                  player2: opponent.name,
                                  sets: [{ score1: '', score2: '' }],
                                  hadPint: false,
                                  pintsCount: 1,
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
                      {divisionPlayers.filter(p => p.name !== selectedPlayer).map(opponent => {
                        const h2hMatches = playerMatches.played.filter(match => 
                          (match.player1 === selectedPlayer && match.player2 === opponent.name) ||
                          (match.player1 === opponent.name && match.player2 === selectedPlayer)
                        );
                        
                        if (h2hMatches.length === 0) return null;
                        
                        // Calculate head-to-head stats
                        let wins = 0;
                        let losses = 0;
                        let draws = 0;
                        let totalSetsWon = 0;
                        let totalSetsLost = 0;
                        
                        h2hMatches.forEach(match => {
                          if (match.player1 === selectedPlayer) {
                            totalSetsWon += match.player1GamesWon;
                            totalSetsLost += match.player2GamesWon;
                            if (match.player1SetsWon > match.player2SetsWon) wins++;
                            else if (match.player1SetsWon < match.player2SetsWon) losses++;
                            else draws++;
                          } else {
                            totalSetsWon += match.player2GamesWon;
                            totalSetsLost += match.player1GamesWon;
                            if (match.player2SetsWon > match.player1SetsWon) wins++;
                            else if (match.player1SetsWon < match.player2SetsWon) losses++;
                            else draws++;
                          }
                        });
                        
                        return (
                          <div key={opponent.id} className="border rounded-lg p-4">
                            <div className="flex justify-between items-center mb-4">
                              <h3 className="font-semibold text-gray-800 text-lg">{opponent.name}</h3>
                              <div className="bg-gray-50 px-3 py-1 rounded-lg">
                                <span className="text-green-600 font-medium">{wins}W</span> - 
                                <span className="text-blue-600 font-medium">{draws}D</span> - 
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
                              {h2hMatches.map((match, index) => (
                                <div key={index} className="border-t pt-2">
                                  <div className="flex justify-between">
                                    <div>
                                      <p className="text-sm font-medium">{match.player1} vs {match.player2}</p>
                                      <p className="text-xs text-gray-500">{match.date} | {match.location}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-medium">
                                        {match.player1GamesWon}-{match.player2GamesWon}
                                      </p>
                                      {match.hadPint && (
                                        <p className="text-xs text-purple-600 flex items-center justify-end">
                                          <span className="text-lg">🍻</span>
                                          <span className="ml-1">{match.pintsCount}</span>
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
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
                  ← Back to {selectedTournament}
                </button>
                <h1 className="text-4xl font-bold text-gray-800">Pinta Post Championship</h1>
                <p className="text-gray-600">{getDivisionHighlights(selectedDivision, selectedTournament)}</p>
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
                    <span className="font-bold text-blue-600">{players.length}/20</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Partidos Jugados:</span>
                    <span className="font-bold text-green-600">{getDivisionMatches(selectedDivision, selectedTournament).length}</span>
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
                    <span className="font-bold text-purple-600">{sortedStats.reduce((sum, player) => sum + player.pints, 0)}</span>
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
                      {sortedStats.length > 0 ? (
                        sortedStats.map((stats, index) => (
                          <tr key={stats.name} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedPlayer(stats.name)}>
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
                              {stats.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">{stats.points}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stats.matchesPlayed}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">{stats.matchesWon}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">{stats.matchesDrawn}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">{stats.matchesLost}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{stats.setsWon}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{stats.setsLost}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{stats.setsDifference}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <span className="text-lg">🍻</span>
                                <span className="ml-1 text-sm font-medium">{stats.pints}</span>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="11" className="px-6 py-4 text-center text-gray-500">
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
                      value={newMatch.player1}
                      onChange={(e) => setNewMatch({...newMatch, player1: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Player</option>
                      {players.map(player => (
                        <option key={player.id} value={player.name}>{player.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Jugador 2</label>
                    <select
                      value={newMatch.player2}
                      onChange={(e) => setNewMatch({...newMatch, player2: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Player</option>
                      {players.filter(p => p.name !== newMatch.player1).map(player => (
                        <option key={player.id} value={player.name}>{player.name}</option>
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
                          onChange={(e) => setNewMatch({...newMatch, pintsCount: parseInt(e.target.value) || 1})}
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
              <form onSubmit={(e) => {
                e.preventDefault();
                
                // Check for duplicate matches
                const isDuplicate = scheduledMatches.some(match => {
                  const playersMatch = 
                    (match.player1 === newMatch.player1 && match.player2 === newMatch.player2) ||
                    (match.player1 === newMatch.player2 && match.player2 === newMatch.player1);
                  
                  return playersMatch && 
                         match.division === newMatch.division && 
                         match.tournament === newMatch.tournament &&
                         (match.status === 'pending' || match.status === 'confirmed');
                });

                if (isDuplicate) {
                  alert('A match between these players already exists in this division and tournament!');
                  return;
                }
                
                // Validate required fields
                if (!newMatch.player1) {
                  alert('Please select Player 1');
                  return;
                }
                
                if (!newMatch.division) {
                  alert('Division is missing');
                  return;
                }
                
                if (!newMatch.tournament) {
                  alert('Tournament is missing');
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
                
                // Create the match
                const match = {
                  id: Date.now(),
                  ...newMatch,
                  status: newMatch.player2 ? 'confirmed' : 'pending',
                  player2: newMatch.player2 || 'Pending'
                };
                
                // Add to scheduled matches
                setScheduledMatches(prev => [...prev, match]);
                
                // Show success message
                if (match.status === 'confirmed') {
                  alert('Partido programado exitosamente! Ambos jugadores confirmaron.');
                } else {
                  alert('Partido programado exitosamente! Otros jugadores pueden unirse a este partido.');
                }
                
                // Reset form while preserving division and tournament
                setNewMatch(prev => ({
                  ...prev,
                  player1: '',
                  player2: '',
                  sets: [{ score1: '', score2: '' }],
                  hadPint: false,
                  pintsCount: 1,
                  location: '',
                  date: '',
                  time: ''
                }));
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Jugador 1</label>
                  <select
                    value={newMatch.player1}
                    onChange={(e) => setNewMatch({...newMatch, player1: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Player</option>
                    {players.map(player => (
                      <option key={player.id} value={player.name}>{player.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Jugador 2 (Opcional)</label>
                  <select
                    value={newMatch.player2}
                    onChange={(e) => setNewMatch({...newMatch, player2: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Anyone can join (Pending)</option>
                    {players.filter(p => p.name !== newMatch.player1).map(player => (
                      <option key={player.id} value={player.name}>{player.name}</option>
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
                {pendingMatches.map(match => (
                  <div key={match.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-800">{match.player1} is looking for a match</h4>
                        <p className="text-sm text-gray-600">{selectedDivision}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-blue-600">{match.date}</div>
                        <div className="text-sm text-gray-600">{match.time}</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Location:</span> {match.location}
                    </div>
                    {currentUser?.name !== match.player1 && (
                      <button 
                        type="button"
                        className="mt-2 w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition duration-200 text-sm"
                        onClick={() => {
                          // Confirm match with current user
                          const updatedMatch = {
                            ...match,
                            player2: currentUser.name,
                            status: 'confirmed'
                          };
                          
                          setScheduledMatches(prev => prev.map(m => 
                            m.id === match.id ? updatedMatch : m
                          ));
                          
                          alert(`You have joined ${match.player1}'s match! The match is now confirmed.`);
                        }}
                      >
                        Unirse al Partido
                      </button>
                    )}
                  </div>
                ))}
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
                    const date = match.date;
                    if (!acc[date]) acc[date] = [];
                    acc[date].push(match);
                    return acc;
                  }, {})
                ).sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB)).map(([date, matchesForDate]) => (
                  <div key={date} className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 font-semibold text-lg">
                      {new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                    
                    <div className="divide-y divide-gray-200">
                      {['Morning (07:00-12:00)', 'Afternoon (12:00-18:00)', 'Evening (18:00-22:00)'].map(timeSlot => {
                        const matchesForTime = matchesForDate.filter(match => 
                          match.time.includes(timeSlot.split(' ')[0])
                        );
                        
                        if (matchesForTime.length === 0) return null;
                        
                        return (
                          <div key={timeSlot} className="p-4">
                            <h4 className="font-medium text-gray-700 mb-3">{timeSlot}</h4>
                            <div className="space-y-3">
                              {matchesForTime.map(match => (
                                <div key={match.id} className="border rounded-lg p-3">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <h5 className="font-semibold text-gray-800">{match.player1} vs {match.player2}</h5>
                                      <p className="text-sm text-gray-600">{match.division} Division</p>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-sm font-medium text-gray-800">{match.location}</div>
                                      {match.hadPint && (
                                        <div className="mt-1 text-sm text-purple-600 flex items-center justify-end">
                                          <span className="text-lg">🍻</span>
                                          <span className="ml-1">{match.pintsCount}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
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
