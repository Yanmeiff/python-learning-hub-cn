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

test("a solved mistake remains visible in the future review plan", () => {
  let now = new Date("2026-11-22T10:00:00.000Z");
  const storage = memoryStorage();
  const store = createStore(storage, () => now);
  store.recordAttempt({qid:"CH01-E-013",topic:"不换行输出",passed:false});
  store.recordAttempt({qid:"CH01-E-013",topic:"不换行输出",passed:true});

  assert.equal(store.getMistakes().length,0,"solved question is not unresolved");
  const plan = store.getReviewPlan();
  assert.equal(plan.length,1,"solved question remains in the review plan");
  assert.equal(plan[0].qid,"CH01-E-013");
  assert.equal(plan[0].status,"scheduled");
  assert.equal(plan[0].dueAt,"2026-11-23T10:00:00.000Z");
  assert.equal(plan[0].wrongCount,1);
  assert.equal(store.getDueReviews().length,0);
  assert.equal(store.getStats({},1780).reviewTotal,1);
  assert.equal(store.getStats({},1780).scheduledReviews,1);

  const reloaded=createStore(storage,()=>now);
  assert.equal(reloaded.getReviewPlan()[0].status,"scheduled");
  assert.equal(reloaded.getReviewPlan()[0].dueAt,"2026-11-23T10:00:00.000Z");
  now=new Date("2026-11-23T10:00:00.000Z");
  assert.equal(reloaded.getReviewPlan()[0].status,"due");
  assert.equal(reloaded.getDueReviews().length,1);
});

test("correct-first questions never enter the mistake review plan", () => {
  const store=createStore(memoryStorage(),()=>new Date("2026-11-22T10:00:00.000Z"));
  store.recordAttempt({qid:"CH01-E-001",passed:true});
  store.recordAttempt({qid:"CH01-E-001",passed:true});
  assert.equal(store.getReviewPlan().length,0);
  assert.equal(store.getDueReviews().length,0);
});

test("existing V1 backups keep solved-but-scheduled mistakes", () => {
  const store=createStore(memoryStorage(),()=>new Date("2026-11-22T11:00:00.000Z"));
  const backup={
    format:"pyquest-learning-hub",version:1,
    learning:{version:1,attempts:[
      {qid:"CH01-E-013",passed:false,timestamp:"2026-11-22T09:00:00.000Z",topic:"print"},
      {qid:"CH01-E-013",passed:true,timestamp:"2026-11-22T10:00:00.000Z",topic:"print"}
    ],reviewMeta:{"CH01-E-013":{
      stage:0,dueAt:"2026-11-23T10:00:00.000Z",lastResult:"passed",note:"不要忘记 end 参数",starred:true
    }}},
    progress:{"CH01-E-013":true},codes:{"CH01-E-013":'print("Hi",end="!")'}
  };
  store.importBackup(backup);
  const plan=store.getReviewPlan();
  assert.equal(plan.length,1);
  assert.equal(plan[0].status,"scheduled");
  assert.equal(plan[0].note,"不要忘记 end 参数");
  assert.equal(plan[0].starred,true);
  assert.equal(plan[0].wrongCount,1);
});

test("a failed review resets the schedule without discarding the mistake", () => {
  let now=new Date("2026-11-22T10:00:00.000Z");
  const store=createStore(memoryStorage(),()=>now);
  store.recordAttempt({qid:"CH02-M-008",passed:false});
  store.recordAttempt({qid:"CH02-M-008",passed:true});
  now=new Date("2026-11-23T10:00:00.000Z");
  assert.equal(store.getReviewPlan()[0].status,"due");
  store.recordAttempt({qid:"CH02-M-008",passed:false});
  const plan=store.getReviewPlan();
  assert.equal(plan.length,1);
  assert.equal(plan[0].status,"unresolved");
  assert.equal(plan[0].dueAt,"2026-11-24T10:00:00.000Z");
  assert.equal(plan[0].wrongCount,2);
});
