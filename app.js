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

const DB_NAME = "purrrfect_regions_db";
const DB_VERSION = 1;
const STORE_META = "meta";
const STORE_SCORES = "scores";

const dbState = {
  promise: null
};

const state = {
  config: null,
  puzzle: null,
  blockerOf: [],
  cats: [],
  catCount: 0,
  status: "playing",
  mistakes: 0,
  hintsUsed: 0,
  checksUsed: 0,
  history: [],
  mode: "round",
  startedAt: 0,
  elapsedMs: 0,
  timerId: null,
  bestMs: null,
  topTimes: [],
  earnedStars: 0,
  campaignUnlockedLevel: 1,
  totalCampaignStars: 0,
  solverMode: false,
  solverCandidates: new Map(),
  touchHighlightCells: [],
  settingsOpen: false,
  infoOpen: false,
  statsOpen: false,
  autoAdvanceTimerId: null,
  selectedRoundSize: 5,
  selectedRoundSingletons: 2,
  selectedRoundDifficulty: "normal",
  selectedRoundModifiers: {
    maxHints: null,
    maxChecks: null,
    solverDisabled: false
  },
  selectedCampaignLevel: 1
};

const ui = {
  board: document.getElementById("board"),
  status: document.getElementById("status"),
  nextAutoBtn: document.getElementById("next-auto-btn"),
  newGridBtn: document.getElementById("new-grid-btn"),
  statMode: document.getElementById("stat-mode"),
  statSize: document.getElementById("stat-size"),
  statCats: document.getElementById("stat-cats"),
  statPlaced: document.getElementById("stat-placed"),
  statMistakes: document.getElementById("stat-mistakes"),
  statTime: document.getElementById("stat-time"),
  statBest: document.getElementById("stat-best"),
  statUnlocked: document.getElementById("stat-unlocked"),
  statTotalStars: document.getElementById("stat-total-stars"),
  statStars: document.getElementById("stat-stars"),
  campaignBadges: document.getElementById("campaign-badges"),
  campaignProgressFill: document.getElementById("campaign-progress-fill"),
  campaignProgressText: document.getElementById("campaign-progress-text"),
  starsStrip: document.getElementById("stars-strip"),
  rulesList: document.getElementById("rules-list"),
  leaderboardLabel: document.getElementById("leaderboard-label"),
  leaderboardList: document.getElementById("leaderboard-list"),

  modeRound: document.getElementById("mode-round"),
  modeCampaign: document.getElementById("mode-campaign"),
  toggleSettings: document.getElementById("toggle-settings"),
  toggleInfo: document.getElementById("toggle-info"),
  toggleStats: document.getElementById("toggle-stats"),
  closeSettings: document.getElementById("close-settings"),
  closeInfo: document.getElementById("close-info"),
  closeStats: document.getElementById("close-stats"),
  settingsPanel: document.getElementById("settings-panel"),
  statsPanel: document.getElementById("stats-panel"),
  rulesPanel: document.getElementById("rules-panel"),
  roundControls: document.getElementById("round-controls"),
  campaignControls: document.getElementById("campaign-controls"),

  sizeOptions: document.getElementById("size-options"),
  difficultyOptions: document.getElementById("difficulty-options"),
  modifierOptions: document.getElementById("modifier-options"),
  difficultySlider: document.getElementById("difficulty-slider"),
  difficultyHelp: document.getElementById("difficulty-help"),
  difficultyReadout: document.getElementById("difficulty-readout"),
  newRoundBtn: document.getElementById("new-round"),

  levelDownBtn: document.getElementById("level-down"),
  levelUpBtn: document.getElementById("level-up"),
  levelValue: document.getElementById("level-value"),
  campaignLockNote: document.getElementById("campaign-lock-note"),
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
  buildRoundPickers();
  bindEvents();
  registerServiceWorker();

  await initDatabase();
  const storedLevel = await getMeta("campaignUnlockedLevel", 1);
  state.campaignUnlockedLevel = clamp(Number(storedLevel || 1), 1, 100);
  state.totalCampaignStars = await getTotalCampaignStars();
  state.selectedCampaignLevel = Math.min(state.campaignUnlockedLevel, getMaxAccessibleCampaignLevel());
  ui.statUnlocked.textContent = String(state.campaignUnlockedLevel);
  ui.statTotalStars.textContent = String(state.totalCampaignStars);
  updateLevelDisplay();
  renderCampaignBadges();
  renderPanelVisibility();

  loadRound();
}

function buildRoundPickers() {
  ui.sizeOptions.innerHTML = "";

  for (let size = 2; size <= 9; size++) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-btn";
    button.textContent = `${size}x${size}`;
    button.dataset.size = String(size);
    button.addEventListener("click", () => {
      state.selectedRoundSize = size;
      state.selectedRoundSingletons = clamp(
        state.selectedRoundSingletons,
        0,
        getMaxSingletonRegions(size)
      );
      syncRoundDifficultySlider();
      renderRoundPickerState();
    });
    ui.sizeOptions.append(button);
  }

  state.selectedRoundSize = 5;
  state.selectedRoundSingletons = getPresetSingletons(state.selectedRoundSize, "normal");
  state.selectedRoundDifficulty = "normal";
  syncDifficultyButtons();
  syncModifierButtons();
  syncRoundDifficultySlider();
  renderRoundPickerState();
}

function syncModifierButtons() {
  ui.modifierOptions.innerHTML = "";

  const options = [
    { key: "hint", label: "💡 1 Hint" },
    { key: "check", label: "✅ 2 Checks" },
    { key: "solver", label: "🚫 Solver" }
  ];

  for (const option of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-btn";
    button.textContent = option.label;
    button.dataset.modifier = option.key;
    button.addEventListener("click", () => {
      toggleRoundModifier(option.key);
      renderRoundPickerState();
    });
    ui.modifierOptions.append(button);
  }
}

function bindEvents() {
  ui.modeRound.addEventListener("click", () => {
    state.mode = "round";
    renderMode();
  });

  ui.modeCampaign.addEventListener("click", () => {
    state.mode = "campaign";
    renderMode();
  });

  ui.toggleSettings.addEventListener("click", () => {
    const next = !state.settingsOpen;
    closeAllSidebars();
    state.settingsOpen = next;
    renderPanelVisibility();
  });

  ui.closeSettings.addEventListener("click", () => {
    state.settingsOpen = false;
    renderPanelVisibility();
  });

  ui.toggleInfo.addEventListener("click", () => {
    const next = !state.infoOpen;
    closeAllSidebars();
    state.infoOpen = next;
    renderPanelVisibility();
  });

  ui.closeInfo.addEventListener("click", () => {
    state.infoOpen = false;
    renderPanelVisibility();
  });

  ui.toggleStats.addEventListener("click", () => {
    const next = !state.statsOpen;
    closeAllSidebars();
    state.statsOpen = next;
    renderPanelVisibility();
  });

  ui.closeStats.addEventListener("click", () => {
    state.statsOpen = false;
    renderPanelVisibility();
  });

  ui.newRoundBtn.addEventListener("click", () => {
    loadRound();
  });

  ui.difficultySlider.addEventListener("input", () => {
    state.selectedRoundSingletons = clamp(
      Number(ui.difficultySlider.value),
      0,
      getMaxSingletonRegions(state.selectedRoundSize)
    );
    state.selectedRoundDifficulty = getDifficultyFromSingletons(
      state.selectedRoundSize,
      state.selectedRoundSingletons
    );
    renderRoundPickerState();
  });

  ui.loadLevelBtn.addEventListener("click", () => {
    const level = clamp(state.selectedCampaignLevel, 1, getMaxAccessibleCampaignLevel());
    state.selectedCampaignLevel = level;
    updateLevelDisplay();
    loadCampaignLevel(level);
  });

  ui.nextLevelBtn.addEventListener("click", () => {
    const current = clamp(state.selectedCampaignLevel, 1, getMaxAccessibleCampaignLevel());
    const next = clamp(current + 1, 1, getMaxAccessibleCampaignLevel());
    state.selectedCampaignLevel = next;
    updateLevelDisplay();
    loadCampaignLevel(next);
  });

  ui.levelDownBtn.addEventListener("click", () => {
    state.selectedCampaignLevel = clamp(state.selectedCampaignLevel - 1, 1, getMaxAccessibleCampaignLevel());
    updateLevelDisplay();
  });

  ui.levelUpBtn.addEventListener("click", () => {
    state.selectedCampaignLevel = clamp(state.selectedCampaignLevel + 1, 1, getMaxAccessibleCampaignLevel());
    updateLevelDisplay();
  });

  ui.hintBtn.addEventListener("click", () => {
    giveHint();
  });

  ui.solverBtn.addEventListener("click", () => {
    if (state.config.modifiers.solverDisabled) {
      setStatus("Solver is disabled on this level.", "warn");
      return;
    }

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
    clearAutoAdvance();
    state.cats = new Array(state.puzzle.size * state.puzzle.size).fill(false);
    state.blockerOf = state.puzzle.blocked.slice();
    state.catCount = 0;
    state.status = "playing";
    state.hintsUsed = 0;
    state.checksUsed = 0;
    state.mistakes = 0;
    state.solverCandidates = new Map();
    renderBoard();
    updateStats();
    setStatus("Board reset.", "");
  });

  ui.nextAutoBtn.addEventListener("click", () => {
    advanceToNextCampaignLevel();
  });

  ui.newGridBtn.addEventListener("click", () => {
    loadRound();
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
    const level = clamp(state.selectedCampaignLevel, 1, getMaxAccessibleCampaignLevel());
    state.selectedCampaignLevel = level;
    updateLevelDisplay();
    loadCampaignLevel(level);
  }
}

function getRequiredStarsForLevel(level) {
  if (level <= 8) return 0;
  if (level <= 18) return 3;
  if (level <= 32) return 9;
  if (level <= 48) return 18;
  if (level <= 66) return 30;
  if (level <= 84) return 45;
  return 60;
}

function getCampaignBands() {
  return [
    { key: "sprout", icon: "🌱", label: "Sprout", range: "L1-8", requiredStars: 0, reward: "Tiny boards" },
    { key: "rookie", icon: "🐾", label: "Rookie", range: "L9-18", requiredStars: 3, reward: "4x4 campaign" },
    { key: "pouncer", icon: "🧩", label: "Pouncer", range: "L19-32", requiredStars: 9, reward: "5x5 campaign" },
    { key: "hunter", icon: "🧱", label: "Hunter", range: "L33-48", requiredStars: 18, reward: "Solid blockers" },
    { key: "shadow", icon: "🌙", label: "Shadow", range: "L49-66", requiredStars: 30, reward: "Bigger boards" },
    { key: "oracle", icon: "🔮", label: "Oracle", range: "L67-84", requiredStars: 45, reward: "Fragile blockers" },
    { key: "mythic", icon: "👑", label: "Mythic", range: "L85-100", requiredStars: 60, reward: "No-solver endgame" }
  ];
}

function getMaxAccessibleCampaignLevel() {
  let gatedLevel = 1;

  for (let level = 1; level <= state.campaignUnlockedLevel; level++) {
    if (state.totalCampaignStars >= getRequiredStarsForLevel(level)) {
      gatedLevel = level;
    } else {
      break;
    }
  }

  return gatedLevel;
}

function renderPanelVisibility() {
  ui.settingsPanel.classList.toggle("open", state.settingsOpen);
  ui.rulesPanel.classList.toggle("open", state.infoOpen);
  ui.statsPanel.classList.toggle("open", state.statsOpen);

  ui.toggleSettings.classList.toggle("active", state.settingsOpen);
  ui.toggleInfo.classList.toggle("active", state.infoOpen);
  ui.toggleStats.classList.toggle("active", state.statsOpen);
}

function closeAllSidebars() {
  state.settingsOpen = false;
  state.infoOpen = false;
  state.statsOpen = false;
}

function updateLevelDisplay() {
  const maxAccessible = getMaxAccessibleCampaignLevel();
  state.selectedCampaignLevel = clamp(state.selectedCampaignLevel, 1, Math.max(1, maxAccessible));
  ui.levelValue.textContent = String(state.selectedCampaignLevel);
  const requiredStars = getRequiredStarsForLevel(state.selectedCampaignLevel);
  ui.campaignLockNote.textContent = state.totalCampaignStars >= requiredStars
    ? `You have ${state.totalCampaignStars} stars. This level is unlocked.`
    : `Need ${requiredStars} stars. You currently have ${state.totalCampaignStars}.`;
}

function toggleRoundModifier(key) {
  if (key === "hint") {
    state.selectedRoundModifiers.maxHints = state.selectedRoundModifiers.maxHints === 1 ? null : 1;
    return;
  }

  if (key === "check") {
    state.selectedRoundModifiers.maxChecks = state.selectedRoundModifiers.maxChecks === 2 ? null : 2;
    return;
  }

  if (key === "solver") {
    state.selectedRoundModifiers.solverDisabled = !state.selectedRoundModifiers.solverDisabled;
  }
}

function syncDifficultyButtons() {
  ui.difficultyOptions.innerHTML = "";

  const options = [
    { key: "easy", label: "🐣 Easy" },
    { key: "normal", label: "🐾 Normal" },
    { key: "hard", label: "🦁 Hard" }
  ];

  for (const option of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-btn";
    button.textContent = option.label;
    button.dataset.difficulty = option.key;
    button.addEventListener("click", () => {
      applyRoundDifficultyPreset(option.key);
      renderRoundPickerState();
    });
    ui.difficultyOptions.append(button);
  }
}

function applyRoundDifficultyPreset(preset) {
  state.selectedRoundDifficulty = preset;
  state.selectedRoundSingletons = getPresetSingletons(state.selectedRoundSize, preset);
  syncRoundDifficultySlider();
}

function syncRoundDifficultySlider() {
  const maxSingletons = getMaxSingletonRegions(state.selectedRoundSize);
  ui.difficultySlider.max = String(maxSingletons);
  state.selectedRoundSingletons = clamp(state.selectedRoundSingletons, 0, maxSingletons);
  ui.difficultySlider.value = String(state.selectedRoundSingletons);
  state.selectedRoundDifficulty = getDifficultyFromSingletons(state.selectedRoundSize, state.selectedRoundSingletons);
  ui.difficultyHelp.textContent = `Tiny one-cell regions can go from 0 to ${maxSingletons} on this board.`;
  ui.difficultyReadout.textContent = `${state.selectedRoundSingletons} tiny region${state.selectedRoundSingletons === 1 ? "" : "s"}`;
}

function renderRoundPickerState() {
  for (const el of ui.sizeOptions.querySelectorAll(".option-btn")) {
    const isActive = Number(el.dataset.size) === state.selectedRoundSize;
    el.classList.toggle("active", isActive);
  }

  for (const el of ui.difficultyOptions.querySelectorAll(".option-btn")) {
    const isActive = el.dataset.difficulty === state.selectedRoundDifficulty;
    el.classList.toggle("active", isActive);
  }

  for (const el of ui.modifierOptions.querySelectorAll(".option-btn")) {
    const key = el.dataset.modifier;
    const isActive = (key === "hint" && state.selectedRoundModifiers.maxHints === 1)
      || (key === "check" && state.selectedRoundModifiers.maxChecks === 2)
      || (key === "solver" && state.selectedRoundModifiers.solverDisabled);
    el.classList.toggle("active", isActive);
  }

  syncRoundDifficultySlider();
}

function loadRound() {
  const size = state.selectedRoundSize;
  const config = buildRoundConfig(size, state.selectedRoundSingletons);
  startGame(config);
}

function loadCampaignLevel(level) {
  const safeLevel = clamp(level, 1, getMaxAccessibleCampaignLevel());
  state.selectedCampaignLevel = safeLevel;
  updateLevelDisplay();
  const config = getCampaignConfig(safeLevel);
  startGame(config);

  if (level > getMaxAccessibleCampaignLevel()) {
    setStatus(`Level ${level} is locked. Loaded level ${safeLevel}.`, "warn");
  }
}

function buildRoundConfig(size, singletonCount) {
  const normalizedSize = clamp(size, 2, 9);
  const maxSingletons = getMaxSingletonRegions(normalizedSize);
  const normalizedSingletonCount = clamp(singletonCount, 0, maxSingletons);
  const difficulty = getDifficultyFromSingletons(normalizedSize, normalizedSingletonCount);
  const singletonBias = maxSingletons === 0 ? 0 : normalizedSingletonCount / maxSingletons;
  const irregularity = 0.18 + (1 - singletonBias) * 0.42;
  const shapeStyle = getShapeStyleForDifficulty(difficulty);

  let allowDiagonalTouch = false;
  if (normalizedSize <= 3) {
    allowDiagonalTouch = true;
  }

  return normalizeConfig({
    mode: "round",
    level: null,
    difficulty,
    size: normalizedSize,
    regionCount: normalizedSize,
    modifiers: { ...state.selectedRoundModifiers },
    allowDiagonalTouch,
    blockers: 0,
    blockerMode: "none",
    shapeStyle,
    irregularity,
    singletonBias,
    singletonCount: normalizedSingletonCount,
    seed: "round:" + Math.random().toString(36).slice(2)
  });
}

function getCampaignConfig(level) {
  const phases = [
    { start: 1, end: 3, size: 2, allowTouch: true, minBlockers: 0, maxBlockers: 0 },
    { start: 4, end: 8, size: 3, allowTouch: true, minBlockers: 0, maxBlockers: 0 },

    { start: 9, end: 18, size: 4, allowTouch: false, minBlockers: 0, maxBlockers: 1 },
    { start: 19, end: 32, size: 5, allowTouch: false, minBlockers: 0, maxBlockers: 2 },
    { start: 33, end: 48, size: 6, allowTouch: false, minBlockers: 0, maxBlockers: 3 },
    { start: 49, end: 66, size: 7, allowTouch: false, minBlockers: 1, maxBlockers: 3 },
    { start: 67, end: 84, size: 8, allowTouch: false, minBlockers: 1, maxBlockers: 4 },
    { start: 85, end: 100, size: 9, allowTouch: false, minBlockers: 2, maxBlockers: 5 }
  ];

  const safeLevel = clamp(level, 1, 100);
  const phase = phases.find((p) => safeLevel >= p.start && safeLevel <= p.end);
  const span = phase.end - phase.start;
  const t = span === 0 ? 1 : (safeLevel - phase.start) / span;
  const blockers = Math.round(phase.minBlockers + t * (phase.maxBlockers - phase.minBlockers));
  const difficulty = safeLevel <= 8 ? "easy" : safeLevel <= 55 ? "normal" : "hard";
  const profile = getDifficultyProfile(difficulty, safeLevel);
  const singletonCount = getCampaignSingletonCount(phase.size, safeLevel, difficulty, t);
  const blockerMode = getBlockerModeForLevel(safeLevel);
  const shapeStyle = getCampaignShapeStyle(safeLevel);
  const modifiers = getModifiersForLevel(safeLevel);

  return normalizeConfig({
    mode: "campaign",
    level: safeLevel,
    difficulty,
    size: phase.size,
    regionCount: phase.size,
    modifiers,
    allowDiagonalTouch: phase.allowTouch,
    blockers,
    blockerMode,
    shapeStyle,
    irregularity: profile.irregularity,
    singletonBias: getMaxSingletonRegions(phase.size) === 0 ? 0 : singletonCount / getMaxSingletonRegions(phase.size),
    singletonCount,
    seed: "campaign:" + safeLevel
  });
}

function getModifiersForLevel(level) {
  if (level < 35) {
    return { maxHints: null, maxChecks: null, solverDisabled: false };
  }

  if (level < 60) {
    return { maxHints: 1, maxChecks: null, solverDisabled: false };
  }

  if (level < 80) {
    return { maxHints: 1, maxChecks: 3, solverDisabled: false };
  }

  if (level < 90) {
    return { maxHints: 0, maxChecks: 2, solverDisabled: false };
  }

  return { maxHints: 0, maxChecks: 1, solverDisabled: true };
}

function getCampaignSingletonCount(size, level, difficulty, t) {
  const maxSingletons = getMaxSingletonRegions(size);

  if (difficulty === "easy") {
    return Math.max(1, maxSingletons - Math.round(t));
  }

  if (difficulty === "hard") {
    return Math.max(0, Math.round(maxSingletons * 0.2 - t));
  }

  return Math.max(1, Math.round(maxSingletons * 0.5 - t * 0.5));
}

function getBlockerModeForLevel(level) {
  if (level < 40) return "none";
  if (level < 75) return "solid";
  return "mixed";
}

function getShapeStyleForDifficulty(difficulty) {
  if (difficulty === "easy") return "chunky";
  if (difficulty === "hard") return "snaky";
  return "organic";
}

function getCampaignShapeStyle(level) {
  if (level < 25) return "chunky";
  if (level < 60) return "organic";
  return level % 2 === 0 ? "snaky" : "organic";
}

function getMaxSingletonRegions(size) {
  return Math.max(0, size - 1);
}

function getPresetSingletons(size, preset) {
  const maxSingletons = getMaxSingletonRegions(size);

  if (preset === "easy") {
    return maxSingletons;
  }

  if (preset === "hard") {
    return 0;
  }

  return Math.round(maxSingletons / 2);
}

function getDifficultyFromSingletons(size, singletonCount) {
  const maxSingletons = getMaxSingletonRegions(size);

  if (singletonCount <= 0) {
    return "hard";
  }

  if (singletonCount >= maxSingletons) {
    return "easy";
  }

  return "normal";
}

function getDifficultyProfile(difficulty, level) {
  const isCampaign = Number.isFinite(level);
  const campaignBoost = isCampaign ? clamp(level / 100, 0, 1) : 0;

  if (difficulty === "easy") {
    return {
      irregularity: 0.2 + campaignBoost * 0.08,
      singletonBias: 0.28 - campaignBoost * 0.08,
      blockers: 0
    };
  }

  if (difficulty === "hard") {
    return {
      irregularity: 0.5 + campaignBoost * 0.12,
      singletonBias: 0,
      blockers: 0
    };
  }

  return {
    irregularity: 0.34 + campaignBoost * 0.1,
    singletonBias: 0.12 - campaignBoost * 0.06,
    blockers: 0
  };
}

function normalizeConfig(config) {
  const size = clamp(config.size, 2, 9);
  const regionCount = clamp(config.regionCount, 1, size);
  const difficulty = ["easy", "normal", "hard"].includes(config.difficulty) ? config.difficulty : "normal";
  const maxSingletons = getMaxSingletonRegions(size);
  const singletonCount = clamp(Number(config.singletonCount) || 0, 0, maxSingletons);
  const blockerMode = ["none", "solid", "mixed"].includes(config.blockerMode) ? config.blockerMode : "none";
  const shapeStyle = ["chunky", "organic", "snaky"].includes(config.shapeStyle) ? config.shapeStyle : "organic";

  let allowDiagonalTouch = !!config.allowDiagonalTouch;

  if (size === 2) {
    allowDiagonalTouch = true;
  }

  if (size >= 4) {
    allowDiagonalTouch = false;
  }

  if (size === 3 && regionCount === 3) {
    allowDiagonalTouch = true;
  }

  return {
    ...config,
    difficulty,
    size,
    regionCount,
    singletonCount,
    blockerMode,
    shapeStyle,
    modifiers: normalizeModifiers(config.modifiers),
    allowDiagonalTouch,
    blockers: Math.max(0, Math.floor(config.blockers || 0)),
    irregularity: clamp(Number(config.irregularity) || 0, 0, 1),
    singletonBias: clamp(Number(config.singletonBias) || 0, 0, 1)
  };
}

function normalizeModifiers(modifiers) {
  const source = modifiers || {};

  return {
    maxHints: Number.isFinite(Number(source.maxHints)) ? Math.max(0, Number(source.maxHints)) : null,
    maxChecks: Number.isFinite(Number(source.maxChecks)) ? Math.max(0, Number(source.maxChecks)) : null,
    solverDisabled: !!source.solverDisabled
  };
}

function startGame(config) {
  clearAutoAdvance();
  stopTimer();
  const puzzle = generatePuzzle(config);
  state.config = config;
  state.puzzle = puzzle;
  state.blockerOf = puzzle.blocked.slice();
  state.cats = new Array(config.size * config.size).fill(false);
  state.catCount = 0;
  state.status = "playing";
  state.mistakes = 0;
  state.hintsUsed = 0;
  state.checksUsed = 0;
  state.history = [];
  state.solverCandidates = new Map();
  state.bestMs = null;
  state.topTimes = [];
  state.earnedStars = 0;
  state.startedAt = Date.now();
  state.elapsedMs = 0;
  ui.newGridBtn.classList.add("hidden");
  ui.solverBtn.disabled = !!config.modifiers.solverDisabled;
  ui.solverBtn.classList.toggle("disabled", !!config.modifiers.solverDisabled);

  startTimer();

  renderBoard();
  updateStats();
  renderStars(0);
  renderRules();
  renderLeaderboard();
  refreshBestScore().catch(() => {
    setStatus("Could not load highscores from IndexedDB.", "warn");
  });

  const modeLabel = config.mode === "campaign"
    ? `Campaign L${config.level} (${prettyDifficulty(config.difficulty)})`
    : `Single (${prettyDifficulty(config.difficulty)})`;
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

    const regionOf = growRegions(
      config.size,
      config.regionCount,
      solution,
      rng,
      config.irregularity,
      config.singletonBias,
      config.shapeStyle
    );
    const blocked = addBlockers(config.size, solution, config.blockers, rng, config.blockerMode);

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
  const regionOf = growRegions(config.size, config.regionCount, solution, rng, 0.1, 0, config.shapeStyle);
  const blocked = addBlockers(config.size, solution, 0, rng, "none");

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

  if (size === 2 && catCount === 2) {
    return [0, 3];
  }

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

function growRegions(size, regionCount, solution, rng, irregularity = 0, singletonBias = 0, shapeStyle = "organic") {
  const total = size * size;
  const regionOf = new Array(total).fill(-1);
  const sizes = new Array(regionCount).fill(1);
  const frontiers = Array.from({ length: regionCount }, () => new Set());
  const freezeCount = Math.min(regionCount - 1, Math.max(0, Math.round((regionCount - 1) * singletonBias)));
  const frozenRegions = new Set(shuffle(range(regionCount), rng).slice(0, freezeCount));

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
      if (frozenRegions.has(regionId)) continue;

      if (frontiers[regionId].size > 0 && sizes[regionId] < maxSize) {
        eligible.push(regionId);
      }
    }

    if (eligible.length === 0) {
      for (let regionId = 0; regionId < regionCount; regionId++) {
        if (frozenRegions.has(regionId)) continue;
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

        let regionId = adjacent.find((r) => !frozenRegions.has(r));
        if (regionId === undefined) {
          regionId = adjacent.length > 0 ? adjacent[0] : 0;
        }

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
    const cell = pickRegionGrowthCell(options, regionId, regionOf, size, rng, shapeStyle);

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

function pickRegionGrowthCell(options, regionId, regionOf, size, rng, shapeStyle) {
  if (options.length === 1) {
    return options[0];
  }

  const scored = options.map((cell) => {
    const sameRegionNeighbors = neighbors4(cell, size).filter((n) => regionOf[n] === regionId).length;
    return { cell, sameRegionNeighbors };
  });

  if (shapeStyle === "chunky") {
    scored.sort((a, b) => b.sameRegionNeighbors - a.sameRegionNeighbors);
    return scored[0].cell;
  }

  if (shapeStyle === "snaky") {
    scored.sort((a, b) => a.sameRegionNeighbors - b.sameRegionNeighbors);
    return scored[0].cell;
  }

  return scored[Math.floor(rng() * scored.length)].cell;
}

function addBlockers(size, solution, blockerCount, rng, blockerMode = "none") {
  const total = size * size;
  const blocked = new Array(total).fill(null);
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
    blocked[shuffled[i]] = blockerMode === "mixed" && i % 2 === 1 ? "fragile" : "solid";
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
  ui.board.dataset.size = String(puzzle.size);
  ui.board.classList.toggle("touch-feedback", state.touchHighlightCells.length > 0);
  ui.board.style.gridTemplateColumns = `repeat(${puzzle.size}, minmax(0, 1fr))`;

  for (let i = 0; i < puzzle.size * puzzle.size; i++) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";
    cell.setAttribute("role", "gridcell");
    cell.dataset.index = String(i);

    const regionId = puzzle.regionOf[i];
    const color = puzzle.colorOfRegion[regionId];
    const blockerType = state.blockerOf[i];
    cell.style.backgroundColor = color;

    if (blockerType) {
      cell.classList.add("blocked", `blocked-${blockerType}`);
      cell.setAttribute("aria-label", `${blockerType} blocked cell, region ${regionId + 1}`);
    } else {
      cell.setAttribute("aria-label", `Empty cell, region ${regionId + 1}`);
    }

    if (state.cats[i]) {
      cell.classList.add("cat");
      cell.setAttribute("aria-label", `Cat in region ${regionId + 1}`);
    }

    if (state.touchHighlightCells.includes(i)) {
      cell.classList.add("touch-focus");
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

  if (state.blockerOf[index] === "fragile") {
    state.blockerOf[index] = null;
    renderBoard();
    setStatus("Fragile blocker cleared.", "");
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
    if (findTouchConflictCell(index, state) !== null) {
      flashTouchConflict(index);
    }
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
    setStatus(`You solved it in ${formatDuration(state.elapsedMs)}. Purrrfect!`, "win");
    handleSolvedGame().then(() => {
      if (state.config.mode === "round") {
        ui.newGridBtn.classList.remove("hidden");
      }
      maybeScheduleCampaignAutoAdvance();
    }).catch(() => {
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

  if (currentState.blockerOf[cell]) {
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

    if (!config.allowDiagonalTouch) {
      const dr = Math.abs(rowOf(i, size) - r);
      const dc = Math.abs(colOf(i, size) - c);

      if (dr <= 1 && dc <= 1) {
        return { ok: false, reason: "touching", conflictCell: i };
      }
    }

    if (rowOf(i, size) === r) {
      return { ok: false, reason: "row" };
    }

    if (colOf(i, size) === c) {
      return { ok: false, reason: "column" };
    }

  }

  return { ok: true };
}

function findTouchConflictCell(cell, currentState) {
  if (currentState.config.allowDiagonalTouch) {
    return null;
  }

  const size = currentState.puzzle.size;
  const row = rowOf(cell, size);
  const col = colOf(cell, size);

  for (let i = 0; i < currentState.cats.length; i++) {
    if (!currentState.cats[i]) continue;

    const dr = Math.abs(rowOf(i, size) - row);
    const dc = Math.abs(colOf(i, size) - col);

    if (dr <= 1 && dc <= 1) {
      return i;
    }
  }

  return null;
}

function flashTouchConflict(targetCell) {
  const conflictCell = findTouchConflictCell(targetCell, state);
  if (typeof conflictCell !== "number") {
    return;
  }

  state.touchHighlightCells = [targetCell, conflictCell];
  renderBoard();

  setTimeout(() => {
    state.touchHighlightCells = [];
    renderBoard();
  }, 850);
}

function checkBoard(cats, puzzle, config) {
  const blockerOf = state.blockerOf;
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

    if (blockerOf[i]) {
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
  const maxChecks = state.config.modifiers.maxChecks;
  if (maxChecks !== null && state.checksUsed >= maxChecks) {
    setStatus("No checks left on this level.", "warn");
    return;
  }

  state.checksUsed++;
  const result = checkBoard(state.cats, state.puzzle, state.config);

  if (result.valid && state.catCount === state.config.regionCount) {
    state.status = "won";
    state.elapsedMs = Date.now() - state.startedAt;
    stopTimer();
    updateStats();
    setStatus(`All constraints pass. You win in ${formatDuration(state.elapsedMs)}.`, "win");
    handleSolvedGame().then(() => {
      maybeScheduleCampaignAutoAdvance();
    }).catch(() => {
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
  lines.push(`Difficulty: ${prettyDifficulty(config.difficulty)}.`);

  if (config.mode === "round") {
    lines.push(`Tiny one-cell regions: ${config.singletonCount} of ${getMaxSingletonRegions(config.size)} possible.`);
  }

  if (config.shapeStyle === "snaky") {
    lines.push("Special shape: longer snaky regions.");
  } else if (config.shapeStyle === "chunky") {
    lines.push("Special shape: chunkier compact regions.");
  }

  if (config.blockerMode === "mixed") {
    lines.push("Some blockers are fragile: tap once to clear them.");
  } else if (config.blockerMode === "solid" && config.blockers > 0) {
    lines.push("Solid blockers cannot hold cats.");
  }

  if (config.modifiers.maxHints === 0) {
    lines.push("Modifier: no hints.");
  } else if (config.modifiers.maxHints !== null) {
    lines.push(`Modifier: ${config.modifiers.maxHints} hint${config.modifiers.maxHints === 1 ? "" : "s"} available.`);
  }

  if (config.modifiers.maxChecks !== null) {
    lines.push(`Modifier: ${config.modifiers.maxChecks} check${config.modifiers.maxChecks === 1 ? "" : "s"} available.`);
  }

  if (config.modifiers.solverDisabled) {
    lines.push("Modifier: solver disabled.");
  }

  if (config.mode === "campaign") {
    lines.push(`Star gate: requires ${getRequiredStarsForLevel(config.level)} total campaign stars.`);
  }

  if (config.allowDiagonalTouch && config.size <= 3) {
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
  ui.statTotalStars.textContent = String(state.totalCampaignStars);
  ui.statStars.textContent = state.earnedStars > 0 ? `${state.earnedStars}/3` : "-";
  renderCampaignBadges();
}

function renderCampaignBadges() {
  if (!ui.campaignBadges) {
    return;
  }

  ui.campaignBadges.innerHTML = "";

  const bands = getCampaignBands();
  const nextLocked = bands.find((band) => state.totalCampaignStars < band.requiredStars) || bands[bands.length - 1];
  const prevUnlocked = [...bands].reverse().find((band) => state.totalCampaignStars >= band.requiredStars) || bands[0];
  const span = Math.max(1, nextLocked.requiredStars - prevUnlocked.requiredStars);
  const progressed = Math.max(0, state.totalCampaignStars - prevUnlocked.requiredStars);
  const percent = nextLocked.requiredStars === prevUnlocked.requiredStars ? 100 : Math.min(100, Math.round((progressed / span) * 100));

  ui.campaignProgressFill.style.width = `${percent}%`;
  ui.campaignProgressText.textContent = nextLocked.requiredStars === prevUnlocked.requiredStars
    ? `All badge bands unlocked with ${state.totalCampaignStars} stars.`
    : `${state.totalCampaignStars} / ${nextLocked.requiredStars} stars to ${nextLocked.label}`;

  for (const band of bands) {
    const badge = document.createElement("div");
    const unlocked = state.totalCampaignStars >= band.requiredStars;
    badge.className = `campaign-badge ${unlocked ? "unlocked" : "locked"}`;
    badge.dataset.band = band.key;
    badge.innerHTML = `<strong>${band.icon} ${band.label}</strong><span>${band.range} · ${band.requiredStars}★</span><em>${band.reward}</em>`;
    ui.campaignBadges.append(badge);
  }
}

function calculateStars() {
  let stars = 1;

  if (state.mistakes === 0) {
    stars += 1;
  }

  if (state.hintsUsed === 0) {
    stars += 1;
  }

  return stars;
}

function renderStars(stars) {
  ui.starsStrip.innerHTML = "";

  for (let i = 0; i < 3; i++) {
    const span = document.createElement("span");
    span.className = `star${i < stars ? " filled" : ""}`;
    span.textContent = "⭐";
    ui.starsStrip.append(span);
  }
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

  const maxHints = state.config.modifiers.maxHints;
  if (maxHints !== null && state.hintsUsed >= maxHints) {
    setStatus("No hints left on this level.", "warn");
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
    handleSolvedGame().then(() => {
      maybeScheduleCampaignAutoAdvance();
    }).catch(() => {
      setStatus("Solved, but could not persist progress.", "warn");
    });
  } else {
    setStatus("Hint: one cat placed.", "");
  }
}

function computeSolverCandidates() {
  const puzzle = state.puzzle;
  const config = state.config;
  const blockerOf = state.blockerOf;
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
    if (blockerOf[i] || state.cats[i]) {
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

    if (solvePuzzle(puzzle, config, presetCats, 1, blockerOf).length > 0) {
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

function clearAutoAdvance() {
  if (state.autoAdvanceTimerId) {
    clearTimeout(state.autoAdvanceTimerId);
    state.autoAdvanceTimerId = null;
  }

  ui.nextAutoBtn.classList.add("hidden");
}

function maybeScheduleCampaignAutoAdvance() {
  clearAutoAdvance();

  if (state.config.mode !== "campaign") {
    return;
  }

  if (state.config.level >= 100) {
    return;
  }

  const nextLevel = state.config.level + 1;
  ui.nextAutoBtn.classList.remove("hidden");
  setStatus(`Level solved. Jumping to level ${nextLevel} in 5 seconds.`, "win");

  state.autoAdvanceTimerId = setTimeout(() => {
    advanceToNextCampaignLevel();
  }, 5000);
}

function advanceToNextCampaignLevel() {
  clearAutoAdvance();

  if (!state.config || state.config.mode !== "campaign") {
    return;
  }

  const nextLevel = clamp(state.config.level + 1, 1, 100);
  if (nextLevel === state.config.level) {
    return;
  }

  if (nextLevel > state.campaignUnlockedLevel) {
    state.campaignUnlockedLevel = nextLevel;
    state.selectedCampaignLevel = nextLevel;
    setMeta("campaignUnlockedLevel", nextLevel).catch(() => {
      // Keep gameplay flowing even when persistence fails.
    });
  }

  state.selectedCampaignLevel = Math.min(nextLevel, getMaxAccessibleCampaignLevel());
  updateLevelDisplay();
  loadCampaignLevel(state.selectedCampaignLevel);
}

async function handleSolvedGame() {
  state.earnedStars = calculateStars();
  renderStars(state.earnedStars);
  updateStats();
  if (state.config.mode === "round") {
    ui.newGridBtn.classList.remove("hidden");
  }
  await saveBestScoreForCurrentConfig(state.elapsedMs);
  state.totalCampaignStars = await getTotalCampaignStars();
  updateStats();

  if (state.config.mode === "campaign" && state.config.level < 100) {
    const newUnlocked = Math.max(state.campaignUnlockedLevel, state.config.level + 1);
    if (newUnlocked !== state.campaignUnlockedLevel) {
      state.campaignUnlockedLevel = newUnlocked;
      state.selectedCampaignLevel = Math.min(newUnlocked, getMaxAccessibleCampaignLevel());
      await setMeta("campaignUnlockedLevel", newUnlocked);
      updateLevelDisplay();
      updateStats();
    }
  }

  await refreshBestScore();
}

function buildScoreKey(config) {
  if (config.mode === "campaign") {
    return `campaign:${config.level}`;
  }

  return `round:${config.size}:${config.regionCount}:${config.singletonCount}:${config.modifiers.maxHints ?? "n"}:${config.modifiers.maxChecks ?? "n"}:${config.modifiers.solverDisabled ? 1 : 0}:${config.allowDiagonalTouch ? 1 : 0}:${config.blockers}`;
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
  const stars = Math.max(current && Number.isFinite(Number(current.stars)) ? Number(current.stars) : 0, state.earnedStars);

  await putScore({
    key,
    mode: state.config.mode,
    level: state.config.level,
    size: state.config.size,
    regionCount: state.config.regionCount,
    singletonCount: state.config.singletonCount,
    bestMs,
    topTimes: nextTopTimes,
    stars,
    attempts,
    updatedAt: Date.now()
  });
}

function getLeaderboardLabel(config) {
  if (config.mode === "campaign") {
    return `Campaign level ${config.level} (${prettyDifficulty(config.difficulty)})`;
  }

  return `Single ${config.size}x${config.size}, ${config.regionCount} cats, ${config.singletonCount} tiny regions`;
}

function prettyDifficulty(difficulty) {
  if (difficulty === "easy") return "Easy";
  if (difficulty === "hard") return "Hard";
  return "Normal";
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

async function getAllScores() {
  const db = await initDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SCORES, "readonly");
    const store = tx.objectStore(STORE_SCORES);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error || new Error("Read all scores failed"));
  });
}

async function getTotalCampaignStars() {
  const scores = await getAllScores();

  return scores
    .filter((row) => row.mode === "campaign")
    .reduce((sum, row) => sum + (Number.isFinite(Number(row.stars)) ? Number(row.stars) : 0), 0);
}

function solvePuzzle(puzzle, config, presetCats, maxSolutions = 1, blockerOf = puzzle.blocked) {
  const size = puzzle.size;
  const total = size * size;
  const solutionSet = [];

  const regionCells = Array.from({ length: puzzle.regionCount }, () => []);
  for (let i = 0; i < total; i++) {
    if (!blockerOf[i]) {
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
