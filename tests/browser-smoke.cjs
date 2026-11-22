"use strict";
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const SITE = "http://127.0.0.1:8000";
async function run() {
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.goto(SITE, {waitUntil:"domcontentloaded"});
    await page.waitForFunction(() => document.getElementById("progress-total")?.textContent === "1780", {timeout:15000});
    await page.waitForFunction(() => document.getElementById("hub-total")?.textContent === "1780", {timeout:15000});
    await page.waitForFunction(() => document.querySelectorAll("#heatmap-grid .heat-cell").length >= 365, {timeout:15000});
    await page.waitForFunction(() => document.querySelectorAll("#mastery-list .mastery-item").length === 6, {timeout:15000});

    const style = await page.evaluate(() => {
      const grid = document.querySelector(".hub-stats");
      const panel = document.querySelector(".hub-panel");
      const heatmap = document.querySelector(".heatmap-grid");
      return {
        grid: getComputedStyle(grid).display,
        heatmap: getComputedStyle(heatmap).display,
        panelBackground: getComputedStyle(panel).backgroundColor,
        navButton: getComputedStyle(document.querySelector(".nav-button")).backgroundColor,
        hubStyleLoaded: [...document.styleSheets].some(sheet => sheet.href?.includes("hub.css"))
      };
    });
    assert.equal(style.grid, "grid", "learning statistics must use CSS grid");
    assert.equal(style.heatmap, "grid", "activity heatmap must use CSS grid");
    assert.notEqual(style.panelBackground, "rgba(0, 0, 0, 0)");
    assert.equal(style.hubStyleLoaded, true, "versioned hub.css must be loaded");
    await page.screenshot({path:"hub-dashboard-desktop.png",fullPage:true});

    await page.waitForFunction(() => document.getElementById("engine-status").textContent.includes("就绪"), {timeout:120000});
    await page.locator("#btn-hub-start").click();
    await page.waitForFunction(() => document.querySelector("#q-id").textContent === "CH01-E-001");

    async function submit(question, code, pass, expectedOutput) {
      await page.locator("#editor").fill(code);
      await page.locator("#btn-run").click();
      await page.waitForFunction(() => !document.getElementById("verdict").classList.contains("hidden"));
      const verdictClass = await page.locator("#verdict").getAttribute("class");
      const output = await page.locator("#output").textContent();
      assert.equal(verdictClass.includes(pass ? "ok" : "fail"), true, "Unexpected verdict for " + question + ": " + verdictClass);
      assert.equal(output, expectedOutput, "Output mismatch for " + question);
    }
    await submit("CH01-E-001", "print('Hello, Python!')", true, "Hello, Python!\n");
    await page.locator('.chapter-head').first().click();
    await page.locator('.qlink[data-id="CH01-E-002"]').click();
    await page.waitForFunction(() => document.querySelector("#q-id").textContent === "CH01-E-002");
    await submit("CH01-E-002", "print('Hello, World!')", true, "Hello, World!\n");
    await page.locator('.qlink[data-id="CH01-E-013"]').click();
    await page.waitForFunction(() => document.querySelector("#q-id").textContent === "CH01-E-013");
    await submit("CH01-E-013", 'print("Hi", end="!")', true, "Hi!");
    await page.screenshot({path:"hub-question-output.png",fullPage:true});
    await submit("CH01-E-013", 'print("Wrong", end="!")', false, "Wrong!");

    await page.locator("#btn-dashboard").click();
    await page.waitForFunction(() => document.getElementById("hub-mistake-total").textContent === "1");
    const activity = await page.locator("#heatmap-grid .heat-cell.level-2").count();
    assert.ok(activity >= 1, "at least one heatmap square should reflect the four submissions");
    await page.locator("#btn-mistakes").click();
    await page.waitForFunction(() => document.querySelectorAll(".mistake-card").length >= 1);
    await page.locator(".mistake-note").first().fill("检查 print 的 end 参数");
    await page.locator('button[data-action="save-note"]').first().click();
    const note = await page.evaluate(() => window.learningStore.getMistakes()[0].note);
    assert.equal(note, "检查 print 的 end 参数");

    await page.setViewportSize({width:390,height:844});
    await page.locator("#btn-back-dashboard").click();
    const layout = await page.evaluate(() => {
      const sidebar = document.querySelector(".sidebar").getBoundingClientRect();
      const main = document.querySelector(".workspace").getBoundingClientRect();
      return {sideBottom:sidebar.bottom, mainTop:main.top, viewport:window.innerWidth};
    });
    assert.ok(layout.mainTop >= layout.sideBottom - 2, "mobile layout must stack sidebar above dashboard");
    await page.screenshot({path:"hub-dashboard-mobile.png",fullPage:true});
    assert.deepEqual(errors, [], "page should not contain uncaught JavaScript errors");
    console.log("Browser smoke checks passed: CSS, dashboard, 1780 questions, real Pyodide, exact stdout, judging, mistakes, mobile layout");
  } finally {
    await browser.close();
  }
}
run().catch(error => { console.error(error); process.exitCode=1; });
