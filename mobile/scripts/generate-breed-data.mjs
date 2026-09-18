#!/usr/bin/env node
/**
 * One-time data-generation script for the breed-based calorie calculator
 * (mobile MealPlannerScreen). NOT run by the app itself — run manually,
 * its output is committed as a static file the app ships with.
 *
 * Source: https://dogapi.dog/ (MIT licensed, free, no auth) — 283 breeds
 * with real weight ranges and their AKC group.
 *
 * For each breed (excluding the two non-type administrative groups,
 * "Foundation Stock Service" and "Miscellaneous Class" — provisional
 * recognition statuses, not real breed types a user would pick):
 *   - typical weight = average of the midpoints of the male and female
 *     weight ranges (kg)
 *   - default calories = the same RER/MER formula already used elsewhere
 *     in this app (MealPlannerScreen.tsx), applied to that typical
 *     weight, once per activity level — this is the breed's "expected"
 *     calorie need for an average dog of that breed, used later as the
 *     baseline the user's own dog is compared against.
 *
 * Outputs two files:
 *   1. mobile/src/constants/breedData.ts   — shipped with the app
 *   2. mobile/scripts/breed-database.json  — the same data as a plain
 *      standalone JSON "database" file, for review outside the app.
 */

const API_BASE = 'https://dogapi.dog/api/v2';
const EXCLUDED_GROUPS = new Set(['Foundation Stock Service', 'Miscellaneous Class']);

async function fetchAllGroups() {
  const res = await fetch(`${API_BASE}/groups`);
  if (!res.ok) throw new Error(`Failed to fetch groups: HTTP ${res.status}`);
  const json = await res.json();
  const map = new Map();
  for (const g of json.data) {
    map.set(g.id, g.attributes.name);
  }
  return map;
}

async function fetchAllBreeds() {
  const breeds = [];
  let page = 1;
  const pageSize = 100;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await fetch(`${API_BASE}/breeds?page[number]=${page}&page[size]=${pageSize}`);
    if (!res.ok) throw new Error(`Failed to fetch breeds page ${page}: HTTP ${res.status}`);
    const json = await res.json();
    breeds.push(...json.data);
    const { next, last } = json.meta.pagination;
    if (!next || page >= last) break;
    page = next;
  }
  return breeds;
}

// Same RER/MER formula as MealPlannerScreen.tsx — kept in sync deliberately
// so the breed baseline and the user's own calculation are directly comparable.
function calculateCalories(weightKg, activityFactor) {
  const rer = 70 * Math.pow(weightKg, 0.75);
  return Math.round(rer * activityFactor);
}

const ACTIVITY_FACTORS = { sedentary: 1.0, active: 1.4, very_active: 1.8 };

function midpoint(range) {
  if (!range || range.min == null || range.max == null) return null;
  return (range.min + range.max) / 2;
}

async function main() {
  console.log('Fetching AKC groups...');
  const groupMap = await fetchAllGroups();
  console.log(`Fetched ${groupMap.size} groups.`);

  console.log('Fetching all breeds (paginated)...');
  const rawBreeds = await fetchAllBreeds();
  console.log(`Fetched ${rawBreeds.length} breeds.`);

  const results = [];
  const skipped = [];

  for (const breed of rawBreeds) {
    const name = breed.attributes.name;
    const groupId = breed.relationships?.group?.data?.id;
    const groupName = groupId ? groupMap.get(groupId) : null;

    if (!groupName || EXCLUDED_GROUPS.has(groupName)) {
      skipped.push({ name, reason: `excluded group: ${groupName || 'none'}` });
      continue;
    }

    const maleMid = midpoint(breed.attributes.male_weight);
    const femaleMid = midpoint(breed.attributes.female_weight);
    const validMids = [maleMid, femaleMid].filter((v) => v != null && v > 0);

    if (validMids.length === 0) {
      skipped.push({ name, reason: 'no usable weight data' });
      continue;
    }

    const typicalWeightKg = Number(
      (validMids.reduce((a, b) => a + b, 0) / validMids.length).toFixed(1)
    );

    results.push({
      name,
      group: groupName,
      typicalWeightKg,
      defaultCalories: {
        sedentary: calculateCalories(typicalWeightKg, ACTIVITY_FACTORS.sedentary),
        active: calculateCalories(typicalWeightKg, ACTIVITY_FACTORS.active),
        very_active: calculateCalories(typicalWeightKg, ACTIVITY_FACTORS.very_active),
      },
    });
  }

  results.sort((a, b) => a.name.localeCompare(b.name));

  console.log(`\nIncluded: ${results.length} breeds`);
  console.log(`Skipped: ${skipped.length}`);
  if (skipped.length > 0) {
    console.log('Skipped breakdown:', skipped.reduce((acc, s) => {
      acc[s.reason] = (acc[s.reason] || 0) + 1;
      return acc;
    }, {}));
  }

  const groupCounts = results.reduce((acc, r) => {
    acc[r.group] = (acc[r.group] || 0) + 1;
    return acc;
  }, {});
  console.log('Breeds per group:', groupCounts);

  const fs = await import('node:fs/promises');
  const path = await import('node:path');

  // 1. Standalone JSON "database" file, for review outside the app.
  const dbPath = path.resolve(process.cwd(), 'scripts', 'breed-database.json');
  await fs.writeFile(dbPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\nWrote standalone database: ${dbPath}`);

  // 2. TypeScript file shipped with the app.
  const tsContent = `// AUTO-GENERATED by scripts/generate-breed-data.mjs — do not hand-edit.
// Source: https://dogapi.dog/ (MIT licensed). Regenerate with:
//   node scripts/generate-breed-data.mjs
//
// typicalWeightKg is the average of the midpoints of this breed's male and
// female weight ranges. defaultCalories are precomputed via the same
// RER/MER formula MealPlannerScreen.tsx uses for the user's own dog, so the
// two numbers are directly comparable.

export type AkcGroup =
  | ${[...new Set(results.map((r) => r.group))].sort().map((g) => `'${g}'`).join('\n  | ')};

export interface BreedDataEntry {
  name: string;
  group: AkcGroup;
  typicalWeightKg: number;
  defaultCalories: {
    sedentary: number;
    active: number;
    very_active: number;
  };
}

export const BREED_DATA: BreedDataEntry[] = ${JSON.stringify(results, null, 2)};
`;

  const tsPath = path.resolve(process.cwd(), 'src', 'constants', 'breedData.ts');
  await fs.mkdir(path.dirname(tsPath), { recursive: true });
  await fs.writeFile(tsPath, tsContent, 'utf-8');
  console.log(`Wrote app data file: ${tsPath}`);
}

main().catch((err) => {
  console.error('generate-breed-data failed:', err);
  process.exit(1);
});
