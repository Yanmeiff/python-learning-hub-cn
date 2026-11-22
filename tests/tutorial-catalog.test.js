"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const catalog=JSON.parse(fs.readFileSync(path.join(root,"docs/data/tutorial-catalog.json"),"utf8"));

test("tutorial catalog includes original author and CC BY 4.0 attribution",()=>{
  assert.equal(catalog.source.repository,"walter201230/Python");
  assert.equal(catalog.source.author,"walter201230");
  assert.equal(catalog.source.license,"CC BY 4.0");
  assert.equal(catalog.source.revision.length,40);
  assert.equal(catalog.chapters.length,29);
  assert.equal(catalog.chapters.flatMap(ch=>ch.lessons).length,94);
});
test("all tutorial ids and source links are unique and valid",()=>{
  const ids=new Set();
  for(const chapter of catalog.chapters){
    for(const lesson of chapter.lessons){
      assert.ok(!ids.has(lesson.id),"duplicate lesson: "+lesson.id);
      ids.add(lesson.id);
      assert.ok(lesson.path.startsWith("Article/PythonBasis/"));
      assert.ok(lesson.sourceUrl.includes(catalog.source.revision));
    }
  }
});
test("locally bundled tutorial chapters contain every declared Markdown lesson",()=>{
  let bundled=0;
  for(const chapter of catalog.chapters){
    if(!chapter.file) continue;
    const file=path.join(root,"docs/data",chapter.file);
    assert.ok(fs.existsSync(file),"missing "+file);
    const data=JSON.parse(fs.readFileSync(file,"utf8"));
    assert.equal(data.sourceRevision,catalog.source.revision);
    assert.equal(data.chapterId,chapter.id);
    assert.deepEqual(data.lessons.map(x=>x.id),chapter.lessons.map(x=>x.id));
    for(const item of data.lessons) assert.ok(item.markdown.length>30);
    bundled+=data.lessons.length;
  }
  assert.equal(bundled,29);
});
test("reading progress is included in learning backups without breaking older backups",()=>{
  const {createStore}=require("../docs/learning/learning-store.js");
  const data=new Map();
  const storage={
    getItem:(k)=>data.has(k)?data.get(k):null,
    setItem:(k,v)=>data.set(k,String(v)),
    removeItem:(k)=>data.delete(k),
    key:(n)=>Array.from(data.keys())[n]||null,
    get length(){return data.size;}
  };
  storage.setItem("pyquest-tutorial-progress-v1",JSON.stringify({read:["python0-whystudypython"],last:"python0-whystudypython"}));
  const store=createStore(storage);
  const backup=store.exportBackup();
  assert.equal(backup.tutorialProgress.read[0],"python0-whystudypython");
  storage.removeItem("pyquest-tutorial-progress-v1");
  store.importBackup(backup);
  assert.equal(JSON.parse(storage.getItem("pyquest-tutorial-progress-v1")).last,"python0-whystudypython");
  const previousBackup=JSON.parse(JSON.stringify(backup));
  delete previousBackup.tutorialProgress;
  store.importBackup(previousBackup);
  assert.equal(JSON.parse(storage.getItem("pyquest-tutorial-progress-v1")).read.length,1);
});
