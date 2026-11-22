"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { captureRun, judge } = require("../docs/learning/pyodide-judge.js");

function fakePyodide({ output = "", chunkSize = 1024, testRunner = null, runError = null } = {}) {
  const values = new Map();
  let stdout = null;
  const pyodide = {
    globals: {
      set(key, value) { values.set(key, value); },
      get(key) { return values.get(key); },
      delete(key) { values.delete(key); }
    },
    setStdout(handler) {
      stdout = handler || null;
    },
    runPython(code) {
      // The default fake writes immediately; an explicit flush must not replay it.
      if (code === "import sys; sys.stdout.flush()") return;
      if (code.startsWith("assert ") || code.startsWith("test:")) {
        if (testRunner) return testRunner(code, values);
        return;
      }
      if (runError) throw runError;
      if (!stdout || typeof stdout.write !== "function") throw new Error("stdout writer missing");
      const bytes = new TextEncoder().encode(output);
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const chunk = bytes.slice(offset, offset + chunkSize);
        assert.equal(stdout.write(chunk), chunk.length);
      }
    },
    hasCapturedOutput() {
      return values.has("captured_output");
    },
    getStdoutHandler() {
      return stdout;
    }
  };
  return pyodide;
}

test("captures the exact Hello World output including its trailing newline", () => {
  const pyodide = fakePyodide({ output: "Hello, World!\n", chunkSize: 2 });
  assert.equal(captureRun(pyodide, "print('Hello, World!')"), "Hello, World!\n");
  assert.equal(pyodide.getStdoutHandler(), null);
});

test("preserves UTF-8 Chinese text and newlines split across byte chunks", () => {
  const output = "你好，Python！\n第二行";
  const pyodide = fakePyodide({ output, chunkSize: 1 });
  assert.equal(captureRun(pyodide, "print('你好')"), output);
});

test("preserves output without a trailing newline", () => {
  const pyodide = fakePyodide({ output: "Hello!", chunkSize: 1 });
  assert.equal(captureRun(pyodide, "print('Hello!', end='')"), "Hello!");
});

test("restores the default stdout handler when user code raises", () => {
  const pyodide = fakePyodide({ runError: new Error("SyntaxError: invalid syntax") });
  assert.throws(() => captureRun(pyodide, "this is not python"), /SyntaxError/);
  assert.equal(pyodide.getStdoutHandler(), null);
});

test("a matching test_cases assertion passes and temporary global is cleaned up", () => {
  const testCase = "assert captured_output == 'Hello, World!\\n'";
  const pyodide = fakePyodide({
    testRunner(code, values) {
      assert.equal(code, testCase);
      assert.equal(values.get("captured_output"), "Hello, World!\n");
    }
  });
  const result = judge({ test_cases: [testCase] }, "Hello, World!\n", pyodide);
  assert.equal(result.pass, true);
  assert.equal(result.method, "test_cases");
  assert.equal(pyodide.hasCapturedOutput(), false);
});

test("a real assertion mismatch remains a failed answer", () => {
  const testCase = "assert captured_output == 'Hello, World!\\n'";
  const pyodide = fakePyodide({
    testRunner(code, values) {
      assert.equal(code, testCase);
      assert.equal(values.get("captured_output"), "Hello, World!\n");
    }
  });
  const result = judge({ test_cases: [testCase] }, "Hello, Python!\n", pyodide);
  assert.equal(result.pass, false);
  assert.match(result.reason, /AssertionError/);
  assert.equal(pyodide.hasCapturedOutput(), false);
});

test("all test_cases must pass; a later failing assertion is not ignored", () => {
  const pyodide = fakePyodide({
    testRunner(code) {
      if (code === "test:fail") throw new Error("AssertionError: second test failed");
    }
  });
  const result = judge({ test_cases: ["test:pass", "test:fail"] }, "ok\n", pyodide);
  assert.equal(result.pass, false);
  assert.match(result.reason, /second test failed/);
});

test("expected_output fallback accepts exact output and trailing-whitespace-only differences", () => {
  assert.deepEqual(judge({ expected_output: "42\n" }, "42\n", null), { pass: true });
  assert.deepEqual(judge({ expected_output: "42\n" }, "42", null), { pass: true, soft: true });
  assert.deepEqual(judge({ expected_output: "42\n" }, "41\n", null), { pass: false });
});

test("empty output remains distinguishable from a newline", () => {
  const empty = fakePyodide({ output: "" });
  const newline = fakePyodide({ output: "\n" });
  assert.equal(captureRun(empty, "pass"), "");
  assert.equal(captureRun(newline, "print()"), "\n");
});


test("flushes a buffered partial line before detaching the stdout writer", () => {
  const bytes = new TextEncoder().encode("Hi!");
  let writer = null;
  let flushed = false;
  const pyodide = {
    setStdout(handler) { writer = handler || null; },
    runPython(code) {
      if (code === "print('Hi', end='!')") {
        // Simulate CPython line buffering: no write until stdout.flush().
        return;
      }
      if (code === "import sys; sys.stdout.flush()") {
        flushed = true;
        assert.ok(writer && typeof writer.write === "function");
        writer.write(bytes);
        return;
      }
      throw new Error("Unexpected Python call: " + code);
    }
  };
  assert.equal(captureRun(pyodide, "print('Hi', end='!')"), "Hi!");
  assert.equal(flushed, true);
  assert.equal(writer, null);
});

test("still flushes and restores stdout after a Python exception", () => {
  let writer = null;
  let flushed = false;
  const pyodide = {
    setStdout(handler) { writer = handler || null; },
    runPython(code) {
      if (code === "raise ValueError('oops')") throw new Error("ValueError: oops");
      if (code === "import sys; sys.stdout.flush()") {
        flushed = true;
        return;
      }
      throw new Error("Unexpected Python call");
    }
  };
  assert.throws(() => captureRun(pyodide, "raise ValueError('oops')"), /ValueError/);
  assert.equal(flushed, true);
  assert.equal(writer, null);
});
