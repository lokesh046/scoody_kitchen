import test from 'node:test';
import assert from 'node:assert/strict';
import { KG_PER_LB, toKilograms, displayWeight, estimateCalories, recommendRecipe, progressForStep, parseDraft, EMPTY_DRAFT, pendingPetWeightKg } from '../mealPlanner.ts';

const product = (id, name, extra = {}) => ({ id, name, description: 'Small batch recipe', is_active: true, ...extra });

test('equivalent kg and pounds produce the same calorie estimate', () => {
  for (const activity of ['sedentary', 'active', 'very_active']) {
    assert.equal(estimateCalories(20, activity), estimateCalories(toKilograms(20 / KG_PER_LB, 'lbs'), activity));
  }
  assert.ok(Math.abs(toKilograms(displayWeight(20, 'lbs'), 'lbs') - 20) < 0.01);
  assert.equal(estimateCalories(NaN, 'active'), 0);
  assert.equal(estimateCalories(-10, 'active'), 0);
});

test('guest saves support both new kg payloads and legacy pounds', () => {
  assert.equal(pendingPetWeightKg(20, 'kg'), 20);
  assert.equal(pendingPetWeightKg(40), 40 * KG_PER_LB);
  assert.equal(pendingPetWeightKg(40, 'lbs'), 40 * KG_PER_LB);
});

test('allergy exclusions never fall back to excluded recipes', () => {
  const items = [product(1, 'Beef bowl'), product(2, 'Chicken bowl'), product(3, 'Rice bowl')];
  assert.equal(recommendRecipe(items, ['beef', 'chicken', 'grains'], 'very_active', 30), null);
  assert.equal(recommendRecipe(items, ['beef', 'chicken'], 'very_active', 30).id, 3);
  assert.equal(recommendRecipe([], [], 'active', 10), null);
});

test('checks descriptions, grain terms, availability, and does not override exclusions with preferences', () => {
  const items = [
    product(1, 'Sport recipe', { description: 'With beef broth' }),
    product(2, 'Fish bowl', { description: 'With barley' }),
    product(3, 'Turkey bowl', { is_active: false }),
    product(4, 'Salmon bowl', { is_in_stock: false }),
    product(5, 'Turkey bowl', { available_stock: 0 }),
    product(6, 'Pumpkin bowl'),
  ];
  assert.equal(recommendRecipe(items, ['beef', 'grains'], 'very_active', 35).id, 6);
});

test('three question steps use 33, 67 and 100 percent', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(progressForStep), [0, 33, 67, 100, 100]);
});

test('draft round trips units and answers and discards malformed stored values', () => {
  const draft = { ...EMPTY_DRAFT, step: 4, dogName: 'Puma', gender: 'male', breed: 'Beagle', selectedGroup: 'Hound Group', breedQuery: 'Beagle', weight: 28, weightUnit: 'lbs', activity: 'active', allergies: ['beef'] };
  assert.deepEqual(parseDraft(JSON.stringify(draft)), draft);
  assert.deepEqual(parseDraft('{broken'), EMPTY_DRAFT);
  assert.deepEqual(parseDraft('null'), EMPTY_DRAFT);
  const invalid = parseDraft(JSON.stringify({ ...draft, weight: -3, allergies: ['beef', 'unknown', 'beef'] }));
  assert.equal(invalid.step, 2);
  assert.equal(invalid.weight, '');
  assert.deepEqual(invalid.allergies, ['beef']);
  assert.equal(parseDraft(JSON.stringify({ ...draft, dogName: '' })).step, 1);
  assert.equal(parseDraft(JSON.stringify({ ...draft, activity: '' })).step, 3);
});
