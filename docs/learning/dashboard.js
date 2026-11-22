(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let topicMap = null;
  let appState = null;
  function setPanel(activeId) {
    ["hub-dashboard", "mistake-panel", "tutorial-panel", "welcome", "quiz"].forEach((id) => {
      const node = $(id);
      if (node) node.classList.toggle("hidden", id !== activeId);
    });
    document.querySelectorAll(".nav-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.panel === activeId);
    });
  }
  function renderHeatmap(store) {
    const grid = $("heatmap-grid");
    if (!grid) return;
    grid.innerHTML = "";
    const days = store.getHeatmap(365);
    if (days.length) {
      const firstWeekday = new Date(days[0].date + "T12:00:00").getDay();
      for (let blank = 0; blank < firstWeekday; blank += 1) {
        const spacer = document.createElement("span");
        spacer.className = "heat-cell heat-empty";
        grid.appendChild(spacer);
      }
    }
    days.forEach((day) => {
      const cell = document.createElement("button");
      const level = day.count === 0 ? 0 : day.count < 2 ? 1 : day.count < 4 ? 2 : day.count < 7 ? 3 : 4;
      cell.type = "button";
      cell.className = "heat-cell level-" + level;
      cell.title = day.date + " · " + day.count + " 次提交 · 通过 " + day.passed + " · 未通过 " + day.failed;
      cell.setAttribute("aria-label", cell.title);
      cell.addEventListener("click", () => {
        const detail = $("heatmap-detail");
        if (detail) detail.textContent = day.date + "：提交 " + day.count + " 次，通过 " + day.passed + " 次，未通过 " + day.failed + " 次。";
      });
      grid.appendChild(cell);
    });
  }
  function renderMastery(store) {
    const target = $("mastery-list");
    if (!target || !topicMap || !appState || !appState.index) return;
    target.innerHTML = "";
    const chapterCounts = {};
    appState.index.chapters.forEach((chapter) => { chapterCounts[chapter.id] = chapter.count; });
    const mastery = store.getMastery(topicMap, chapterCounts);
    const evaluated = mastery.filter((item) => item.score !== null);
    const average = evaluated.length ? Math.round(evaluated.reduce((sum, item) => sum + item.score, 0) / evaluated.length) : null;
    const overall = $("hub-mastery");
    if (overall) overall.textContent = average === null ? "—" : average + "%";
    mastery.forEach((item) => {
      const row = document.createElement("div");
      row.className = "mastery-item";
      const top = document.createElement("div");
      top.className = "mastery-top";
      const label = document.createElement("strong");
      label.textContent = item.label;
      const score = document.createElement("span");
      score.className = "mastery-score";
      score.textContent = item.score === null ? "尚未评估" : item.score + "%";
      top.appendChild(label);
      top.appendChild(score);
      const track = document.createElement("div");
      track.className = "mastery-track";
      const fill = document.createElement("div");
      fill.className = "mastery-fill";
      fill.style.width = (item.score === null ? 0 : item.score) + "%";
      track.appendChild(fill);
      const meta = document.createElement("small");
      meta.textContent = item.attempted + " / " + item.questions + " 道题有作答记录 · 覆盖率 " + item.coverage + "%";
      row.appendChild(top);
      row.appendChild(track);
      row.appendChild(meta);
      target.appendChild(row);
    });
  }
  function formatReviewDate(date) {
    if (!date) return "待安排";
    const value = new Date(date);
    if (Number.isNaN(value.getTime())) return "日期无效";
    return value.toLocaleString("zh-CN", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false
    });
  }
  function statusLabel(item) {
    if (item.status === "unresolved") return "待解决";
    if (item.status === "due") return "已到期 · 请复习";
    return "已答对 · 按计划复习";
  }
  function renderMistakePreview(store) {
    const target = $("mistake-preview");
    if (!target) return;
    target.innerHTML = "";
    const reviews = store.getReviewPlan().slice(0, 5);
    if (!reviews.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "暂时没有错题。出现错误后，这道题即使重新答对，也会保留在复习计划中。";
      target.appendChild(empty);
      return;
    }
    reviews.forEach((item) => {
      const row = document.createElement("div");
      row.className = "mistake-preview-row";
      const text = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = item.qid + " · " + item.topic;
      const detail = document.createElement("small");
      detail.textContent = statusLabel(item) + " · 下次复习：" + formatReviewDate(item.dueAt);
      text.appendChild(title);
      text.appendChild(detail);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn ghost";
      button.textContent = "继续练习";
      button.addEventListener("click", () => {
        if (typeof window.openQuestion === "function") window.openQuestion(item.qid);
      });
      row.appendChild(text);
      row.appendChild(button);
      target.appendChild(row);
    });
  }
  function renderMistakes(store) {
    const target = $("mistake-list");
    if (!target || !store) return;
    target.innerHTML = "";
    const all = store.getReviewPlan();
    const unresolved = all.filter((item) => item.status === "unresolved");
    const scheduled = all.filter((item) => item.status === "scheduled");
    const due = all.filter((item) => item.dueAt && new Date(item.dueAt).getTime() <= Date.now());
    const count = $("mistake-count");
    if (count) count.textContent = String(unresolved.length);
    const planCount = $("planned-review-count");
    if (planCount) planCount.textContent = String(scheduled.length);
    const total = $("total-review-count");
    if (total) total.textContent = String(all.length);
    const dueCount = $("due-review-count");
    if (dueCount) dueCount.textContent = String(due.length);
    const navCount = $("nav-mistake-count");
    if (navCount) navCount.textContent = String(all.length);

    if (!all.length) {
      const empty = document.createElement("div");
      empty.className = "mistake-empty";
      empty.textContent = "还没有错题记录。第一次答错后，系统会保存该题并建立复习计划。";
      target.appendChild(empty);
      return;
    }
    all.forEach((item) => {
      const card = document.createElement("article");
      card.className = "mistake-card";
      card.dataset.reviewStatus = item.status;
      card.dataset.qid = item.qid;
      const head = document.createElement("div");
      head.className = "mistake-card-head";
      const heading = document.createElement("div");
      const title = document.createElement("h3");
      title.textContent = item.qid + " · " + item.topic;
      const status = document.createElement("span");
      status.className = "review-status review-status-" + item.status;
      status.textContent = statusLabel(item);
      const meta = document.createElement("p");
      meta.className = "muted";
      meta.textContent = "最近作答：" + new Date(item.timestamp).toLocaleString("zh-CN") +
        " · 历史答错 " + item.wrongCount + " 次";
      const review = document.createElement("p");
      review.className = "review-schedule";
      review.textContent = "下次复习：" + formatReviewDate(item.dueAt) +
        " · 复习阶段 " + (item.reviewStage + 1) + "/5";
      heading.appendChild(title);
      heading.appendChild(status);
      heading.appendChild(meta);
      heading.appendChild(review);
      const star = document.createElement("button");
      star.type = "button";
      star.className = "btn ghost";
      star.dataset.action = "star";
      star.dataset.qid = item.qid;
      star.textContent = item.starred ? "★ 已收藏" : "☆ 收藏";
      head.appendChild(heading);
      head.appendChild(star);

      const note = document.createElement("textarea");
      note.className = "mistake-note";
      note.rows = 2;
      note.maxLength = 2000;
      note.placeholder = "记录错误原因、易错知识点或解题思路…";
      note.value = item.note || "";
      note.dataset.noteQid = item.qid;

      const actions = document.createElement("div");
      actions.className = "mistake-actions";
      const save = document.createElement("button");
      save.type = "button";
      save.className = "btn ghost";
      save.dataset.action = "save-note";
      save.dataset.qid = item.qid;
      save.textContent = "保存笔记";
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "btn primary";
      retry.dataset.action = "review";
      retry.dataset.qid = item.qid;
      retry.textContent = "重新练习";
      actions.appendChild(save);
      actions.appendChild(retry);
      card.appendChild(head);
      card.appendChild(note);
      card.appendChild(actions);
      target.appendChild(card);
    });
  }
  function render(state) {
    appState = state;
    const store = window.learningStore;
    if (!store || !state) return;
    const stats = store.getStats(state.progress, state.order ? state.order.length : 0);
    const setText = (id, value) => { const node = $(id); if (node) node.textContent = String(value); };
    setText("hub-completed", stats.completed);
    setText("hub-total", stats.totalQuestions);
    setText("hub-attempts", stats.attempts);
    setText("hub-streak", stats.streak);
    setText("hub-mistake-total", stats.activeMistakes);
    setText("hub-due-total", store.getDueReviews().length);
    setText("hub-planned-total", stats.scheduledReviews);
    const completion = stats.totalQuestions ? Math.round(stats.completed / stats.totalQuestions * 100) : 0;
    const fill = $("hub-completion-fill");
    if (fill) fill.style.width = completion + "%";
    const completionLabel = $("hub-completion-label");
    if (completionLabel) completionLabel.textContent = completion + "% 已完成";
    renderHeatmap(store);
    renderMastery(store);
    renderMistakePreview(store);
    renderMistakes(store);
  }
  window.showAppPanel = setPanel;
  window.renderLearningHub = render;
  window.showHubDashboard = () => setPanel("hub-dashboard");
  window.showMistakePanel = () => { setPanel("mistake-panel"); renderMistakes(window.learningStore); };
  const dashboardButton = $("btn-dashboard");
  if (dashboardButton) dashboardButton.addEventListener("click", window.showHubDashboard);
  const mistakeButton = $("btn-mistakes");
  if (mistakeButton) mistakeButton.addEventListener("click", window.showMistakePanel);
  const backButton = $("btn-back-dashboard");
  if (backButton) backButton.addEventListener("click", window.showHubDashboard);
  const previewButton = $("btn-hub-mistakes");
  if (previewButton) previewButton.addEventListener("click", window.showMistakePanel);
  const startButton = $("btn-hub-start");
  if (startButton) startButton.addEventListener("click", () => {
    if (typeof window.startPractice === "function") window.startPractice();
  });
  const mistakeList = $("mistake-list");
  if (mistakeList) mistakeList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button || !window.learningStore) return;
    const qid = button.dataset.qid;
    if (button.dataset.action === "review") {
      if (typeof window.openQuestion === "function") window.openQuestion(qid);
    } else if (button.dataset.action === "star") {
      window.learningStore.toggleStar(qid);
      renderMistakes(window.learningStore);
    } else if (button.dataset.action === "save-note") {
      const field = mistakeList.querySelector("textarea[data-note-qid='" + qid + "']");
      window.learningStore.setNote(qid, field ? field.value : "");
      button.textContent = "已保存";
    }
  });
  const exportButton = $("btn-export-data");
  if (exportButton) exportButton.addEventListener("click", () => {
    if (!window.learningStore) return;
    const content = JSON.stringify(window.learningStore.exportBackup(), null, 2);
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "python-learning-hub-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });
  const importInput = $("import-data-file");
  if (importInput) importInput.addEventListener("change", async () => {
    const file = importInput.files && importInput.files[0];
    if (!file || !window.learningStore) return;
    try {
      const backup = JSON.parse(await file.text());
      if (!window.confirm("导入备份会替换当前学习记录、错题和已保存代码。建议先导出当前数据。继续吗？")) {
        importInput.value = "";
        return;
      }
      const result = window.learningStore.importBackup(backup);
      window.alert("导入成功：恢复 " + result.attempts + " 条作答记录和 " + result.codes + " 份代码。页面即将刷新。");
      window.location.reload();
    } catch (error) {
      window.alert("导入失败：" + error.message);
      importInput.value = "";
    }
  });
  fetch("data/topic-map.json").then((response) => {
    if (!response.ok) throw new Error("知识点映射文件加载失败");
    return response.json();
  }).then((value) => {
    topicMap = value;
    if (appState) render(appState);
  }).catch((error) => {
    const target = $("mastery-list");
    if (target) target.textContent = error.message;
  });
})();