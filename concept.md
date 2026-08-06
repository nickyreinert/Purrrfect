# Updated Game Concept + Implementation Spec  
## **Purrfect Regions** — corrected version

Use this version as the authoritative concept.  
It corrects the earlier interpretation and aligns with your rules:

- **One color = one region = one cat.**
- The player chooses / is given:
  - board size: `3x3` to `9x9`
  - number of regions / colors / cats: `1` up to the board’s supported maximum
- Rows and columns are handled as:
  - **at most one cat per row**
  - **at most one cat per column**
  - if number of cats equals board size, then every row/column is automatically filled
- Diagonal touching:
  - forbidden from `4x4` upward
  - allowed as a special small-board exception on `3x3`, especially needed for 3 cats on `3x3`

---

# 1. Core Rules — Updated

## Global logical entities

For every puzzle:

```text
regionCount = colorCount = catCount
```

There must never be:

- more regions than colors
- more colors than regions
- regions without exactly one cat
- cats sharing a row
- cats sharing a column

---

## Row / column rule

Because the number of cats can be smaller than the board size, the row/column rule must be implemented as:

```text
No row may contain more than one cat.
No column may contain more than one cat.
```

If:

```text
catCount == boardSize
```

then this automatically means:

```text
Every row has exactly one cat.
Every column has exactly one cat.
```

So:

- `3x3` with `1` cat → only 1 row and 1 column are used
- `3x3` with `2` cats → 2 rows and 2 columns are used
- `4x4` with `4` cats → every row and column is used
- `5x5` with `3` cats → 3 rows and 3 columns are used

---

## Touching rule

### From `4x4` upward

Cats cannot touch, even diagonally.

In code:

```text
Two cats are forbidden if their Chebyshev distance is 1.
```

Meaning:

```text
abs(rowA - rowB) <= 1 AND abs(colA - colB) <= 1
```

for two different cats.

### Special case: `3x3`

On `3x3`, diagonal touching is allowed as a small-board exception.

This is necessary if you want:

```text
3x3 with 3 cats
```

to be possible.

Recommended implementation:

```text
3x3, 1 cat: touching irrelevant
3x3, 2 cats: can be either strict or relaxed, but simple mode may allow diagonal touching
3x3, 3 cats: diagonal touching must be allowed
4x4 and larger: diagonal touching forbidden
```

For campaign teaching, the updated spec below uses:

- `3x3` with `2 cats`: **no touching**
- `3x3` with `3 cats`: **diagonal touching allowed**

For Simple Mode, you can either:

- allow diagonal touching for all `3x3` puzzles, or
- only force it when `3 cats` are used

The cleanest implementation is to have a config flag:

```js
allowDiagonalTouch: boolean
```

---

# 2. Parameter Model

## GameConfig

```js
GameConfig = {
  mode: "round" | "campaign",
  level: number | null,

  size: number,                  // 3..9
  regionCount: number,           // also colorCount and catCount

  allowDiagonalTouch: boolean,   // small-board exception only

  blockers: number,
  irregularity: number,          // 0..1
  seed: string
}
```

Important:

```text
regionCount = colorCount = catCount
```

Do **not** use a separate visual palette count anymore.  
Each region gets its own distinct color.

---

# 3. Allowed Settings

## Board size: `3x3`

Allowed region/color/cat counts:

```text
1, 2, 3
```

Special handling:

```text
regionCount = 1 → trivial, one color, one cat
regionCount = 2 → can be strict or relaxed; campaign teaches strict no-touch
regionCount = 3 → allowDiagonalTouch must be true
```

## Board sizes: `4x4` to `9x9`

Allowed region/color/cat counts:

```text
1 through boardSize
```

Examples:

```text
4x4 → 1, 2, 3, or 4 cats/regions/colors
5x5 → 1, 2, 3, 4, or 5 cats/regions/colors
9x9 → 1 through 9 cats/regions/colors
```

For all boards `4x4` and larger:

```text
allowDiagonalTouch = false
```

---

# 4. Simple / Round Mode

Round Mode is the free play mode.

The user chooses:

1. Board size:
   - `3x3`
   - `4x4`
   - `5x5`
   - `6x6`
   - `7x7`
   - `8x8`
   - `9x9`

2. Number of regions / colors / cats:
   - `1` up to maximum supported by board size

The UI must show clearly:

```text
 Cats to place: X
 Colors / Regions: X
```

where `X = regionCount`.

---

## Round Mode config builder

```js
function buildRoundConfig(size, regionCount) {
  const normalizedSize = Math.min(9, Math.max(3, size));

  const maxRegions = normalizedSize;
  const normalizedRegionCount = Math.min(
    maxRegions,
    Math.max(1, regionCount)
  );

  let allowDiagonalTouch = false;

  if (normalizedSize === 3) {
    // Small-board exception.
    // For 3 cats it is mandatory.
    // For 1-2 cats you may keep it enabled in simple mode for ease.
    allowDiagonalTouch = true;
  }

  return {
    mode: "round",
    level: null,
    size: normalizedSize,
    regionCount: normalizedRegionCount,
    allowDiagonalTouch,
    blockers: 0,
    irregularity: 0.35,
    seed: "round:" + Math.random().toString(36).slice(2)
  };
}
```

If you want a stricter `3x3` experience for 1-2 cats, change only this part:

```js
if (normalizedSize === 3) {
  allowDiagonalTouch = normalizedRegionCount === 3;
}
```

Both variants are supported by the logic below.

---

# 5. Campaign Mode

Campaign Mode should teach slowly.

It uses deterministic seeds:

```js
seed = "campaign:" + level
```

Same level always produces the same puzzle.

---

## Updated campaign progression

This progression starts extremely simple and grows slowly.

| Levels | Board | Regions / Colors / Cats | Diagonal Touch Allowed | Blockers | Teaching Goal |
|---:|---:|---:|---|---:|---|
| 1–3 | 3x3 | 1 | irrelevant | 0 | Place one cat |
| 4–8 | 3x3 | 2 | no | 0 | Two cats, no shared row/column, no touching |
| 9–12 | 3x3 | 3 | yes | 0 | Three cats on 3x3, small-board exception |
| 13–20 | 4x4 | 2 | no | 0 | Bigger board, two cats |
| 21–30 | 4x4 | 3 | no | 0 | Three cats on bigger board |
| 31–42 | 4x4 | 4 | no | 0–1 | Full 4x4, introduce blockers gently |
| 43–50 | 5x5 | 3 | no | 0–1 | Bigger board, still manageable cat count |
| 51–60 | 5x5 | 4 | no | 0–2 | More cats |
| 61–70 | 5x5 | 5 | no | 0–2 | Full 5x5 |
| 71–78 | 6x6 | 4 | no | 0–3 | Larger board |
| 79–86 | 7x7 | 5 | no | 0–3 | Larger board |
| 87–92 | 8x8 | 6 | no | 1–4 | Larger board |
| 93–97 | 9x9 | 7 | no | 1–4 | Large board |
| 98–99 | 9x9 | 8 | no | 2–5 | Near-full 9x9 |
| 100 | 9x9 | 9 | no | 2 | Grand finale: full 9x9 |

This gives 100 levels and does not rush the player.

---

## getCampaignConfig

```js
function getCampaignConfig(level) {
  const phases = [
    { start: 1,   end: 3,   size: 3, regions: 1, allowTouch: false, minBlockers: 0, maxBlockers: 0 },
    { start: 4,   end: 8,   size: 3, regions: 2, allowTouch: false, minBlockers: 0, maxBlockers: 0 },
    { start: 9,   end: 12,  size: 3, regions: 3, allowTouch: true,  minBlockers: 0, maxBlockers: 0 },

    { start: 13,  end: 20,  size: 4, regions: 2, allowTouch: false, minBlockers: 0, maxBlockers: 0 },
    { start: 21,  end: 30,  size: 4, regions: 3, allowTouch: false, minBlockers: 0, maxBlockers: 0 },
    { start: 31,  end: 42,  size: 4, regions: 4, allowTouch: false, minBlockers: 0, maxBlockers: 1 },

    { start: 43,  end: 50,  size: 5, regions: 3, allowTouch: false, minBlockers: 0, maxBlockers: 1 },
    { start: 51,  end: 60,  size: 5, regions: 4, allowTouch: false, minBlockers: 0, maxBlockers: 2 },
    { start: 61,  end: 70,  size: 5, regions: 5, allowTouch: false, minBlockers: 0, maxBlockers: 2 },

    { start: 71,  end: 78,  size: 6, regions: 4, allowTouch: false, minBlockers: 0, maxBlockers: 3 },
    { start: 79,  end: 86,  size: 7, regions: 5, allowTouch: false, minBlockers: 0, maxBlockers: 3 },
    { start: 87,  end: 92,  size: 8, regions: 6, allowTouch: false, minBlockers: 1, maxBlockers: 4 },

    { start: 93,  end: 97,  size: 9, regions: 7, allowTouch: false, minBlockers: 1, maxBlockers: 4 },
    { start: 98,  end: 99,  size: 9, regions: 8, allowTouch: false, minBlockers: 2, maxBlockers: 5 },
    { start: 100, end: 100, size: 9, regions: 9, allowTouch: false, minBlockers: 2, maxBlockers: 2 }
  ];

  const phase = phases.find(
    p => level >= p.start && level <= p.end
  );

  const span = phase.end - phase.start;
  const t = span === 0 ? 1 : (level - phase.start) / span;

  const blockers = Math.round(
    phase.minBlockers + t * (phase.maxBlockers - phase.minBlockers)
  );

  return {
    mode: "campaign",
    level,
    size: phase.size,
    regionCount: phase.regions,
    allowDiagonalTouch: phase.allowTouch,
    blockers,
    irregularity: Math.min(1, level / 100),
    seed: "campaign:" + level
  };
}
```

---

# 6. Updated Data Structures

## Puzzle

```js
Puzzle = {
  size: number,
  regionCount: number,
  regionOf: array<number>,   // length size*size
  blocked: array<boolean>,   // length size*size
  solution: array<number>    // generated solution cells
}
```

## GameState

```js
GameState = {
  config: GameConfig,
  puzzle: Puzzle,

  cats: array<boolean>,
  catCount: number,

  status: "playing" | "won",

  mistakes: number,
  hintsUsed: number,
  history: array
}
```

---

# 7. Updated Generation Logic

The generator must still **not** randomly drop colors.

Correct pipeline:

```text
1. Create config.
2. Generate valid cat positions.
3. Grow connected regions around those cat positions.
4. Add optional blockers.
5. Validate the puzzle.
6. Return it.
```

---

## 7.1 Main generator

```js
function generatePuzzle(config) {
  const maxAttempts = 25;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rng = makeRng(config.seed + ":attempt:" + attempt);

    const solution = generatePlacement(config, rng);

    if (!solution) continue;

    const regionOf = growRegions(
      config.size,
      config.regionCount,
      solution,
      rng,
      config.irregularity
    );

    const blocked = addBlockers(
      config.size,
      solution,
      config.blockers,
      rng
    );

    const puzzle = {
      size: config.size,
      regionCount: config.regionCount,
      regionOf,
      blocked,
      solution
    };

    if (validatePuzzle(puzzle, config)) {
      return puzzle;
    }
  }

  return fallbackPuzzle(config);
}
```

---

# 8. Placement Generator

This replaces the previous classic/starter split.

It supports:

- any board size `3..9`
- any valid cat count `1..size`
- `allowDiagonalTouch` on/off

---

## 8.1 generatePlacement

```js
function generatePlacement(config, rng) {
  const size = config.size;
  const catCount = config.regionCount;
  const allowTouch = config.allowDiagonalTouch;

  // Try multiple random row/column selections.
  for (let attempt = 0; attempt < 80; attempt++) {

    // Pick rows.
    const rows = shuffle(range(size), rng)
      .slice(0, catCount)
      .sort((a, b) => a - b);

    // Pick columns.
    const columns = shuffle(range(size), rng).slice(0, catCount);

    const usedColumns = new Set();
    const assignedColumns = [];

    function backtrack(i) {
      if (i === catCount) {
        return true;
      }

      const row = rows[i];

      const candidates = shuffle(
        columns.filter(c => !usedColumns.has(c)),
        rng
      );

      for (const col of candidates) {

        // If diagonal touching is not allowed, and this row is
        // directly below the previous selected row, then the column
        // difference must not be 1.
        if (
          !allowTouch &&
          i > 0 &&
          row - rows[i - 1] === 1 &&
          Math.abs(col - assignedColumns[i - 1]) === 1
        ) {
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
```

Helper:

```js
function range(n) {
  const result = [];

  for (let i = 0; i < n; i++) {
    result.push(i);
  }

  return result;
}
```

---

## 8.2 Why this works

Because rows and columns are unique:

- cats can never share a row
- cats can never share a column
- orthogonal touching is already impossible

The only extra check needed when diagonal touching is forbidden is:

```text
If two selected rows are consecutive,
their columns must not differ by 1.
```

That is exactly what the generator checks.

---

## 8.3 Fallback placement

```js
function fallbackPlacement(config) {
  const size = config.size;
  const catCount = config.regionCount;
  const allowTouch = config.allowDiagonalTouch;

  const center = Math.floor(size / 2) * size + Math.floor(size / 2);

  if (catCount === 1) {
    return [center];
  }

  // 3x3 relaxed fallbacks.
  if (size === 3 && allowTouch) {
    if (catCount === 2) {
      return [0, 8];
    }

    if (catCount === 3) {
      return [0, 4, 8];
    }
  }

  // 3x3 strict fallback for 2 cats.
  if (size === 3 && !allowTouch && catCount === 2) {
    return [0, 8];
  }

  // For 4x4 and larger, use a known full valid placement
  // and take the first K cats from it.
  if (size >= 4) {
    const full = classicFallbackColumns(size).map(
      (col, row) => indexOf(row, col, size)
    );

    return full.slice(0, catCount);
  }

  return [center];
}
```

Classic fallback columns:

```js
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
```

---

# 9. Region Growing

Region growing stays mostly the same, but now supports:

- `regionCount = 1`
- any valid `regionCount` up to `size`

Important:

- each region starts from one generated cat cell
- all regions remain connected
- every region contains exactly one solution cat

---

## 9.1 growRegions

```js
function growRegions(size, regionCount, solution, rng, irregularity = 0) {
  const total = size * size;

  const regionOf = new Array(total).fill(-1);
  const sizes = new Array(regionCount).fill(1);

  const frontiers = Array.from(
    { length: regionCount },
    () => new Set()
  );

  // Seed regions.
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

  // For regionCount = 1, this simply fills the whole board.
  const maxSize = Math.ceil(total / regionCount) + Math.floor(irregularity * 3);

  let unassigned = total - regionCount;

  while (unassigned > 0) {

    // Clean stale frontier cells.
    for (let regionId = 0; regionId < regionCount; regionId++) {
      for (const cell of frontiers[regionId]) {
        if (regionOf[cell] !== -1) {
          frontiers[regionId].delete(cell);
        }
      }
    }

    let eligible = [];

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

    // Safety fallback for isolated pockets.
    if (eligible.length === 0) {
      for (let cell = 0; cell < total; cell++) {
        if (regionOf[cell] !== -1) continue;

        const adjacent = neighbors4(cell, size)
          .map(n => regionOf[n])
          .filter(r => r !== -1);

        const regionId = adjacent.length > 0 ? adjacent[0] : 0;

        regionOf[cell] = regionId;
        sizes[regionId]++;
        unassigned--;
      }

      break;
    }

    // Early levels: balanced shapes.
    // Later levels: more organic shapes.
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
```

---

# 10. Blockers

Blockers remain the simple strategic element.

They are cells where cats cannot sit.

Rules:

- blockers belong visually to a region
- blockers never overlap generated cat cells
- blockers do not change region count or cat count

```js
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

  const safeCount = Math.min(
    blockerCount,
    shuffled.length
  );

  for (let i = 0; i < safeCount; i++) {
    blocked[shuffled[i]] = true;
  }

  return blocked;
}
```

---

# 11. Color Assignment

Because of your correction:

```text
regionCount = colorCount
```

Do **not** reuse colors across regions.

Each region gets one distinct color.

```js
function assignRegionColors(regionCount, rng) {
  const palette = shuffle(REGION_PALETTE, rng).slice(0, regionCount);

  return palette;
}
```

Then:

```js
const color = colorOfRegion[puzzle.regionOf[cell]];
cellElement.style.backgroundColor = color;
```

Rules still use `regionOf`, never the color value.

---

# 12. Validation and Win Logic

## 12.1 checkBoard

```js
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

  // Exactly one cat per region.
  for (let regionId = 0; regionId < puzzle.regionCount; regionId++) {
    if (regionCounts[regionId] !== 1) {
      errors.push(`Region ${regionId} has ${regionCounts[regionId]} cats`);
    }
  }

  // At most one cat per row.
  for (let r = 0; r < size; r++) {
    if (rowCounts[r] > 1) {
      errors.push(`Row ${r} has more than one cat`);
    }
  }

  // At most one cat per column.
  for (let c = 0; c < size; c++) {
    if (colCounts[c] > 1) {
      errors.push(`Column ${c} has more than one cat`);
    }
  }

  // No touching, unless diagonal touching is allowed.
  if (!config.allowDiagonalTouch) {
    for (const cell of catCells) {
      for (const n of neighbors8(cell, size)) {
        if (cats[n]) {
          errors.push("Cats are touching");
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
```

---

## 12.2 canPlaceCat

```js
function canPlaceCat(cell, state) {
  const puzzle = state.puzzle;
  const config = state.config;
  const size = puzzle.size;

  if (puzzle.blocked[cell]) {
    return { ok: false, reason: "blocked" };
  }

  const regionId = puzzle.regionOf[cell];
  const r = rowOf(cell, size);
  const c = colOf(cell, size);

  for (let i = 0; i < state.cats.length; i++) {
    if (!state.cats[i]) continue;

    // Same region.
    if (puzzle.regionOf[i] === regionId) {
      return { ok: false, reason: "region" };
    }

    // Same row.
    if (rowOf(i, size) === r) {
      return { ok: false, reason: "row" };
    }

    // Same column.
    if (colOf(i, size) === c) {
      return { ok: false, reason: "column" };
    }

    // Touching diagonally / orthogonally.
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
```

---

## 12.3 checkWin

```js
function checkWin(state) {
  if (state.catCount !== state.config.regionCount) {
    return false;
  }

  const result = checkBoard(
    state.cats,
    state.puzzle,
    state.config
  );

  return result.valid;
}
```

---

# 13. Solver / Hint Adjustment

The solver from the previous spec still works with one change:

```text
If allowDiagonalTouch is true,
skip the diagonal adjacency check.
```

In candidate generation:

```js
function isAdjacentToCat(cell) {
  if (config.allowDiagonalTouch) {
    return false;
  }

  for (const n of neighbors8(cell, size)) {
    if (cats.has(n)) return true;
  }

  return false;
}
```

Everything else remains the same:

- one cat per region
- no shared row
- no shared column
- respect blocked cells
- respect `allowDiagonalTouch`

---

# 14. UI Text Updates

Because the rules now depend on board size and cat count, the UI should show dynamic helper text.

## Examples

### Level 1

```text
Place one cat in the colored region.
```

### 3x3, 2 cats, strict campaign level

```text
Place two cats.
Each color needs one cat.
Cats cannot share a row or column.
Cats cannot touch.
```

### 3x3, 3 cats

```text
Place three cats.
Each color needs one cat.
Cats cannot share a row or column.
On this tiny board, cats may touch diagonally.
```

### 4x4 and larger

```text
Place X cats.
Each color needs one cat.
No row or column may have more than one cat.
Cats cannot touch, even diagonally.
```

---

# 15. Updated Edge Cases

The implementation must handle these correctly.

## 15.1 One region / one cat

```text
size: any
regionCount: 1
colorCount: 1
catCount: 1
```

This is valid.

The whole board is one region unless blockers are used.  
The player only needs to place one cat.

---

## 15.2 3x3 with 3 regions

```text
size: 3
regionCount: 3
allowDiagonalTouch: true
```

This is valid only because diagonal touching is allowed.

If `allowDiagonalTouch` were false, this configuration should be rejected or automatically corrected.

```js
if (size === 3 && regionCount === 3) {
  allowDiagonalTouch = true;
}
```

---

## 15.3 3x3 with 2 regions

Both variants are valid:

```text
allowDiagonalTouch = false
```

or

```text
allowDiagonalTouch = true
```

Campaign uses `false` first to teach no touching.  
Simple Mode may use `true` for a more relaxed experience.

---

## 15.4 4x4 and larger

```text
allowDiagonalTouch = false
```

Always.

---

## 15.5 Region/color equality

Never allow:

```text
regionCount > colorCount
colorCount > regionCount
```

They are the same value.

```js
colorCount = regionCount
catCount = regionCount
```

---

# 16. Updated Acceptance Checklist

A coding agent can consider the updated concept complete when:

1. The player can choose:
   - board size from `3x3` to `9x9`
   - number of regions/colors/cats from `1` upward

2. The number of cats always equals:
   ```text
   regionCount = colorCount = catCount
   ```

3. Rows and columns enforce:
   ```text
   at most one cat per row
   at most one cat per column
   ```

4. If cat count equals board size:
   ```text
   every row and column is filled
   ```

5. On `4x4` and larger:
   ```text
   cats cannot touch diagonally
   ```

6. On `3x3`:
   ```text
   diagonal touching can be allowed
   3 cats require diagonal touching to be allowed
   ```

7. Campaign starts with:
   ```text
   3x3, 1 region, 1 cat
   ```

8. Then slowly introduces:
   ```text
   2 cats
   3 cats
   larger boards
   blockers
   ```

9. The generator still does not randomly drop colors.
   It must:
   - generate valid cat positions first
   - grow regions from those cats
   - validate the puzzle

10. The puzzle is won when:
   ```text
   all regions have exactly one cat
   no row has more than one cat
   no column has more than one cat
   touching rules are satisfied
   ```

---

# 17. Final Rule Summary for the Coding Agent

Implement the rules exactly like this:

```text
regionCount = colorCount = catCount

For every puzzle:
  - each region must contain exactly one cat
  - no row may contain more than one cat
  - no column may contain more than one cat

If board size >= 4:
  - cats may not touch diagonally

If board size == 3:
  - allowDiagonalTouch may be true
  - if regionCount == 3, allowDiagonalTouch must be true

Rows/columns:
  - do not need to be completely filled unless catCount == boardSize
```

This is the corrected and final logical foundation for the game.
