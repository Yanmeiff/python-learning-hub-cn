"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createStore } = require("../docs/learning/learning-store.js");
function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    key: (index) => Array.from(values.keys())[index] || null,
    get length() { return values.size; }
  };
}
test("failed submissions enter the mistake book and later become scheduled reviews", () => {
  let current = new Date("2026-11-22T10:00:00.000Z");
  const store = createStore(memoryStorage(), () => current);
  store.recordAttempt({ qid: "CH01-E-001", topic: "print()", passed: false });
  assert.equal(store.getMistakes().length, 1);
  assert.equal(store.getDueReviews().length, 0);
  store.recordAttempt({ qid: "CH01-E-001", topic: "print()", passed: true });
  assert.equal(store.getMistakes().length, 0);
  current = new Date("2026-11-23T10:00:00.000Z");
  assert.equal(store.getDueReviews().length, 1);
});
test("heatmap aggregates daily attempts and outcomes", () => {
  const current = new Date("2026-11-22T10:00:00.000Z");
  const store = createStore(memoryStorage(), () => current);
  store.recordAttempt({ qid: "CH01-E-001", passed: true });
  store.recordAttempt({ qid: "CH01-E-002", passed: false });
  const today = store.getHeatmap(3).find((day) => day.date === "2026-11-22");
  assert.deepEqual({ count: today.count, passed: today.passed, failed: today.failed }, { count: 2, passed: 1, failed: 1 });
});
test("mastery uses each question's latest result and difficulty weight", () => {
  const store = createStore(memoryStorage(), () => new Date("2026-11-22T10:00:00.000Z"));
  store.recordAttempt({ qid: "CH01-E-001", chapter: "CH01", difficulty: "E", passed: true });
  store.recordAttempt({ qid: "CH01-M-002", chapter: "CH01", difficulty: "M", passed: false });
  const result = store.getMastery({ categories: [{ id: "basics", label: "基础", chapters: ["CH01"] }] }, { CH01: 120 })[0];
  assert.equal(result.attempted, 2);
  assert.equal(result.questions, 120);
  assert.equal(result.score, 47);
});
test("backup export and import restore attempts, progress, and saved code", () => {
  const source = memoryStorage();
  source.setItem("pyquest-progress-v1", JSON.stringify({ "CH01-E-001": true }));
  source.setItem("pyquest-code-CH01-E-001", "print('hello')");
  const first = createStore(source, () => new Date("2026-11-22T10:00:00.000Z"));
  first.recordAttempt({ qid: "CH01-E-001", passed: true });
  const backup = first.exportBackup();
  const destination = memoryStorage();
  const second = createStore(destination, () => new Date("2026-11-22T10:00:00.000Z"));
  const result = second.importBackup(backup);
  assert.equal(result.attempts, 1);
  assert.equal(destination.getItem("pyquest-progress-v1"), JSON.stringify({ "CH01-E-001": true }));
  assert.equal(destination.getItem("pyquest-code-CH01-E-001"), "print('hello')");
  assert.equal(second.getStats({ "CH01-E-001": true }, 10).attempts, 1);
});
test("invalid backup files are rejected", () => {
  const store = createStore(memoryStorage());
  assert.throws(() => store.importBackup({ version: 9 }), /备份文件格式不正确/);
});