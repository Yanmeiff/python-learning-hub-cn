(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PyQuestLearningStore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const STORAGE_KEY = "pyquest-learning-hub-v1";
  const PROGRESS_KEY = "pyquest-progress-v1";
  const CODE_PREFIX = "pyquest-code-";
  const REVIEW_INTERVALS = [1, 3, 7, 14, 30];
  const MAX_ATTEMPTS = 10000;
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
  function safeJson(value, fallback) {
    try { return JSON.parse(value); } catch (error) { return fallback; }
  }
  function pad(value) { return String(value).padStart(2, "0"); }
  function dateKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }
  function addDays(value, days) {
    const date = new Date(value);
    date.setDate(date.getDate() + days);
    return date.toISOString();
  }
  function emptyData() { return { version: 1, attempts: [], reviewMeta: {} }; }
  function createStore(storage, clock) {
    const target = storage || memoryStorage();
    const getNow = typeof clock === "function" ? clock : function () { return new Date(); };
    let data = emptyData();
    function nowDate() {
      const value = getNow();
      return value instanceof Date ? new Date(value.getTime()) : new Date(value);
    }
    function persist() {
      try { target.setItem(STORAGE_KEY, JSON.stringify(data)); return true; }
      catch (error) { return false; }
    }
    function load() {
      const parsed = safeJson(target.getItem(STORAGE_KEY), null);
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.attempts)) return emptyData();
      return {
        version: 1,
        attempts: parsed.attempts.filter((item) => item && typeof item.qid === "string" && typeof item.passed === "boolean").slice(-MAX_ATTEMPTS),
        reviewMeta: parsed.reviewMeta && typeof parsed.reviewMeta === "object" ? parsed.reviewMeta : {}
      };
    }
    data = load();
    function latestAttempts() {
      const latest = Object.create(null);
      data.attempts.forEach((attempt) => {
        const previous = latest[attempt.qid];
        if (!previous || new Date(attempt.timestamp).getTime() >= new Date(previous.timestamp).getTime()) latest[attempt.qid] = attempt;
      });
      return latest;
    }
    function recordAttempt(attempt) {
      if (!attempt || typeof attempt.qid !== "string" || !attempt.qid) throw new Error("recordAttempt requires a question id");
      const timestamp = attempt.timestamp || nowDate().toISOString();
      const item = {
        qid: attempt.qid, chapter: attempt.chapter || attempt.qid.slice(0, 4),
        topic: attempt.topic || "未分类", difficulty: attempt.difficulty || attempt.qid.split("-")[1] || "E",
        passed: attempt.passed === true, timestamp: timestamp,
        durationMs: Math.max(0, Number(attempt.durationMs) || 0),
        code: String(attempt.code || ""), output: String(attempt.output || ""), error: String(attempt.error || "")
      };
      data.attempts.push(item);
      if (data.attempts.length > MAX_ATTEMPTS) data.attempts = data.attempts.slice(-MAX_ATTEMPTS);
      const meta = data.reviewMeta[item.qid] || { stage: 0, dueAt: null, note: "", starred: false };
      if (!item.passed) {
        meta.stage = 0;
        meta.dueAt = addDays(timestamp, REVIEW_INTERVALS[0]);
        meta.lastResult = "wrong";
      } else if (data.reviewMeta[item.qid]) {
        meta.stage = meta.lastResult === "wrong" ? 0 :
          Math.min((Number(meta.stage) || 0) + 1, REVIEW_INTERVALS.length - 1);
        meta.dueAt = addDays(timestamp, REVIEW_INTERVALS[meta.stage]);
        meta.lastResult = "passed";
      }
      meta.lastAttemptAt = timestamp;
      data.reviewMeta[item.qid] = meta;
      persist();
      return item;
    }
    function getMistakes() {
      const latest = latestAttempts();
      return Object.keys(latest).map((qid) => {
        const attempt = latest[qid];
        const meta = data.reviewMeta[qid] || {};
        return Object.assign({}, attempt, {
          note: meta.note || "", starred: meta.starred === true,
          dueAt: meta.dueAt || null, reviewStage: Number(meta.stage) || 0
        });
      }).filter((item) => item.passed === false)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    function getDueReviews() {
      const now = nowDate().getTime();
      const latest = latestAttempts();
      return Object.keys(data.reviewMeta).map((qid) => {
        const meta = data.reviewMeta[qid] || {};
        return {
          qid: qid, dueAt: meta.dueAt || null, note: meta.note || "",
          starred: meta.starred === true, reviewStage: Number(meta.stage) || 0,
          lastAttempt: latest[qid] || null
        };
      }).filter((item) => item.dueAt && new Date(item.dueAt).getTime() <= now && item.lastAttempt)
        .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
    }
    function setNote(qid, note) {
      if (!qid) return false;
      const meta = data.reviewMeta[qid] || { stage: 0, dueAt: null, starred: false };
      meta.note = String(note || "").slice(0, 2000);
      data.reviewMeta[qid] = meta;
      return persist();
    }
    function toggleStar(qid) {
      if (!qid) return false;
      const meta = data.reviewMeta[qid] || { stage: 0, dueAt: null, note: "" };
      meta.starred = !meta.starred;
      data.reviewMeta[qid] = meta;
      persist();
      return meta.starred;
    }
    function getHeatmap(days) {
      const count = Math.max(1, Math.min(3650, Number(days) || 365));
      const today = nowDate();
      today.setHours(0, 0, 0, 0);
      const start = new Date(today);
      start.setDate(start.getDate() - count + 1);
      const buckets = Object.create(null);
      data.attempts.forEach((attempt) => {
        const key = dateKey(attempt.timestamp);
        if (!buckets[key]) buckets[key] = { count: 0, passed: 0, failed: 0 };
        buckets[key].count += 1;
        if (attempt.passed) buckets[key].passed += 1;
        else buckets[key].failed += 1;
      });
      const result = [];
      for (let index = 0; index < count; index += 1) {
        const day = new Date(start);
        day.setDate(start.getDate() + index);
        const key = dateKey(day);
        const bucket = buckets[key] || { count: 0, passed: 0, failed: 0 };
        result.push({ date: key, count: bucket.count, passed: bucket.passed, failed: bucket.failed });
      }
      return result;
    }
    function getStreak() {
      const days = getHeatmap(370);
      const byDate = Object.create(null);
      days.forEach((day) => { byDate[day.date] = day.count; });
      const cursor = nowDate();
      cursor.setHours(0, 0, 0, 0);
      if (!byDate[dateKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
      let streak = 0;
      while (byDate[dateKey(cursor)] > 0) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
      return streak;
    }
    function getMastery(topicMap, chapterCounts) {
      const latest = latestAttempts();
      const categories = topicMap && Array.isArray(topicMap.categories) ? topicMap.categories : [];
      const weights = { E: 1, M: 1.15, H: 1.3, X: 1.5 };
      return categories.map((category) => {
        const chapters = Array.isArray(category.chapters) ? category.chapters : [];
        const attempts = Object.keys(latest).map((qid) => latest[qid]).filter((item) => chapters.indexOf(item.chapter) !== -1);
        let totalWeight = 0;
        let passedWeight = 0;
        attempts.forEach((item) => {
          const weight = weights[item.difficulty] || 1;
          totalWeight += weight;
          if (item.passed) passedWeight += weight;
        });
        const questions = chapters.reduce((sum, chapter) => sum + (Number(chapterCounts && chapterCounts[chapter]) || 0), 0);
        return {
          id: category.id, label: category.label,
          score: totalWeight ? Math.round((passedWeight / totalWeight) * 100) : null,
          attempted: attempts.length, questions: questions,
          coverage: questions ? Math.round((attempts.length / questions) * 100) : 0
        };
      });
    }
    function getStats(progress, totalQuestions) {
      const latest = latestAttempts();
      const attempts = data.attempts.length;
      const passedAttempts = data.attempts.filter((item) => item.passed).length;
      return {
        attempts: attempts, passedAttempts: passedAttempts, failedAttempts: attempts - passedAttempts,
        completed: progress && typeof progress === "object" ? Object.keys(progress).filter((qid) => progress[qid]).length : 0,
        totalQuestions: Number(totalQuestions) || 0, activeMistakes: getMistakes().length,
        uniqueAttempted: Object.keys(latest).length, streak: getStreak()
      };
    }
    function readProgress() { return safeJson(target.getItem(PROGRESS_KEY), {}); }
    function readCodes() {
      const codes = {};
      if (typeof target.key !== "function") return codes;
      for (let index = 0; index < target.length; index += 1) {
        const key = target.key(index);
        if (key && key.indexOf(CODE_PREFIX) === 0) codes[key.slice(CODE_PREFIX.length)] = target.getItem(key) || "";
      }
      return codes;
    }
    function exportBackup() {
      return {
        format: "pyquest-learning-hub", version: 1, exportedAt: nowDate().toISOString(),
        learning: JSON.parse(JSON.stringify(data)), progress: readProgress(), codes: readCodes()
      };
    }
    function importBackup(bundle) {
      if (!bundle || bundle.format !== "pyquest-learning-hub" || bundle.version !== 1 ||
          !bundle.learning || !Array.isArray(bundle.learning.attempts)) {
        throw new Error("备份文件格式不正确或版本不受支持");
      }
      const attempts = bundle.learning.attempts.filter((item) => item && typeof item.qid === "string" && typeof item.passed === "boolean").slice(-MAX_ATTEMPTS);
      data = {
        version: 1, attempts: attempts,
        reviewMeta: bundle.learning.reviewMeta && typeof bundle.learning.reviewMeta === "object" ? bundle.learning.reviewMeta : {}
      };
      persist();
      if (bundle.progress && typeof bundle.progress === "object") target.setItem(PROGRESS_KEY, JSON.stringify(bundle.progress));
      if (typeof target.key === "function") {
        const oldKeys = [];
        for (let index = 0; index < target.length; index += 1) {
          const key = target.key(index);
          if (key && key.indexOf(CODE_PREFIX) === 0) oldKeys.push(key);
        }
        oldKeys.forEach((key) => target.removeItem(key));
      }
      if (bundle.codes && typeof bundle.codes === "object") {
        Object.keys(bundle.codes).forEach((qid) => target.setItem(CODE_PREFIX + qid, String(bundle.codes[qid] || "")));
      }
      return { attempts: attempts.length, codes: Object.keys(bundle.codes || {}).length };
    }
    function getAttemptHistory(qid) {
      return data.attempts.filter((item) => item.qid === qid);
    }
    return {
      recordAttempt, getMistakes, getDueReviews, setNote, toggleStar,
      getHeatmap, getStreak, getMastery, getStats, getAttemptHistory,
      exportBackup, importBackup, getData: () => JSON.parse(JSON.stringify(data))
    };
  }
  return { STORAGE_KEY: STORAGE_KEY, createStore: createStore };
});