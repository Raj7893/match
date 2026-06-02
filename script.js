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
    
    // 1. Establish System Authorization Role
    if (urlParams.get('admin') === 'true') {
        isViewOnly = false;
        document.body.classList.add('admin-privileges');
        document.getElementById('viewOnlyNotice').style.display = 'none';
    } else {
        isViewOnly = true;
        document.body.classList.remove('admin-privileges');
        document.getElementById('viewOnlyNotice').style.display = 'block';
    }

    // 2. Unpack Compressed Snapshot Parameter
    const encodedData = urlParams.get('snapshot');
    if (encodedData) {
        try {
            // Read raw base64 data safely
            const decoded = decodeURIComponent(escape(atob(encodedData)));
            appData = JSON.parse(decoded);
            
            // Validate schemas safely
            if (!appData.upcomingMatches) appData.upcomingMatches = [];
            if (!appData.elimRounds) appData.elimRounds = [];
            if (!appData.skills) appData.skills = {};
        } catch (e) {
            console.error("Critical: Decryption of snapshot cluster aborted.", e);
            alert("⚠️ Warning: Could not read this link's data cleanly. Make sure the link wasn't cut short!");
        }
    }

    // 3. Process Paint Pipeline
    renderApp();
    if (!isViewOnly) {
        generateSnapshotURLs();
    }
}

// --- DATA SERIALIZATION ENGINE (FIXED URL-SAFE ENCODING) ---
function generateSnapshotURLs() {
    if (isViewOnly) return;
    
    const baseUrl = window.location.origin + window.location.pathname;
    
    // Transform JSON data into a clean text string
    const jsonString = JSON.stringify(appData);
    const base64Data = btoa(unescape(encodeURIComponent(jsonString)));
    
    // FIX: Explicitly encode the base64 string so characters like +, /, and = don't turn into spaces
    const urlSafeData = encodeURIComponent(base64Data);
    
    // View Link strips administrative query commands
    document.getElementById('shareLink').value = `${baseUrl}?snapshot=${urlSafeData}`;
    // Admin Link saves state AND restores write authority
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
    targetInput.setSelectionRange(0, 99999); // Mobile optimization safeguard
    navigator.clipboard.writeText(targetInput.value);
    
    // Fire Toast Animation
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
    document.getElementById('recorderBox').classList.
