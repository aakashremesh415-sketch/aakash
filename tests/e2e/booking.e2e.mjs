// Browser test of the whole booking flow, against the built site (npm run build first).
// Run: npm run test:e2e   (needs Chrome; set CHROME_PATH if it isn't found automatically)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { startServer } from "./server.mjs";

const CHROME = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
  .find((p) => p && existsSync(p));

let site, browser;
before(async () => {
  site = await startServer();
  browser = await chromium.launch({ executablePath: CHROME });
});
after(async () => { await browser?.close(); await site?.close(); });

// A visitor in London; the page should default to their time.
async function openBooking(opts = {}) {
  const ctx = await browser.newContext({ timezoneId: "Europe/London", locale: "en-GB", viewport: { width: 1280, height: 900 }, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`${site.origin}/#contact`);
  await page.locator("#contact").scrollIntoViewIfNeeded();
  await page.waitForSelector("[data-book-picker]:not([hidden])", { timeout: 15000 });
  return { ctx, page, errors };
}

async function fillAndBook(page, { name = "Priya Test", email = `p${Date.now()}@example.com`, company = "Ledger Co" } = {}) {
  await page.fill("#b-name", name);
  await page.fill("#b-email", email);
  await page.fill("#b-company", company);
  await page.waitForTimeout(2600); // the bot check rejects forms filled in under 2.5 s
  await page.click("[data-book-form] button[type=submit]");
  return email;
}

test("times show in the visitor's zone by default and switch to US Eastern", async () => {
  const { ctx, page, errors } = await openBooking();
  assert.match(await page.textContent("[data-tz]"), /your time \(Greenwich Mean Time\)/);
  assert.equal(await page.textContent("[data-local-name]"), "London");
  const firstLondon = await page.locator("[data-slots] .slot").first().textContent();
  await page.click('[data-tz-mode="eastern"]');
  assert.match(await page.textContent("[data-tz]"), /US Eastern/);
  const firstEastern = await page.locator("[data-slots] .slot").first().textContent();
  assert.notEqual(firstLondon, firstEastern, "times shift by the zone difference");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("week view: only open days, five at a time, with working arrows", async () => {
  const { ctx, page } = await openBooking();
  const days = page.locator("[data-days] .day");
  assert.equal(await days.count(), 5);
  assert.equal(await page.locator("[data-days] .day[disabled]").count(), 0, "no greyed-out days");
  assert.ok(await page.locator("[data-week-prev]").isDisabled());
  const firstWeek = await days.first().textContent();
  await page.click("[data-week-next]");
  assert.notEqual(await days.first().textContent(), firstWeek);
  assert.ok(!(await page.locator("[data-week-prev]").isDisabled()));
  await days.nth(2).click();
  assert.equal(await days.nth(2).getAttribute("aria-pressed"), "true");
  assert.ok((await page.locator("[data-slots] .slot").count()) > 0);
  await ctx.close();
});

test("book a 45-minute call with prep answers, then add it to a calendar", async () => {
  const { ctx, page, errors } = await openBooking();
  const before20 = await page.locator("[data-slots] .slot").count();
  await page.click('[data-duration="45"]');
  await page.waitForSelector("[data-book-picker]:not([hidden])");
  assert.ok((await page.locator("[data-slots] .slot").count()) < before20, "fewer 45-minute starts per day");

  await page.click("[data-next-free]");
  assert.match(await page.textContent("[data-picked]"), /45 minutes/);
  await page.click('.chip:has(input[value="Xero"])');
  await page.click('.chip:has(input[value="NetSuite"])');
  await page.selectOption("#b-entities", "2-3");
  site.outbox.length = 0;
  const email = await fillAndBook(page);

  await page.waitForSelector("[data-book-success]:not([hidden])", { timeout: 15000 });
  assert.match(await page.textContent("[data-success-text]"), /for 45 minutes/);
  assert.equal(await page.getAttribute("[data-join-link]", "href"), "https://meet.google.com/test-link-abc");
  assert.match(await page.getAttribute("[data-cal-google]", "href"), /^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE/);
  assert.match(await page.getAttribute("[data-cal-outlook]", "href"), /^https:\/\/outlook\.live\.com\/calendar/);
  const ics = decodeURIComponent((await page.getAttribute("[data-cal-ics]", "href")).split(",")[1]);
  assert.match(ics, /BEGIN:VEVENT/);
  const [s, e] = [/DTSTART:(\w+)/.exec(ics)[1], /DTEND:(\w+)/.exec(ics)[1]];
  const t = (x) => Date.UTC(+x.slice(0, 4), +x.slice(4, 6) - 1, +x.slice(6, 8), +x.slice(9, 11), +x.slice(11, 13));
  assert.equal((t(e) - t(s)) / 60000, 45);

  const owner = site.outbox.find((m) => m.to.address === "owner@example.com");
  const visitor = site.outbox.find((m) => m.to.address === email);
  assert.match(owner.text, /^New 45-minute call booked/);
  assert.match(owner.text, /Setup: Xero, NetSuite · 2-3 entities/);
  assert.match(owner.text, /Their time: .*GMT/);
  assert.match(visitor.subject, /^Confirmed: 45-minute call/);
  assert.match(visitor.text, /Cancel or reschedule: http:\/\/127\.0\.0\.1:\d+\/cancel#/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("the cancel link in the email frees the slot", async () => {
  const { ctx, page } = await openBooking();
  await page.click("[data-next-free]");
  const picked = await page.textContent("[data-picked]");
  site.outbox.length = 0;
  const email = await fillAndBook(page);
  await page.waitForSelector("[data-book-success]:not([hidden])", { timeout: 15000 });
  const link = /http:\/\/127\.0\.0\.1:\d+\/cancel#[\w.-]+/.exec(site.outbox.find((m) => m.to.address === email).text)[0];

  const p2 = await ctx.newPage();
  await p2.goto(link);
  await p2.waitForSelector('[data-state="found"]:not([hidden])');
  assert.match(await p2.textContent("[data-when]"), /^Hi Priya, your call is on/);
  site.outbox.length = 0;
  await p2.click("[data-cancel]");
  await p2.waitForSelector('[data-state="done"]:not([hidden])');
  assert.equal(new URL(p2.url()).hash, "", "spent code removed from the address bar");
  assert.equal(site.outbox.length, 2);
  assert.ok(site.outbox.every((m) => m.icalEvent.method === "CANCEL"));

  const p3 = await ctx.newPage(); // a fresh tab: same-URL navigation would only change the #hash
  await p3.goto(link);
  await p3.waitForSelector('[data-state="error"]:not([hidden])');

  const fresh = await openBooking();
  await fresh.page.click("[data-next-free]");
  assert.equal(await fresh.page.textContent("[data-picked]"), picked, "the same time is bookable again");
  await fresh.ctx.close();
  await ctx.close();
});

test("someone else takes the time first: clear message and fresh times", async () => {
  const { ctx, page } = await openBooking();
  await page.click("[data-next-free]");
  // Book the same time behind this visitor's back.
  const first = (await (await fetch(`${site.origin}/api/slots?duration=20`)).json()).slots[0];
  await fetch(`${site.origin}/api/book`, { method: "POST", headers: { "content-type": "application/json", origin: site.origin }, body: JSON.stringify({ fullName: "Other", email: "other@example.com", company: "X", start: first, elapsedMs: 9000, timeZone: "UTC" }) });
  await fillAndBook(page);
  await page.waitForSelector("[data-book-picker]:not([hidden])", { timeout: 15000 });
  assert.match(await page.textContent("[data-book-form] [data-status]"), /no longer available|just took/);
  await ctx.close();
});

test("empty form shows what's missing; nothing is sent", async () => {
  const { ctx, page } = await openBooking();
  await page.click("[data-slots] .slot >> nth=0");
  site.outbox.length = 0;
  await page.click("[data-book-form] button[type=submit]");
  assert.equal(await page.textContent("[data-book-form] [data-status]"), "Please fill in Full Name.");
  assert.equal(await page.getAttribute("#b-name", "aria-invalid"), "true");
  await page.fill("#b-name", "A");
  await page.fill("#b-email", "not-an-email");
  await page.click("[data-book-form] button[type=submit]");
  assert.equal(await page.textContent("[data-book-form] [data-status]"), "Please enter a valid email address.");
  assert.equal(site.outbox.length, 0);
  await ctx.close();
});

test("phone width: no sideways scrolling and the controls fit", async () => {
  const { ctx, page, errors } = await openBooking({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `page scrolls sideways by ${overflow}px`);
  const box = await page.locator("[data-days]").boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= 375);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("privacy page loads and is linked from the booking form", async () => {
  const { ctx, page } = await openBooking();
  await page.click("[data-slots] .slot >> nth=0");
  assert.equal(await page.getAttribute(".privacy-note a", "href"), "/privacy");
  await page.goto(`${site.origin}/privacy`);
  assert.match(await page.textContent("h1"), /What this site collects/);
  await ctx.close();
});
