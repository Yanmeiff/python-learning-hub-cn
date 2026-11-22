"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const index = JSON.parse(fs.readFileSync(path.join(root, "docs/data/index.json"), "utf8"));
const topicMap = JSON.parse(fs.readFileSync(path.join(root, "docs/data/topic-map.json"), "utf8"));
test("full extended catalog contains 29 chapters and 3460 total questions", () => {
  assert.equal(index.chapters.length, 29);
  assert.equal(index.chapters.reduce((sum, chapter) => sum + chapter.count, 0), 3460);
  for (let i=1; i<=29; i++) assert.ok(index.chapters.some(c=>c.id===`CH${String(i).padStart(2,'0')}`));
  assert.equal(topicMap.categories.length, 12);
});
test("new chapters have 120 verified questions with four levels and synced site data", () => {
  const fields = ["id","topic","difficulty","stars","description","code_template","expected_output","hints","test_cases","solution"].sort();
  for (const ch of index.chapters.filter(c => Number(c.id.slice(2)) >= 17)) {
    assert.equal(ch.count,120);
    const outputs = new Set(), allIds = new Set();
    for (const [level,name] of [["E","easy_30.json"],["M","medium_30.json"],["H","hard_30.json"],["X","expert_30.json"]]) {
      const a=JSON.parse(fs.readFileSync(path.join(root,"questions",ch.dir,name),"utf8"));
      const b=JSON.parse(fs.readFileSync(path.join(root,"docs/data/questions",ch.dir,name),"utf8"));
      assert.deepEqual(a,b);
      assert.equal(a.questions.length,30);
      for (const [i,q] of a.questions.entries()){
        assert.equal(q.id,`${ch.id}-${level}-${String(i+1).padStart(3,'0')}`);
        assert.deepEqual(Object.keys(q).sort(),fields);
        assert.ok(q.code_template.includes("___"));
        assert.ok(q.test_cases.length>0);
        assert.match(q.test_cases[0], /^assert captured_output == /);
        assert.ok(!allIds.has(q.id));
        assert.ok(!outputs.has(q.expected_output));
        allIds.add(q.id); outputs.add(q.expected_output);
      }
    }
    assert.equal(allIds.size,120);
  }
});
