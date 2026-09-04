// COLDSNAP deployment mark: one global version, shown on the start screen
// and the in-game corner. Bump EVERY deployment: +0.01 per task, +0.1 per
// phase (a new phase sets the next tenth). The form is 0.<phase>.<task>;
// the old mk-prefixed form retired at 0.3.10 (The Shell Carved, task 1).
// A deploy without a bump is a defect.
export const MK = "0.3.10";
