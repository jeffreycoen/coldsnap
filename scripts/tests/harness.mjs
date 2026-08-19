// P7 T22: the ok() harness, the fail list, and the summary + exit — moved
// verbatim from the top and bottom of scripts/depot-test.mjs. finish() is the
// old bottom-of-file summary/exit code, now behind an export so the runner
// can call it after every era file has imported (and run) in order.
const fails = [];
export const ok = (name, cond, detail) => {
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}${detail ? " (" + detail + ")" : ""}`);
  if (!cond) fails.push(name);
};

export function finish() {
  if (fails.length) {
    console.error(`\n${fails.length} FAILURE(S): ${fails.join(", ")}`);
    process.exit(1);
  }
  console.log("\ndepot-test PASS");
}
