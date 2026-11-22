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
    await page.waitForFunction(() => document.getElementById("progress-total")?.textContent === "3460", {timeout:15000});
    await page.waitForFunction(() => document.getElementById("hub-total")?.textContent === "3460", {timeout:15000});
    await page.waitForFunction(() => document.querySelectorAll("#heatmap-grid .heat-cell").length >= 365, {timeout:15000});
    await page.waitForFunction(() => document.querySelectorAll("#mastery-list .mastery-item").length === 12, {timeout:15000});

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

    // Use the original interactive course instead of duplicating its reader.
    const originalCourse = page.locator("a.tutorial-external-link");
    assert.equal(await originalCourse.getAttribute("href"), "https://learn-py.org/");
    assert.equal(await originalCourse.getAttribute("target"), "_blank");
    assert.match(await originalCourse.getAttribute("rel"), /noopener/);
    const learningLink = page.locator("#btn-learn-python");
    assert.equal(await learningLink.getAttribute("href"), "https://learn-py.org/");
    assert.equal(await page.locator("#tutorial-panel").count(), 0);
    assert.equal(await page.locator("script[src*='tutorials.js']").count(), 0);


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
    const activity = await page.locator("#heatmap-grid .heat-cell.level-3").count();
    assert.ok(activity >= 1, "at least one heatmap square should reflect the four submissions");
    await page.locator("#btn-mistakes").click();
    await page.waitForFunction(() => document.querySelectorAll(".mistake-card").length >= 1);
    await page.locator(".mistake-note").first().fill("检查 print 的 end 参数");
    await page.locator('button[data-action="save-note"]').first().click();
    const note = await page.evaluate(() => window.learningStore.getMistakes()[0].note);
    assert.equal(note, "检查 print 的 end 参数");

    // Regression: after an incorrect answer is corrected, it must remain
    // visible in the review plan with a future due date.
    await page.locator('button[data-action="review"]').first().click();
    await page.waitForFunction(() => document.querySelector("#q-id").textContent === "CH01-E-013");
    await submit("CH01-E-013", 'print("Hi", end="!")', true, "Hi!");
    await page.locator("#btn-mistakes").click();
    await page.waitForFunction(() => document.querySelector('.mistake-card[data-review-status="scheduled"]'));
    assert.equal(await page.locator("#total-review-count").textContent(), "1");
    assert.equal(await page.locator("#mistake-count").textContent(), "0");
    assert.equal(await page.locator("#planned-review-count").textContent(), "1");
    assert.equal(await page.locator("#nav-mistake-count").textContent(), "1");
    assert.equal(await page.locator(".mistake-card .review-schedule").count(), 1);
    assert.match(await page.locator(".mistake-card .review-schedule").textContent(), /下次复习：/);
    assert.equal(await page.locator(".mistake-card .mistake-note").inputValue(), "检查 print 的 end 参数");
    await page.locator("#btn-back-dashboard").click();
    assert.equal(await page.locator("#hub-planned-total").textContent(), "1");

    await page.setViewportSize({width:390,height:844});
    const layout = await page.evaluate(() => {
      const sidebar = document.querySelector(".sidebar").getBoundingClientRect();
      const main = document.querySelector(".workspace").getBoundingClientRect();
      return {sideBottom:sidebar.bottom, mainTop:main.top, viewport:window.innerWidth};
    });
    assert.ok(layout.mainTop >= layout.sideBottom - 2, "mobile layout must stack sidebar above dashboard");
    await page.screenshot({path:"hub-dashboard-mobile.png",fullPage:true});

    // New chapter must be navigable and judged by real Pyodide.
    // CH16 is no longer the final sidebar chapter after adding CH17–CH29.
    // Select it by ID rather than assuming the last expanded chapter.
    await page.evaluate(async () => window.openQuestion("CH16-E-001"));
    await page.waitForFunction(() => document.getElementById("q-id").textContent === "CH16-E-001");
    const ch16 = await page.evaluate(() => ({
      code: document.querySelector("#editor").value,
      template: document.querySelector("#q-description").textContent
    }));
    assert.match(ch16.template, /列表推导式/);
    const newCase = await page.evaluate(async () => {
      const response = await fetch("data/questions/CH16_Iteration_Generators/easy_30.json");
      const data = await response.json();
      return data.questions[0];
    });
    await submit("CH16-E-001", newCase.solution, true, newCase.expected_output);
    await page.locator("#btn-dashboard").click();
    assert.equal(await page.locator("#hub-total").textContent(), "3460");

    // Inspect the newly added 13 chapters in the real Pyodide browser engine.
    // Each chapter gets one easy and one expert question, not mocked stdout.
    const newer = [
      ["CH17","CH17_Classes_Objects"],["CH18","CH18_Inheritance_Polymorphism"],
      ["CH19","CH19_Modules_Imports"],["CH20","CH20_Magic_Methods"],
      ["CH21","CH21_Closures_Decorators"],["CH22","CH22_Exceptions_Context"],
      ["CH23","CH23_Regex"],["CH24","CH24_Enums_Metaclasses"],
      ["CH25","CH25_Pathlib_Files"],["CH26","CH26_Typing_Dataclasses"],
      ["CH27","CH27_Async_Concurrency"],["CH28","CH28_Testing_Logging_Quality"],
      ["CH29","CH29_CLI_Projects"]
    ];
    for (const [chapter, directory] of newer) {
      for (const [suffix, filename] of [["E","easy_30.json"],["X","expert_30.json"]]) {
        const item = await page.evaluate(async ({dir,file}) => {
          const response = await fetch("data/questions/" + dir + "/" + file);
          if (!response.ok) throw new Error("Missing question bank: " + response.status);
          const data = await response.json();
          const q = data.questions[0];
          if (typeof window.openQuestion !== "function") throw new Error("No openQuestion API");
          await window.openQuestion(q.id);
          return q;
        }, {dir: directory, file:filename});
        await page.waitForFunction(qid => document.getElementById("q-id").textContent === qid, item.id);
        await submit(item.id, item.solution, true, item.expected_output);
      }
    }
    await page.locator("#btn-dashboard").click();
    assert.equal(await page.locator("#hub-total").textContent(), "3460");
    assert.deepEqual(errors, [], "page should not contain uncaught JavaScript errors");
    console.log("Browser smoke checks passed: CSS, dashboard, 3460 questions, real Pyodide, exact stdout, judging, mistakes, mobile layout");
  } finally {
    await browser.close();
  }
}
run().catch(error => { console.error(error); process.exitCode=1; });
