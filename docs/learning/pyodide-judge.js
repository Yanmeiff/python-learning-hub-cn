(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PyQuestJudge = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /**
   * Capture the exact UTF-8 bytes written to stdout.
   *
   * Pyodide's batched handler removes line terminators from complete lines,
   * which makes it unsuitable for exact-output judging. Its write handler
   * receives UTF-8 Uint8Array chunks and preserves newlines and partial lines.
   */
  function captureRun(pyodide, code) {
    if (!pyodide || typeof pyodide.setStdout !== "function" || typeof pyodide.runPython !== "function") {
      throw new Error("Python 引擎尚未正确初始化");
    }

    let output = "";
    const decoder = new TextDecoder("utf-8");

    pyodide.setStdout({
      write(buffer) {
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        output += decoder.decode(bytes, { stream: true });
        return bytes.length;
      }
    });

    try {
      pyodide.runPython(code);
    } finally {
      try {
        // Python stdout may buffer a partial line when print(..., end="") is used.
        // Flush *before* restoring the handler so the final bytes are captured.
        pyodide.runPython("import sys; sys.stdout.flush()");
      } finally {
        output += decoder.decode();
        // Restore the browser's normal stdout handler, even if user code raises.
        pyodide.setStdout();
      }
    }

    return output;
  }

  function judge(question, actual, pyodide) {
    const tests = Array.isArray(question && question.test_cases)
      ? question.test_cases.filter((item) => typeof item === "string" && item.trim())
      : [];

    if (tests.length && pyodide) {
      try {
        pyodide.globals.set("captured_output", actual);
        for (const testCase of tests) pyodide.runPython(testCase);
        return { pass: true, method: "test_cases" };
      } catch (error) {
        return { pass: false, method: "test_cases", reason: String(error) };
      } finally {
        try { pyodide.globals.delete("captured_output"); } catch (error) {}
      }
    }

    const expected = question && question.expected_output ? question.expected_output : "";
    if (actual === expected) return { pass: true };
    if (expected.trim() !== "" && actual.replace(/\s+$/, "") === expected.replace(/\s+$/, "")) {
      return { pass: true, soft: true };
    }
    return { pass: false };
  }

  return { captureRun, judge };
});
