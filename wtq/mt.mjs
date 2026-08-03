// Q: correct multi-touch via raw CDP — puppeteer's Touchscreen wrapper
// cancels the first touch when a second starts (measured: both sticks dead).
// Usage: const mt = await makeMT(page); await mt.start(1, x, y); mt.move(1, x, y); mt.end(1);
export async function makeMT(page) {
  const cdp = await page.target().createCDPSession();
  const pts = new Map();
  const list = () => [...pts.entries()].map(([id, p]) => ({ x: p.x, y: p.y, id }));
  return {
    async start(id, x, y) {
      pts.set(id, { x, y });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: list() });
    },
    async move(id, x, y) {
      pts.set(id, { x, y });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: list() });
    },
    async end(id) {
      pts.delete(id);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: list() });
    },
  };
}
