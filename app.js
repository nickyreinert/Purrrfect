const REGION_PALETTE = [
  "#F94144",
  "#F3722C",
  "#F8961E",
  "#F9C74F",
  "#90BE6D",
  "#43AA8B",
  "#4D908E",
  "#577590",
  "#277DA1"
];

const DB_NAME = "purrfect_regions_db";
const DB_VERSION = 1;
const STORE_META = "meta";
const STORE_SCORES = "scores";

const dbState = {
  promise: null
};

const state = {
  config: null,
  puzzle: null,
  cats: [],
  catCount: 0,
  status: "playing",
  mistakes: 0,
  hintsUsed: 0,
  history: [],
  mode: "round",
  startedAt: 0,
  elapsedMs: 0,
  timerId: null,
  bestMs: null,
  topTimes: [],
  campaignUnlockedLevel: 1,
  solverMode: false,
  solverCandidates: new Map(),
  settingsOpen: false,
  infoOpen: false
};

const ui = {
  board: document.getElementById("board"),
  status: document.getElementById("status"),
  statMode: document.getElementById("stat-mode"),
  statSize: document.getElementById("stat-size"),
  statCats: document.getElementById("stat-cats"),
  statPlaced: document.getElementById("stat-placed"),
  statMistakes: document.getElementById("stat-mistakes"),
  statTime: document.getElementById("stat-time"),
  statBest: document.getElementById("stat-best"),
  statUnlocked: document.getElementById("stat-unlocked"),
  rulesList: document.getElementById("rules-list"),
  leaderboardLabel: document.getElementById("leaderboard-label"),
  leaderboardList: document.getElementById("leaderboard-list"),

  modeRound: document.getElementById("mode-round"),
  modeCampaign: document.getElementById("mode-campaign"),
  toggleSettings: document.getElementById("toggle-settings"),
  toggleInfo: document.getElementById("toggle-info"),
  settingsPanel: document.getElementById("settings-panel"),
  statsPanel: document.getElementById("stats-panel"),
  rulesPanel: document.getElementById("rules-panel"),
  leaderboardPanel: document.getElementById("leaderboard-panel"),
  roundControls: document.getElementById("round-controls"),
  campaignControls: document.getElementById("campaign-controls"),

  sizeSelect: document.getElementById("size-select"),
  regionSelect: document.getElementById("region-select"),
  newRoundBtn: document.getElementById("new-round"),

  levelInput: document.getElementById("level-input"),
  loadLevelBtn: document.getElementById("load-level"),
  nextLevelBtn: document.getElementById("next-level"),

  hintBtn: document.getElementById("hint-btn"),
  solverBtn: document.getElementById("solver-btn"),
  checkBtn: document.getElementById("check-btn"),
  resetBtn: document.getElementById("reset-btn")
};

init().catch(() => {
  setStatus("Initialization failed.", "warn");
});

async function init() {
  buildRoundSelectors();
  bindEvents();
  registerServiceWorker();

  await initDatabase();
  const storedLevel = await getMeta("campaignUnlockedLevel", 1);
  state.campaignUnlockedLevel = clamp(Number(storedLevel || 1), 1, 100);
  ui.statUnlocked.textContent = String(state.campaignUnlockedLevel);
  ui.levelInput.value = String(state.campaignUnlockedLevel);

  loadRound();
}

function buildRoundSelectors() {
  for (let size = 3; size <= 9; size++) {
    const option = document.createElement("option");
    option.value = String(size);
    option.textContent = `${size}x${size}`;
    ui.sizeSelect.append(option);
  }

  ui.sizeSelect.value = "5";
  syncRegionSelectOptions();
}

function bindEvents() {
  ui.sizeSelect.addEventListener("change", () => {
    syncRegionSelectOptions();
  });

  ui.modeRound.addEventListener("click", () => {
    state.mode = "round";
    renderMode();
  });

  ui.modeCampaign.addEventListener("click", () => {
    state.mode = "campaign";
    renderMode();
  });

  ui.toggleSettings.addEventListener("click", () => {
    state.settingsOpen = !state.settingsOpen;
    renderPanelVisibility();
  });

  ui.toggleInfo.addEventListener("click", () => {
    state.infoOpen = !state.infoOpen;
    renderPanelVisibility();
  });

  ui.newRoundBtn.addEventListener("click", () => {
    loadRound();
  });

  ui.loadLevelBtn.addEventListener("click", () => {
    const level = clamp(Number(ui.levelInput.value || 1), 1, state.campaignUnlockedLevel);
    ui.levelInput.value = String(level);
    loadCampaignLevel(level);
  });

  ui.nextLevelBtn.addEventListener("click", () => {
    const current = clamp(Number(ui.levelInput.value || 1), 1, state.campaignUnlockedLevel);
    const next = clamp(current + 1, 1, state.campaignUnlockedLevel);
    ui.levelInput.value = String(next);
    loadCampaignLevel(next);
  });

  ui.hintBtn.addEventListener("click", () => {
    giveHint();
  });

  ui.solverBtn.addEventListener("click", () => {
    state.solverMode = !state.solverMode;
    ui.solverBtn.classList.toggle("active", state.solverMode);
    renderBoard();
    setStatus(state.solverMode ? "Solver candidates enabled." : "Solver candidates hidden.", "");
  });

  ui.checkBtn.addEventListener("click", () => {
    checkCurrentBoard();
  });

  ui.resetBtn.addEventListener("click", () => {
    if (!state.puzzle) return;
    state.cats = new Array(state.puzzle.size * state.puzzle.size).fill(false);
    state.catCount = 0;
    state.status = "playing";
    state.solverCandidates = new Map();
    renderBoard();
    updateStats();
    setStatus("Board reset.", "");
  });
}

function renderMode() {
  const isRound = state.mode === "round";

  ui.modeRound.classList.toggle("active", isRound);
  ui.modeCampaign.classList.toggle("active", !isRound);
  ui.roundControls.classList.toggle("hidden", !isRound);
  ui.campaignControls.classList.toggle("hidden", isRound);

  if (isRound) {
    loadRound();
  } else {
    const level = clamp(Number(ui.levelInput.value || 1), 1, state.campaignUnlockedLevel);
    ui.levelInput.value = String(level);
    loadCampaignLevel(level);
  }
}

function renderPanelVisibility() {
  ui.settingsPanel.classList.toggle("hidden", !state.settingsOpen);
  ui.statsPanel.classList.toggle("hidden", !state.infoOpen);
  ui.rulesPanel.classList.toggle("hidden", !state.infoOpen);
  ui.leaderboardPanel.classList.toggle("hidden", !state.infoOpen);

  ui.toggleSettings.classList.toggle("active", state.settingsOpen);
  ui.toggleInfo.classList.toggle("active", state.infoOpen);
}

function syncRegionSelectOptions() {
  const size = Number(ui.sizeSelect.value);

  ui.regionSelect.innerHTML = "";

  for (let regionCount = 1; regionCount <= size; regionCount++) {
    const option = document.createElement("option");
    option.value = String(regionCount);
    option.textContent = String(regionCount);
    ui.regionSelect.append(option);
  }

  ui.regionSelect.value = String(Math.min(3, size));
}

function loadRound() {
  const size = Number(ui.sizeSelect.value);
  const regionCount = Number(ui.regionSelect.value);
  const config = buildRoundConfig(size, regionCount);
  startGame(config);
}

function loadCampaignLevel(level) {
  const safeLevel = clamp(level, 1, state.campaignUnlockedLevel);
  const config = getCampaignConfig(safeLevel);
  startGame(config);

  if (level > state.campaignUnlockedLevel) {
    setStatus(`Level ${level} is locked. Loaded level ${safeLevel}.`, "warn");
  }
}

function buildRoundConfig(size, regionCount) {
  const normalizedSize = clamp(size, 3, 9);
  const maxRegions = normalizedSize;
  const normalizedRegionCount = clamp(regionCount, 1, maxRegions);

  let allowDiagonalTouch = false;
  if (normalizedSize === 3) {
    allowDiagonalTouch = true;
  }

  return normalizeConfig({
    mode: "round",
    level: null,
    size: normalizedSize,
    regionCount: normalizedRegionCount,
    allowDiagonalTouch,
    blockers: 0,
    irregularity: 0.35,
    seed: "round:" + Math.random().toString(36).slice(2)
  });
}

function getCampaignConfig(level) {
  const phases = [
    { start: 1, end: 3, size: 3, regions: 1, allowTouch: false, minBlockers: 0, maxBlockers: 0 },
    { start: 4, end: 8, size: 3, regions: 2, allowTouch: false, minBlockers: 0, maxBlockers: 0 },
    { start: 9, end: 12, size: 3, regions: 3, allowTouch: true, minBlockers: 0, maxBlockers: 0 },

    { start: 13, end: 20, size: 4, regions: 2, allowTouch: false, minBlockers: 0, maxBlockers: 0 },
    { start: 21, end: 30, size: 4, regions: 3, allowTouch: false, minBlockers: 0, maxBlockers: 0 },
    { start: 31, end: 42, size: 4, regions: 4, allowTouch: false, minBlockers: 0, maxBlockers: 1 },

    { start: 43, end: 50, size: 5, regions: 3, allowTouch: false, minBlockers: 0, maxBlockers: 1 },
    { start: 51, end: 60, size: 5, regions: 4, allowTouch: false, minBlockers: 0, maxBlockers: 2 },
    { start: 61, end: 70, size: 5, regions: 5, allowTouch: false, minBlockers: 0, maxBlockers: 2 },

    { start: 71, end: 78, size: 6, regions: 4, allowTouch: false, minBlockers: 0, maxBlockers: 3 },
    { start: 79, end: 86, size: 7, regions: 5, allowTouch: false, minBlockers: 0, maxBlockers: 3 },
    { start: 87, end: 92, size: 8, regions: 6, allowTouch: false, minBlockers: 1, maxBlockers: 4 },

    { start: 93, end: 97, size: 9, regions: 7, allowTouch: false, minBlockers: 1, maxBlockers: 4 },
    { start: 98, end: 99, size: 9, regions: 8, allowTouch: false, minBlockers: 2, maxBlockers: 5 },
    { start: 100, end: 100, size: 9, regions: 9, allowTouch: false, minBlockers: 2, maxBlockers: 2 }
  ];

  const safeLevel = clamp(level, 1, 100);
  const phase = phases.find((p) => safeLevel >= p.start && safeLevel <= p.end);
  const span = phase.end - phase.start;
  const t = span === 0 ? 1 : (safeLevel - phase.start) / span;
  const blockers = Math.round(phase.minBlockers + t * (phase.maxBlockers - phase.minBlockers));

  return normalizeConfig({
    mode: "campaign",
    level: safeLevel,
    size: phase.size,
    regionCount: phase.regions,
    allowDiagonalTouch: phase.allowTouch,
    blockers,
    irregularity: Math.min(1, safeLevel / 100),
    seed: "campaign:" + safeLevel
  });
}

function normalizeConfig(config) {
  const size = clamp(config.size, 3, 9);
  const regionCount = clamp(config.regionCount, 1, size);

  let allowDiagonalTouch = !!config.allowDiagonalTouch;

  if (size >= 4) {
    allowDiagonalTouch = false;
  }

  if (size === 3 && regionCount === 3) {
    allowDiagonalTouch = true;
  }

  return {
    ...config,
    size,
    regionCount,
    allowDiagonalTouch,
    blockers: Math.max(0, Math.floor(config.blockers || 0)),
    irregularity: clamp(Number(config.irregularity) || 0, 0, 1)
  };
}

function startGame(config) {
  stopTimer();
  const puzzle = generatePuzzle(config);
  state.config = config;
  state.puzzle = puzzle;
  state.cats = new Array(config.size * config.size).fill(false);
  state.catCount = 0;
  state.status = "playing";
  state.mistakes = 0;
  state.hintsUsed = 0;
  state.history = [];
  state.solverCandidates = new Map();
  state.bestMs = null;
  state.topTimes = [];
  state.startedAt = Date.now();
  state.elapsedMs = 0;

  startTimer();

  renderBoard();
  updateStats();
  renderRules();
  renderLeaderboard();
  refreshBestScore().catch(() => {
    setStatus("Could not load highscores from IndexedDB.", "warn");
  });

  const modeLabel = config.mode === "campaign" ? `Campaign L${config.level}` : "Round";
  setStatus(`${modeLabel} ready. Place ${config.regionCount} cats.`, "");
}

function generatePuzzle(config) {
  const maxAttempts = 25;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rng = makeRng(`${config.seed}:attempt:${attempt}`);
    const solution = generatePlacement(config, rng);

    if (!solution || solution.length !== config.regionCount) {
      continue;
    }

    const regionOf = growRegions(config.size, config.regionCount, solution, rng, config.irregularity);
    const blocked = addBlockers(config.size, solution, config.blockers, rng);

    const puzzle = {
      size: config.size,
      regionCount: config.regionCount,
      regionOf,
      blocked,
      solution,
      colorOfRegion: assignRegionColors(config.regionCount, rng)
    };

    if (validatePuzzle(puzzle, config)) {
      return puzzle;
    }
  }

  return fallbackPuzzle(config);
}

function validatePuzzle(puzzle, config) {
  const total = puzzle.size * puzzle.size;

  for (let regionId = 0; regionId < puzzle.regionCount; regionId++) {
    let hasUnblocked = false;

    for (let i = 0; i < total; i++) {
      if (puzzle.regionOf[i] === regionId && !puzzle.blocked[i]) {
        hasUnblocked = true;
        break;
      }
    }

    if (!hasUnblocked) {
      return false;
    }
  }

  const solutions = solvePuzzle(puzzle, config, new Array(total).fill(false), 2);
  return solutions.length >= 1;
}

function fallbackPuzzle(config) {
  const rng = makeRng(config.seed + ":fallback");
  const solution = fallbackPlacement(config);
  const regionOf = growRegions(config.size, config.regionCount, solution, rng, 0.1);
  const blocked = addBlockers(config.size, solution, 0, rng);

  return {
    size: config.size,
    regionCount: config.regionCount,
    regionOf,
    blocked,
    solution,
    colorOfRegion: assignRegionColors(config.regionCount, rng)
  };
}

function generatePlacement(config, rng) {
  const size = config.size;
  const catCount = config.regionCount;
  const allowTouch = config.allowDiagonalTouch;

  for (let attempt = 0; attempt < 80; attempt++) {
    const rows = shuffle(range(size), rng)
      .slice(0, catCount)
      .sort((a, b) => a - b);

    const columns = shuffle(range(size), rng).slice(0, catCount);
    const usedColumns = new Set();
    const assignedColumns = [];

    function backtrack(i) {
      if (i === catCount) {
        return true;
      }

      const row = rows[i];
      const candidates = shuffle(columns.filter((c) => !usedColumns.has(c)), rng);

      for (const col of candidates) {
        if (!allowTouch && i > 0 && row - rows[i - 1] === 1 && Math.abs(col - assignedColumns[i - 1]) === 1) {
          continue;
        }

        usedColumns.add(col);
        assignedColumns.push(col);

        if (backtrack(i + 1)) {
          return true;
        }

        usedColumns.delete(col);
        assignedColumns.pop();
      }

      return false;
    }

    if (backtrack(0)) {
      return rows.map((row, i) => indexOf(row, assignedColumns[i], size));
    }
  }

  return fallbackPlacement(config);
}

function fallbackPlacement(config) {
  const size = config.size;
  const catCount = config.regionCount;
  const allowTouch = config.allowDiagonalTouch;
  const center = Math.floor(size / 2) * size + Math.floor(size / 2);

  if (catCount === 1) {
    return [center];
  }

  if (size === 3 && allowTouch) {
    if (catCount === 2) {
      return [0, 8];
    }

    if (catCount === 3) {
      return [0, 4, 8];
    }
  }

  if (size === 3 && !allowTouch && catCount === 2) {
    return [0, 8];
  }

  if (size >= 4) {
    const full = classicFallbackColumns(size).map((col, row) => indexOf(row, col, size));
    return full.slice(0, catCount);
  }

  return [center];
}

function classicFallbackColumns(size) {
  if (size === 4) {
    return [1, 3, 0, 2];
  }

  const evens = [];
  const odds = [];

  for (let c = 0; c < size; c++) {
    if (c % 2 === 0) {
      evens.push(c);
    } else {
      odds.push(c);
    }
  }

  return [...evens, ...odds];
}

function growRegions(size, regionCount, solution, rng, irregularity = 0) {
  const total = size * size;
  const regionOf = new Array(total).fill(-1);
  const sizes = new Array(regionCount).fill(1);
  const frontiers = Array.from({ length: regionCount }, () => new Set());

  solution.forEach((cell, regionId) => {
    regionOf[cell] = regionId;
  });

  function addFrontier(regionId, cell) {
    if (regionOf[cell] === -1) {
      frontiers[regionId].add(cell);
    }
  }

  solution.forEach((cell, regionId) => {
    for (const n of neighbors4(cell, size)) {
      addFrontier(regionId, n);
    }
  });

  const maxSize = Math.ceil(total / regionCount) + Math.floor(irregularity * 3);
  let unassigned = total - regionCount;

  while (unassigned > 0) {
    for (let regionId = 0; regionId < regionCount; regionId++) {
      for (const cell of frontiers[regionId]) {
        if (regionOf[cell] !== -1) {
          frontiers[regionId].delete(cell);
        }
      }
    }

    const eligible = [];

    for (let regionId = 0; regionId < regionCount; regionId++) {
      if (frontiers[regionId].size > 0 && sizes[regionId] < maxSize) {
        eligible.push(regionId);
      }
    }

    if (eligible.length === 0) {
      for (let regionId = 0; regionId < regionCount; regionId++) {
        if (frontiers[regionId].size > 0) {
          eligible.push(regionId);
        }
      }
    }

    if (eligible.length === 0) {
      for (let cell = 0; cell < total; cell++) {
        if (regionOf[cell] !== -1) continue;

        const adjacent = neighbors4(cell, size)
          .map((n) => regionOf[n])
          .filter((r) => r !== -1);

        const regionId = adjacent.length > 0 ? adjacent[0] : 0;

        regionOf[cell] = regionId;
        sizes[regionId]++;
        unassigned--;
      }

      break;
    }

    const balancedChance = Math.max(0.35, 0.85 - irregularity);
    let regionId;

    if (rng() < balancedChance) {
      eligible.sort((a, b) => sizes[a] - sizes[b]);
      regionId = eligible[0];
    } else {
      regionId = eligible[Math.floor(rng() * eligible.length)];
    }

    const options = [...frontiers[regionId]];
    const cell = options[Math.floor(rng() * options.length)];

    frontiers[regionId].delete(cell);
    regionOf[cell] = regionId;
    sizes[regionId]++;
    unassigned--;

    for (const n of neighbors4(cell, size)) {
      if (regionOf[n] === -1) {
        frontiers[regionId].add(n);
      }
    }
  }

  return regionOf;
}

function addBlockers(size, solution, blockerCount, rng) {
  const total = size * size;
  const blocked = new Array(total).fill(false);
  const solutionSet = new Set(solution);
  const candidates = [];

  for (let i = 0; i < total; i++) {
    if (!solutionSet.has(i)) {
      candidates.push(i);
    }
  }

  const shuffled = shuffle(candidates, rng);
  const safeCount = Math.min(blockerCount, shuffled.length);

  for (let i = 0; i < safeCount; i++) {
    blocked[shuffled[i]] = true;
  }

  return blocked;
}

function assignRegionColors(regionCount, rng) {
  return shuffle(REGION_PALETTE.slice(), rng).slice(0, regionCount);
}

function renderBoard() {
  const puzzle = state.puzzle;
  if (!puzzle) return;

  state.solverCandidates = state.solverMode ? computeSolverCandidates() : new Map();

  ui.board.innerHTML = "";
  ui.board.style.gridTemplateColumns = `repeat(${puzzle.size}, minmax(0, 1fr))`;

  for (let i = 0; i < puzzle.size * puzzle.size; i++) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";
    cell.setAttribute("role", "gridcell");
    cell.dataset.index = String(i);

    const regionId = puzzle.regionOf[i];
    const color = puzzle.colorOfRegion[regionId];
    cell.style.backgroundColor = color;

    if (puzzle.blocked[i]) {
      cell.classList.add("blocked");
      cell.setAttribute("aria-label", `Blocked cell, region ${regionId + 1}`);
    } else {
      cell.setAttribute("aria-label", `Empty cell, region ${regionId + 1}`);
    }

    if (state.cats[i]) {
      cell.classList.add("cat");
      cell.setAttribute("aria-label", `Cat in region ${regionId + 1}`);
    }

    if (!puzzle.blocked[i] && !state.cats[i] && state.solverMode && state.solverCandidates.has(i)) {
      cell.classList.add("candidate");
      cell.dataset.cand = String(state.solverCandidates.get(i));
      cell.setAttribute("aria-label", `Candidate cell, region ${regionId + 1}`);
    }

    cell.addEventListener("click", () => onCellClick(i));
    ui.board.append(cell);
  }
}

function onCellClick(index) {
  if (state.status === "won") {
    return;
  }

  if (state.cats[index]) {
    state.cats[index] = false;
    state.catCount--;
    state.history.push({ type: "remove", index });
    renderBoard();
    updateStats();
    setStatus("Cat removed.", "");
    return;
  }

  const check = canPlaceCat(index, state);
  if (!check.ok) {
    state.mistakes++;
    updateStats();
    setStatus(`Cannot place cat: ${explainReason(check.reason)}.`, "warn");
    return;
  }

  state.cats[index] = true;
  state.catCount++;
  state.history.push({ type: "place", index });

  renderBoard();
  updateStats();

  if (checkWin(state)) {
    state.status = "won";
    state.elapsedMs = Date.now() - state.startedAt;
    stopTimer();
    updateStats();
    setStatus(`You solved it in ${formatDuration(state.elapsedMs)}. Purrfect!`, "win");
    handleSolvedGame().catch(() => {
      setStatus("Solved, but could not persist progress.", "warn");
    });

    return;
  }

  setStatus("Cat placed.", "");
}

function canPlaceCat(cell, currentState) {
  const puzzle = currentState.puzzle;
  const config = currentState.config;
  const size = puzzle.size;

  if (puzzle.blocked[cell]) {
    return { ok: false, reason: "blocked" };
  }

  const regionId = puzzle.regionOf[cell];
  const r = rowOf(cell, size);
  const c = colOf(cell, size);

  for (let i = 0; i < currentState.cats.length; i++) {
    if (!currentState.cats[i]) continue;

    if (puzzle.regionOf[i] === regionId) {
      return { ok: false, reason: "region" };
    }

    if (rowOf(i, size) === r) {
      return { ok: false, reason: "row" };
    }

    if (colOf(i, size) === c) {
      return { ok: false, reason: "column" };
    }

    if (!config.allowDiagonalTouch) {
      const dr = Math.abs(rowOf(i, size) - r);
      const dc = Math.abs(colOf(i, size) - c);

      if (dr <= 1 && dc <= 1) {
        return { ok: false, reason: "touching" };
      }
    }
  }

  return { ok: true };
}

function checkBoard(cats, puzzle, config) {
  const size = puzzle.size;
  const total = size * size;

  const errors = [];
  const regionCounts = new Array(puzzle.regionCount).fill(0);
  const rowCounts = new Array(size).fill(0);
  const colCounts = new Array(size).fill(0);
  const catCells = [];

  for (let i = 0; i < total; i++) {
    if (!cats[i]) continue;

    catCells.push(i);

    if (puzzle.blocked[i]) {
      errors.push("Cat placed on blocked cell");
    }

    const regionId = puzzle.regionOf[i];
    const r = rowOf(i, size);
    const c = colOf(i, size);

    regionCounts[regionId]++;
    rowCounts[r]++;
    colCounts[c]++;
  }

  for (let regionId = 0; regionId < puzzle.regionCount; regionId++) {
    if (regionCounts[regionId] !== 1) {
      errors.push(`Region ${regionId + 1} has ${regionCounts[regionId]} cats`);
    }
  }

  for (let r = 0; r < size; r++) {
    if (rowCounts[r] > 1) {
      errors.push(`Row ${r + 1} has more than one cat`);
    }
  }

  for (let c = 0; c < size; c++) {
    if (colCounts[c] > 1) {
      errors.push(`Column ${c + 1} has more than one cat`);
    }
  }

  if (!config.allowDiagonalTouch) {
    for (let i = 0; i < catCells.length; i++) {
      for (let j = i + 1; j < catCells.length; j++) {
        const a = catCells[i];
        const b = catCells[j];

        const dr = Math.abs(rowOf(a, size) - rowOf(b, size));
        const dc = Math.abs(colOf(a, size) - colOf(b, size));

        if (dr <= 1 && dc <= 1) {
          errors.push("Cats are touching");
          i = catCells.length;
          break;
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    regionCounts,
    rowCounts,
    colCounts,
    catCells
  };
}

function checkWin(currentState) {
  if (currentState.catCount !== currentState.config.regionCount) {
    return false;
  }

  const result = checkBoard(currentState.cats, currentState.puzzle, currentState.config);
  return result.valid;
}

function checkCurrentBoard() {
  const result = checkBoard(state.cats, state.puzzle, state.config);

  if (result.valid && state.catCount === state.config.regionCount) {
    state.status = "won";
    state.elapsedMs = Date.now() - state.startedAt;
    stopTimer();
    updateStats();
    setStatus(`All constraints pass. You win in ${formatDuration(state.elapsedMs)}.`, "win");
    handleSolvedGame().catch(() => {
      setStatus("Solved, but could not persist progress.", "warn");
    });
    return;
  }

  if (result.errors.length === 0) {
    setStatus("So far valid. Keep placing cats.", "");
    return;
  }

  setStatus(result.errors[0], "warn");
}

function renderRules() {
  const config = state.config;
  const lines = [];

  if (config.regionCount === 1) {
    lines.push("Place one cat in the single region.");
  } else {
    lines.push(`Place ${config.regionCount} cats.`);
  }

  lines.push("Each color/region needs exactly one cat.");
  lines.push("No row or column may have more than one cat.");

  if (config.allowDiagonalTouch && config.size === 3) {
    lines.push("On this tiny board, diagonal touching is allowed.");
  } else {
    lines.push("Cats cannot touch, even diagonally.");
  }

  ui.rulesList.innerHTML = "";
  for (const line of lines) {
    const li = document.createElement("li");
    li.textContent = line;
    ui.rulesList.append(li);
  }
}

function updateStats() {
  ui.statMode.textContent = state.config.mode === "campaign" ? `Campaign L${state.config.level}` : "Round";
  ui.statSize.textContent = `${state.config.size}x${state.config.size}`;
  ui.statCats.textContent = String(state.config.regionCount);
  ui.statPlaced.textContent = String(state.catCount);
  ui.statMistakes.textContent = String(state.mistakes);
  ui.statTime.textContent = formatDuration(state.status === "won" ? state.elapsedMs : Date.now() - state.startedAt);
  ui.statBest.textContent = state.bestMs === null ? "-" : formatDuration(state.bestMs);
  ui.statUnlocked.textContent = String(state.campaignUnlockedLevel);
}

function setStatus(message, tone) {
  ui.status.textContent = message;
  ui.status.classList.remove("win", "warn");
  if (tone) {
    ui.status.classList.add(tone);
  }
}

function explainReason(reason) {
  switch (reason) {
    case "blocked":
      return "blocked cell";
    case "region":
      return "region already has a cat";
    case "row":
      return "row already has a cat";
    case "column":
      return "column already has a cat";
    case "touching":
      return "cats would touch";
    default:
      return "rule violation";
  }
}

function giveHint() {
  if (state.status === "won") {
    setStatus("Already solved.", "");
    return;
  }

  const candidates = [];

  for (const cell of state.puzzle.solution) {
    if (!state.cats[cell]) {
      candidates.push(cell);
    }
  }

  if (candidates.length === 0) {
    setStatus("No hint needed right now.", "");
    return;
  }

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const check = canPlaceCat(pick, state);

  if (!check.ok) {
    setStatus("Hint blocked by current placements. Try reset/check.", "warn");
    return;
  }

  state.cats[pick] = true;
  state.catCount++;
  state.hintsUsed++;
  renderBoard();
  updateStats();

  if (checkWin(state)) {
    state.status = "won";
    state.elapsedMs = Date.now() - state.startedAt;
    stopTimer();
    setStatus(`Hint placed the final cat. Solved in ${formatDuration(state.elapsedMs)}.`, "win");
    updateStats();
    handleSolvedGame().catch(() => {
      setStatus("Solved, but could not persist progress.", "warn");
    });
  } else {
    setStatus("Hint: one cat placed.", "");
  }
}

function computeSolverCandidates() {
  const puzzle = state.puzzle;
  const config = state.config;
  const total = puzzle.size * puzzle.size;
  const regionHasCat = new Array(puzzle.regionCount).fill(false);
  const regionCounts = new Array(puzzle.regionCount).fill(0);
  const candidateCells = [];

  for (let i = 0; i < total; i++) {
    if (state.cats[i]) {
      regionHasCat[puzzle.regionOf[i]] = true;
    }
  }

  for (let i = 0; i < total; i++) {
    if (puzzle.blocked[i] || state.cats[i]) {
      continue;
    }

    const regionId = puzzle.regionOf[i];
    if (regionHasCat[regionId]) {
      continue;
    }

    if (!canPlaceCat(i, state).ok) {
      continue;
    }

    const presetCats = state.cats.slice();
    presetCats[i] = true;

    if (solvePuzzle(puzzle, config, presetCats, 1).length > 0) {
      regionCounts[regionId]++;
      candidateCells.push(i);
    }
  }

  const map = new Map();
  for (const cell of candidateCells) {
    const regionId = puzzle.regionOf[cell];
    map.set(cell, regionCounts[regionId]);
  }

  return map;
}

function startTimer() {
  stopTimer();
  state.timerId = setInterval(() => {
    if (state.status !== "won") {
      state.elapsedMs = Date.now() - state.startedAt;
      updateStats();
    }
  }, 1000);
}

function stopTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

async function handleSolvedGame() {
  await saveBestScoreForCurrentConfig(state.elapsedMs);

  if (state.config.mode === "campaign" && state.config.level < 100) {
    const newUnlocked = Math.max(state.campaignUnlockedLevel, state.config.level + 1);
    if (newUnlocked !== state.campaignUnlockedLevel) {
      state.campaignUnlockedLevel = newUnlocked;
      await setMeta("campaignUnlockedLevel", newUnlocked);
      ui.levelInput.value = String(newUnlocked);
      updateStats();
    }
  }

  await refreshBestScore();
}

function buildScoreKey(config) {
  if (config.mode === "campaign") {
    return `campaign:${config.level}`;
  }

  return `round:${config.size}:${config.regionCount}:${config.allowDiagonalTouch ? 1 : 0}:${config.blockers}`;
}

async function refreshBestScore() {
  if (!state.config) {
    return;
  }

  const key = buildScoreKey(state.config);
  const record = await getScore(key);
  state.bestMs = record ? Number(record.bestMs) : null;
  state.topTimes = record && Array.isArray(record.topTimes) ? record.topTimes.slice(0, 5).map(Number) : [];
  updateStats();
  renderLeaderboard();
}

async function saveBestScoreForCurrentConfig(elapsedMs) {
  if (!state.config) {
    return;
  }

  const key = buildScoreKey(state.config);
  const current = await getScore(key);
  const previous = current && Array.isArray(current.topTimes) ? current.topTimes.map(Number) : [];
  const nextTopTimes = previous
    .concat(elapsedMs)
    .filter((v) => Number.isFinite(v) && v >= 0)
    .sort((a, b) => a - b)
    .slice(0, 5);
  const bestMs = nextTopTimes.length > 0 ? nextTopTimes[0] : elapsedMs;
  const attempts = current && Number.isFinite(Number(current.attempts)) ? Number(current.attempts) + 1 : 1;

  await putScore({
    key,
    mode: state.config.mode,
    level: state.config.level,
    size: state.config.size,
    regionCount: state.config.regionCount,
    bestMs,
    topTimes: nextTopTimes,
    attempts,
    updatedAt: Date.now()
  });
}

function getLeaderboardLabel(config) {
  if (config.mode === "campaign") {
    return `Campaign level ${config.level}`;
  }

  return `Round ${config.size}x${config.size}, ${config.regionCount} cats`;
}

function renderLeaderboard() {
  if (!state.config || !ui.leaderboardList || !ui.leaderboardLabel) {
    return;
  }

  ui.leaderboardLabel.textContent = getLeaderboardLabel(state.config);
  ui.leaderboardList.innerHTML = "";

  if (state.topTimes.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No completed runs yet";
    ui.leaderboardList.append(li);
    return;
  }

  for (const time of state.topTimes) {
    const li = document.createElement("li");
    li.textContent = formatDuration(time);
    ui.leaderboardList.append(li);
  }
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function initDatabase() {
  if (dbState.promise) {
    return dbState.promise;
  }

  dbState.promise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(STORE_SCORES)) {
        db.createObjectStore(STORE_SCORES, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB unavailable"));
  });

  return dbState.promise;
}

async function readStore(storeName, key) {
  const db = await initDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("Read failed"));
  });
}

async function writeStore(storeName, value) {
  const db = await initDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.put(value);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("Write failed"));
  });
}

async function getMeta(key, fallbackValue) {
  const row = await readStore(STORE_META, key);
  return row ? row.value : fallbackValue;
}

async function setMeta(key, value) {
  await writeStore(STORE_META, { key, value });
}

async function getScore(key) {
  return readStore(STORE_SCORES, key);
}

async function putScore(record) {
  await writeStore(STORE_SCORES, record);
}

function solvePuzzle(puzzle, config, presetCats, maxSolutions = 1) {
  const size = puzzle.size;
  const total = size * size;
  const solutionSet = [];

  const regionCells = Array.from({ length: puzzle.regionCount }, () => []);
  for (let i = 0; i < total; i++) {
    if (!puzzle.blocked[i]) {
      regionCells[puzzle.regionOf[i]].push(i);
    }
  }

  const fixedByRegion = new Array(puzzle.regionCount).fill(null);
  const usedRows = new Set();
  const usedCols = new Set();
  const placed = [];

  for (let i = 0; i < total; i++) {
    if (!presetCats[i]) continue;

    const regionId = puzzle.regionOf[i];
    const r = rowOf(i, size);
    const c = colOf(i, size);

    if (fixedByRegion[regionId] !== null) {
      return [];
    }

    if (usedRows.has(r) || usedCols.has(c)) {
      return [];
    }

    if (!config.allowDiagonalTouch) {
      for (const other of placed) {
        const dr = Math.abs(rowOf(other, size) - r);
        const dc = Math.abs(colOf(other, size) - c);
        if (dr <= 1 && dc <= 1) {
          return [];
        }
      }
    }

    fixedByRegion[regionId] = i;
    usedRows.add(r);
    usedCols.add(c);
    placed.push(i);
  }

  const regionOrder = range(puzzle.regionCount).sort((a, b) => regionCells[a].length - regionCells[b].length);

  function canPlaceAgainstPlaced(cell) {
    const r = rowOf(cell, size);
    const c = colOf(cell, size);

    if (usedRows.has(r) || usedCols.has(c)) {
      return false;
    }

    if (!config.allowDiagonalTouch) {
      for (const other of placed) {
        const dr = Math.abs(rowOf(other, size) - r);
        const dc = Math.abs(colOf(other, size) - c);
        if (dr <= 1 && dc <= 1) {
          return false;
        }
      }
    }

    return true;
  }

  function backtrack(idx) {
    if (solutionSet.length >= maxSolutions) {
      return;
    }

    if (idx === regionOrder.length) {
      solutionSet.push(placed.slice());
      return;
    }

    const regionId = regionOrder[idx];

    if (fixedByRegion[regionId] !== null) {
      backtrack(idx + 1);
      return;
    }

    for (const cell of regionCells[regionId]) {
      if (!canPlaceAgainstPlaced(cell)) continue;

      const r = rowOf(cell, size);
      const c = colOf(cell, size);

      usedRows.add(r);
      usedCols.add(c);
      placed.push(cell);

      backtrack(idx + 1);

      placed.pop();
      usedRows.delete(r);
      usedCols.delete(c);
    }
  }

  backtrack(0);
  return solutionSet;
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        // Service worker support is optional in development.
      });
    });
  }
}

function makeRng(seed) {
  let h = 1779033703 ^ seed.length;

  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }

  return function next() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }

  return arr;
}

function range(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(i);
  }
  return out;
}

function rowOf(index, size) {
  return Math.floor(index / size);
}

function colOf(index, size) {
  return index % size;
}

function indexOf(row, col, size) {
  return row * size + col;
}

function neighbors4(index, size) {
  const r = rowOf(index, size);
  const c = colOf(index, size);
  const out = [];

  if (r > 0) out.push(indexOf(r - 1, c, size));
  if (r < size - 1) out.push(indexOf(r + 1, c, size));
  if (c > 0) out.push(indexOf(r, c - 1, size));
  if (c < size - 1) out.push(indexOf(r, c + 1, size));

  return out;
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}
