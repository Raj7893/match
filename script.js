// --- CENTRALIZED STATE MANAGEMENT ---
let appData = {
    teams: [],
    qualMatches: [],
    upcomingMatches: [],
    elimRounds: [],
    skills: {}
};

let isViewOnly = true;
let activeUpcomingIndex = null;

// --- INITIALIZATION PIPELINE ---
function init() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // AUTOMATIC ADMIN OVERRIDE: 
    // If you open the file fresh (no snapshot) OR explicitly ask for admin, unlock editing.
    if (urlParams.get('admin') === 'true' || !urlParams.has('snapshot')) {
        isViewOnly = false;
        document.body.classList.add('admin-privileges');
        document.getElementById('viewOnlyNotice').style.display = 'none';
    } else {
        isViewOnly = true;
        document.body.classList.remove('admin-privileges');
        document.getElementById('viewOnlyNotice').style.display = 'block';
    }

    // Unpack Compressed Snapshot Parameter
    const encodedData = urlParams.get('snapshot');
    if (encodedData) {
        try {
            const decoded = decodeURIComponent(escape(atob(encodedData)));
            appData = JSON.parse(decoded);
            
            if (!appData.upcomingMatches) appData.upcomingMatches = [];
            if (!appData.elimRounds) appData.elimRounds = [];
            if (!appData.skills) appData.skills = {};
        } catch (e) {
            console.error("Critical: Decryption of snapshot cluster aborted.", e);
            alert("⚠️ Warning: Could not read this link's data cleanly.");
        }
    }

    renderApp();
    if (!isViewOnly) {
        generateSnapshotURLs();
    }
}

// --- DATA SERIALIZATION ENGINE (URL-SAFE) ---
function generateSnapshotURLs() {
    if (isViewOnly) return;
    
    const baseUrl = window.location.origin + window.location.pathname;
    const jsonString = JSON.stringify(appData);
    const base64Data = btoa(unescape(encodeURIComponent(jsonString)));
    const urlSafeData = encodeURIComponent(base64Data);
    
    document.getElementById('shareLink').value = `${baseUrl}?snapshot=${urlSafeData}`;
    document.getElementById('adminLink').value = `${baseUrl}?admin=true&snapshot=${urlSafeData}`;
}

// --- UTILITY UX INTERACTIONS ---
function switchTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    btnElement.classList.add('active');
}

function handleKeyPress(event) {
    if (event.key === 'Enter') addPlayer();
}

function copyToClipboard(inputId) {
    const targetInput = document.getElementById(inputId);
    targetInput.select();
    targetInput.setSelectionRange(0, 99999); 
    navigator.clipboard.writeText(targetInput.value);
    
    const toast = document.getElementById('toast');
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 2500);
}

// --- TOURNAMENT CORE FUNCTIONALITIES ---
function addPlayer() {
    if (isViewOnly) return;
    const input = document.getElementById('playerName');
    const name = input.value.trim();
    if (name && !appData.teams.includes(name)) {
        appData.teams.push(name);
        appData.skills[name] = { auto: 0, driver: 0 };
        input.value = '';
        updatePipeline();
    }
}

function removePlayer(index) {
    if (isViewOnly) return;
    const teamName = appData.teams[index];
    appData.teams.splice(index, 1);
    delete appData.skills[teamName];
    
    appData.qualMatches = appData.qualMatches.filter(m => m.team1 !== teamName && m.team2 !== teamName);
    appData.upcomingMatches = appData.upcomingMatches.filter(m => m.team1 !== teamName && m.team2 !== teamName);
    
    cancelActiveMatch();
    updatePipeline();
}

function autoGenerateSchedule() {
    if (isViewOnly) return;
    const matchesPerTeam = parseInt(document.getElementById('matchesPerTeam').value) || 3;
    let teams = [...appData.teams];
    
    if (teams.length < 2) {
        alert("Register at least 2 teams before generating matrices.");
        return;
    }

    let matchTracker = {};
    teams.forEach(t => matchTracker[t] = 0);
    let masterSchedule = [];
    let iterations = 1000;

    while (iterations > 0) {
        let satisfied = teams.every(t => matchTracker[t] >= matchesPerTeam);
        if (satisfied) break;

        let queue = [...teams].sort((a, b) => matchTracker[a] - matchTracker[b]);
        let t1 = queue[0];
        let t2 = queue.find(t => t !== t1) || null;

        if (t1 && t2) {
            masterSchedule.push({ team1: t1, team2: t2 });
            matchTracker[t1]++;
            matchTracker[t2]++;
        } else {
            break;
        }
        iterations--;
    }

    appData.upcomingMatches = [...appData.upcomingMatches, ...masterSchedule];
    updatePipeline();
}

function deleteUpcomingMatch(index) {
    if (isViewOnly) return;
    appData.upcomingMatches.splice(index, 1);
    if (activeUpcomingIndex === index) cancelActiveMatch();
    updatePipeline();
}

function playUpcomingMatch(index) {
    if (isViewOnly) return;
    const match = appData.upcomingMatches[index];
    activeUpcomingIndex = index;
    
    document.getElementById('qTeam1').value = match.team1;
    document.getElementById('qTeam2').value = match.team2;
    document.getElementById('recorderHeading').innerText = `🔥 Match #${index + 1} Live Stream Configuration`;
    document.getElementById('recorderBox').classList.add('active-play');
    document.getElementById('cancelMatchBtn').style.display = 'inline-block';
    
    switchTab('recorderTab', document.querySelectorAll('.tab-btn')[1]);
}

function cancelActiveMatch() {
    activeUpcomingIndex = null;
    document.getElementById('recorderHeading').innerText = "Record Qualifying Match";
    document.getElementById('recorderBox').classList.remove('active-play');
    document.getElementById('cancelMatchBtn').style.display = 'none';
    document.getElementById('qTeam1').value = '';
    document.getElementById('qTeam2').value = '';
}

function recordQualifyingMatch() {
    if (isViewOnly) return;
    const t1 = document.getElementById('qTeam1').value;
    const t2 = document.getElementById('qTeam2').value;
    const winnerSelection = document.getElementById('qWinner').value;
    const autoSelection = document.getElementById('qAuto').value;

    if (!t1 || !t2 || t1 === t2) {
        alert("Assign two individual unique teams to log outcomes.");
        return;
    }

    let matchWinner = winnerSelection === 'tie' ? 'tie' : (winnerSelection === 'team1' ? t1 : t2);
    let autoWinner = autoSelection === 'tie' ? 'tie' : (autoSelection === 'team1' ? t1 : t2);

    appData.qualMatches.push({ team1: t1, team2: t2, winner: matchWinner, autoWinner: autoWinner });

    if (activeUpcomingIndex !== null) {
        appData.upcomingMatches.splice(activeUpcomingIndex, 1);
        cancelActiveMatch();
    }
    updatePipeline();
}

function recordSkillsScore() {
    if (isViewOnly) return;
    const team = document.getElementById('skillsTeam').value;
    const autoScore = parseInt(document.getElementById('autoSkillsScore').value) || 0;
    const driverScore = parseInt(document.getElementById('driverSkillsScore').value) || 0;

    if (!team) return alert("Select a registered team vector.");

    appData.skills[team] = { auto: autoScore, driver: driverScore };
    document.getElementById('autoSkillsScore').value = '';
    document.getElementById('driverSkillsScore').value = '';
    updatePipeline();
}

function deleteMatch(index) {
    if (isViewOnly) return;
    appData.qualMatches.splice(index, 1);
    updatePipeline();
}

// --- STATISTICS ENGINE ---
function calculateRankings() {
    let rankings = {};
    appData.teams.forEach(team => rankings[team] = { name: team, wp: 0, ap: 0, matchesPlayed: 0 });

    appData.qualMatches.forEach(match => {
        if (rankings[match.team1]) rankings[match.team1].matchesPlayed++;
        if (rankings[match.team2]) rankings[match.team2].matchesPlayed++;

        if (match.winner === 'tie') {
            if (rankings[match.team1]) rankings[match.team1].wp += 1;
            if (rankings[match.team2]) rankings[match.team2].wp += 1;
        } else {
            if (match.winner === match.team1 && rankings[match.team1]) rankings[match.team1].wp += 2;
            if (match.winner === match.team2 && rankings[match.team2]) rankings[match.team2].wp += 2;
        }

        if (match.autoWinner === match.team1 && rankings[match.team1]) rankings[match.team1].ap += 1;
        if (match.autoWinner === match.team2 && rankings[match.team2]) rankings[match.team2].ap += 1;
    });

    return Object.values(rankings).sort((a, b) => {
        let aAvgWp = a.matchesPlayed > 0 ? a.wp / a.matchesPlayed : 0;
        let bAvgWp = b.matchesPlayed > 0 ? b.wp / b.matchesPlayed : 0;
        let aAvgAp = a.matchesPlayed > 0 ? a.ap / a.matchesPlayed : 0;
        let bAvgAp = b.matchesPlayed > 0 ? b.ap / b.matchesPlayed : 0;

        if (bAvgWp !== aAvgWp) return bAvgWp - aAvgWp;
        return bAvgAp - aAvgAp;
    });
}

function getSkillsRankings() {
    let list = appData.teams.map(team => {
        let s = appData.skills[team] || { auto: 0, driver: 0 };
        return { name: team, auto: s.auto, driver: s.driver, total: s.auto + s.driver };
    });
    return list.sort((a, b) => (b.total !== a.total) ? b.total - a.total : b.auto - a.auto);
}

// --- DYNAMIC TREE BRACKET BUILDERS ---
function getSymmetricalSeedOrder(size) {
    let order = [1];
    while (order.length < size) {
        let nextOrder = [];
        let targetValue = order.length * 2 + 1;
        for (let i = 0; i < order.length; i++) {
            nextOrder.push(order[i]);
            nextOrder.push(targetValue - order[i]);
        }
        order = nextOrder;
    }
    return order;
}

function generateEliminationBracket() {
    if (isViewOnly) return;
    const ranked = calculateRankings();
    if (ranked.length < 2) return alert("You need a baseline criteria of 2 teams to populate a tree graph.");

    appData.elimRounds = [];
    let capacity = Math.pow(2, Math.ceil(Math.log2(ranked.length)));
    let seeds = getSymmetricalSeedOrder(capacity);
    let initialRound = [];

    for (let i = 0; i < capacity; i += 2) {
        let s1 = seeds[i], s2 = seeds[i + 1];
        let t1 = s1 <= ranked.length ? { name: ranked[s1 - 1].name, seed: s1 } : { name: "", seed: null };
        let t2 = s2 <= ranked.length ? { name: ranked[s2 - 1].name, seed: s2 } : { name: "", seed: null };
        
        let automaticWinner = (!t1.name && t2.name) ? t2.name : ((t1.name && !t2.name) ? t1.name : null);
        initialRound.push({ t1, t2, winner: automaticWinner });
    }
    appData.elimRounds.push(initialRound);

    let roundSlots = capacity / 2;
    while (roundSlots > 1) {
        roundSlots /= 2;
        appData.elimRounds.push(Array.from({ length: roundSlots }, () => ({ t1: { name: "", seed: null }, t2: { name: "", seed: null }, winner: null })));
    }
    syncBracketGenerations();
    updatePipeline();
}

function advanceBracketWinner(roundIdx, matchIdx, winnerName) {
    if (isViewOnly || !winnerName) return;
    appData.elimRounds[roundIdx][matchIdx].winner = winnerName;
    syncBracketGenerations();
    updatePipeline();
}

function syncBracketGenerations() {
    for (let r = 0; r < appData.elimRounds.length - 1; r++) {
        let current = appData.elimRounds[r];
        let next = appData.elimRounds[r + 1];
        current.forEach((match, mIdx) => {
            let targetIdx = Math.floor(mIdx / 2);
            let slot = (mIdx % 2 === 0) ? 't1' : 't2';
            if (match.winner) {
                let seedNum = (match.t1.name === match.winner) ? match.t1.seed : match.t2.seed;
                next[targetIdx][slot] = { name: match.winner, seed: seedNum };
            } else {
                next[targetIdx][slot] = { name: "", seed: null };
            }
        });
    }
}

// --- DISPATCH OVERHAUL CONTROL ---
function updatePipeline() {
    renderApp();
    if (!isViewOnly) generateSnapshotURLs();
}

// --- THE VISUAL RENDER ENGINE ---
function renderApp() {
    const list = document.getElementById('playerList');
    list.innerHTML = '';
    appData.teams.forEach((player, i) => {
        list.innerHTML += `<li><span><strong>${player}</strong></span> ${isViewOnly ? '' : `<button class="action-btn danger mini-btn" onclick="removePlayer(${i})">X</button>`}</li>`;
    });

    ['qTeam1', 'qTeam2', 'skillsTeam'].forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            const currentVal = select.value;
            select.innerHTML = `<option value="">Select Team Option</option>`;
            appData.teams.forEach(t => select.innerHTML += `<option value="${t}">${t}</option>`);
            select.value = currentVal;
        }
    });

    const upcomingContainer = document.getElementById('upcomingMatchesList');
    upcomingContainer.innerHTML = '';
    if (appData.upcomingMatches.length === 0) {
        upcomingContainer.innerHTML = `<tr><td colspan="3" style="color:var(--text-secondary); text-align:center;">No scheduled matches remain in queue.</td></tr>`;
    } else {
        appData.upcomingMatches.forEach((m, idx) => {
            upcomingContainer.innerHTML += `
                <tr>
                    <td>#${idx + 1}</td>
                    <td><strong>${m.team1}</strong> <span class="vs">VS</span> <strong>${m.team2}</strong></td>
                    ${isViewOnly ? '' : `<td><button class="action-btn secondary mini-btn" onclick="playUpcomingMatch(${idx})">Launch Match</button><button class="action-btn danger mini-btn" onclick="deleteUpcomingMatch(${idx})" style="margin-left:5px;">X</button></td>`}
                </tr>`;
        });
    }

    const qualBoard = document.getElementById('qualLeaderboard');
    qualBoard.innerHTML = '';
    const ranked = calculateRankings();
    ranked.forEach((t, i) => {
        qualBoard.innerHTML += `
            <tr>
                <td><strong>${i + 1}</strong></td>
                <td><span style="color:var(--accent-cyan); font-weight:bold;">${t.name}</span></td>
                <td>${t.matchesPlayed}</td>
                <td>${t.wp}</td>
                <td>${t.matchesPlayed > 0 ? (t.wp/t.matchesPlayed).toFixed(2) : "0.00"}</td>
                <td>${t.ap}</td>
                <td>${t.matchesPlayed > 0 ? (t.ap/t.matchesPlayed).toFixed(2) : "0.00"}</td>
            </tr>`;
    });

    const skillsBoard = document.getElementById('skillsLeaderboard');
    skillsBoard.innerHTML = '';
    getSkillsRankings().forEach((t, i) => {
        skillsBoard.innerHTML += `
            <tr>
                <td><strong>${i + 1}</strong></td>
                <td><strong>${t.name}</strong></td>
                <td>${t.auto}</td>
                <td>${t.driver}</td>
                <td><span style="color:var(--accent-emerald); font-weight:900;">${t.total}</span></td>
            </tr>`;
    });

    const historyBoard = document.getElementById('matchHistoryList');
    historyBoard.innerHTML = '';
    if(appData.qualMatches.length === 0) {
        historyBoard.innerHTML = `<tr><td colspan="5" style="color:var(--text-secondary); text-align:center;">No logged history found.</td></tr>`;
    } else {
        appData.qualMatches.forEach((m, idx) => {
            historyBoard.innerHTML += `
                <tr>
                    <td>#${idx + 1}</td>
                    <td>${m.team1} <span class="vs">VS</span> ${m.team2}</td>
                    <td><span style="color:var(--accent-emerald); font-weight:bold;">🏆 ${m.winner}</span></td>
                    <td>${m.autoWinner === 'tie' ? 'Split/None' : m.autoWinner}</td>
                    ${isViewOnly ? '' : `<td><button class="action-btn danger mini-btn" onclick="deleteMatch(${idx})">Wipe</button></td>`}
                </tr>`;
        });
    }

    const tree = document.getElementById('bracketTreeContainer');
    tree.innerHTML = '';
    if (!appData.elimRounds || appData.elimRounds.length === 0) {
        tree.innerHTML = `<p style="margin:40px auto; color:var(--text-secondary); text-align:center;">Complete qualifiers then generate your dynamic bracket matrix tree layout.</p>`;
    } else {
        if (!isViewOnly) tree.classList.add('admin-mode-active');
        appData.elimRounds.forEach((round, rIdx) => {
            const roundCol = document.createElement('div');
            roundCol.className = 'bracket-round';
            let rName = rIdx === appData.elimRounds.length - 1 ? "Grand Finals" : (rIdx === appData.elimRounds.length - 2 ? "Semifinals" : `Round ${rIdx + 1}`);
            roundCol.innerHTML = `<div class="round-title">${rName}</div>`;

            round.forEach((match, mIdx) => {
                if (!match.t1.name && !match.t2.name) return;
                const box = document.createElement('div');
                box.className = 'bracket-box';
                
                let t1WinClass = match.winner === match.t1.name ? 'team-slot winner-slot' : 'team-slot';
                let t2WinClass = match.winner === match.t2.name ? 'team-slot winner-slot' : 'team-slot';

                box.innerHTML = `
                    <div class="${t1WinClass}" onclick="advanceBracketWinner(${rIdx}, ${mIdx}, '${match.t1.name}')">
                        <span>${match.t1.seed ? `<span class="seed-number">${match.t1.seed}</span>` : ''}${match.t1.name || '—'}</span>
                    </div>
                    <div style="height:1px; background:rgba(255,255,255,0.05); margin:4px 0;"></div>
                    <div class="${t2WinClass}" onclick="advanceBracketWinner(${rIdx}, ${mIdx}, '${match.t2.name}')">
                        <span>${match.t2.seed ? `<span class="seed-number">${match.t2.seed}</span>` : ''}${match.t2.name || '—'}</span>
                    </div>`;
                roundCol.appendChild(box);
            });
            tree.appendChild(roundCol);
        });
    }
}

function resetTournament() {
    if (isViewOnly) return;
    if (confirm("🚨 Wipe entire local tournament database metrics? This cannot be undone.")) {
        appData = { teams: [], qualMatches: [], upcomingMatches: [], elimRounds: [], skills: {} };
        cancelActiveMatch();
        window.history.replaceState(null, null, window.location.pathname);
        updatePipeline();
    }
}

// Boot System
init();
