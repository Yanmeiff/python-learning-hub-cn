/* CC BY 4.0 Chinese Markdown tutorials from walter201230/Python.
 * Rendering uses markdown-it with raw HTML disabled.
 * The content index and copyright attribution are in data/tutorial-catalog.json.
 */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const PROGRESS_KEY = "pyquest-tutorial-progress-v1";
  let catalog = null;
  let selected = null;
  let readState = { read: [], last: null };
  const cache = new Map();
  let currentLoad = 0;

  function loadProgress() {
    try {
      const stored = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "null");
      if (stored && typeof stored === "object") {
        readState = {
          read: Array.isArray(stored.read) ? [...new Set(stored.read.filter((x) => typeof x === "string"))] : [],
          last: typeof stored.last === "string" ? stored.last : null
        };
      }
    } catch (error) {
      console.warn("教程学习记录读取失败：", error);
    }
  }
  function saveProgress() {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(readState)); }
    catch (error) { console.warn("教程学习记录保存失败：", error); }
  }
  function lessons() { return catalog ? catalog.chapters.flatMap((chapter) => chapter.lessons) : []; }
  function findLesson(id) {
    if (!catalog) return null;
    for (const chapter of catalog.chapters) {
      const lesson = chapter.lessons.find((item) => item.id === id);
      if (lesson) return { lesson, chapter };
    }
    return null;
  }
  function sourceRawUrl(path) {
    return "https://raw.githubusercontent.com/" + catalog.source.repository +
      "/" + catalog.source.revision + "/" + path;
  }
  function sourceUrlForRelative(rawUrl, relative) {
    if (!relative || /^(?:https?:|mailto:|tel:|#)/i.test(relative)) return relative;
    try { return new URL(relative, rawUrl).href; }
    catch (error) { return relative; }
  }

  async function getMarkdown(lesson, chapter) {
    if (cache.has(lesson.id)) return cache.get(lesson.id);
    let markdown;
    if (chapter.file) {
      if (!cache.has(chapter.id)) {
        const response = await fetch("data/" + chapter.file);
        if (!response.ok) throw new Error("本地教程加载失败（HTTP " + response.status + "）");
        const bundle = await response.json();
        if (bundle.sourceRevision !== catalog.source.revision) throw new Error("教程源版本与目录不一致");
        const items = Array.isArray(bundle.lessons) ? bundle.lessons : [];
        items.forEach((item) => {
          if (typeof item.id === "string" && typeof item.markdown === "string") cache.set(item.id, item.markdown);
        });
        cache.set(chapter.id, true);
      }
      markdown = cache.get(lesson.id);
      if (typeof markdown !== "string") throw new Error("未找到该节教程内容");
    } else {
      const response = await fetch(sourceRawUrl(lesson.path));
      if (!response.ok) throw new Error("上游教程加载失败（HTTP " + response.status + "）");
      markdown = await response.text();
      cache.set(lesson.id, markdown);
    }
    return markdown;
  }

  function renderMarkdown(markdown, lesson) {
    if (typeof window.markdownit !== "function") {
      throw new Error("Markdown 渲染组件加载失败，请检查网络后刷新页面");
    }
    const md = window.markdownit({ html: false, linkify: true, typographer: true });
    const raw = sourceRawUrl(lesson.path);
    const originalImage = md.renderer.rules.image;
    md.renderer.rules.image = function (tokens, idx, options, env, self) {
      const token = tokens[idx];
      const src = token.attrGet("src");
      if (src) token.attrSet("src", sourceUrlForRelative(raw, src));
      token.attrSet("loading", "lazy");
      return originalImage(tokens, idx, options, env, self);
    };
    const originalLink = md.renderer.rules.link_open ||
      function (tokens, idx, options, env, self) { return self.renderToken(tokens, idx, options); };
    md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
      const token = tokens[idx];
      const href = token.attrGet("href");
      if (href) token.attrSet("href", sourceUrlForRelative(raw, href));
      token.attrSet("target", "_blank");
      token.attrSet("rel", "noopener noreferrer");
      return originalLink(tokens, idx, options, env, self);
    };
    return md.render(markdown);
  }

  function setReaderMessage(message) {
    const article = $("tutorial-article");
    if (article) article.textContent = message;
  }
  function updateProgressUi() {
    if (!catalog) return;
    const total = lessons().length;
    const known = new Set(lessons().map((lesson) => lesson.id));
    const count = readState.read.filter((id) => known.has(id)).length;
    const label = $("tutorial-progress-label");
    if (label) label.textContent = "已读 " + count + " / " + total + " 节";
    const bar = $("tutorial-progress-fill");
    if (bar) bar.style.width = (total ? (count * 100 / total) : 0) + "%";
    const mark = $("btn-mark-tutorial-read");
    if (mark && selected) mark.textContent = readState.read.includes(selected) ? "✓ 已完成阅读" : "标记为已读";
  }

  function renderChapterList(search) {
    if (!catalog) return;
    const target = $("tutorial-chapters");
    target.innerHTML = "";
    const filter = String(search || "").trim().toLowerCase();
    catalog.chapters.forEach((chapter) => {
      const found = !filter || chapter.title.toLowerCase().includes(filter) ||
        chapter.lessons.some((lesson) => lesson.title.toLowerCase().includes(filter));
      if (!found) return;
      const group = document.createElement("div");
      group.className = "tutorial-chapter";
      const head = document.createElement("div");
      head.className = "tutorial-chapter-heading";
      const label = document.createElement("strong");
      label.textContent = String(Number(chapter.id.slice(6)) + 1).padStart(2, "0") + ". " + chapter.title;
      const done = chapter.lessons.filter((lesson) => readState.read.includes(lesson.id)).length;
      const count = document.createElement("small");
      count.textContent = done + "/" + chapter.lessons.length;
      head.appendChild(label); head.appendChild(count);
      group.appendChild(head);
      chapter.lessons.forEach((lesson) => {
        if (filter && !chapter.title.toLowerCase().includes(filter) && !lesson.title.toLowerCase().includes(filter)) return;
        const button = document.createElement("button");
        button.className = "tutorial-lesson";
        if (selected === lesson.id) button.classList.add("active");
        if (readState.read.includes(lesson.id)) button.classList.add("done");
        button.type = "button";
        button.dataset.lessonId = lesson.id;
        button.textContent = (readState.read.includes(lesson.id) ? "✓ " : "• ") + lesson.title;
        button.addEventListener("click", () => selectLesson(lesson.id));
        group.appendChild(button);
      });
      target.appendChild(group);
    });
  }

  async function selectLesson(id) {
    const located = findLesson(id);
    if (!located) return;
    selected = id;
    readState.last = id;
    saveProgress();
    const token = ++currentLoad;
    const { lesson, chapter } = located;
    const headline = $("tutorial-current-title");
    if (headline) headline.textContent = lesson.title;
    const eyebrow = $("tutorial-current-chapter");
    if (eyebrow) eyebrow.textContent = chapter.title;
    const original = $("tutorial-source-link");
    if (original) original.href = lesson.sourceUrl;
    const practice = $("btn-tutorial-practice");
    if (practice) {
      practice.disabled = chapter.practiceChapters.length === 0;
      practice.textContent = chapter.practiceChapters.length ? "去做配套练习" : "该章节暂无配套题库";
    }
    const all = lessons();
    const index = all.findIndex((item) => item.id === selected);
    $("btn-tutorial-prev").disabled = index <= 0;
    $("btn-tutorial-next").disabled = index >= all.length - 1;
    renderChapterList($("tutorial-search").value);
    updateProgressUi();
    setReaderMessage("正在加载教程内容…");
    try {
      const markdown = await getMarkdown(lesson, chapter);
      if (token !== currentLoad) return;
      $("tutorial-article").innerHTML = renderMarkdown(markdown, lesson);
      $("tutorial-article").scrollTop = 0;
    } catch (error) {
      if (token !== currentLoad) return;
      setReaderMessage(error.message + "。可以点击「查看原文」继续阅读。");
      console.warn("教程内容无法显示：", error);
    }
  }

  async function start() {
    loadProgress();
    const response = await fetch("data/tutorial-catalog.json");
    if (!response.ok) throw new Error("教程目录加载失败（HTTP " + response.status + "）");
    catalog = await response.json();
    if (!catalog || !Array.isArray(catalog.chapters)) throw new Error("教程目录格式不正确");
    updateProgressUi();
    const id = findLesson(readState.last) ? readState.last : lessons()[0]?.id;
    if (id) await selectLesson(id);
  }

  window.showTutorialPanel = async function () {
    if (typeof window.showAppPanel === "function") window.showAppPanel("tutorial-panel");
    if (!catalog) {
      try { await start(); }
      catch (error) { setReaderMessage(error.message); }
    }
  };
  window.getTutorialProgress = function () { return JSON.parse(JSON.stringify(readState)); };

  $("btn-tutorial").addEventListener("click", window.showTutorialPanel);
  $("tutorial-search").addEventListener("input", (event) => renderChapterList(event.target.value));
  $("btn-mark-tutorial-read").addEventListener("click", () => {
    if (!selected) return;
    if (!readState.read.includes(selected)) readState.read.push(selected);
    saveProgress();
    updateProgressUi();
    renderChapterList($("tutorial-search").value);
  });
  function navigate(direction) {
    const list = lessons();
    const index = list.findIndex((lesson) => lesson.id === selected);
    if (index < 0) return;
    const next = list[index + direction];
    if (next) selectLesson(next.id);
  }
  $("btn-tutorial-prev").addEventListener("click", () => navigate(-1));
  $("btn-tutorial-next").addEventListener("click", () => navigate(1));
  $("btn-tutorial-practice").addEventListener("click", async () => {
    const located = findLesson(selected);
    if (!located || !located.chapter.practiceChapters.length) return;
    const questionId = located.chapter.practiceChapters[0] + "-E-001";
    if (typeof window.openQuestion === "function") {
      try { await window.openQuestion(questionId); }
      catch (error) { setReaderMessage("配套练习打开失败：" + error.message); }
    }
  });

  // The catalog loads only when the user first opens the tutorial tab.
})();