let appData = {
    teams: [],
    qualMatches: [],
    upcomingMatches: [],
    elimRounds: [],
    skills: {} // Keyed perfectly by team name: { auto: 0, driver: 0 }
};

let isViewOnly = false;
let activeUpcomingIndex = null;

function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedViewData = urlParams.get('view');

    if (sharedViewData) {
        try {
            appData = JSON.parse(decodeURIComponent(sharedViewData));
            isViewOnly = true;
            document.getElementById('viewOnlyNotice').style.display = 'block';
        } catch (e) { console.error("Error decoding view payload."); }
    } else {
        const savedData = localStorage.getItem('tournamentManagerData');
        if (savedData) {
            appData = JSON.parse(savedData);
            if (!appData.upcomingMatches) appData.upcomingMatches = [];
            if (!appData.elimRounds) appData.elimRounds = [];
            if (!appData.skills) appData.skills = {};
        }
    }
    renderApp();
}

function switchTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    btnElement.classList.add('active');
}

function handleKeyPress(event) {
    if (event.key === 'Enter') addPlayer();
}

function addPlayer() {
    if (isViewOnly) return;
    const input = document.getElementById('playerName');
    const name = input.value.trim();
    if (name && !appData.teams.includes(name)) { 
        appData.teams.push(name);
        appData.skills[name] = { auto: 0, driver: 0 };
        input.value = '';
        saveData();
        renderApp();
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
    saveData();
    renderApp();
}

function addUpcomingMatch() {
    if (isViewOnly) return;
    const t1 = document.getElementById('schedTeam1').value;
    const t2 = document.getElementById('schedTeam2').value;
    if (!t1 || !t2 || t1 === t2) {
        alert("Select two individual competing teams.");
        return;
    }
    appData.upcomingMatches.push({ team1: t1, team2: t2 });
    saveData();
    renderApp();
}

function autoGenerateSchedule() {
    if (isViewOnly) return;
    const numMatches = parseInt(document.getElementById('matchesPerTeam').value) || 3;
    let teams = [...appData.teams];
    
    if (teams.length < 2) {
        alert("Register at least 2 teams before generating schedules.");
        return;
    }

    if (confirm(`Generate schedule rounds where every team gets AT LEAST ${numMatches} matches?`)) {
        let counts = {};
        teams.forEach(t => counts[t] = 0);
        
        let schedule = [];
        let maxLoops = 2000; 

        while (maxLoops > 0) {
            let done = teams.every(t => counts[t] >= numMatches);
            if (done) break;

            let sortedTeams = [...teams].sort((a, b) => counts[a] - counts[b]);
            let team1 = sortedTeams[0];
            let team2 = null;

            for (let i = 1; i < sortedTeams.length; i++) {
                if (sortedTeams[i] !== team1) {
                    team2 = sortedTeams[i];
                    break;
                }
            }

            if (team1 && team2) {
                schedule.push({ team1, team2 });
                counts[team1]++;
                counts[team2]++;
            } else {
                break;
            }
            maxLoops--;
        }

        appData.upcomingMatches = [...appData.upcomingMatches, ...schedule];
        saveData();
        renderApp();
    }
}

function deleteUpcomingMatch(index) {
    if (isViewOnly) return;
    appData.upcomingMatches.splice(index, 1);
    if (activeUpcomingIndex === index) cancelActiveMatch();
    saveData();
    renderApp();
}

function playUpcomingMatch(index) {
    if (isViewOnly) return;
    const match = appData.upcomingMatches[index];
    activeUpcomingIndex = index;
    document.getElementById('qTeam1').value = match.team1;
    document.getElementById('qTeam2').value = match.team2;
    document.getElementById('recorderHeading').innerText = `Playing Scheduled Game #${index + 1}`;
    document.getElementById('recorderBox').classList.add('active-play');
    document.getElementById('cancelMatchBtn').style.display = 'inline-block';
    document.getElementById('recorderHeading').scrollIntoView({ behavior: 'smooth' });
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
    const winnerSel = document.getElementById('qWinner').value;
    const autoSel = document.getElementById('qAuto').value;

    if (!t1 || !t2 || t1 === t2) {
        alert("Select two valid active teams.");
        return;
    }

    let matchWinner = winnerSel === 'tie' ? 'tie' : (winnerSel === 'team1' ? t1 : t2);
    let autoWinner = autoSel === 'tie' ? 'tie' : (autoSel === 'team1' ? t1 : t2);

    appData.qualMatches.push({ team1: t1, team2: t2, winner: matchWinner, autoWinner: autoWinner });

    if (activeUpcomingIndex !== null) {
        appData.upcomingMatches.splice(activeUpcomingIndex, 1);
        cancelActiveMatch();
    }

    document.getElementById('qWinner').value = 'team1';
    document.getElementById('qAuto').value = 'team1';
    saveData();
    renderApp();
}

// Logs the skills runs directly into the isolated skills array
function recordSkillsScore() {
    if (isViewOnly) return;
    const team = document.getElementById('skillsTeam').value;
    const autoScore = parseInt(document.getElementById('autoSkillsScore').value) || 0;
    const driverScore = parseInt(document.getElementById('driverSkillsScore').value) || 0;

    if (!team) {
        alert("Please select a valid team first.");
        return;
    }

    appData.skills[team] = { auto: autoScore, driver: driverScore };
    
    document.getElementById('skillsTeam').value = '';
    document.getElementById('autoSkillsScore').value = '';
    document.getElementById('driverSkillsScore').value = '';
    
    saveData();
    renderApp();
}

function deleteMatch(index) {
    if (isViewOnly) return;
    if (confirm("Delete this match? Standings will instantly recalculate.")) {
        appData.qualMatches.splice(index, 1);
        saveData();
        renderApp();
    }
}

// Standings Engine (Only calculates data generated inside the Qualifying Match Log)
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

// Skills Ranking Engine (Completely isolated calculations)
function getSkillsRankings() {
    let list = appData.teams.map(team => {
        let s = appData.skills[team] || { auto: 0, driver: 0 };
        return { name: team, auto: s.auto, driver: s.driver, total: s.auto + s.driver };
    });

    return list.sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return b.auto - a.auto; // Sits as tiebreaker only within Skills Leaderboard window
    });
}

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
    const ranked = calculateRankings(); // Uses only Qualifying history data
    const teamCount = ranked.length;

    if (teamCount < 2) {
        alert("You need at least 2 registered teams to construct an elimination tree.");
        return;
    }

    if (confirm(`Freeze qualification standings and build a balanced tree containing ALL ${teamCount} teams?`)) {
        appData.elimRounds = [];
        let treeCapacity = Math.pow(2, Math.ceil(Math.log2(teamCount)));
        let seedSequence = getSymmetricalSeedOrder(treeCapacity);
        let round0Matches = [];

        for (let i = 0; i < treeCapacity; i += 2) {
            let seed1 = seedSequence[i];
            let seed2 = seedSequence[i + 1];

            let t1Obj = seed1 <= teamCount ? { name: ranked[seed1 - 1].name, seed: seed1 } : { name: "", seed: null };
            let t2Obj = seed2 <= teamCount ? { name: ranked[seed2 - 1].name, seed: seed2 } : { name: "", seed: null };

            let initialWinner = null;
            if (t1Obj.name && !t2Obj.name) initialWinner = t1Obj.name;
            if (!t1Obj.name && t2Obj.name) initialWinner = t2Obj.name;

            round0Matches.push({ t1: t1Obj, t2: t2Obj, winner: initialWinner });
        }
        appData.elimRounds.push(round0Matches);

        let currentRoundSize = treeCapacity / 2;
        while (currentRoundSize > 1) {
            currentRoundSize /= 2;
            let roundSlots = Array.from({ length: currentRoundSize }, () => ({ 
                t1: { name: "", seed: null }, t2: { name: "", seed: null }, winner: null 
            }));
            appData.elimRounds.push(roundSlots);
        }

        syncAdvancedBracketTree();
        saveData();
        renderApp();
    }
}

function advanceBracketWinner(roundIdx, matchIdx, selectedTeamName) {
    if (isViewOnly || !selectedTeamName) return;
    
    let round = appData.elimRounds[roundIdx];
    let match = round[matchIdx];
    
    match.winner = selectedTeamName;
    syncAdvancedBracketTree();
    saveData();
    renderApp();
}

function syncAdvancedBracketTree() {
    for (let r = 0; r < appData.elimRounds.length - 1; r++) {
        let currentRound = appData.elimRounds[r];
        let nextRound = appData.elimRounds[r + 1];

        currentRound.forEach((match, mIdx) => {
            let targetMatchIdx = Math.floor(mIdx / 2);
            let slotKey = (mIdx % 2 === 0) ? 't1' : 't2';
            
            if (match.winner) {
                let seedNum = (match.t1.name === match.winner) ? match.t1.seed : match.t2.seed;
                nextRound[targetMatchIdx][slotKey] = { name: match.winner, seed: seedNum };
            } else {
                nextRound[targetMatchIdx][slotKey] = { name: "", seed: null };
            }
        });
    }
}

function saveData() {
    if (!isViewOnly) localStorage.setItem('tournamentManagerData', JSON.stringify(appData));
    document.getElementById('shareLink').value = '';
}

function renderApp() {
    if (isViewOnly) document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');

    const listContainer = document.getElementById('playerList');
    listContainer.innerHTML = '';
    appData.teams.forEach((player, index) => {
        const li = document.createElement('li');
        li.innerHTML = `${player} ${isViewOnly ? '' : `<button class="delete-btn" onclick="removePlayer(${index})">X</button>`}`;
        listContainer.appendChild(li);
    });

    ['qTeam1', 'qTeam2', 'schedTeam1', 'schedTeam2', 'skillsTeam'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = `<option value="">Select Team</option>`;
            appData.teams.forEach(t => el.innerHTML += `<option value="${t}">${t}</option>`);
        }
    });

    const upcomingList = document.getElementById('upcomingMatchesList');
    upcomingList.innerHTML = '';
    if (appData.upcomingMatches.length === 0) {
        upcomingList.innerHTML = `<tr><td colspan="${isViewOnly ? 2 : 3}" style="color:#888;">No matches scheduled.</td></tr>`;
    } else {
        appData.upcomingMatches.forEach((m, idx) => {
            upcomingList.innerHTML += `
                <tr>
                    <td>#${idx + 1}</td>
                    <td><strong>${m.team1}</strong> <span class="vs">VS</span> <strong>${m.team2}</strong></td>
                    ${isViewOnly ? '' : `<td><button class="play-btn" onclick="playUpcomingMatch(${idx})">Play</button><button class="delete-btn" onclick="deleteUpcomingMatch(${idx})">X</button></td>`}
                </tr>`;
        });
    }

    const qualLeaderboard = document.getElementById('qualLeaderboard');
    qualLeaderboard.innerHTML = '';
    const rankedTeams = calculateRankings();
    if (rankedTeams.length === 0) {
        qualLeaderboard.innerHTML = '<tr><td colspan="7" style="color:#888;">Add teams to see rankings.</td></tr>';
    } else {
        rankedTeams.forEach((t, i) => {
            let avgWp = t.matchesPlayed > 0 ? (t.wp / t.matchesPlayed).toFixed(2) : "0.00";
            let avgAp = t.matchesPlayed > 0 ? (t.ap / t.matchesPlayed).toFixed(2) : "0.00";
            qualLeaderboard.innerHTML += `
                <tr>
                    <td>${i + 1}</td>
                    <td><strong>${t.name}</strong></td>
                    <td>${t.matchesPlayed}</td>
                    <td>${t.wp}</td>
                    <td>${avgWp}</td>
                    <td>${t.ap}</td>
                    <td>${avgAp}</td>
                </tr>`;
        });
    }

    // Render Skills Challenge Standings (Now in its own separated tab view node)
    const skillsLeaderboard = document.getElementById('skillsLeaderboard');
    skillsLeaderboard.innerHTML = '';
    const rankedSkills = getSkillsRankings();
    if (rankedSkills.length === 0) {
        skillsLeaderboard.innerHTML = '<tr><td colspan="5" style="color:#888;">No skills logged.</td></tr>';
    } else {
        rankedSkills.forEach((t, i) => {
            skillsLeaderboard.innerHTML += `
                <tr>
                    <td>${i + 1}</td>
                    <td><strong>${t.name}</strong></td>
                    <td>${t.auto}</td>
                    <td>${t.driver}</td>
                    <td><strong>${t.total}</strong></td>
                </tr>`;
        });
    }

    const historyList = document.getElementById('matchHistoryList');
    historyList.innerHTML = '';
    if (appData.qualMatches.length === 0) {
        historyList.innerHTML = `<tr><td colspan="${isViewOnly ? 4 : 5}" style="color:#888;">No recorded matches.</td></tr>`;
    } else {
        appData.qualMatches.forEach((m, idx) => {
            historyList.innerHTML += `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${m.team1} <span class="vs">VS</span> ${m.team2}</td>
                    <td><span style="color: green; font-weight: bold;">${m.winner}</span></td>
                    <td>${m.autoWinner === 'tie' ? 'Tie' : m.autoWinner}</td>
                    ${isViewOnly ? '' : `<td><button class="delete-btn" onclick="deleteMatch(${idx})">Delete</button></td>`}
                </tr>`;
        });
    }

    const treeContainer = document.getElementById('bracketTreeContainer');
    treeContainer.innerHTML = '';
    
    if (!appData.elimRounds || appData.elimRounds.length === 0) {
        treeContainer.innerHTML = '<p style="margin: auto; color:#777;">Perform qualifiers then click "Freeze Standings & Create Bracket" to open your dynamic bracket tree.</p>';
    } else {
        if (!isViewOnly) treeContainer.classList.add('admin-mode-active');
        
        appData.elimRounds.forEach((round, rIdx) => {
            const roundCol = document.createElement('div');
            roundCol.className = 'bracket-round';
            
            let roundName = rIdx === appData.elimRounds.length - 1 ? "Finals" : (rIdx === appData.elimRounds.length - 2 ? "Semifinals" : `Round ${rIdx + 1}`);
            roundCol.innerHTML = `<div class="round-title">${roundName}</div>`;

            round.forEach((match, mIdx) => {
                if (!match.t1.name && !match.t2.name) return;

                const matchBox = document.createElement('div');
                matchBox.className = 'bracket-box';

                let t1Class = match.winner && match.winner === match.t1.name ? 'team-slot winner-slot' : 'team-slot';
                let t2Class = match.winner && match.winner === match.t2.name ? 'team-slot winner-slot' : 'team-slot';

                let t1SeedBadge = match.t1.seed ? `<span class="seed-number">${match.t1.seed}</span>` : '';
                let t2SeedBadge = match.t2.seed ? `<span class="seed-number">${match.t2.seed}</span>` : '';

                matchBox.innerHTML = `
                    <div class="${t1Class}" onclick="advanceBracketWinner(${rIdx}, ${mIdx}, '${match.t1.name}')">
                        <span>${t1SeedBadge}${match.t1.name || "—"}</span>
                    </div>
                    <div style="text-align:center; font-size:10px; color:#999; margin: -2px 0;">vs</div>
                    <div class="${t2Class}" onclick="advanceBracketWinner(${rIdx}, ${mIdx}, '${match.t2.name}')">
                        <span>${t2SeedBadge}${match.t2.name || "—"}</span>
                    </div>
                `;
                roundCol.appendChild(matchBox);
            });
            
            if(roundCol.children.length > 1) {
                treeContainer.appendChild(roundCol);
            }
        });
    }
}

function generateShareLink() {
    const dataString = encodeURIComponent(JSON.stringify(appData));
    const shareUrl = window.location.origin + window.location.pathname + "?view=" + dataString;
    const linkInput = document.getElementById('shareLink');
    linkInput.value = shareUrl;
    linkInput.select();
}

function resetTournament() {
    if (isViewOnly) return;
    if (confirm("🚨 WIPE ENTIRE TOURNAMENT Standings, Matches, Schedules, and Brackets?")) {
        appData = { teams: [], qualMatches: [], upcomingMatches: [], elimRounds: [], skills: {} };
        cancelActiveMatch();
        saveData();
        renderApp();
    }
}

init();
