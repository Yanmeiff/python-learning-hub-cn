"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "../docs/index.html"), "utf8");
const readme = fs.readFileSync(path.join(__dirname, "../README.md"), "utf8");

test("tutorial links open the official interactive site in a new tab", () => {
  assert.match(html, /class="nav-button tutorial-external-link"[^>]*href="https:\/\/learn-py\.org\/"[^>]*target="_blank"/);
  assert.match(html, /id="btn-learn-python"[^>]*href="https:\/\/learn-py\.org\/"[^>]*target="_blank"/);
});
test("duplicated internal tutorial reader and Markdown dependency are absent", () => {
  assert.doesNotMatch(html, /id="tutorial-panel"/);
  assert.doesNotMatch(html, /learning\/tutorials\.js/);
  assert.doesNotMatch(html, /markdown-it/);
  assert.match(readme, /不会自动同步学习进度/);
});
