/*
 * Padel Match Center
 *
 * This script implements a simple tournament manager for padel matches. It allows users
 * to create players, set up various tournament types (official match, fixed partner
 * tournaments, rotating partner tournaments and free tournaments), automatically
 * generate match schedules for round‑robin events, record scores and track live
 * rankings. The goal is to provide a lightweight match center that runs in a
 * modern browser and can be installed as a progressive web app on an iPhone.
 */

// Global state
const players = [];
let tournament = null;
// Temporary state used during creation of playoff tournaments to hold
// unassigned players and other information prior to building the final
// tournament object.  This is assigned in the playoff branch of the
// tournament creation handler and removed once merged into the tournament.
let tempPlayoffState;

// Elements
const playersListEl = document.getElementById('players-list');
const addPlayerForm = document.getElementById('add-player-form');
const playerNameInput = document.getElementById('player-name');

const tournamentForm = document.getElementById('tournament-form');
const tournamentTypeSelect = document.getElementById('tournament-type');
const fixedOptionsEl = document.getElementById('fixed-options');
const rotatingOptionsEl = document.getElementById('rotating-options');
const freeOptionsEl = document.getElementById('free-options');
const matchOptionsEl = document.getElementById('match-options');
const playoffOptionsEl = document.getElementById('playoff-options');
const handicapOptionsEl = document.getElementById('handicap-options');
const handicapListEl = document.getElementById('handicap-list');

const managementSection = document.getElementById('management-section');
const tournamentInfoEl = document.getElementById('tournament-info');
const scheduleEl = document.getElementById('schedule');
const resultsEl = document.getElementById('results');
const rankingEl = document.getElementById('ranking');
const addMatchBtn = document.getElementById('add-match-btn');

// Button for adding a second round of matches (fixed partner tournaments)
const secondRoundBtn = document.getElementById('second-round-btn');

// New button to finalize tournament and show final classification
const finishTournamentBtn = document.getElementById('finish-tournament-btn');

// Page containers and navigation
const page1 = document.getElementById('page1');
const page2 = document.getElementById('page2');
const page3 = document.getElementById('page3');
const backBtn = document.getElementById('back-btn'); // old unused back button (removed in new HTML but kept for backward compatibility)

// Navigation elements for multi‑page flow
const toFormatBtn = document.getElementById('to-format-btn');
const backToPlayersBtn = document.getElementById('back-to-players');
const backToConfigBtn = document.getElementById('back-to-config');

// Attach click handler for adding matches.  For free tournaments we allow manual entry,
// otherwise we show a player picker to form two pairs.  This handler is set up once
// and checks the tournament type at runtime.
if (addMatchBtn) {
  addMatchBtn.addEventListener('click', () => {
    if (!tournament) return;
    if (tournament.type === 'free') {
      addMatchFree();
    } else {
      addRandomMatch();
    }
  });

  // Update Add Match button to include an icon and label (English)
  addMatchBtn.innerHTML = '<span class="btn-icon">➕</span><span class="btn-label">Add</span>';
  addMatchBtn.classList.add('icon-btn');
}

// Handle finalize tournament button
if (finishTournamentBtn) {
  finishTournamentBtn.addEventListener('click', () => {
    finalizeTournament();
  });

  // Update Finish Tournament button with an icon and label (English)
  finishTournamentBtn.innerHTML = '<span class="btn-icon">🏁</span><span class="btn-label">Finish</span>';
  finishTournamentBtn.classList.add('icon-btn');
}

// Attach click handler for second round button (only used in fixed partner tournaments)
if (secondRoundBtn) {
  secondRoundBtn.addEventListener('click', () => {
    addSecondRound();
  });
}

// Handle import list button on the players page.  This opens a modal where
// users can paste or type a list of names separated by commas, newlines or
// numbered bullets.  The names will be parsed and added to the players
// array automatically.  The modal is created dynamically and removed
// after use.
const importListBtn = document.getElementById('import-list-btn');
if (importListBtn) {
  importListBtn.addEventListener('click', () => {
    openImportPlayersModal();
  });
}

function openImportPlayersModal() {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  // Create modal container
  const modal = document.createElement('div');
  modal.className = 'modal';
  // Title
  const title = document.createElement('h3');
  title.textContent = 'Import Players';
  modal.appendChild(title);
  // Instructions
  const instructions = document.createElement('p');
  instructions.style.fontSize = '0.9rem';
  instructions.style.marginBottom = '0.5rem';
  instructions.textContent = 'Paste or type player names separated by commas or line breaks. Numbers or bullets will be ignored.';
  modal.appendChild(instructions);
  // Text area for names
  const textarea = document.createElement('textarea');
  textarea.style.width = '100%';
  textarea.style.height = '120px';
  textarea.style.resize = 'vertical';
  textarea.placeholder = 'e.g. Alice, Bob, Charlie\n1. David\n2) Eve\nFrank';
  modal.appendChild(textarea);
  // Action buttons container
  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.justifyContent = 'space-evenly';
  actions.style.marginTop = '1rem';
  // Cancel button
  const cancel = document.createElement('button');
  cancel.className = 'btn secondary';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => {
    document.body.removeChild(overlay);
  });
  actions.appendChild(cancel);
  // Confirm button
  const confirm = document.createElement('button');
  confirm.className = 'btn primary';
  confirm.textContent = 'Add Players';
  confirm.addEventListener('click', () => {
    const text = textarea.value;
    if (text) {
      // Split on commas and newlines
      let names = text.split(/[,\n]+/);
      names = names
        .map((n) => n.trim())
        .filter((n) => n.length > 0)
        .map((n) => {
          // Remove leading numbers and punctuation (e.g. "1. ", "2) ")
          return n.replace(/^\d+\s*[\.\)\-:]?\s*/, '').trim();
        });
      names.forEach((name) => {
        // Avoid adding duplicate names (case insensitive)
        if (!players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
          players.push({ id: Date.now() + Math.random(), name, handicap: 0 });
        }
      });
      renderPlayers();
    }
    document.body.removeChild(overlay);
  });
  actions.appendChild(confirm);
  modal.appendChild(actions);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// Navigate from player page to configuration page
if (toFormatBtn) {
  toFormatBtn.addEventListener('click', () => {
    // Must have at least two players to proceed
    if (players.length < 2) {
      alert('Please add at least two players before creating a tournament.');
      return;
    }
    // Show page2 and hide page1
    page1.classList.add('hidden');
    page2.classList.remove('hidden');
    // Update handicap list now that players may have changed
    updateHandicapList();
  });
}

// Back from configuration to player page
if (backToPlayersBtn) {
  backToPlayersBtn.addEventListener('click', () => {
    // Reset any tournament config inputs? not necessary
    page2.classList.add('hidden');
    page1.classList.remove('hidden');
  });
}

// Back from schedule/ranking page to config page
if (backToConfigBtn) {
  backToConfigBtn.addEventListener('click', () => {
    // Reset tournament data and UI when going back
    tournament = null;
    scheduleEl.innerHTML = '';
    rankingEl.innerHTML = '';
    tournamentInfoEl.innerHTML = '';
    addMatchBtn.classList.add('hidden');

    // Hide finish tournament button when returning to config
    finishTournamentBtn.classList.add('hidden');
    // Show config page and hide schedule page
    page3.classList.add('hidden');
    page2.classList.remove('hidden');
  });
}

// Note: the old back button is no longer used. Navigation is handled via back-to-players and back-to-config buttons.

// Utility: shuffle array (Fisher–Yates)
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Render the list of players and update handicap options
function renderPlayers() {
  playersListEl.innerHTML = '';
  players.forEach((player, index) => {
    const div = document.createElement('div');
    // player index and name span.  Display a running number so users can
    // easily see how many players have been added.  The index is
    // one‑based and followed by a period for clarity.
    const nameSpan = document.createElement('span');
    nameSpan.className = 'name';
    nameSpan.textContent = `${index + 1}. ${player.name}`;
    div.appendChild(nameSpan);
    // delete button
    const delBtn = document.createElement('button');
    delBtn.className = 'delete-player';
    delBtn.innerHTML = '&times;';
    delBtn.addEventListener('click', () => {
      deletePlayer(player.id);
    });
    div.appendChild(delBtn);
    playersListEl.appendChild(div);
  });
  updateHandicapList();
}

// Update handicap list based on current players
function updateHandicapList() {
  handicapListEl.innerHTML = '';
  players.forEach((player) => {
    const label = document.createElement('label');
    label.textContent = `${player.name}: `;
    const input = document.createElement('input');
    input.type = 'number';
    input.value = player.handicap || 0;
    input.step = '1';
    input.addEventListener('change', () => {
      player.handicap = parseInt(input.value, 10) || 0;
    });
    label.appendChild(input);
    handicapListEl.appendChild(label);
  });
}

// Remove a player by id
function deletePlayer(playerId) {
  const idx = players.findIndex((p) => p.id === playerId);
  if (idx !== -1) {
    players.splice(idx, 1);
    // Update UI
    renderPlayers();
  }
}

// Show/hide tournament option sections based on selected type
function updateTournamentOptions() {
  const type = tournamentTypeSelect.value;
  fixedOptionsEl.classList.add('hidden');
  rotatingOptionsEl.classList.add('hidden');
  freeOptionsEl.classList.add('hidden');
  matchOptionsEl.classList.add('hidden');
  playoffOptionsEl.classList.add('hidden');
  // Populate buttons based on selected tournament type
  if (type === 'match') {
    matchOptionsEl.classList.remove('hidden');
    // Best of sets options: typical choices 1, 3 or 5
    createButtons([1, 3, 5], document.getElementById('match-sets-options'), document.getElementById('match-sets'));
  } else if (type === 'fixed') {
    fixedOptionsEl.classList.remove('hidden');
    // Fixed tournament players options (even numbers between 6 and 16)
    createButtons([6, 8, 10, 12, 14, 16], document.getElementById('fixed-players-options'), document.getElementById('fixed-players'));
  } else if (type === 'rotating') {
    rotatingOptionsEl.classList.remove('hidden');
    /*
     * Rotating tournament player options.
     * The user requested support for odd sizes (5, 7, 9, 11, 13, 14, 15, 16) in addition to the
     * traditional even sizes.  By supplying a full range from 4 up to 16 we allow organisers
     * to pick any number of players and our scheduling algorithm will handle byes fairly.  
     */
    createButtons([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], document.getElementById('rotating-players-options'), document.getElementById('rotating-players'));
  } else if (type === 'ladder') {
    // Ladder tournaments use all players and manual match entry
    freeOptionsEl.classList.add('hidden');
  } else if (type === 'free') {
    // In free tournaments we do not require a player count selection.  All
    // registered players are eligible (up to a maximum handled in the
    // tournament creation handler).  Hide the player count options
    // entirely.
    // Do not call createButtons for free tournaments.
    freeOptionsEl.classList.add('hidden');
  } else if (type === 'playoff') {
    // Show playoff options: number of players (4-16).  We allow even numbers up to 16.
    const playoffOpt = document.getElementById('playoff-options');
    playoffOpt.classList.remove('hidden');
    const playoffInput = document.getElementById('playoff-players');
    // When switching to playoff type, default the number of players to the current number
    // of available players (rounded down to the nearest even number) so users don't have
    // to manually select it.  Clamp between 4 and 16.
    let defaultCount = players.length;
    if (defaultCount < 4) defaultCount = 4;
    // ensure even number and within limits
    if (defaultCount % 2 !== 0) defaultCount--;
    if (defaultCount > 16) defaultCount = 16;
    playoffInput.value = defaultCount;
    // Build the option buttons and mark the default as active.  Allow even
    // player counts from 4 up to 32 (corresponding to 2 to 16 teams).
    createButtons([4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32], document.getElementById('playoff-players-options'), playoffInput);
  }
  // Courts options: display for all types
  createButtons([1, 2, 3, 4], document.getElementById('courts-options'), document.getElementById('courts'));
}

// Handle adding new player
addPlayerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = playerNameInput.value.trim();
  if (!name) return;
  players.push({ id: Date.now(), name, handicap: 0 });
  playerNameInput.value = '';
  renderPlayers();
});

// Handle tournament type change
tournamentTypeSelect.addEventListener('change', () => {
  updateTournamentOptions();
});

// On initial load, build the tournament type buttons and update the dependent options
document.addEventListener('DOMContentLoaded', () => {
  // Build format and scoring type buttons on page load
  createFormatButtons();
  createScoringButtons();
  updateTournamentOptions();
});

// Helper to clone nested objects (for schedule generation)
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Create a group of buttons for numeric option selection. This function fills the given
// container with buttons representing the values in the options array. When a button
// is clicked it updates the associated hidden input value and visually marks the
// selected button as active.
function createButtons(options, containerEl, inputEl) {
  if (!containerEl || !inputEl) return;
  // Clear existing buttons
  containerEl.innerHTML = '';
  options.forEach((val) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = val;
    // Apply active class if this value matches the input's current value
    if (String(inputEl.value) === String(val)) {
      btn.classList.add('active');
    }
    btn.addEventListener('click', () => {
      // Update hidden input
      inputEl.value = val;
      // Remove active class from all sibling buttons
      containerEl.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      // Set active class on clicked button
      btn.classList.add('active');
    });
    containerEl.appendChild(btn);
  });
}

// Create a set of buttons for selecting the tournament format.  The buttons are
// generated from the options defined in the hidden select element.  When a button
// is clicked, it updates the select's value, marks the button as active, and
// refreshes the dependent tournament options (number of players, sets, etc.).
function createFormatButtons() {
  const formatContainer = document.getElementById('format-options');
  const selectEl = tournamentTypeSelect;
  if (!formatContainer || !selectEl) return;
  // Clear existing buttons
  formatContainer.innerHTML = '';
  // Iterate through the select options to build corresponding buttons
  Array.from(selectEl.options).forEach((opt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    // Use the option's text as the button label
    btn.textContent = opt.textContent;
    // Save value on dataset for convenience
    btn.dataset.value = opt.value;
    // Set active state if this option is currently selected
    if (selectEl.value === opt.value) {
      btn.classList.add('active');
    }
    btn.addEventListener('click', () => {
      // Update the hidden select's value
      selectEl.value = opt.value;
      // Update button active state
      formatContainer.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      // Refresh dependent options
      updateTournamentOptions();
    });
    formatContainer.appendChild(btn);
  });
}

// Helper to find an existing team by its players (used for official and fixed tournaments when adding manual/random matches).
function findTeamByPlayers(selectedPlayers) {
  if (!tournament || !tournament.teams) return null;
  // Compare player ids ignoring order
  const ids = selectedPlayers.map((p) => p.id).sort().join('-');
  for (const team of tournament.teams) {
    const teamIds = team.players.map((p) => p.id).sort().join('-');
    if (ids === teamIds) {
      return team;
    }
  }
  return null;
}

// Create a set of buttons for selecting the scoring type (sets or Americano). When a user selects
// a scoring type, it toggles the visibility of sets options and Americano points accordingly.
function createScoringButtons() {
  const scoringContainer = document.getElementById('scoring-options');
  const scoringInput = document.getElementById('scoring-type');
  const matchOptionsEl = document.getElementById('match-options');
  const americanoContainer = document.getElementById('americano-points-container');
  if (!scoringContainer || !scoringInput) return;
  // Clear existing buttons
  scoringContainer.innerHTML = '';
  const options = [
    { value: 'sets', label: 'Sets' },
    { value: 'americano', label: 'Americano' },
  ];
  options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = opt.label;
    // Apply active state based on current input value
    if (scoringInput.value === opt.value) {
      btn.classList.add('active');
    }
    btn.addEventListener('click', () => {
      scoringInput.value = opt.value;
      // Remove active class from all buttons
      scoringContainer.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      // Toggle visibility
      if (opt.value === 'sets') {
        matchOptionsEl.classList.remove('hidden');
        americanoContainer.classList.add('hidden');
      } else {
        matchOptionsEl.classList.add('hidden');
        americanoContainer.classList.remove('hidden');
      }
    });
    scoringContainer.appendChild(btn);
  });
  // Initialize visibility on load
  if (scoringInput.value === 'americano') {
    matchOptionsEl.classList.add('hidden');
    americanoContainer.classList.remove('hidden');
  } else {
    matchOptionsEl.classList.remove('hidden');
    americanoContainer.classList.add('hidden');
  }
}

// Append a second round of matches for fixed partner tournaments.  It regenerates the round‑robin
// schedule for the existing teams and courts, adjusts round numbers to continue after the
// current schedule, and appends the new matches.  Scores from the first leg remain intact.
function addSecondRound() {
  if (!tournament || tournament.type !== 'fixed') return;
  // Use the same teams and number of courts stored in the tournament
  const newSchedule = generateScheduleFixed(tournament.teams.slice(), tournament.courts);
  const currentLength = tournament.schedule.length;
  newSchedule.forEach((roundMatches) => {
    roundMatches.forEach((match) => {
      match.round += currentLength;
    });
  });
  tournament.schedule = tournament.schedule.concat(newSchedule);
  updateRankingAndSchedule();
}

// Generate schedule for fixed partner tournament (round robin)
function generateScheduleFixed(teams, courts) {
  // Generate a full round‑robin schedule for fixed partner tournaments.  All teams
  // should play each other exactly once.  If the number of courts is less than
  // the maximum matches that can be played concurrently, additional sub‑rounds
  // will be created to ensure all pairings are scheduled.  This ensures that
  // each team plays (numTeams – 1) matches even when courts < numTeams/2.
  let numTeams = teams.length;
  // If odd number of teams, add a dummy team so round robin works
  if (numTeams % 2 === 1) {
    teams = teams.concat([{ id: 'dummy', name: 'BYE', players: [] }]);
    numTeams = teams.length;
  }
  const totalRounds = numTeams - 1;
  const schedule = [];
  // Create array of team indices used for rotation
  const indices = teams.map((_, i) => i);
  for (let round = 0; round < totalRounds; round++) {
    const matchesForRound = [];
    // Pair teams from opposite ends of indices list
    for (let m = 0; m < Math.floor(numTeams / 2); m++) {
      const teamA = teams[indices[m]];
      const teamB = teams[indices[numTeams - 1 - m]];
      // Skip matches involving dummy team
      if (teamA.id === 'dummy' || teamB.id === 'dummy') continue;
      matchesForRound.push({ teamA, teamB });
    }
    // Now split matchesForRound into sub‑rounds according to number of courts
    for (let i = 0; i < matchesForRound.length; i += courts) {
      const subRoundMatches = matchesForRound.slice(i, i + courts).map((m, idx) => {
        return {
          round: schedule.length + 1,
          court: idx + 1,
          teamA: m.teamA,
          teamB: m.teamB,
          score: null,
        };
      });
      if (subRoundMatches.length > 0) {
        schedule.push(subRoundMatches);
      }
    }
    // Rotate teams for next round (keep first fixed)
    indices.splice(1, 0, indices.pop());
  }
  return schedule;
}

// Generate schedule for rotating partner tournament (Americano style)
function generateScheduleRotating(playerList, courts) {
  const P = playerList.length;
  // For even number of players divisible by 4 we can create a balanced schedule where
  // each player pairs with every other player exactly once.  We use a round‑robin
  // algorithm to generate pairs for each round and then group these pairs into
  // matches of two pairs each.  If the number of courts is smaller than the
  // number of matches that can be simultaneously played (P/4), the matches are
  // spread across additional rounds.  For other sizes we fall back to the
  // original greedy algorithm to avoid infinite loops.
  if (P % 2 === 0 && P >= 4 && P % 4 === 0) {
    // Copy players array to avoid mutating original
    const arr = playerList.slice();
    const n = arr.length;
    const totalRounds = n - 1;
    const matchesList = [];
    // Generate all matches via round‑robin pairing
    let rotation = arr.slice();
    for (let r = 0; r < totalRounds; r++) {
      // Pair players from opposite ends of the rotation array
      const pairs = [];
      for (let i = 0; i < Math.floor(n / 2); i++) {
        const p1 = rotation[i];
        const p2 = rotation[n - 1 - i];
        // Skip self pairing (should not happen)
        if (p1 && p2 && p1.id !== p2.id) {
          pairs.push([p1, p2]);
        }
      }
      // Group pairs into matches of two pairs (four players)
      for (let i = 0; i + 1 < pairs.length; i += 2) {
        matchesList.push({ teamA: pairs[i], teamB: pairs[i + 1] });
      }
      // Rotate the array for next round (fix first element)
      const last = rotation.pop();
      rotation.splice(1, 0, last);
    }
    // Build schedule by grouping matches according to available courts
    const schedule = [];
    // Determine the maximum matches per sub‑round: at most P/4 matches can be played
    const matchesPerGroup = Math.floor(n / 4);
    let index = 0;
    while (index < matchesList.length) {
      const roundMatches = [];
      // Determine how many matches this round can host based on number of courts
      const maxMatchesThisRound = Math.min(courts, matchesPerGroup);
      for (let c = 0; c < maxMatchesThisRound && index < matchesList.length; c++) {
        const match = matchesList[index];
        // Assign round and court; round number is schedule length + 1 after push
        match.round = schedule.length + 1;
        match.court = (c % courts) + 1;
        match.score = null;
        roundMatches.push(match);
        index++;
      }
      schedule.push(roundMatches);
    }
    return schedule;
  }
  // Fallback algorithm for odd sizes or numbers not divisible by 4.
  // To ensure fairness when the number of players is not a multiple of four, we
  // generate all possible pairs and then schedule matches by prioritising
  // players who have rested the most and played the fewest matches.  This
  // reduces long sequences of rest rounds for any single player and ensures
  // everyone plays a comparable number of matches.
  // Build list of all pairs and a stats map for each player
  const allPairs = [];
  for (let i = 0; i < P; i++) {
    for (let j = i + 1; j < P; j++) {
      const pA = playerList[i];
      const pB = playerList[j];
      allPairs.push({ p1: pA, p2: pB, scheduled: false });
    }
  }
  const statsMap = new Map();
  playerList.forEach((p) => {
    statsMap.set(p.id, { matchesPlayed: 0, consecutiveRest: 0 });
  });
  const schedule = [];
  // Continue scheduling until all pairs are placed into matches or no further progress can be made
  while (allPairs.some((pair) => !pair.scheduled)) {
    const used = new Set();
    const round = [];
    // Determine maximum matches per round: at least 1 match if enough players exist
    const matchesPerRound = Math.max(1, Math.min(Math.floor(P / 4), courts));
    let matchesThisRound = 0;
    while (matchesThisRound < matchesPerRound) {
      // Candidate pairs: unscheduled and players not used in this round
      const candidates = allPairs.filter(
        (pair) =>
          !pair.scheduled &&
          !used.has(pair.p1.id) &&
          !used.has(pair.p2.id)
      );
      if (candidates.length < 2) break;
      // Sort candidates by priority: prefer pairs whose players have rested more and played less
      candidates.sort((A, B) => {
        const statA1 = statsMap.get(A.p1.id);
        const statA2 = statsMap.get(A.p2.id);
        const statB1 = statsMap.get(B.p1.id);
        const statB2 = statsMap.get(B.p2.id);
        const priA =
          statA1.consecutiveRest +
          statA2.consecutiveRest -
          0.1 * (statA1.matchesPlayed + statA2.matchesPlayed);
        const priB =
          statB1.consecutiveRest +
          statB2.consecutiveRest -
          0.1 * (statB1.matchesPlayed + statB2.matchesPlayed);
      return priB - priA;
      });
      const pairA = candidates[0];
      // Find second pair for this match that does not share players with pairA
      let pairB = null;
      for (let k = 1; k < candidates.length; k++) {
        const cand = candidates[k];
        if (
          cand.p1.id !== pairA.p1.id &&
          cand.p1.id !== pairA.p2.id &&
          cand.p2.id !== pairA.p1.id &&
          cand.p2.id !== pairA.p2.id
        ) {
          pairB = cand;
          break;
        }
      }
      if (!pairB) {
        // No compatible second pair found; break out to avoid infinite loop
        break;
      }
      // Schedule this match
      pairA.scheduled = true;
      pairB.scheduled = true;
      used.add(pairA.p1.id);
      used.add(pairA.p2.id);
      used.add(pairB.p1.id);
      used.add(pairB.p2.id);
      round.push({
        teamA: [pairA.p1, pairA.p2],
        teamB: [pairB.p1, pairB.p2],
        round: schedule.length + 1,
        court: (round.length % courts) + 1,
        score: null,
      });
      matchesThisRound++;
    }
    if (round.length > 0) {
      // Update player statistics: players used have played a match; others rested
      playerList.forEach((p) => {
        const st = statsMap.get(p.id);
        if (used.has(p.id)) {
          st.matchesPlayed++;
          st.consecutiveRest = 0;
        } else {
          st.consecutiveRest++;
        }
      });
      schedule.push(round);
    } else {
      // Unable to schedule more matches; break to avoid infinite loop
      break;
    }
  }
  return schedule;
}

// Generate bracket rounds for a playoff tournament given an array of teams.
// Returns an array of rounds; each round is an array of match objects with teamA, teamB and score fields.
function generatePlayoffBracket(teams) {
  // Determine bracket size as the next power of two >= number of teams
  let n = teams.length;
  let bracketSize = 1;
  while (bracketSize < n) bracketSize *= 2;
  // Randomize seed order for fairness
  const shuffled = shuffle(teams.slice());
  // Fill initial positions; null for byes
  const initial = [];
  for (let i = 0; i < bracketSize; i++) {
    initial[i] = shuffled[i] || null;
  }
  const rounds = [];
  let current = initial;
  const numRounds = Math.log2(bracketSize);
  for (let r = 0; r < numRounds; r++) {
    const matches = [];
    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      const teamA = current[i];
      const teamB = current[i + 1];
      matches.push({
        round: r + 1,
        court: 1,
        teamA,
        teamB,
        score: null,
      });
      // Prepopulate next round with bye winners
      if (!teamA && !teamB) {
        next.push(null);
      } else if (!teamA) {
        next.push(teamB);
      } else if (!teamB) {
        next.push(teamA);
      } else {
        next.push(null);
      }
    }
    rounds.push(matches);
    current = next;
  }
  return rounds;
}

// Generate an empty bracket structure for a given number of players.  This returns
// an array of rounds similar to generatePlayoffBracket, but all teamA/teamB
// slots in the first round are left as null so the user can assign teams
// manually.  The number of rounds is determined by the next power of two
// greater than or equal to the number of potential teams (players/2).
function generateEmptyBracket(numPlayers) {
  // Determine how many teams will be formed from the provided players. We assume
  // padel teams consist of two players each.  Compute the next power of two
  // greater than or equal to this team count to determine the bracket size.
  const numTeams = Math.ceil(numPlayers / 2);
  let bracketSize = 1;
  while (bracketSize < numTeams) bracketSize *= 2;
  const numRounds = Math.log2(bracketSize);
  // Create initial array of bracket slots; all positions are null so the user can
  // fill them later via the UI.  Although we know how many real teams will be
  // formed (numTeams), we intentionally leave the full bracket size blank and
  // handle byes during the match progression phase via propagateByesAll().
  let current = new Array(bracketSize).fill(null);
  const rounds = [];
  for (let r = 0; r < numRounds; r++) {
    const matches = [];
    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      matches.push({
        round: r + 1,
        court: 1,
        teamA: current[i],
        teamB: current[i + 1],
        score: null,
      });
      // prepare next round slots; initially null until winners are advanced
      next.push(null);
    }
    rounds.push(matches);
    current = next;
  }
  return rounds;
}

// Advance the winner of a playoff match to the next round.  Given the indices of the current round and match,
// determine the winner based on score and insert them into the next round's appropriate slot.
function progressWinner(roundIndex, matchIndex) {
  if (!tournament || tournament.type !== 'playoff') return;
  // Determine current match
  const match = tournament.schedule[roundIndex][matchIndex];
  if (!match || !match.score) return;
  const isAmericano = tournament.useAmericano;
  let winner = null;
  if (isAmericano) {
    winner = match.score[0] > match.score[1] ? match.teamA : match.teamB;
  } else {
    // Count sets won
    let setsA = 0;
    let setsB = 0;
    match.score.forEach(([a, b]) => {
      if (a > b) setsA++; else if (b > a) setsB++;
    });
    winner = setsA > setsB ? match.teamA : match.teamB;
  }
  // Determine next round index
  const nextRoundIndex = roundIndex + 1;
  if (!tournament.schedule[nextRoundIndex]) return;
  const nextMatchIndex = Math.floor(matchIndex / 2);
  const nextMatch = tournament.schedule[nextRoundIndex][nextMatchIndex];
  if (!nextMatch) return;
  // Determine placement: if matchIndex is even, winner goes into teamA; else teamB
  if (matchIndex % 2 === 0) {
    nextMatch.teamA = winner;
  } else {
    nextMatch.teamB = winner;
  }
}

// Propagate automatic winners through the bracket when only one team is present
// in a match (i.e. when the opponent slot is empty).  This helper function
// iterates through all rounds except the final one and advances any lone
// participants to the next round.  It repeatedly propagates until no
// additional changes occur, handling cases where byes cascade through
// multiple rounds.  This function is idempotent.
function propagateByesAll() {
  if (!tournament || tournament.type !== 'playoff') return;
  let changed;
  do {
    changed = false;
    for (let r = 0; r < tournament.schedule.length - 1; r++) {
      const currentRound = tournament.schedule[r];
      const nextRound = tournament.schedule[r + 1];
      for (let i = 0; i < currentRound.length; i++) {
        const match = currentRound[i];
        // Skip matches that already have a score recorded; winners will be
        // determined by progressWinner() when results are entered.
        if (match.score) continue;
        const onlyA = match.teamA && !match.teamB;
        const onlyB = match.teamB && !match.teamA;
        if (onlyA || onlyB) {
          const winner = onlyA ? match.teamA : match.teamB;
          const parent = nextRound[Math.floor(i / 2)];
          if (!parent) continue;
          if (i % 2 === 0) {
            if (!parent.teamA) {
              parent.teamA = winner;
              changed = true;
            }
          } else {
            if (!parent.teamB) {
              parent.teamB = winner;
              changed = true;
            }
          }
        }
      }
    }
  } while (changed);
}

// Display an overlay allowing the user to select two teams for a given first-round
// match.  The user can select exactly two players per team (or just one team
// if insufficient players remain).  Selected players are removed from the
// tournament.unassignedPlayers array and added to tournament.assignedPlayers.  A
// new team object is created for each side with a unique ID and a name
// composed of the two players' names.  After assigning teams the bracket is
// re-rendered.
function openTeamSelection(roundIndex, matchIndex) {
  if (!tournament || tournament.type !== 'playoff') return;
  // Only allow team selection on the first round
  if (roundIndex !== 0) return;
  const match = tournament.schedule[roundIndex][matchIndex];
  // Create overlay elements
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'modal';
  overlay.appendChild(modal);
  const title = document.createElement('h3');
  title.textContent = 'Select players for this match';
  modal.appendChild(title);
  // Container holding both team selection panes
  const teamContainer = document.createElement('div');
  teamContainer.style.display = 'flex';
  teamContainer.style.justifyContent = 'space-between';
  teamContainer.style.gap = '1rem';
  modal.appendChild(teamContainer);
  // Internal state
  const selectedA = [];
  const selectedB = [];
  // Map player ID to button elements for enabling/disabling between lists
  const btnsA = new Map();
  const btnsB = new Map();
    // Helper to update button states (disable a player if selected in other
    // team or if the respective team already has two players).  Also update
    // the confirm button disabled state based on selections.
    function refreshButtons() {
      // Team A buttons: highlight selected players; disable players that
      // belong to team B or when team A already has two players.
      btnsA.forEach((btn, id) => {
        const inA = selectedA.some((p) => p.id === id);
        const inB = selectedB.some((p) => p.id === id);
        if (inA) {
          btn.classList.add('active');
          btn.disabled = false;
        } else if (inB || selectedA.length >= 2) {
          btn.classList.remove('active');
          btn.disabled = true;
        } else {
          btn.classList.remove('active');
          btn.disabled = false;
        }
      });
      // Team B buttons: similar logic
      btnsB.forEach((btn, id) => {
        const inA = selectedA.some((p) => p.id === id);
        const inB = selectedB.some((p) => p.id === id);
        if (inB) {
          btn.classList.add('active');
          btn.disabled = false;
        } else if (inA || selectedB.length >= 2) {
          btn.classList.remove('active');
          btn.disabled = true;
        } else {
          btn.classList.remove('active');
          btn.disabled = false;
        }
      });
      // Enable confirm only when both teams have exactly two players selected
      if (confirmBtn) {
        confirmBtn.disabled = !(selectedA.length === 2 && selectedB.length === 2);
      }
    }
  // Build list for Team A
  const teamACol = document.createElement('div');
  teamACol.style.flex = '1';
  const headingA = document.createElement('h4');
  headingA.textContent = 'Team A';
  teamACol.appendChild(headingA);
  const listA = document.createElement('div');
  listA.className = 'team-list';
  teamACol.appendChild(listA);
  teamContainer.appendChild(teamACol);
  // Build list for Team B
  const teamBCol = document.createElement('div');
  teamBCol.style.flex = '1';
  const headingB = document.createElement('h4');
  headingB.textContent = 'Team B';
  teamBCol.appendChild(headingB);
  const listB = document.createElement('div');
  listB.className = 'team-list';
  teamBCol.appendChild(listB);
  teamContainer.appendChild(teamBCol);
  // Populate player buttons
  tournament.unassignedPlayers.forEach((player) => {
    // Button for Team A
    const btnA = document.createElement('button');
    btnA.type = 'button';
    btnA.textContent = player.name;
    btnA.className = 'btn secondary';
    btnA.style.margin = '0.2rem';
    btnA.addEventListener('click', () => {
      const idx = selectedA.findIndex((p) => p.id === player.id);
      if (idx >= 0) {
        // Remove from selectedA
        selectedA.splice(idx, 1);
      } else {
        if (selectedA.length < 2 && !selectedB.some((p) => p.id === player.id)) {
          selectedA.push(player);
        }
      }
      refreshButtons();
    });
    listA.appendChild(btnA);
    btnsA.set(player.id, btnA);
    // Button for Team B
    const btnB = document.createElement('button');
    btnB.type = 'button';
    btnB.textContent = player.name;
    btnB.className = 'btn secondary';
    btnB.style.margin = '0.2rem';
    btnB.addEventListener('click', () => {
      const idx = selectedB.findIndex((p) => p.id === player.id);
      if (idx >= 0) {
        selectedB.splice(idx, 1);
      } else {
        if (selectedB.length < 2 && !selectedA.some((p) => p.id === player.id)) {
          selectedB.push(player);
        }
      }
      refreshButtons();
    });
    listB.appendChild(btnB);
    btnsB.set(player.id, btnB);
  });
  // Footer with confirm and cancel buttons
  const footer = document.createElement('div');
  footer.style.display = 'flex';
  footer.style.justifyContent = 'flex-end';
  footer.style.gap = '0.5rem';
  footer.style.marginTop = '1rem';
  modal.appendChild(footer);
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    overlay.remove();
  });
  footer.appendChild(cancelBtn);
  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn primary';
  confirmBtn.textContent = 'Confirm';
  confirmBtn.disabled = true;
    confirmBtn.addEventListener('click', () => {
      /*
       * When confirmed, require that both sides have exactly two players.
       * If either team is incomplete, show an alert and abort.  This ensures
       * the organiser explicitly chooses both pairs instead of the system
       * automatically filling remaining players, which could be confusing.
       */
      if (selectedA.length !== 2 || selectedB.length !== 2) {
        alert('Please select exactly two players for each team.');
        return;
      }
      // Helper to create a team object
      function createTeam(selected) {
        const [p1, p2] = selected;
        const id = `team${tournament.nextTeamId++}`;
        return { id, name: `${p1.name} & ${p2.name}`, players: [p1, p2] };
      }
      const teamA = createTeam(selectedA);
      const teamB = createTeam(selectedB);
      // Assign teams to the match; always put teamA in A slot and teamB in B slot
      match.teamA = teamA;
      match.teamB = teamB;
      tournament.teams.push(teamA, teamB);
      // Remove assigned players from unassigned list
      const idsToRemove = [...selectedA, ...selectedB].map((p) => p.id);
      tournament.unassignedPlayers = tournament.unassignedPlayers.filter((p) => !idsToRemove.includes(p.id));
      // Record assigned players
      tournament.assignedPlayers = tournament.assignedPlayers.concat(selectedA.concat(selectedB));
      // Close overlay and refresh bracket
      overlay.remove();
      updateRankingAndSchedule();
    });
  footer.appendChild(confirmBtn);
  document.body.appendChild(overlay);
  // Initial state update
  refreshButtons();
}

/*
 * Show a choice dialog when creating a fixed partner tournament.  The user
 * can choose between automatically generating random teams or manually
 * creating each team.  When manual mode is selected, a second dialog
 * (openFixedManualTeamSelection) is presented.  This function receives
 * the list of players selected for the tournament, the number of courts,
 * and tournament configuration options needed to build the final
 * tournament once the teams are formed.
 */
function openFixedTeamsChoice(selectedPlayers, numPlayers, courts, sets, useAmericano, americanoPoints, useHandicap) {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'modal';
  overlay.appendChild(modal);
  const title = document.createElement('h3');
  title.textContent = 'Create teams';
  modal.appendChild(title);
  const prompt = document.createElement('p');
  prompt.textContent = 'How would you like to form the teams?';
  modal.appendChild(prompt);
  const buttons = document.createElement('div');
  buttons.style.display = 'flex';
  buttons.style.justifyContent = 'center';
  buttons.style.gap = '1rem';
  modal.appendChild(buttons);
  // Auto generate button
  const autoBtn = document.createElement('button');
  autoBtn.className = 'btn primary';
  autoBtn.textContent = 'Autogenerate';
  autoBtn.addEventListener('click', () => {
    // Shuffle players to randomise teams
    const shuffled = shuffle(selectedPlayers.slice());
    const teams = [];
    for (let i = 0; i < numPlayers; i += 2) {
      const p1 = shuffled[i];
      const p2 = shuffled[i + 1];
      teams.push({
        id: `team${i / 2}`,
        name: `${p1.name} & ${p2.name}`,
        players: [p1, p2],
      });
    }
    // Generate schedule and create tournament
    const schedule = generateScheduleFixed(teams, courts);
    const infoHtml = `<p>Fixed partner tournament with ${teams.length} teams and ${courts} court(s).</p>`;
    // Build tournament object and update UI
    finalizeFixedTournament(teams, schedule, infoHtml, sets, useAmericano, americanoPoints, useHandicap, courts);
    overlay.remove();
  });
  buttons.appendChild(autoBtn);
  // Manual teams button
  const manualBtn = document.createElement('button');
  manualBtn.className = 'btn accent';
  manualBtn.textContent = "I'll do manually";
  manualBtn.addEventListener('click', () => {
    overlay.remove();
    openFixedManualTeamSelection(selectedPlayers, numPlayers, courts, sets, useAmericano, americanoPoints, useHandicap);
  });
  buttons.appendChild(manualBtn);
  // Cancel button
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    overlay.remove();
  });
  buttons.appendChild(cancelBtn);
  document.body.appendChild(overlay);
}

/*
 * Display a modal allowing the organiser to manually assign players into
 * fixed teams.  The number of teams equals numPlayers/2.  Players are
 * selected sequentially and placed into the first available team until
 * each team has two players.  Selected players are disabled and
 * highlighted.  Once all teams have been filled, the organiser can
 * confirm to proceed.  Upon confirmation the schedule is generated
 * using generateScheduleFixed() and the tournament is created.
 */
function openFixedManualTeamSelection(selectedPlayers, numPlayers, courts, sets, useAmericano, americanoPoints, useHandicap) {
  const numTeams = numPlayers / 2;
  // State: team slots and assigned players
  const teamSlots = Array.from({ length: numTeams }, () => []);
  let currentTeam = 0;
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'modal';
  overlay.appendChild(modal);
  const title = document.createElement('h3');
  title.textContent = 'Select players for each team';
  modal.appendChild(title);
  // Container for team boxes
  const teamsContainer = document.createElement('div');
  teamsContainer.style.display = 'flex';
  teamsContainer.style.flexWrap = 'wrap';
  teamsContainer.style.gap = '1rem';
  modal.appendChild(teamsContainer);
  // Render each team box
  const teamBoxes = [];
  for (let i = 0; i < numTeams; i++) {
    const box = document.createElement('div');
    box.style.border = '2px dashed #90caf9';
    box.style.borderRadius = '6px';
    box.style.padding = '0.8rem';
    box.style.minWidth = '140px';
    box.style.minHeight = '60px';
    box.style.flex = '1 1 45%';
    const label = document.createElement('div');
    label.style.fontWeight = '600';
    label.style.marginBottom = '0.4rem';
    label.textContent = `Team ${String.fromCharCode(65 + i)}`;
    box.appendChild(label);
    const namesDiv = document.createElement('div');
    namesDiv.className = 'team-names';
    namesDiv.style.minHeight = '1.2rem';
    namesDiv.style.fontSize = '0.9rem';
    namesDiv.style.fontWeight = '600';
    namesDiv.textContent = '';
    box.appendChild(namesDiv);
    teamBoxes.push({ box, namesDiv });
    teamsContainer.appendChild(box);
  }
  // Player buttons container
  const listContainer = document.createElement('div');
  listContainer.style.marginTop = '1rem';
  listContainer.style.display = 'flex';
  listContainer.style.flexWrap = 'wrap';
  listContainer.style.gap = '0.5rem';
  modal.appendChild(listContainer);
  // Map id -> button
  const playerButtons = new Map();
  selectedPlayers.forEach((player) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn secondary';
    btn.textContent = player.name;
    btn.style.margin = '0.2rem';
    btn.addEventListener('click', () => {
      // If button is disabled, ignore
      if (btn.disabled) return;
      // Assign to current team
      if (currentTeam >= numTeams) return;
      if (teamSlots[currentTeam].length >= 2) return;
      teamSlots[currentTeam].push(player);
      btn.disabled = true;
      btn.classList.add('active');
      // Update names display
      const slotNames = teamSlots[currentTeam].map((p) => p.name).join(' & ');
      teamBoxes[currentTeam].namesDiv.textContent = slotNames;
      // If current team is filled, move to next team
      if (teamSlots[currentTeam].length === 2) {
        currentTeam++;
      }
      // Enable confirm if all teams have two players
      if (confirmBtn) {
        const allFilled = teamSlots.every((arr) => arr.length === 2);
        confirmBtn.disabled = !allFilled;
      }
    });
    listContainer.appendChild(btn);
    playerButtons.set(player.id, btn);
  });
  // Footer with actions
  const footer = document.createElement('div');
  footer.style.display = 'flex';
  footer.style.justifyContent = 'flex-end';
  footer.style.gap = '0.5rem';
  footer.style.marginTop = '1rem';
  modal.appendChild(footer);
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    overlay.remove();
  });
  footer.appendChild(cancelBtn);
  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn primary';
  confirmBtn.textContent = 'Confirm';
  confirmBtn.disabled = true;
  confirmBtn.addEventListener('click', () => {
    // Create teams from teamSlots
    const teams = teamSlots.map((slot, idx) => {
      return {
        id: `team${idx}`,
        name: `${slot[0].name} & ${slot[1].name}`,
        players: [slot[0], slot[1]],
      };
    });
    const schedule = generateScheduleFixed(teams, courts);
    const infoHtml = `<p>Fixed partner tournament with ${teams.length} teams and ${courts} court(s).</p>`;
    // Create tournament and update UI
    finalizeFixedTournament(teams, schedule, infoHtml, sets, useAmericano, americanoPoints, useHandicap, courts);
    overlay.remove();
  });
  footer.appendChild(confirmBtn);
  document.body.appendChild(overlay);
}

/*
 * Finalize creation of a fixed partner tournament once teams and schedule
 * have been prepared.  This helper constructs the tournament object,
 * populates UI elements and navigates to the schedule page.  It mirrors
 * the logic found in the main tournament creation handler.
 */
function finalizeFixedTournament(teams, schedule, infoHtml, sets, useAmericano, americanoPoints, useHandicap, courts) {
  tournament = {
    type: 'fixed',
    teams,
    schedule,
    sets,
    useAmericano,
    americanoPoints,
    useHandicap,
    courts,
  };
  tournamentInfoEl.innerHTML = infoHtml;
  displaySchedule(schedule);
  updateRankingAndSchedule();
  addMatchBtn.classList.remove('hidden');
  finishTournamentBtn.classList.remove('hidden');
  secondRoundBtn.classList.remove('hidden');
  // Hide config page and show schedule page
  page2.classList.add('hidden');
  page3.classList.remove('hidden');
}

/*
 * Present the organiser with options for creating a playoff bracket tournament.
 * There are three modes:
 *  1. Manual teams & manual placement: participants are selected into teams
 *     and the organiser chooses where each team goes in the bracket (status quo).
 *  2. Manual teams & random placement: participants are selected into teams
 *     manually but teams are assigned randomly to the bracket positions.
 *  3. Random teams & random placement: both the formation of teams and their
 *     placement in the bracket are random.
 * After the user makes a choice, the appropriate helper is invoked to
 * construct the tournament object and display the bracket.
 */
function openPlayoffOptionChoice(selectedPlayers, numPlayers, sets, useAmericano, americanoPoints, useHandicap, courts) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'modal';
  overlay.appendChild(modal);
  const title = document.createElement('h3');
  title.textContent = 'Select playoff mode';
  modal.appendChild(title);
  // Description text
  const desc = document.createElement('p');
  desc.textContent = 'Choose how teams are formed and placed in the bracket:';
  desc.style.marginBottom = '1rem';
  modal.appendChild(desc);
  // Container for buttons
  const btnContainer = document.createElement('div');
  btnContainer.style.display = 'flex';
  btnContainer.style.flexDirection = 'column';
  btnContainer.style.gap = '0.5rem';
  modal.appendChild(btnContainer);
  // Helper to close overlay
  const closeOverlay = () => overlay.remove();
  // Manual teams & manual placement button
  const manualManualBtn = document.createElement('button');
  manualManualBtn.className = 'btn primary';
  manualManualBtn.textContent = 'Manual teams & manual placement';
  manualManualBtn.addEventListener('click', () => {
    closeOverlay();
    // Mode 1: create empty bracket and allow organiser to assign teams manually
    createPlayoffManualManual(selectedPlayers, numPlayers, sets, useAmericano, americanoPoints, useHandicap, courts);
  });
  btnContainer.appendChild(manualManualBtn);
  // Manual teams & random placement
  const manualRandomBtn = document.createElement('button');
  manualRandomBtn.className = 'btn primary';
  manualRandomBtn.textContent = 'Manual teams & random placement';
  manualRandomBtn.addEventListener('click', () => {
    closeOverlay();
    // Mode 2: form teams manually then assign randomly to the bracket
    openPlayoffManualTeamSelection(selectedPlayers, numPlayers, sets, useAmericano, americanoPoints, useHandicap, courts, true);
  });
  btnContainer.appendChild(manualRandomBtn);
  // Random teams & random placement
  const randomRandomBtn = document.createElement('button');
  randomRandomBtn.className = 'btn primary';
  randomRandomBtn.textContent = 'Random teams & random placement';
  randomRandomBtn.addEventListener('click', () => {
    closeOverlay();
    // Mode 3: automatically form random teams and assign to bracket
    createPlayoffRandom(selectedPlayers, numPlayers, sets, useAmericano, americanoPoints, useHandicap, courts);
  });
  btnContainer.appendChild(randomRandomBtn);
  // Cancel button
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', closeOverlay);
  btnContainer.appendChild(cancelBtn);
  document.body.appendChild(overlay);
}

/*
 * Mode 1: manual teams & manual placement.  This replicates the existing
 * behaviour for playoff tournaments: an empty bracket is created and
 * participants may be assigned to matches via the “Select teams” buttons.
 */
function createPlayoffManualManual(selectedPlayers, numPlayers, sets, useAmericano, americanoPoints, useHandicap, courts) {
  // Generate an empty bracket sized for the players
  const schedule = generateEmptyBracket(numPlayers);
  // Prepare tournament state: teams are empty, players will be assigned manually
  tournament = {
    type: 'playoff',
    teams: [],
    schedule,
    sets,
    useAmericano,
    americanoPoints,
    useHandicap,
    courts,
    unassignedPlayers: selectedPlayers.slice(),
    assignedPlayers: [],
    nextTeamId: 0,
  };
  // Inform the user about potential number of teams
  tournamentInfoEl.innerHTML = `<p>Playoff bracket tournament with ${numPlayers / 2} potential teams. Select players to form teams for each match.</p>`;
  // Render bracket and hide ranking (handled in updateRankingAndSchedule)
  displaySchedule(schedule);
  updateRankingAndSchedule();
  // Show appropriate buttons
  addMatchBtn.classList.add('hidden');
  finishTournamentBtn.classList.remove('hidden');
  secondRoundBtn.classList.add('hidden');
  // Navigate to schedule page
  page2.classList.add('hidden');
  page3.classList.remove('hidden');
}

/*
 * Mode 2: manual teams & random placement.  This helper presents a team
 * selection overlay similar to fixed partner tournaments.  Once teams are
 * selected, they are shuffled and assigned to the bracket positions.
 */
function openPlayoffManualTeamSelection(selectedPlayers, numPlayers, sets, useAmericano, americanoPoints, useHandicap, courts, randomPlacement) {
  const numTeams = numPlayers / 2;
  // State: team slots and assigned players
  const teamSlots = Array.from({ length: numTeams }, () => []);
  let currentTeam = 0;
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'modal';
  overlay.appendChild(modal);
  const title = document.createElement('h3');
  title.textContent = 'Select players for each team';
  modal.appendChild(title);
  // Container for team boxes
  const teamsContainer = document.createElement('div');
  teamsContainer.style.display = 'flex';
  teamsContainer.style.flexWrap = 'wrap';
  teamsContainer.style.gap = '1rem';
  modal.appendChild(teamsContainer);
  const teamBoxes = [];
  for (let i = 0; i < numTeams; i++) {
    const box = document.createElement('div');
    box.style.border = '2px dashed #90caf9';
    box.style.borderRadius = '6px';
    box.style.padding = '0.8rem';
    box.style.minWidth = '140px';
    box.style.minHeight = '60px';
    box.style.flex = '1 1 45%';
    const label = document.createElement('div');
    label.style.fontWeight = '600';
    label.style.marginBottom = '0.4rem';
    label.textContent = `Team ${String.fromCharCode(65 + i)}`;
    box.appendChild(label);
    const namesDiv = document.createElement('div');
    namesDiv.className = 'team-names';
    namesDiv.style.minHeight = '1.2rem';
    namesDiv.style.fontSize = '0.9rem';
    namesDiv.style.fontWeight = '600';
    namesDiv.textContent = '';
    box.appendChild(namesDiv);
    teamBoxes.push({ box, namesDiv });
    teamsContainer.appendChild(box);
  }
  // Player buttons
  const listContainer = document.createElement('div');
  listContainer.style.marginTop = '1rem';
  listContainer.style.display = 'flex';
  listContainer.style.flexWrap = 'wrap';
  listContainer.style.gap = '0.5rem';
  modal.appendChild(listContainer);
  const playerButtons = new Map();
  selectedPlayers.forEach((player) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn secondary';
    btn.textContent = player.name;
    btn.style.margin = '0.2rem';
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      if (currentTeam >= numTeams) return;
      if (teamSlots[currentTeam].length >= 2) return;
      teamSlots[currentTeam].push(player);
      btn.disabled = true;
      btn.classList.add('active');
      const slotNames = teamSlots[currentTeam].map((p) => p.name).join(' & ');
      teamBoxes[currentTeam].namesDiv.textContent = slotNames;
      if (teamSlots[currentTeam].length === 2) {
        currentTeam++;
      }
      if (confirmBtn) {
        const allFilled = teamSlots.every((arr) => arr.length === 2);
        confirmBtn.disabled = !allFilled;
      }
    });
    listContainer.appendChild(btn);
    playerButtons.set(player.id, btn);
  });
  // Footer
  const footer = document.createElement('div');
  footer.style.display = 'flex';
  footer.style.justifyContent = 'flex-end';
  footer.style.gap = '0.5rem';
  footer.style.marginTop = '1rem';
  modal.appendChild(footer);
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    overlay.remove();
  });
  footer.appendChild(cancelBtn);
  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn primary';
  confirmBtn.textContent = 'Confirm';
  confirmBtn.disabled = true;
  confirmBtn.addEventListener('click', () => {
    // Create team objects
    const teams = teamSlots.map((slot, idx) => {
      const id = `team${idx}`;
      return { id, name: `${slot[0].name} & ${slot[1].name}`, players: [slot[0], slot[1]] };
    });
    // Randomly shuffle teams if requested
    const shuffled = randomPlacement ? shuffle(teams.slice()) : teams;
    // Build an empty bracket and assign teams to matches
    const schedule = generateEmptyBracket(numPlayers);
    // Assign teams to first round matches
    const firstRound = schedule[0];
    for (let i = 0; i < firstRound.length; i++) {
      const match = firstRound[i];
      const teamA = shuffled[i * 2] || null;
      const teamB = shuffled[i * 2 + 1] || null;
      match.teamA = teamA;
      match.teamB = teamB;
    }
    // Create tournament object
    tournament = {
      type: 'playoff',
      teams,
      schedule,
      sets,
      useAmericano,
      americanoPoints,
      useHandicap,
      courts,
    };
    // Propagate byes automatically to fill later rounds
    propagateByesAll(schedule);
    // Info text
    tournamentInfoEl.innerHTML = `<p>Playoff bracket tournament with ${numTeams} teams.</p>`;
    // Display schedule and update ranking
    displaySchedule(schedule);
    updateRankingAndSchedule();
    // Show and hide appropriate buttons
    addMatchBtn.classList.add('hidden');
    finishTournamentBtn.classList.remove('hidden');
    secondRoundBtn.classList.add('hidden');
    // Switch to schedule page
    page2.classList.add('hidden');
    page3.classList.remove('hidden');
    overlay.remove();
  });
  footer.appendChild(confirmBtn);
  document.body.appendChild(overlay);
}

/*
 * Mode 3: random teams & random placement.  Automatically form teams by
 * shuffling the selected players and pairing them, then assign teams
 * randomly to bracket positions.
 */
function createPlayoffRandom(selectedPlayers, numPlayers, sets, useAmericano, americanoPoints, useHandicap, courts) {
  // Shuffle players and pair them into teams
  const shuffledPlayers = shuffle(selectedPlayers.slice());
  const teams = [];
  for (let i = 0; i < shuffledPlayers.length; i += 2) {
    const p1 = shuffledPlayers[i];
    const p2 = shuffledPlayers[i + 1];
    const id = `team${i / 2}`;
    teams.push({ id, name: `${p1.name} & ${p2.name}`, players: [p1, p2] });
  }
  // Shuffle teams to randomise bracket placement
  const shuffledTeams = shuffle(teams.slice());
  // Build empty bracket
  const schedule = generateEmptyBracket(numPlayers);
  const firstRound = schedule[0];
  for (let i = 0; i < firstRound.length; i++) {
    const match = firstRound[i];
    match.teamA = shuffledTeams[i * 2] || null;
    match.teamB = shuffledTeams[i * 2 + 1] || null;
  }
  tournament = {
    type: 'playoff',
    teams,
    schedule,
    sets,
    useAmericano,
    americanoPoints,
    useHandicap,
    courts,
  };
  propagateByesAll(schedule);
  tournamentInfoEl.innerHTML = `<p>Playoff bracket tournament with ${numPlayers / 2} teams (randomised).</p>`;
  displaySchedule(schedule);
  updateRankingAndSchedule();
  addMatchBtn.classList.add('hidden');
  finishTournamentBtn.classList.remove('hidden');
  secondRoundBtn.classList.add('hidden');
  page2.classList.add('hidden');
  page3.classList.remove('hidden');
}

// Compute ranking for tournaments with fixed partner or match type (based on wins and sets)
function computeRankingFixed(schedule) {
  // Map storing aggregated statistics for each team
  const stats = new Map(); // key: team.id, value: { name, matches, wins, losses, setsWon, setsLost, gamesWon, gamesLost }
  schedule.forEach((round) => {
    round.forEach((match) => {
      const { teamA, teamB, score } = match;
      // Initialise stats for both teams if not already present
      [teamA, teamB].forEach((team) => {
        if (!stats.has(team.id)) {
          stats.set(team.id, {
            name: team.name,
            matches: 0,
            wins: 0,
            losses: 0,
            // Track sets statistics for set‑based scoring
            setsWon: 0,
            setsLost: 0,
            gamesWon: 0,
            gamesLost: 0,
            // For Americano scoring we track totalPoints (including bonus) to
            // compute rankings.  This field is unused for set scoring.
            totalPoints: 0,
          });
        }
      });
      if (score) {
        const statA = stats.get(teamA.id);
        const statB = stats.get(teamB.id);
        statA.matches += 1;
        statB.matches += 1;
        // If score entries are arrays, treat as set-based scoring. Otherwise treat as Americano (points only)
        if (Array.isArray(score[0])) {
          // Set‑based scoring
          let setsWonA = 0;
          let setsWonB = 0;
          score.forEach(([a, b]) => {
            // Games won/lost accumulate the raw game scores
            statA.gamesWon += a;
            statA.gamesLost += b;
            statB.gamesWon += b;
            statB.gamesLost += a;
            // Count sets won for each team
            if (a > b) {
              setsWonA++;
            } else if (b > a) {
              setsWonB++;
            }
          });
          // Accumulate sets won/lost for each team
          statA.setsWon += setsWonA;
          statA.setsLost += setsWonB;
          statB.setsWon += setsWonB;
          statB.setsLost += setsWonA;
          // Determine match winner based on sets won
          if (setsWonA > setsWonB) {
            statA.wins += 1;
            statB.losses += 1;
          } else if (setsWonB > setsWonA) {
            statB.wins += 1;
            statA.losses += 1;
          }
        } else {
          // Americano scoring: score is [pointsA, pointsB].  Use totalPoints
          // to aggregate the raw points plus a bonus: +2 for a win, +1 for a tie.
          const ptsA = score[0] || 0;
          const ptsB = score[1] || 0;
          // Determine winner or tie
          let winnerTeam = null;
          if (ptsA > ptsB) winnerTeam = 'A';
          else if (ptsB > ptsA) winnerTeam = 'B';
          // Bonus points per team
          const bonusA = winnerTeam === 'A' ? 2 : winnerTeam === null ? 1 : 0;
          const bonusB = winnerTeam === 'B' ? 2 : winnerTeam === null ? 1 : 0;
          // Accumulate total points including bonus (matches count already updated above)
          statA.totalPoints += ptsA + bonusA;
          statB.totalPoints += ptsB + bonusB;
          // Record wins for the winner only (no explicit losses for Americano ranking)
          if (winnerTeam === 'A') {
            statA.wins += 1;
          } else if (winnerTeam === 'B') {
            statB.wins += 1;
          }
          // Record games won/lost for completeness
          statA.gamesWon += ptsA;
          statA.gamesLost += ptsB;
          statB.gamesWon += ptsB;
          statB.gamesLost += ptsA;
        }
      }
    });
  });
  // Convert stats to array and calculate average points for Americano scoring
  const ranking = Array.from(stats.values()).map((entry) => {
    entry.avgPoints = entry.matches > 0 ? entry.totalPoints / entry.matches : 0;
    return entry;
  });
  if (tournament && tournament.useAmericano) {
    // Sort Americano ranking by wins, then average points, then name
    ranking.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.avgPoints !== a.avgPoints) return b.avgPoints - a.avgPoints;
      return a.name.localeCompare(b.name);
    });
  } else {
    // Sort set-based ranking by wins, then set difference, then game difference
    ranking.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const setDiffA = a.setsWon - a.setsLost;
      const setDiffB = b.setsWon - b.setsLost;
      if (setDiffB !== setDiffA) return setDiffB - setDiffA;
      const gameDiffA = a.gamesWon - a.gamesLost;
      const gameDiffB = b.gamesWon - b.gamesLost;
      return gameDiffB - gameDiffA;
    });
  }
  return ranking;
}

// Compute ranking for rotating partner (Americano) based on total points
function computeRankingRotating(schedule) {
  /*
   * Compute ranking for rotating partner tournaments.
   * For Americano scoring we count matches, wins and losses for each player
   * rather than raw points. We also calculate the average points per match.
   * For sets‑based rotating tournaments we fall back to the previous
   * behaviour of summing points and game difference.
   */
  const stats = new Map();
  schedule.forEach((round) => {
    round.forEach((match) => {
      const { teamA, teamB, score } = match;
      // Create stats entry for each player
      [teamA[0], teamA[1], teamB[0], teamB[1]].forEach((player) => {
        if (!stats.has(player.id)) {
          stats.set(player.id, {
            name: player.name,
            matches: 0,
            wins: 0,
            losses: 0,
            totalPoints: 0,
            points: 0,
            gamesWon: 0,
            gamesLost: 0,
          });
        }
      });
      if (!score) return;
      // Determine if scoring is Americano: score is simple array of two numbers
      const isAmericano = !Array.isArray(score[0]);
      if (isAmericano && tournament && tournament.useAmericano) {
        // Americano scoring: two numbers represent points for teams A and B.
        const ptsA = score[0] || 0;
        const ptsB = score[1] || 0;
        // Determine winner or tie
        let winnerTeam = null;
        if (ptsA > ptsB) winnerTeam = 'A';
        else if (ptsB > ptsA) winnerTeam = 'B';
        // Bonus points: +2 for a win, +1 for a tie.  These bonus points
        // do not appear in the score entry but are added to the total
        // points tally for ranking purposes.
        const bonusA = winnerTeam === 'A' ? 2 : winnerTeam === null ? 1 : 0;
        const bonusB = winnerTeam === 'B' ? 2 : winnerTeam === null ? 1 : 0;
        // Update stats for players in team A
        teamA.forEach((player) => {
          const entry = stats.get(player.id);
          entry.matches++;
          entry.totalPoints += ptsA + bonusA;
          if (winnerTeam === 'A') entry.wins++;
        });
        // Update stats for players in team B
        teamB.forEach((player) => {
          const entry = stats.get(player.id);
          entry.matches++;
          entry.totalPoints += ptsB + bonusB;
          if (winnerTeam === 'B') entry.wins++;
        });
      } else {
        // Sets scoring: award one point for the match winner rather than a point
        // per set won.  This ensures that longer matches (e.g. best of three
        // sets) do not artificially reward teams for playing more sets.
        let gamesA = 0;
        let gamesB = 0;
        let setsWonA = 0;
        let setsWonB = 0;
        score.forEach(([a, b]) => {
          gamesA += a;
          gamesB += b;
          if (a > b) setsWonA++;
          else if (b > a) setsWonB++;
        });
        // Determine match points: 1 point for the match winner (more sets won), 0 otherwise.
        const matchPointA = setsWonA > setsWonB ? 1 : 0;
        const matchPointB = setsWonB > setsWonA ? 1 : 0;
        // Aggregate stats for team A players
        teamA.forEach((player) => {
          const entry = stats.get(player.id);
          entry.points += matchPointA;
          entry.gamesWon += gamesA;
          entry.gamesLost += gamesB;
        });
        // Aggregate stats for team B players
        teamB.forEach((player) => {
          const entry = stats.get(player.id);
          entry.points += matchPointB;
          entry.gamesWon += gamesB;
          entry.gamesLost += gamesA;
        });
      }
    });
  });
  const ranking = Array.from(stats.values()).map((entry) => {
    if (tournament && tournament.useAmericano) {
      // Compute average points per match for Americano
      entry.avgPoints = entry.matches > 0 ? entry.totalPoints / entry.matches : 0;
    }
    return entry;
  });
  if (tournament && tournament.useAmericano) {
    // Sort by wins, then average points, then name
    ranking.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.avgPoints !== a.avgPoints) return b.avgPoints - a.avgPoints;
      return a.name.localeCompare(b.name);
    });
  } else {
    // Sets ranking: sort by points (sets won), then game difference and games won
    ranking.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const diffA = a.gamesWon - a.gamesLost;
      const diffB = b.gamesWon - b.gamesLost;
      if (diffB !== diffA) return diffB - diffA;
      return b.gamesWon - a.gamesWon;
    });
  }
  return ranking;
}

// Compute ranking for ladder tournaments (player-based)
function computeRankingLadder(schedule, players) {
  const stats = new Map();
  // Initialize stats for all participants so players with no matches still appear
  players.forEach((p) => {
    stats.set(p.id, { name: p.name, matches: 0, wins: 0, points: 0 });
  });
  schedule.forEach((round) => {
    round.forEach((match) => {
      const { teamA, teamB, score } = match;
      if (!score) return;
      const isAmericano = !Array.isArray(score[0]);
      if (isAmericano && tournament && tournament.useAmericano) {
        const ptsA = score[0] || 0;
        const ptsB = score[1] || 0;
        let winner = null;
        if (ptsA > ptsB) winner = 'A';
        else if (ptsB > ptsA) winner = 'B';
        const bonusA = winner === 'A' ? 2 : winner === null ? 1 : 0;
        const bonusB = winner === 'B' ? 2 : winner === null ? 1 : 0;
        teamA.forEach((p) => {
          const st = stats.get(p.id);
          st.matches++;
          st.points += ptsA + bonusA;
          if (winner === 'A') st.wins++;
        });
        teamB.forEach((p) => {
          const st = stats.get(p.id);
          st.matches++;
          st.points += ptsB + bonusB;
          if (winner === 'B') st.wins++;
        });
      } else {
        let setsWonA = 0;
        let setsWonB = 0;
        score.forEach(([a, b]) => {
          if (a > b) setsWonA++; else if (b > a) setsWonB++;
        });
        const winner = setsWonA > setsWonB ? 'A' : setsWonB > setsWonA ? 'B' : null;
        const pointsA = winner === 'A' ? 1 : 0;
        const pointsB = winner === 'B' ? 1 : 0;
        teamA.forEach((p) => {
          const st = stats.get(p.id);
          st.matches++;
          st.points += pointsA;
          if (winner === 'A') st.wins++;
        });
        teamB.forEach((p) => {
          const st = stats.get(p.id);
          st.matches++;
          st.points += pointsB;
          if (winner === 'B') st.wins++;
        });
      }
    });
  });
  const ranking = Array.from(stats.values());
  ranking.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.name.localeCompare(b.name);
  });
  return ranking;
}

// Determine an emoji representing a player's mood based on their ranking position.
// Top positions get excited faces, middle positions get neutral faces, and bottom positions get anxious or angry faces.
// Return the filename of the custom emoticon image based on ranking position.
// Top positions get excited/happy faces, middle positions get neutral faces,
// and bottom positions get bored or angry faces.  This avoids using Unicode
// emojis and instead uses our custom premium icons.
function getRankIcon(index, total) {
  if (index === 0) return 'emoji_excited_face.png'; // first place, very excited
  if (index === 1) return 'emoji_happy_face.png';   // second place, happy
  if (index === 2) return 'emoji_neutral_face.png'; // third place, neutral
  // Last place gets angry face
  if (index === total - 1) return 'emoji_angry_face.png';
  // Second last gets bored face
  if (index === total - 2) return 'emoji_bored_face.png';
  // Middle positions get neutral faces
  return 'emoji_neutral_face.png';
}

// Display schedule table
function displaySchedule(schedule) {
  // If tournament is a playoff bracket, use a dedicated bracket display
  if (tournament && tournament.type === 'playoff') {
    displayBracket(schedule);
    return;
  }

  scheduleEl.innerHTML = '';
  // Compute total rounds and progress
  const totalRounds = schedule.length;
  const totalMatches = schedule.reduce((sum, rnd) => sum + rnd.length, 0);
  let playedMatches = 0;
  schedule.forEach((rnd) => {
    rnd.forEach((m) => {
      if (m.score) playedMatches++;
    });
  });
  const progressPercent = totalMatches === 0 ? 0 : Math.round((playedMatches / totalMatches) * 100);
  // Add progress bar at the top of schedule
  if (totalMatches > 0) {
    const progContainer = document.createElement('div');
    progContainer.className = 'round-progress';
    const progBar = document.createElement('div');
    progBar.className = 'progress-bar';
    const prog = document.createElement('div');
    prog.className = 'progress';
    prog.style.width = `${progressPercent}%`;
    progBar.appendChild(prog);
    progContainer.appendChild(progBar);
    scheduleEl.appendChild(progContainer);
  }
  schedule.forEach((roundMatches, roundIndex) => {
    const roundDiv = document.createElement('div');
    const h3 = document.createElement('h3');
    h3.textContent = `Round ${roundIndex + 1}/${totalRounds}`;
    roundDiv.appendChild(h3);
    // Build table for this round
    const table = document.createElement('table');
    table.className = 'dark-table match-table';
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    // Determine number of set columns based on tournament type
    const isAmericano = tournament.useAmericano;
    const setCount = tournament.sets || 0;
    // Header: Court and Players
    ['Court', 'Players'].forEach((txt) => {
      const th = document.createElement('th');
      th.textContent = txt;
      headerRow.appendChild(th);
    });
    if (isAmericano) {
      // Points column for Americano
      const thPts = document.createElement('th');
      thPts.textContent = 'Points';
      headerRow.appendChild(thPts);
    } else {
      // Set columns
      for (let s = 1; s <= setCount; s++) {
        const thSet = document.createElement('th');
        thSet.textContent = `Set ${s}`;
        // For sets beyond the first, mark them as optional so they can be
        // hidden on small screens via CSS.  This avoids relying on nth‑child
        // selectors which break when only one set is played.
        if (s > 1) thSet.classList.add('optional-set');
        headerRow.appendChild(thSet);
      }
    }
    // Game column.  Mark as optional so it can be hidden on mobile when
    // space is limited.  For Americano tournaments, the points column
    // contains the only score and this column will still be created
    // consistently.
    const thGame = document.createElement('th');
    thGame.textContent = 'Game';
    thGame.classList.add('optional-game');
    headerRow.appendChild(thGame);
    // Actions column
    const thActions = document.createElement('th');
    thActions.textContent = 'Actions';
    headerRow.appendChild(thActions);
    thead.appendChild(headerRow);
    table.appendChild(thead);
    // Tag tables by scoring type for responsive CSS (sets vs. Americano).  This
    // allows the stylesheet to selectively hide columns on mobile without
    // inadvertently removing the actions column for Americano matches.  See
    // @media rules in style.css for details.  We add a custom class in
    // addition to the existing match-table class.
    if (isAmericano) {
      table.classList.add('americano-table');
    } else {
      table.classList.add('sets-table');
    }
    // Body
    const tbody = document.createElement('tbody');
    roundMatches.forEach((match, idx) => {
      const tr = document.createElement('tr');
      // Court cell
      const tdCourt = document.createElement('td');
      tdCourt.textContent = match.court;
      tr.appendChild(tdCourt);
      // Players cell: names stacked vertically and uppercased
      const tdPlayers = document.createElement('td');
      // Build player names safely.  When teams are arrays there may occasionally be
      // only one player (e.g. odd number of players or byes).  In those cases
      // the second entry will be undefined, so guard against accessing it.
      const formatTeamNames = (team) => {
        if (Array.isArray(team)) {
          const first = team[0] ? team[0].name.toUpperCase() : '';
          const second = team[1] ? team[1].name.toUpperCase() : '';
          return second ? `${first}<br>${second}` : `${first}`;
        } else {
          return team.name.toUpperCase();
        }
      };
      const nameA = formatTeamNames(match.teamA);
      const nameB = formatTeamNames(match.teamB);
      tdPlayers.innerHTML = `${nameA}<hr class="player-sep">${nameB}`;
      tr.appendChild(tdPlayers);
      // Stats cells
      let winner = null;
      // Determine winner for sets or Americano
      if (match.score) {
        if (Array.isArray(match.score[0])) {
          let setsA = 0;
          let setsB = 0;
          match.score.forEach(([a, b]) => {
            if (a > b) setsA++; else if (b > a) setsB++;
          });
          if (setsA > setsB) winner = 'A';
          else if (setsB > setsA) winner = 'B';
        } else {
          if (match.score[0] > match.score[1]) winner = 'A';
          else if (match.score[1] > match.score[0]) winner = 'B';
        }
      }
      if (isAmericano) {
        // Points column: create separate spans for each team's points so that
        // we can safely apply styles without risking errors on text nodes.
        const tdPts = document.createElement('td');
        if (match.score) {
          const spanA = document.createElement('span');
          spanA.textContent = match.score[0];
          const br = document.createElement('br');
          const spanB = document.createElement('span');
          spanB.textContent = match.score[1];
          // Highlight winner points by bolding the appropriate span
          if (winner === 'A') {
            spanA.style.fontWeight = '700';
          } else if (winner === 'B') {
            spanB.style.fontWeight = '700';
          }
          tdPts.appendChild(spanA);
          tdPts.appendChild(document.createElement('br'));
          tdPts.appendChild(spanB);
        } else {
          // Use non‑breaking spaces to preserve row height when no score entered
          tdPts.innerHTML = '&nbsp;<br>&nbsp;';
        }
        tr.appendChild(tdPts);
      } else {
        // For sets tournaments, create a cell for each set
        for (let s = 0; s < setCount; s++) {
          const tdSet = document.createElement('td');
          let a = '';
          let b = '';
          if (match.score && Array.isArray(match.score[0]) && s < match.score.length) {
            a = match.score[s][0];
            b = match.score[s][1];
          }
          tdSet.innerHTML = `${a}<br>${b}`;
          // Mark all set cells beyond the first as optional for mobile.  The
          // first set remains visible so single‑set matches still show a
          // score column on narrow screens.
          if (s > 0) tdSet.classList.add('optional-set');
          tr.appendChild(tdSet);
        }
      }
      // Game cell: show 1 for winner and 0 for loser (if score exists)
      const tdGame = document.createElement('td');
      if (match.score && winner) {
        tdGame.innerHTML = winner === 'A' ? `1<br>0` : `0<br>1`;
      } else {
        tdGame.innerHTML = `&nbsp;<br>&nbsp;`;
      }
      // Mark game cell as optional so it can be hidden on mobile.
      tdGame.classList.add('optional-game');
      tr.appendChild(tdGame);
      // Actions cell
      const tdActions = document.createElement('td');
      const actionsContainer = document.createElement('div');
      actionsContainer.style.display = 'flex';
      actionsContainer.style.flexDirection = 'column';
      actionsContainer.style.alignItems = 'center';
      actionsContainer.style.gap = '0.3rem';
      if (!match.score) {
        const enterBtn = document.createElement('button');
        enterBtn.className = 'btn primary icon-btn';
        enterBtn.innerHTML =
          '<span class="btn-icon"><img src="scoreboard_icon.png" alt="Enter" class="btn-icon-img"></span><span class="btn-label">Enter</span>';
        enterBtn.style.padding = '0.3rem 0.6rem';
        enterBtn.addEventListener('click', () => {
          promptResult(match);
        });
        actionsContainer.appendChild(enterBtn);
      } else {
        // Reset button
        const resetBtn = document.createElement('button');
        resetBtn.className = 'btn secondary icon-btn';
        resetBtn.innerHTML = '<span class="btn-icon">🔄</span><span class="btn-label">Reset</span>';
        resetBtn.style.padding = '0.3rem 0.6rem';
        resetBtn.addEventListener('click', () => {
          resetMatch(roundIndex, idx);
        });
        actionsContainer.appendChild(resetBtn);
      }
      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn secondary icon-btn';
      deleteBtn.innerHTML = '<span class="btn-icon">🗑️</span><span class="btn-label">Delete</span>';
      deleteBtn.style.padding = '0.3rem 0.6rem';
      deleteBtn.addEventListener('click', () => {
        deleteMatch(roundIndex, idx);
      });
      actionsContainer.appendChild(deleteBtn);
      tdActions.appendChild(actionsContainer);
      tr.appendChild(tdActions);
      // Optionally highlight the winning row by bolding the score numbers (done above)
      // Mark row as completed if score exists
      if (match.score) tr.classList.add('completed-match');
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    roundDiv.appendChild(table);
    scheduleEl.appendChild(roundDiv);
  });
}

// Display bracket for playoff tournaments.  Each round is a column and each match is a box
// containing the two teams and their score. When a match is completed, it highlights
// the winning team and automatically advances them to the next round.
function displayBracket(rounds) {
  scheduleEl.innerHTML = '';
  // Create container for bracket
  const container = document.createElement('div');
  container.className = 'bracket-container';
  // Before drawing the bracket, propagate any byes so that teams are advanced to
  // the appropriate round when their opponent slot is empty.  This ensures
  // matches in later rounds show the correct participant when one side has a
  // bye.  We run this every time the bracket is rendered because team
  // assignments and match results may have changed.
  propagateByesAll();
  rounds.forEach((roundMatches, roundIndex) => {
    const col = document.createElement('div');
    col.className = 'bracket-round';
    // Create a heading for the round.  Use descriptive names like
    // "Quarter Final", "Semi Final" and "Final" instead of generic
    // "Round 1", "Round 2" labels.  The label chosen depends on the
    // total number of rounds in the bracket and the current index.
    const roundCount = rounds.length;
    function getRoundLabel(idx, total) {
      /*
       * Determine a human friendly label for each round based on the total
       * number of rounds in the bracket.  The names follow common
       * tournament conventions:
       *  - 6 rounds: Round of 64 → Round of 32 → Round of 16 → Quarter Final → Semi Final → Final
       *  - 5 rounds: Round of 32 → Round of 16 → Quarter Final → Semi Final → Final
       *  - 4 rounds: Round of 16 → Quarter Final → Semi Final → Final
       *  - 3 rounds: Quarter Final → Semi Final → Final
       *  - 2 rounds: Semi Final → Final
       *  - 1 round: Final
       *  For any other case fallback to “Round X”.
       */
      const maps = {
        6: ['Round of 64', 'Round of 32', 'Round of 16', 'Quarter Final', 'Semi Final', 'Final'],
        5: ['Round of 32', 'Round of 16', 'Quarter Final', 'Semi Final', 'Final'],
        4: ['Round of 16', 'Quarter Final', 'Semi Final', 'Final'],
        3: ['Quarter Final', 'Semi Final', 'Final'],
        2: ['Semi Final', 'Final'],
        1: ['Final']
      };
      const labels = maps[total];
      if (labels && labels[idx]) {
        return labels[idx];
      }
      return `Round ${idx + 1}`;
    }
    const title = document.createElement('h3');
    title.textContent = getRoundLabel(roundIndex, roundCount);
    col.appendChild(title);
    roundMatches.forEach((match, matchIndex) => {
      const box = document.createElement('div');
      box.className = 'bracket-match';
      // Players container.  Display players separated by a horizontal line like the
      // match table.  Use player-sep class to draw a thin line between
      // competitors.  When no team is assigned in the first round, show an
      // em dash; in subsequent rounds leave blank.
      const playersDiv = document.createElement('div');
      playersDiv.className = 'bracket-players';
      const nameA = document.createElement('div');
      nameA.className = 'bracket-player';
      if (match.teamA) {
        nameA.textContent = match.teamA.name.toUpperCase();
      } else if (roundIndex === 0) {
        nameA.textContent = '—';
      } else {
        nameA.textContent = '';
      }
      playersDiv.appendChild(nameA);
      // Insert separator line between players
      const sep = document.createElement('div');
      sep.className = 'player-sep';
      playersDiv.appendChild(sep);
      const nameB = document.createElement('div');
      nameB.className = 'bracket-player';
      if (match.teamB) {
        nameB.textContent = match.teamB.name.toUpperCase();
      } else if (roundIndex === 0) {
        nameB.textContent = '—';
      } else {
        nameB.textContent = '';
      }
      playersDiv.appendChild(nameB);
      box.appendChild(playersDiv);
      // Detailed set-by-set display.  When a score is present and both teams are
      // assigned, display each set in its own column with the games for team
      // A on top and team B on the bottom.  Also highlight the winning team.
      if (match.score && match.teamA && match.teamB) {
        // Determine winner (for highlighting)
        let winnerA = false;
        if (tournament.useAmericano) {
          if (match.score[0] > match.score[1]) winnerA = true;
        } else {
          let setsA = 0;
          let setsB = 0;
          match.score.forEach(([a, b]) => {
            if (a > b) setsA++; else if (b > a) setsB++;
          });
          winnerA = setsA > setsB;
        }
        // Apply winner/loser classes to names
        if (winnerA) {
          nameA.classList.add('winner');
          nameB.classList.add('loser');
        } else {
          nameB.classList.add('winner');
          nameA.classList.add('loser');
        }
        const setsDiv = document.createElement('div');
        setsDiv.className = 'bracket-sets';
        // For sets scoring: match.score is an array of [gamesA, gamesB]
        match.score.forEach(([a, b]) => {
          const colDiv = document.createElement('div');
          colDiv.className = 'set-col';
          const top = document.createElement('div');
          top.className = 'set-cell';
          top.textContent = a;
          const bottom = document.createElement('div');
          bottom.className = 'set-cell';
          bottom.textContent = b;
          colDiv.appendChild(top);
          colDiv.appendChild(bottom);
          setsDiv.appendChild(colDiv);
        });
        box.appendChild(setsDiv);
      } else if (match.score && tournament.useAmericano && match.teamA && match.teamB) {
        // For Americano, display the two point totals in a single column
        const setsDiv = document.createElement('div');
        setsDiv.className = 'bracket-sets';
        const colDiv = document.createElement('div');
        colDiv.className = 'set-col';
        const top = document.createElement('div');
        top.className = 'set-cell';
        top.textContent = match.score[0];
        const bottom = document.createElement('div');
        bottom.className = 'set-cell';
        bottom.textContent = match.score[1];
        colDiv.appendChild(top);
        colDiv.appendChild(bottom);
        setsDiv.appendChild(colDiv);
        box.appendChild(setsDiv);
      } else {
        // No score yet: leave space for sets to align buttons below
        const setsDiv = document.createElement('div');
        setsDiv.className = 'bracket-sets empty-sets';
        box.appendChild(setsDiv);
      }
      // Actions: determine whether to allow team selection, result entry or reset
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'bracket-actions';
      // In the first round, if either team slot is empty and no score recorded,
      // provide a button to select teams for this match.  The user must
      // complete both team assignments in a single selection step.
      const isFirstRound = roundIndex === 0;
      const needTeams = isFirstRound && !match.score && (!match.teamA || !match.teamB);
      if (needTeams) {
        const selectBtn = document.createElement('button');
        selectBtn.className = 'btn accent';
        selectBtn.textContent = 'Select teams';
        selectBtn.addEventListener('click', () => {
          openTeamSelection(roundIndex, matchIndex);
        });
        actionsDiv.appendChild(selectBtn);
      } else if (!match.score && match.teamA && match.teamB) {
        // If both teams are present but no score, provide the enter score button
        const enterBtn = document.createElement('button');
        enterBtn.className = 'btn accent icon-btn';
        enterBtn.innerHTML = '<span class="btn-icon"><img src="scoreboard_icon.png" alt="Score" width="24" height="24"></span><span class="btn-label">Enter</span>';
        enterBtn.addEventListener('click', () => {
          promptResult(match, roundIndex, matchIndex);
        });
        actionsDiv.appendChild(enterBtn);
      } else if (match.score) {
        // Reset button to clear score
        const resetBtn = document.createElement('button');
        resetBtn.className = 'btn secondary icon-btn';
        resetBtn.innerHTML = '<span class="btn-icon">🔄</span><span class="btn-label">Reset</span>';
        resetBtn.addEventListener('click', () => {
          resetMatch(roundIndex, matchIndex);
        });
        actionsDiv.appendChild(resetBtn);
      }
      // Show delete option on first‑round matches once a team has been assigned.
      // Deleting will remove team assignments and return players to the pool.
      if (roundIndex === 0 && (match.teamA || match.teamB)) {
        const delBtn = document.createElement('button');
        delBtn.className = 'btn secondary icon-btn';
        delBtn.innerHTML = '<span class="btn-icon">🗑️</span><span class="btn-label">Delete</span>';
        delBtn.addEventListener('click', () => {
          deleteTeamAssignments(roundIndex, matchIndex);
        });
        actionsDiv.appendChild(delBtn);
      }
      box.appendChild(actionsDiv);
      // Mark match completed visually
      if (match.score) box.classList.add('completed-match');
      col.appendChild(box);
    });
    container.appendChild(col);
  });
  scheduleEl.appendChild(container);
}

// Prompt user for result and update match
function promptResult(match, roundIndex = null, matchIndex = null) {
  // Custom interactive score input using overlay
  const usingAmericano = tournament.useAmericano;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'modal';
  overlay.appendChild(modal);
  function closeOverlay() {
    overlay.remove();
  }
  if (usingAmericano) {
    /*
     * Americano format: present two equal boxes side by side with team names.
     * The user can enter points for either team; the opponent's points
     * update automatically so that the sum equals the total points.  This
     * provides a more balanced and intuitive input interface.
     */
    const title = document.createElement('h3');
    title.textContent = 'Enter points';
    modal.appendChild(title);
    const maxPts = tournament.americanoPoints || 24;
    // Container for two point boxes
    const container = document.createElement('div');
    container.className = 'americano-inputs';
    // Box for Team A
    const boxA = document.createElement('div');
    boxA.className = 'americano-box';
    const labelA = document.createElement('span');
    labelA.className = 'team-label';
    // Safely build the display name for team A.  Teams in free and rotating
    // tournaments are arrays of players rather than objects with a name
    // property.  Join player names with an ampersand when necessary.
    if (match.teamA) {
      if (Array.isArray(match.teamA)) {
        labelA.textContent = match.teamA
          .filter((p) => p && p.name)
          .map((p) => p.name.toUpperCase())
          .join(' & ');
      } else {
        labelA.textContent = match.teamA.name.toUpperCase();
      }
    } else {
      labelA.textContent = 'TEAM A';
    }
    const inputA = document.createElement('input');
    inputA.type = 'number';
    inputA.min = '0';
    inputA.max = maxPts.toString();
    inputA.value = '0';
    inputA.className = 'score-input';
    boxA.appendChild(labelA);
    boxA.appendChild(inputA);
    // Box for Team B
    const boxB = document.createElement('div');
    boxB.className = 'americano-box';
    const labelB = document.createElement('span');
    labelB.className = 'team-label';
    if (match.teamB) {
      if (Array.isArray(match.teamB)) {
        labelB.textContent = match.teamB
          .filter((p) => p && p.name)
          .map((p) => p.name.toUpperCase())
          .join(' & ');
      } else {
        labelB.textContent = match.teamB.name.toUpperCase();
      }
    } else {
      labelB.textContent = 'TEAM B';
    }
    const inputB = document.createElement('input');
    inputB.type = 'number';
    inputB.min = '0';
    inputB.max = maxPts.toString();
    inputB.value = '0';
    inputB.className = 'score-input';
    boxB.appendChild(labelB);
    boxB.appendChild(inputB);
    container.appendChild(boxA);
    container.appendChild(boxB);
    modal.appendChild(container);
    // Synchronise points so that the sum equals maxPts
    function syncPoints(changed, other) {
      let val = parseInt(changed.value, 10);
      if (isNaN(val) || val < 0) val = 0;
      if (val > maxPts) val = maxPts;
      changed.value = val.toString();
      other.value = (maxPts - val).toString();
    }
    inputA.addEventListener('input', () => syncPoints(inputA, inputB));
    inputB.addEventListener('input', () => syncPoints(inputB, inputA));
    // Footer with OK and Cancel
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    const okBtn = document.createElement('button');
    okBtn.className = 'btn primary';
    okBtn.textContent = 'OK';
    okBtn.addEventListener('click', () => {
      let valA = parseInt(inputA.value, 10);
      if (isNaN(valA) || valA < 0) valA = 0;
      if (valA > maxPts) valA = maxPts;
      match.score = [valA, maxPts - valA];
      closeOverlay();
      // Advance winner in playoff bracket if applicable
      if (tournament && tournament.type === 'playoff' && roundIndex !== null && matchIndex !== null) {
        progressWinner(roundIndex, matchIndex);
      }
      updateRankingAndSchedule();
    });
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'btn secondary';
    cancelBtn.addEventListener('click', () => {
      closeOverlay();
    });
    footer.appendChild(cancelBtn);
    footer.appendChild(okBtn);
    modal.appendChild(footer);
  } else {
    const setsToPlay = tournament.sets;
    const title = document.createElement('h3');
    title.textContent = 'Enter games for each set';
    modal.appendChild(title);
    // Container for all set rows
    const setList = document.createElement('div');
    setList.className = 'set-list';
    modal.appendChild(setList);
    // Keep a list of all displays across all sets to enable auto‑advance selection
    const allDisplays = [];
    // Track the currently active display span
    let currentDisplay = null;
    // Keypad element reused for each display
    const keypad = document.createElement('div');
    keypad.className = 'keypad-row';
    // Build keypad for the currently active display
    function buildKeypad() {
      keypad.innerHTML = '';
      for (let i = 0; i <= 7; i++) {
        const btn = document.createElement('button');
        btn.textContent = i.toString();
        btn.className = 'key-btn';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (currentDisplay) {
            currentDisplay.textContent = i.toString();
            // After entering number, automatically select next display
            const idx = allDisplays.indexOf(currentDisplay);
            if (idx !== -1 && idx + 1 < allDisplays.length) {
              selectDisplay(allDisplays[idx + 1]);
            } else {
              // Remove keypad if at the end
              if (keypad.parentElement) keypad.parentElement.removeChild(keypad);
            }
          }
        });
        keypad.appendChild(btn);
      }
    }
    // Select a display: highlight it and attach keypad
    function selectDisplay(disp) {
      currentDisplay = disp;
      allDisplays.forEach((d) => d.classList.remove('active'));
      disp.classList.add('active');
      // Remove existing keypad from any row
      setList.querySelectorAll('.keypad-row').forEach((kp) => kp.remove());
      // Build keypad for the new current display and append it below the row
      buildKeypad();
      const row = disp.parentElement;
      row.appendChild(keypad);
    }
    // Create a row to show the team names for clarity
    const namesRow = document.createElement('div');
    namesRow.className = 'names-row';
    const nameA = document.createElement('span');
    nameA.className = 'team-name';
    nameA.textContent = match.teamA ? (Array.isArray(match.teamA) ? match.teamA.map(p => p.name).join(' & ').toUpperCase() : match.teamA.name.toUpperCase()) : 'TEAM A';
    const vs = document.createElement('span');
    vs.className = 'score-colon';
    vs.textContent = '';
    const nameB = document.createElement('span');
    nameB.className = 'team-name';
    nameB.textContent = match.teamB ? (Array.isArray(match.teamB) ? match.teamB.map(p => p.name).join(' & ').toUpperCase() : match.teamB.name.toUpperCase()) : 'TEAM B';
    namesRow.appendChild(nameA);
    namesRow.appendChild(vs);
    namesRow.appendChild(nameB);
    setList.appendChild(namesRow);
    // Create set rows
    const scoreLines = [];
    function addSetInput() {
      const setRow = document.createElement('div');
      setRow.className = 'set-row';
      const displayA = document.createElement('span');
      displayA.className = 'score-display';
      displayA.textContent = '0';
      const colon = document.createElement('span');
      colon.className = 'score-colon';
      colon.textContent = ':';
      const displayB = document.createElement('span');
      displayB.className = 'score-display';
      displayB.textContent = '0';
      setRow.appendChild(displayA);
      setRow.appendChild(colon);
      setRow.appendChild(displayB);
      // Add displays to global list for auto‑advance
      allDisplays.push(displayA);
      allDisplays.push(displayB);
      // Attach click handlers to select display
      [displayA, displayB].forEach((disp) => {
        disp.addEventListener('click', (e) => {
          e.stopPropagation();
          selectDisplay(disp);
        });
      });
      setRow.addEventListener('click', (e) => e.stopPropagation());
      setList.appendChild(setRow);
      scoreLines.push({ displayA, displayB });
    }
    for (let i = 0; i < setsToPlay; i++) {
      addSetInput();
    }
    // Initially select the first display
    if (allDisplays.length > 0) {
      selectDisplay(allDisplays[0]);
    }
    // Footer with OK and Cancel buttons
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    const okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    okBtn.className = 'btn accent';
    okBtn.addEventListener('click', () => {
      const sets = [];
      scoreLines.forEach(({ displayA, displayB }) => {
        const a = parseInt(displayA.textContent, 10);
        const b = parseInt(displayB.textContent, 10);
        // Only include sets that are not both zero
        if (!isNaN(a) && !isNaN(b) && (a !== 0 || b !== 0)) {
          sets.push([a, b]);
        }
      });
      if (sets.length > 0) {
        match.score = sets;
        closeOverlay();
        // Advance winner in playoff bracket if applicable
        if (tournament && tournament.type === 'playoff' && roundIndex !== null && matchIndex !== null) {
          progressWinner(roundIndex, matchIndex);
        }
        updateRankingAndSchedule();
      }
    });
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'btn secondary';
    cancelBtn.addEventListener('click', () => {
      closeOverlay();
    });
    footer.appendChild(cancelBtn);
    footer.appendChild(okBtn);
    modal.appendChild(footer);
  }
  document.body.appendChild(overlay);
}

// Show modal to select two players for each team (used for free tournaments)
function showTeamSelectionModal(onConfirm) {
  // Create overlay and modal
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'team-select-modal';
  overlay.appendChild(modal);
  const title = document.createElement('h3');
  title.textContent = 'Select players for each team';
  modal.appendChild(title);
  // Team slots area
  const slotsContainer = document.createElement('div');
  slotsContainer.className = 'team-slots';
  modal.appendChild(slotsContainer);
  const slotA = document.createElement('div');
  slotA.className = 'team-slot selected';
  // Default placeholder text for first team slot
  slotA.textContent = 'Team A';
  const vsText = document.createElement('span');
  vsText.className = 'vs-text';
  vsText.textContent = 'VS';
  const slotB = document.createElement('div');
  slotB.className = 'team-slot';
  // Default placeholder text for second team slot
  slotB.textContent = 'Team B';
  slotsContainer.appendChild(slotA);
  slotsContainer.appendChild(vsText);
  slotsContainer.appendChild(slotB);
  // State
  let activeTeam = 'A';
  let selectedA = [];
  let selectedB = [];
  // Helper to update slot text
  function updateSlots() {
    // Use English labels for empty slots
    slotA.textContent = selectedA.length > 0 ? selectedA.map((p) => p.name).join(' & ') : 'Team A';
    slotB.textContent = selectedB.length > 0 ? selectedB.map((p) => p.name).join(' & ') : 'Team B';
  }
  slotA.addEventListener('click', () => {
    activeTeam = 'A';
    slotA.classList.add('selected');
    slotB.classList.remove('selected');
  });
  slotB.addEventListener('click', () => {
    activeTeam = 'B';
    slotB.classList.add('selected');
    slotA.classList.remove('selected');
  });
  // Player list
  const list = document.createElement('div');
  list.className = 'player-list';
  modal.appendChild(list);
  players.forEach((player) => {
    const btn = document.createElement('button');
    btn.className = 'player-button';
    btn.textContent = player.name;
    btn.addEventListener('click', () => {
      // Check if player already selected
      const inA = selectedA.some((p) => p.id === player.id);
      const inB = selectedB.some((p) => p.id === player.id);
      if (inA || inB) {
        // If clicked within the team currently active, remove selection
        if (activeTeam === 'A' && inA) {
          selectedA = selectedA.filter((p) => p.id !== player.id);
          btn.classList.remove('selected');
          updateSlots();
        } else if (activeTeam === 'B' && inB) {
          selectedB = selectedB.filter((p) => p.id !== player.id);
          btn.classList.remove('selected');
          updateSlots();
        }
        return;
      }
      // Add player to active team if capacity permits
      if (activeTeam === 'A') {
        if (selectedA.length >= 2) return;
        selectedA.push(player);
        btn.classList.add('selected');
      } else {
        if (selectedB.length >= 2) return;
        selectedB.push(player);
        btn.classList.add('selected');
      }
      updateSlots();
    });
    list.appendChild(btn);
  });
  updateSlots();
  // Modal footer with actions
  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn secondary';
  // English label for cancel action
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    overlay.remove();
  });
  const okBtn = document.createElement('button');
  okBtn.className = 'btn accent';
  okBtn.textContent = 'OK';
  okBtn.addEventListener('click', () => {
    if (selectedA.length !== 2 || selectedB.length !== 2) {
      alert('Please select two players on each team.');
      return;
    }
    // Invoke callback with selected players
    onConfirm({ teamAPlayers: selectedA, teamBPlayers: selectedB });
    overlay.remove();
  });
  footer.appendChild(cancelBtn);
  footer.appendChild(okBtn);
  modal.appendChild(footer);
  document.body.appendChild(overlay);
}

// Display ranking table
function displayRanking(ranking, isRotating) {
  rankingEl.innerHTML = '';
  const table = document.createElement('table');
  // Apply dark table styling for ranking as well
  table.className = 'dark-table ranking-table';
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  /*
   * Build the table header based on the tournament type.  We no longer
   * include a “Mood” column, as requested by the user.  For rotating
   * tournaments (player‑based ranking), we show either points/game statistics
   * or matches/wins/losses with average points when Americano scoring is
   * enabled.  For fixed or official tournaments, we include match counts,
   * wins/losses, winning percentage, sets, games and game difference.
   */
  if (isRotating) {
    if (tournament && tournament.useAmericano) {
      // Americano rotating: rank, player, matches, wins, total points and average points.
      ['Rank', 'Player', 'Matches', 'Wins', 'Total Points', 'Avg Points'].forEach((txt) => {
        const th = document.createElement('th');
        th.textContent = txt;
        trh.appendChild(th);
      });
    } else {
      // Sets or free rotating: rank, player, points (sets won), games won/lost and difference
      ['Rank', 'Player', 'Points', 'Games Won', 'Games Lost', 'Game ±'].forEach((txt) => {
        const th = document.createElement('th');
        th.textContent = txt;
        trh.appendChild(th);
      });
    }
  } else {
    // Fixed/official tournaments.  If Americano scoring is enabled, show matches, wins, total points and average points.
    if (tournament && tournament.useAmericano) {
      ['Rank', 'Team', 'Matches', 'Wins', 'Total Points', 'Avg Points'].forEach((txt) => {
        const th = document.createElement('th');
        th.textContent = txt;
        trh.appendChild(th);
      });
    } else {
      // Set‑based fixed/official tournaments: show a compact set of columns to
      // avoid horizontal overflow on small screens.  We include matches,
      // wins, losses, win percentage and a single column for game
      // difference (games won minus games lost).  Sets won/lost and raw
      // games won/lost are still tracked internally but omitted from the
      // table to save space.
      ['Rank', 'Team', 'Matches', 'Wins', 'Losses', 'Win %', 'Game ±'].forEach((txt) => {
        const th = document.createElement('th');
        th.textContent = txt;
        trh.appendChild(th);
      });
    }
  }
  thead.appendChild(trh);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  ranking.forEach((entry, index) => {
    const tr = document.createElement('tr');
    // Rank column
    const rankTd = document.createElement('td');
    rankTd.className = 'rank-col';
    // Use ordinal indicator for rank (e.g., 1º, 2º)
    rankTd.textContent = `${index + 1}º`;
    tr.appendChild(rankTd);
    // Name/Team column: display the name in uppercase for a premium feel.
    const nameTd = document.createElement('td');
    nameTd.className = isRotating ? 'name-col' : 'name-col';
    nameTd.textContent = entry.name.toUpperCase();
    // If the team name contains an ampersand (indicating two players),
    // tag the cell so that mobile CSS can reduce its font size and padding.
    if (entry.name && entry.name.includes(' & ')) {
      nameTd.classList.add('two-names');
    }
    tr.appendChild(nameTd);
    if (isRotating) {
      if (tournament && tournament.useAmericano) {
        // Americano: show matches, wins, total points and average points (with bonus included)
        const matchesTd = document.createElement('td');
        matchesTd.className = 'stat-col';
        matchesTd.textContent = entry.matches;
        const winsTd = document.createElement('td');
        winsTd.className = 'stat-col';
        winsTd.textContent = entry.wins;
        const totalPtsTd = document.createElement('td');
        totalPtsTd.className = 'stat-col';
        totalPtsTd.textContent = entry.totalPoints;
        const avgTd = document.createElement('td');
        avgTd.className = 'stat-col';
        avgTd.textContent = entry.avgPoints ? entry.avgPoints.toFixed(1) : '0.0';
        tr.appendChild(matchesTd);
        tr.appendChild(winsTd);
        tr.appendChild(totalPtsTd);
        tr.appendChild(avgTd);
      } else {
        // Sets or free: show points and games won/lost difference
        const pointsTd = document.createElement('td');
        pointsTd.className = 'stat-col';
        pointsTd.textContent = entry.points;
        const gamesWonTd = document.createElement('td');
        gamesWonTd.className = 'stat-col';
        gamesWonTd.textContent = entry.gamesWon;
        const gamesLostTd = document.createElement('td');
        gamesLostTd.className = 'stat-col';
        gamesLostTd.textContent = entry.gamesLost;
        const diffTd = document.createElement('td');
        diffTd.className = 'stat-col';
        diffTd.textContent = entry.gamesWon - entry.gamesLost;
        tr.appendChild(pointsTd);
        tr.appendChild(gamesWonTd);
        tr.appendChild(gamesLostTd);
        tr.appendChild(diffTd);
      }
    } else {
      // Fixed/official tournaments: show ranking depending on scoring type
      if (tournament && tournament.useAmericano) {
        // Americano fixed: matches, wins, total points and average points
        const matchesTd = document.createElement('td');
        matchesTd.className = 'stat-col';
        matchesTd.textContent = entry.matches;
        const winsTd = document.createElement('td');
        winsTd.className = 'stat-col';
        winsTd.textContent = entry.wins;
        const totalPtsTd = document.createElement('td');
        totalPtsTd.className = 'stat-col';
        totalPtsTd.textContent = entry.totalPoints;
        const avgTd = document.createElement('td');
        avgTd.className = 'stat-col';
        avgTd.textContent = entry.avgPoints ? entry.avgPoints.toFixed(1) : '0.0';
        tr.appendChild(matchesTd);
        tr.appendChild(winsTd);
        tr.appendChild(totalPtsTd);
        tr.appendChild(avgTd);
      } else {
        // Set-based fixed/official tournaments: matches, wins, losses, win % and game difference
        const matchesTd = document.createElement('td');
        matchesTd.className = 'stat-col';
        matchesTd.textContent = entry.matches;
        const winsTd = document.createElement('td');
        winsTd.className = 'stat-col';
        winsTd.textContent = entry.wins;
        const lossesTd = document.createElement('td');
        lossesTd.className = 'stat-col';
        lossesTd.textContent = entry.losses;
        const totalPlayed = entry.wins + entry.losses;
        const pct = totalPlayed > 0 ? Math.round((entry.wins / totalPlayed) * 100) : 0;
        const pctTd = document.createElement('td');
        pctTd.className = 'stat-col';
        pctTd.textContent = `${pct}%`;
        const diffTd = document.createElement('td');
        diffTd.className = 'stat-col';
        diffTd.textContent = entry.gamesWon - entry.gamesLost;
        tr.appendChild(matchesTd);
        tr.appendChild(winsTd);
        tr.appendChild(lossesTd);
        tr.appendChild(pctTd);
        tr.appendChild(diffTd);
      }
    }
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  rankingEl.appendChild(table);

  // Highlight the top row as the winner
  const firstRow = tbody.querySelector('tr');
  if (firstRow) {
    firstRow.classList.add('winner-row');
  }
}

// Display ranking table for ladder tournaments
function displayRankingLadder(ranking) {
  rankingEl.innerHTML = '';
  const table = document.createElement('table');
  table.className = 'dark-table ranking-table';
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  ['Rank', 'Player', 'Matches', 'Wins', 'Points'].forEach((txt) => {
    const th = document.createElement('th');
    th.textContent = txt;
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  ranking.forEach((entry, idx) => {
    const tr = document.createElement('tr');
    const rtd = document.createElement('td');
    rtd.textContent = `${idx + 1}`;
    tr.appendChild(rtd);
    const nameTd = document.createElement('td');
    nameTd.textContent = entry.name.toUpperCase();
    tr.appendChild(nameTd);
    const mTd = document.createElement('td');
    mTd.textContent = entry.matches;
    const wTd = document.createElement('td');
    wTd.textContent = entry.wins;
    const pTd = document.createElement('td');
    pTd.textContent = entry.points;
    tr.appendChild(mTd);
    tr.appendChild(wTd);
    tr.appendChild(pTd);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  rankingEl.appendChild(table);
  const firstRow = tbody.querySelector('tr');
  if (firstRow) firstRow.classList.add('winner-row');
}

// Add a new match for free tournaments via user prompts
function addMatchFree() {
  // Only allow adding matches for free or ladder tournaments
  if (!tournament || (tournament.type !== 'free' && tournament.type !== 'ladder')) {
    return;
  }
  // Use interactive modal to select teams
  showTeamSelectionModal(({ teamAPlayers, teamBPlayers }) => {
    // Ensure no duplicate players across both teams (modal should handle but double-check)
    const allIds = new Set();
    for (const p of teamAPlayers.concat(teamBPlayers)) {
      if (allIds.has(p.id)) {
        alert('The same player cannot be on both teams.');
        return;
      }
      allIds.add(p.id);
    }
    // For free tournaments we treat teams as arrays of players since ranking is player-based
    const match = {
      round: tournament.schedule.length + 1,
      court: 1,
      teamA: teamAPlayers,
      teamB: teamBPlayers,
      score: null,
    };
    tournament.schedule.push([match]);
    updateRankingAndSchedule();
  });
}

// Add a new match for any structured tournament (match, fixed or rotating).
// The user will be prompted with a numbered list of players to select two players for each team.
function addRandomMatch() {
  // Ensure a tournament exists and enough players are available
  if (!tournament) return;
  if (players.length < 4) {
    alert('You need at least four players to create a match.');
    return;
  }
  // Use interactive picker to select two players per team
  showTeamSelectionModal(({ teamAPlayers, teamBPlayers }) => {
    // For rotating, free or Americano tournaments store teams as arrays; otherwise store as team objects
    let teamA;
    let teamB;
    if (tournament.type === 'rotating' || tournament.type === 'free' || tournament.useAmericano) {
      teamA = teamAPlayers;
      teamB = teamBPlayers;
    } else {
      // For match or fixed tournaments, reuse existing team objects if they exist
      const existingA = findTeamByPlayers(teamAPlayers);
      const existingB = findTeamByPlayers(teamBPlayers);
      teamA = existingA || {
        id: `randA-${Date.now()}-${Math.random()}`,
        name: `${teamAPlayers[0].name} & ${teamAPlayers[1].name}`,
        players: teamAPlayers,
      };
      teamB = existingB || {
        id: `randB-${Date.now()}-${Math.random()}`,
        name: `${teamBPlayers[0].name} & ${teamBPlayers[1].name}`,
        players: teamBPlayers,
      };
      // If new teams were created, add them to tournament.teams
      if (!existingA) tournament.teams.push(teamA);
      if (!existingB) tournament.teams.push(teamB);
    }
    const match = {
      round: tournament.schedule.length + 1,
      court: 1,
      teamA,
      teamB,
      score: null,
    };
    tournament.schedule.push([match]);
    updateRankingAndSchedule();
  });
}

// Reset the score of a match at given round and index
function resetMatch(roundIndex, matchIndex) {
  if (!tournament || !tournament.schedule || !tournament.schedule[roundIndex]) return;
  const match = tournament.schedule[roundIndex][matchIndex];
  if (match) {
    match.score = null;
    // If playoff bracket, also remove propagated winner in next round
    if (tournament && tournament.type === 'playoff') {
      const nextRoundIndex = roundIndex + 1;
      if (tournament.schedule[nextRoundIndex]) {
        const nextMatchIndex = Math.floor(matchIndex / 2);
        const nextMatch = tournament.schedule[nextRoundIndex][nextMatchIndex];
        if (nextMatch) {
          if (matchIndex % 2 === 0) nextMatch.teamA = null;
          else nextMatch.teamB = null;
        }
      }
    }
    updateRankingAndSchedule();
  }
}

// Delete team assignments from a first‑round match in the playoff bracket.
// This removes any assigned teams from the match, returns the players to the
// unassigned pool and clears any propagated winners in later rounds.  It
// should only be used for the first round of the playoff bracket, where
// teams are manually chosen.  After deletion the match will return to
// showing a “Select teams” button.
function deleteTeamAssignments(roundIndex, matchIndex) {
  if (!tournament || tournament.type !== 'playoff') return;
  // Only operate on the first round
  if (roundIndex !== 0) return;
  const match = tournament.schedule[roundIndex] && tournament.schedule[roundIndex][matchIndex];
  if (!match) return;
  // Return players to the unassigned pool and remove from assigned/teams lists
  function removeTeam(team) {
    if (!team) return;
    // Add each player back to the unassigned list
    team.players.forEach((p) => {
      // Prevent duplicates: only add if not already present
      if (!tournament.unassignedPlayers.some((u) => u.id === p.id)) {
        tournament.unassignedPlayers.push(p);
      }
      // Remove from assignedPlayers array
      tournament.assignedPlayers = tournament.assignedPlayers.filter((ap) => ap.id !== p.id);
    });
    // Remove from global teams list
    tournament.teams = tournament.teams.filter((t) => t.id !== team.id);
  }
  // Remove teamA and teamB assignments
  removeTeam(match.teamA);
  removeTeam(match.teamB);
  match.teamA = null;
  match.teamB = null;
  match.score = null;
  // Clear propagated winner in the next round
  const nextRoundIndex = roundIndex + 1;
  const nextMatch = tournament.schedule[nextRoundIndex] && tournament.schedule[nextRoundIndex][Math.floor(matchIndex / 2)];
  if (nextMatch) {
    if (matchIndex % 2 === 0) nextMatch.teamA = null;
    else nextMatch.teamB = null;
  }
  updateRankingAndSchedule();
}
// Delete a match from the schedule
function deleteMatch(roundIndex, matchIndex) {
  if (!tournament || !tournament.schedule || !tournament.schedule[roundIndex]) return;
  tournament.schedule[roundIndex].splice(matchIndex, 1);
  // If round becomes empty, remove round
  if (tournament.schedule[roundIndex].length === 0) {
    tournament.schedule.splice(roundIndex, 1);
  }
  updateRankingAndSchedule();
}

// Update ranking and schedule display after scores are entered
function updateRankingAndSchedule() {
  // Always attempt to update schedule and ranking. Wrap in try/finally so
  // that the schedule is re-rendered even if an error occurs during ranking
  // calculation (e.g. due to malformed data).  This prevents the schedule
  // from disappearing for Americano or other scoring modes.
  try {
    // For playoff bracket tournaments we do not display an ongoing ranking.  The
    // eventual winner will emerge from the bracket progression itself.  Hide
    // the ranking container to avoid confusion.  For other tournament types we
    // compute and display the ranking normally.
    if (tournament && tournament.type === 'playoff') {
      if (rankingEl) {
        rankingEl.innerHTML = '';
        rankingEl.classList.add('hidden');
      }
    } else {
      let ranking;
      // Rotating, ladder and free tournaments use player-based ranking
      if (tournament.type === 'rotating' || tournament.type === 'free' || tournament.type === 'ladder') {
        if (tournament.type === 'ladder') {
          ranking = computeRankingLadder(tournament.schedule, tournament.players || players);
          displayRankingLadder(ranking);
        } else {
          ranking = computeRankingRotating(tournament.schedule);
          displayRanking(ranking, true);
        }
      } else {
        // For match and fixed tournaments, use team‑based ranking
        ranking = computeRankingFixed(tournament.schedule);
        displayRanking(ranking, false);
      }
      // Ensure ranking element is visible for non‑playoff tournaments
      if (rankingEl) {
        rankingEl.classList.remove('hidden');
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    // re-render schedule to show scores; schedule may have been cleared earlier
    if (tournament && tournament.schedule) {
      displaySchedule(tournament.schedule);
    }
  }
}

// Display final classification and podium
function finalizeTournament() {
  if (!tournament) return;
  // Compute final ranking based on tournament type
  let finalRanking;
  const isRotating =
    tournament.type === 'rotating' || tournament.type === 'free' || tournament.type === 'ladder';
  if (tournament.type === 'ladder') {
    finalRanking = computeRankingLadder(tournament.schedule, tournament.players || players);
  } else if (isRotating) {
    finalRanking = computeRankingRotating(tournament.schedule);
  } else {
    finalRanking = computeRankingFixed(tournament.schedule);
  }
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'podium-modal';
  overlay.appendChild(modal);
  // Generate victory confetti animation
  (function generateConfetti() {
    const colors = ['#1976b2', '#51b58d', '#43a047', '#ffd700', '#e53935'];
    const count = 80;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      piece.style.left = Math.random() * 100 + 'vw';
      piece.style.animationDelay = Math.random() + 's';
      overlay.appendChild(piece);
    }
    // Remove confetti after animation completes
    setTimeout(() => {
      overlay.querySelectorAll('.confetti-piece').forEach((el) => el.remove());
    }, 3500);
  })();
  const title = document.createElement('h3');
  title.textContent = 'Final classification';
  modal.appendChild(title);
  if (tournament.type === 'match') {
    // For official matches show winner and loser
    const trophy = document.createElement('div');
    trophy.className = 'podium-trophy';
    trophy.textContent = '🏆';
    modal.appendChild(trophy);
    const winner = finalRanking[0];
    const loser = finalRanking[1];
    const winnerP = document.createElement('p');
    winnerP.innerHTML = `<strong>Winning team:</strong> ${winner.name.toUpperCase()}`;
    modal.appendChild(winnerP);
    if (loser) {
      const loserP = document.createElement('p');
      loserP.innerHTML = `<strong>Losing team:</strong> ${loser.name.toUpperCase()}`;
      modal.appendChild(loserP);
    }
  } else {
    // Build podium for top 3 entries
    const podium = document.createElement('div');
    podium.className = 'podium-container';
    const positions = ['first', 'second', 'third'];
    for (let i = 0; i < Math.min(3, finalRanking.length); i++) {
      const entry = finalRanking[i];
      const item = document.createElement('div');
      item.className = `podium-item ${positions[i]}`;
      // Medal
      const medal = document.createElement('div');
      medal.className = 'podium-medal';
      medal.textContent = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
      item.appendChild(medal);
      // Podium step that also holds the name
      const step = document.createElement('div');
      step.className = 'step';
      // Name displayed inside the step for better integration
      const nameDiv = document.createElement('div');
      nameDiv.className = 'podium-name';
      nameDiv.textContent = entry.name.toUpperCase();
      step.appendChild(nameDiv);
      // Position number below the name (1st, 2nd, 3rd)
      const posDiv = document.createElement('div');
      posDiv.className = 'podium-position';
      posDiv.textContent = `${i + 1}`;
      step.appendChild(posDiv);
      item.appendChild(step);
      podium.appendChild(item);
    }
    modal.appendChild(podium);
    // List other participants if any
    if (finalRanking.length > 3) {
      const othersTitle = document.createElement('p');
      othersTitle.innerHTML = '<strong>Other participants:</strong>';
      modal.appendChild(othersTitle);
      const ul = document.createElement('ul');
      for (let i = 3; i < finalRanking.length; i++) {
        const li = document.createElement('li');
        li.textContent = `${i + 1}. ${finalRanking[i].name.toUpperCase()}`;
        ul.appendChild(li);
      }
      modal.appendChild(ul);
    }
  }
  // Footer with close button
  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn secondary';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', () => {
    overlay.remove();
  });
  footer.appendChild(closeBtn);
  modal.appendChild(footer);
  document.body.appendChild(overlay);
}

// Create tournament based on user input
tournamentForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (players.length < 2) {
    alert('Please add at least two players.');
    return;
  }
  const type = tournamentTypeSelect.value;
  const courts = parseInt(document.getElementById('courts').value, 10) || 1;
  // Determine scoring type from hidden input: sets or Americano
  const useAmericano = document.getElementById('scoring-type').value === 'americano';
  const useHandicap = document.getElementById('use-handicap').checked;
  const americanoPoints = parseInt(document.getElementById('americano-points').value, 10) || 24;
  const sets = parseInt(document.getElementById('match-sets').value, 10) || 3;
  // apply handicap option
  players.forEach((p) => {
    if (!useHandicap) p.handicap = 0;
  });
  // Determine participants based on tournament type
  let schedule = [];
  let infoHtml = '';
  let teams = [];
  let selectedPlayers = [];
  if (type === 'match') {
    if (players.length !== 4) {
      alert('Match requires exactly 4 players.');
      return;
    }
    // Two teams of two players each: players[0] & players[1] vs players[2] & players[3]
    teams = [
      { id: 'team1', name: `${players[0].name} & ${players[1].name}`, players: [players[0], players[1]] },
      { id: 'team2', name: `${players[2].name} & ${players[3].name}`, players: [players[2], players[3]] },
    ];
    schedule = [
      [
        {
          round: 1,
          court: 1,
          teamA: teams[0],
          teamB: teams[1],
          score: null,
        },
      ],
    ];
    infoHtml = `<p>Official match: ${teams[0].name} vs ${teams[1].name}</p>`;
  } else if (type === 'fixed') {
    const numPlayers = parseInt(document.getElementById('fixed-players').value, 10);
    // Allow even player counts between 6 and 16 for fixed partner tournaments.
    if (numPlayers % 2 !== 0 || numPlayers < 6 || numPlayers > 16) {
      alert('Fixed partner tournaments require an even number of players between 6 and 16.');
      return;
    }
    if (players.length < numPlayers) {
      alert(`You need at least ${numPlayers} players.`);
      return;
    }
    // Select the first numPlayers players; the organiser will decide how to form teams.
    const selected = players.slice(0, numPlayers);
    // Show a dialog asking whether to auto generate teams or create manually.  The rest
    // of the tournament creation will continue once a choice is made.
    openFixedTeamsChoice(selected, numPlayers, courts, sets, useAmericano, americanoPoints, useHandicap);
    // Do not proceed further in this handler; the overlay will handle team creation
    return;
  } else if (type === 'rotating') {
    const numPlayers = parseInt(document.getElementById('rotating-players').value, 10);
    if (numPlayers < 4 || numPlayers > 16) {
      alert('Rotating partner tournaments require between 4 and 16 players.');
      return;
    }
    if (players.length < numPlayers) {
      alert(`You need at least ${numPlayers} players.`);
      return;
    }
    const selected = shuffle(players.slice()).slice(0, numPlayers);
    schedule = generateScheduleRotating(selected, courts);
    infoHtml = `<p>Rotating partner tournament with ${selected.length} players and ${courts} court(s).</p>`;
  } else if (type === 'ladder') {
    let numPlayers = players.length;
    if (numPlayers < 2) {
      alert('Ladder tournaments require at least 2 players.');
      return;
    }
    if (numPlayers > 30) {
      alert('Ladder tournaments allow a maximum of 30 players. Please remove some players.');
      return;
    }
    selectedPlayers = shuffle(players.slice()).slice(0, numPlayers);
    schedule = [];
    teams = [];
    infoHtml = `<p>Ladder tournament with ${selectedPlayers.length} players. Add matches manually.</p>`;
  } else if (type === 'free') {
    // Free tournaments include all registered players up to a maximum of 30.
    let numPlayers = players.length;
    if (numPlayers < 2) {
      alert('Free tournaments require at least 2 players.');
      return;
    }
    if (numPlayers > 30) {
      alert('Free tournaments allow a maximum of 30 players. Please remove some players.');
      return;
    }
    // Use all available players (shuffle to randomise order for initial pairing suggestions)
    const selected = shuffle(players.slice()).slice(0, numPlayers);
    schedule = [];
    infoHtml = `<p>Free tournament with ${selected.length} players. Add matches manually.</p>`;
  } else if (type === 'playoff') {
    // Playoff bracket tournament: players form fixed teams and play in single elimination bracket.
    const numPlayers = parseInt(document.getElementById('playoff-players').value, 10);
    // Validate number of players (must be between 4 and 16 and even)
    // Validate number of players (must be between 4 and 32 and even)
    if (numPlayers < 4 || numPlayers > 32 || numPlayers % 2 !== 0) {
      alert('Playoff tournaments require an even number of players between 4 and 32.');
      return;
    }
    if (players.length < numPlayers) {
      alert(`You need at least ${numPlayers} players.`);
      return;
    }
    // Select participants.  Do not shuffle here; the organiser will decide how
    // to form teams or randomisation will occur in subsequent options.
    const selected = players.slice(0, numPlayers);
    // Instead of immediately creating the bracket, present the organiser
    // with playoff options (manual/manual, manual/random or random/random).
    openPlayoffOptionChoice(selected, numPlayers, sets, useAmericano, americanoPoints, useHandicap, courts);
    // Do not proceed further in this handler; the overlay will handle
    // creation of the playoff tournament once an option is selected.
    return;
  }
  // Create tournament object
  tournament = {
    type,
    teams,
    schedule,
    sets,
    useAmericano,
    americanoPoints,
    useHandicap,
    courts,
  };
  if (type === 'ladder') {
    tournament.players = selectedPlayers.slice();
  }
  // If this is a playoff tournament, incorporate additional state used for
  // manual team assignment into the tournament object.  The tempPlayoffState
  // object is populated above in the playoff branch.  We clone the arrays to
  // avoid accidental external mutation.
  if (type === 'playoff' && typeof tempPlayoffState !== 'undefined') {
    tournament.unassignedPlayers = tempPlayoffState.unassignedPlayers.slice();
    tournament.assignedPlayers = tempPlayoffState.assignedPlayers.slice();
    tournament.nextTeamId = tempPlayoffState.nextTeamId;
    delete tempPlayoffState;
  }
  // Populate tournament info
  tournamentInfoEl.innerHTML = infoHtml;
  // Display schedule and ranking
  displaySchedule(schedule);
  updateRankingAndSchedule();
  // Always show the Add Match button once a tournament is created.
  // For free tournaments it will prompt for names, otherwise it will allow selecting players.
  addMatchBtn.classList.remove('hidden');

  // Show finish tournament button
  finishTournamentBtn.classList.remove('hidden');
  // Show or hide second round button depending on tournament type
  if (type === 'fixed') {
    secondRoundBtn.classList.remove('hidden');
  } else {
    secondRoundBtn.classList.add('hidden');
  }
  // Switch to page3: hide configuration page and show tournament details page
  page2.classList.add('hidden');
  page3.classList.remove('hidden');
});

// Event to toggle handicap options visibility
document.getElementById('use-handicap').addEventListener('change', (e) => {
  if (e.target.checked) {
    handicapOptionsEl.classList.remove('hidden');
  } else {
    handicapOptionsEl.classList.add('hidden');
  }
});

// No longer need to toggle Americano options via checkbox; this is handled by scoring type buttons

// Initialize UI
updateTournamentOptions();
renderPlayers();