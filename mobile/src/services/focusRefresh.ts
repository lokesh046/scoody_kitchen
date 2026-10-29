// Screens used to reload their data every time they came into focus, which meant a
// database-backed request on every tab switch. They now skip that reload when the data
// was fetched recently -- unless something changed. Any successful create/update/delete
// request (see api/client.ts) calls bumpFocusRefresh(), and the next screen to gain focus
// sees a new "generation" and reloads straight away, so a new order, pet or ticket is
// never hidden behind the throttle.
let generation = 0;

export const bumpFocusRefresh = (): void => {
  generation += 1;
};

export const getFocusGeneration = (): number => generation;
