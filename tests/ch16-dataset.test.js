"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const index = JSON.parse(fs.readFileSync(path.join(root, "docs/data/index.json"), "utf8"));
const dir = path.join(root, "questions/CH16_Iteration_Generators");
const siteDir = path.join(root, "docs/data/questions/CH16_Iteration_Generators");
test("CH16 follows PyQuest's complete four-tier JSON format", () => {
  const chapter = index.chapters.find(ch => ch.id === "CH16");
  assert.ok(chapter);
  assert.equal(chapter.count, 120);
  assert.equal(index.chapters.length,16);
  assert.equal(index.chapters.reduce((s,ch)=>s+ch.count,0),1900);
  const seen = new Set(), outputs=new Set();
  for(const [file,suffix] of [["easy_30.json","E"],["medium_30.json","M"],["hard_30.json","H"],["expert_30.json","X"]]){
    const a=JSON.parse(fs.readFileSync(path.join(dir,file),"utf8"));
    const b=JSON.parse(fs.readFileSync(path.join(siteDir,file),"utf8"));
    assert.deepEqual(a,b,"site copy differs from authoring source");
    assert.equal(a.questions.length,30);
    for(const [i,q] of a.questions.entries()){
      assert.equal(q.id,`CH16-${suffix}-${String(i+1).padStart(3,'0')}`);
      assert.deepEqual(Object.keys(q).sort(),["id","topic","difficulty","stars","description","code_template","expected_output","hints","test_cases","solution"].sort());
      assert.ok(q.code_template.includes("___"));
      assert.ok(q.solution.includes("print(base, result)"));
      assert.ok(q.description.length>20);
      assert.ok(q.hints.length>5);
      assert.ok(!seen.has(q.id));
      assert.ok(!outputs.has(q.expected_output));
      seen.add(q.id);outputs.add(q.expected_output);
    }
  }
  assert.equal(seen.size,120);
});
