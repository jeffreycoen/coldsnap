import fs from "fs";
const L = [0.5, 0.75, 1.25, 1.5];
const SPECIAL = {
  solveIT: [1.33, 1.67, 2.0],
  friction: [0.7, 0.85, 1.05],
  weldK: [0.5, 0.75, 1.5, 2.0, 3.0],
  zeta: [0.6, 0.8, 1.25, 1.5],
};
const A = ["fzKp", "fzKd", "cfmF", "hRecRate", "weldK", "servoKp", "tauMax", "kpDegKnee", "kpDegHipP", "kpDegAnk"];
const B = ["zeta", "BW", "cmgKd", "cmgKp", "katt", "stepHeight", "tDS", "friction", "stopAlpha", "tSS", "solveIT"];
const cells = (fs2) => fs2.flatMap((f) => (SPECIAL[f] || L).map((x) => [f, x]));
fs.writeFileSync("wtphys/cellsA.json", JSON.stringify(cells(A)));
fs.writeFileSync("wtphys/cellsB.json", JSON.stringify(cells(B)));
console.log(cells(A).length, cells(B).length);
