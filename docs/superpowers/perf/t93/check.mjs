// THE PAGE CHECK: the built page opens headless, inside the skeleton the
// viewer wraps it in, without a page error; both charts draw; at phone width
// the page does not scroll sideways.
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const body = fs.readFileSync(path.join(HERE, "index.html"), "utf8");
const doc = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body style="margin:0">' + body + "</body></html>";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-gpu", "--window-size=960,600"] });
let code = 0;
try {
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.setViewport({ width: 960, height: 600 });
  await page.setContent(doc, { waitUntil: "load" });
  await new Promise((r) => setTimeout(r, 500));
  const svgs = await page.evaluate(() => document.querySelectorAll("svg").length);
  const paths = await page.evaluate(() => document.querySelectorAll("svg path").length);
  const verdict = await page.evaluate(() => { const e = document.querySelector("[data-verdict]"); return e ? e.textContent.trim() : ""; });
  console.log(`desktop: svgs ${svgs} | paths ${paths} | verdict ${verdict.slice(0, 80)} | page errors ${errs.length}`);
  if (errs.length) { console.log(errs.join("\n")); code = 1; }
  if (svgs < 2 || paths < 6) code = 1;
  await page.setViewport({ width: 390, height: 844 });
  await new Promise((r) => setTimeout(r, 400));
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log(`phone: sideways scroll ${wide}`);
  if (wide) code = 1;
  console.log(code ? "PAGE CHECK FAILED" : "PAGE CHECK OK");
} finally {
  await browser.close();
}
process.exit(code);
