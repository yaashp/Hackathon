const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const api = async (path, body) => {
  const response = await fetch(path, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
  return data;
};

let state = null;
let selectedIndex = 0;
let flowScale = 1;
let flowOffset = { x: 0, y: 0 };
let draggingFlow = false;
let lastPoint = null;
let quizIssue = null;
let localProfile = JSON.parse(localStorage.getItem("fairDropProfile") || "{}");
localProfile.xp ||= 0;
localProfile.fixed ||= [];
localProfile.verified ||= [];
localProfile.quizzed ||= [];

const currentIssue = () => state?.issues[selectedIndex];
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const persistProfile = () => localStorage.setItem("fairDropProfile", JSON.stringify(localProfile));
function toast(message) { const el = $("#toast"); el.textContent = message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2700); }
function setTheme(theme) { document.body.dataset.theme = theme; localStorage.setItem("fairDropTheme", theme); $$(".theme-button").forEach((b) => b.classList.toggle("active", b.dataset.themeChoice === theme)); }

function renderProfile() {
  $("#xpValue").textContent = `${localProfile.xp} XP`;
  $("#levelValue").textContent = `Level ${Math.floor(localProfile.xp / 100) + 1}`;
  $("#streakBadge").textContent = `🔥 ${localProfile.fixed.length ? 1 : 0} day streak`;
}

async function loadState() {
  state = await api("/api/demo/state");
  selectedIndex = Math.min(selectedIndex, state.issues.length - 1);
  render();
}

function render() {
  if (!state) return;
  const issue = currentIssue();
  const isVerified = issue.is_fixed && localProfile.verified.includes(issue.id);
  const unfinished = state.issues.filter((x) => !x.is_fixed).length;
  $("#totalCount").textContent = state.total;
  $("#fixedCount").textContent = state.issues.filter((x) => localProfile.verified.includes(x.id)).length;
  $("#rootBadge").textContent = unfinished;
  $("#rootBadge").classList.toggle("hidden", unfinished === 0);
  $("#errorCounter").textContent = isVerified ? "ERROR FIXED · VERIFIED" : issue.is_fixed ? "FIX APPLIED · CHECK PENDING" : `ERROR ${selectedIndex + 1} OF ${state.total}`;
  $("#errorIndex").textContent = `Error ${selectedIndex + 1} of ${state.total}`;
  $("#difficultyBadge").textContent = issue.difficulty.toUpperCase();
  $("#difficultyBadge").className = `difficulty ${issue.difficulty.toLowerCase()}`;
  $("#issueTitle").textContent = isVerified ? `${issue.title} · fixed` : issue.is_fixed ? `${issue.title} · checking needed` : issue.title;
  $("#errorMessage").textContent = isVerified ? "Verified: the failing expression is gone and the sample route no longer throws." : issue.is_fixed ? "The source was updated. Reload and verify the route before calling this fixed." : issue.error;
  $("#issueFile").textContent = issue.path;
  $("#issueLine").textContent = `${issue.line}, column ${Math.max(1, issue.bad.indexOf(issue.token) + 1)}`;
  $("#issueCause").textContent = issue.cause;
  $("#flowFile").textContent = issue.path;
  $("#flowVariable").textContent = issue.variable;
  $("#flowCall").textContent = issue.token;
  $("#flowFix").textContent = issue.fixed.trim().replace(/^const /, "").replace(/;$/, "");
  $("#activePath").textContent = issue.path;
  $("#tabName").textContent = issue.path.split("/").pop();
  $("#originalName").textContent = issue.path.split("/").pop();
  $("#fixedName").textContent = issue.path.split("/").pop();
  $("#editorPosition").textContent = `Ln ${issue.line}, Col ${Math.max(1, issue.bad.indexOf(issue.token) + 1)}`;
  $("#whyText").textContent = issue.explanation;
  $("#tooltipFix").textContent = issue.quick_fix;
  $("#explainText").textContent = `${issue.explanation} ${issue.cause}`;
  $("#explainPanel").classList.add("hidden");
  $("#fixedCard").classList.toggle("hidden", !issue.is_fixed);
  $("#undoFix").classList.toggle("hidden", !issue.is_fixed);
  $("#applyFix").classList.toggle("hidden", issue.is_fixed);
  $("#rejectFix").classList.toggle("hidden", issue.is_fixed);
  $("#fixedHeading").textContent = isVerified ? "Error fixed!" : "Fix applied · verify pending";
  $("#verificationText").textContent = isVerified ? "The sample route reloaded without this seeded error." : issue.is_fixed ? "Source changed, but runtime verification did not pass. Retry after checking the sample app is running." : "";
  $("#verifyAgain").classList.toggle("hidden", !issue.is_fixed || isVerified);
  $("#quizButton").classList.toggle("hidden", !isVerified);
  $("#quizButton").textContent = localProfile.quizzed.includes(issue.id) ? "Bonus earned ✓" : "Earn bonus XP →";
  $("#quizButton").disabled = localProfile.quizzed.includes(issue.id);
  const mood = $("#mascot");
  mood.textContent = isVerified ? "😸" : issue.is_fixed ? "🤔" : "🐱";
  mood.classList.toggle("celebrate", isVerified);
  $("#mascotText").textContent = isVerified ? "We fixed it and checked the route. Want to lock in the learning?" : issue.is_fixed ? "The fix is in. Let’s make sure the app runs cleanly." : "Oops, I found a bug. Let’s figure out why!";
  renderStepper(issue, isVerified);
  renderTree();
  renderCode(issue);
  renderProfile();
}

function renderStepper(issue, isVerified) {
  const completed = isVerified ? 5 : issue.is_fixed ? 4 : 3;
  $$(".step").forEach((step, i) => {
    step.classList.toggle("complete", i < completed);
    step.classList.toggle("active", !isVerified && i === (issue.is_fixed ? 4 : 3));
    if (isVerified && i === 4) step.classList.add("complete");
    else if (i === 4 && !isVerified) step.classList.remove("complete");
  });
  const fill = isVerified ? "100%" : issue.is_fixed ? "78%" : "56%";
  document.documentElement.style.setProperty("--step-fill", fill);
}

function renderTree() {
  const issues = state.issues;
  const groups = new Map();
  for (const issue of issues) {
    const folder = issue.path.split("/").slice(0, -1).join("/");
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder).push(issue);
  }
  $("#fileTree").innerHTML = [...groups].map(([folder, items]) => `<div class="tree-folder"><span>⌄</span><b>${escapeHtml(folder.split("/").slice(-1)[0])}</b><span class="tree-badge">${items.filter((i) => !i.is_fixed).length || "✓"}</span></div>${items.map((item) => `<button class="tree-file ${item.id === currentIssue().id ? "active" : ""}" data-issue="${escapeHtml(item.id)}"><span class="file-react">✿</span><span class="file-name">${escapeHtml(item.path.split("/").pop())}</span>${item.is_fixed ? '<span class="tree-fixed">✓</span>' : '<span class="tree-badge">1</span>'}</button>`).join("")}`).join("");
  $$(".tree-file").forEach((button) => button.addEventListener("click", () => selectIssue(button.dataset.issue)));
}

function tokenMarkup(code, issue, isFixed) {
  let escaped = escapeHtml(code);
  escaped = escaped.replace(/&quot;[^&]*?&quot;|&#39;[^&]*?&#39;/g, (match) => `<span class="tok-string">${match}</span>`);
  escaped = escaped.replace(/\b(const|let|return|export|default|function|type|interface|any|undefined|null|useEffect|useState)\b/g, '<span class="tok-keyword">$1</span>');
  escaped = escaped.replace(/\b(EventRow|Event|Promise|React)\b/g, '<span class="tok-type">$1</span>');
  const token = escapeHtml(issue.token);
  if (token && escaped.includes(token)) escaped = escaped.replace(token, `<span class="error-token">${token}</span>`);
  if (isFixed) {
    const repaired = escapeHtml(issue.fixed.trim());
    const old = escapeHtml(issue.bad.trim());
    const changed = repaired.replace(old, "");
    if (changed && escaped.includes(changed.trim())) {
      const changedText = changed.trim();
      escaped = escaped.replace(changedText, `<span class="diff-token">${changedText}</span>`);
    }
  }
  return escaped || " ";
}

function renderCode(issue) {
  const rows = issue.source.replace(/\r/g, "").split("\n");
  const targetIndex = Math.max(0, issue.line - 1);
  const proposedRows = [...rows];
  if (!issue.is_fixed && proposedRows[targetIndex]?.includes(issue.bad.trim())) {
    proposedRows[targetIndex] = proposedRows[targetIndex].replace(issue.bad.trim(), issue.fixed.trim());
  } else if (!issue.is_fixed) {
    const match = proposedRows.findIndex((row) => row.includes(issue.bad.trim()));
    if (match >= 0) proposedRows[match] = proposedRows[match].replace(issue.bad.trim(), issue.fixed.trim());
  }
  const actualBadIndex = rows.findIndex((row) => row.includes(issue.bad.trim()));
  const actualFixedIndex = rows.findIndex((row) => row.includes(issue.fixed.trim()));
  const highlightIndex = actualBadIndex >= 0 ? actualBadIndex : actualFixedIndex;
  const paint = (list, pane) => list.map((row, index) => {
    const isError = index === highlightIndex && !issue.is_fixed && pane === "original";
    const isAdded = index === (actualBadIndex >= 0 ? actualBadIndex : actualFixedIndex) && pane === "fixed";
    const isRemoved = index === highlightIndex && pane === "original";
    const dim = index !== highlightIndex && !/^\s*(import|export|type|interface)/.test(row) && Math.abs(index - highlightIndex) > 3;
    const classes = ["code-line", isError ? "error-line error-focus" : "", dim && pane === "original" ? "context-dim" : "", isAdded ? "diff-added" : "", isRemoved && pane === "original" ? "diff-removed" : ""].filter(Boolean).join(" ");
    const code = tokenMarkup(row, issue, pane === "fixed");
    const detail = isError ? `<span class="inline-error">${escapeHtml(issue.error)}</span>` : "";
    const gutter = isError ? '<span class="gutter-error">!</span>' : "";
    return `<div class="${classes}" data-line="${index + 1}">${gutter}<span class="line-num">${String(index + 1).padStart(2, " ")}</span><span class="line-code">${code}${detail}</span></div>`;
  }).join("");
  $("#originalCode").innerHTML = paint(rows, "original");
  $("#fixedCode").innerHTML = paint(proposedRows, "fixed");
  const errorLine = $("#originalCode .error-line");
  if (errorLine) {
    errorLine.addEventListener("mouseenter", () => $("#whyTooltip").classList.add("visible"));
    errorLine.addEventListener("mouseleave", () => $("#whyTooltip").classList.remove("visible"));
    $("#originalScroll").scrollTop = Math.max(0, errorLine.offsetTop - 110);
    $("#fixedScroll").scrollTop = Math.max(0, errorLine.offsetTop - 110);
  }
  $("#originalScroll").scrollTop = 0;
  $("#fixedScroll").scrollTop = 0;
}

function selectIssue(id) {
  const index = state.issues.findIndex((x) => x.id === id);
  if (index < 0) return;
  selectedIndex = index;
  render();
}
function moveIssue(direction) {
  if (!state?.issues.length) return;
  selectedIndex = (selectedIndex + direction + state.issues.length) % state.issues.length;
  render();
}
function syncScroll(source, target) {
  let syncing = false;
  source.addEventListener("scroll", () => {
    if (syncing) return;
    syncing = true;
    target.scrollTop = source.scrollTop;
    target.scrollLeft = source.scrollLeft;
    requestAnimationFrame(() => { syncing = false; });
  }, { passive: true });
}

function confettiBurst() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#3ecb91", "#ffcd64", "#6b8eff", "#ee78a6", "#9b7bf6"];
  for (let i = 0; i < 26; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${45 + Math.random() * 10}%`;
    piece.style.top = `${Math.max(130, window.innerHeight * .42)}px`;
    piece.style.background = colors[i % colors.length];
    piece.style.setProperty("--dx", `${(Math.random() - .5) * 300}px`);
    piece.style.setProperty("--dy", `${70 + Math.random() * 180}px`);
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 1000);
  }
}

async function applyCurrentFix() {
  const issue = currentIssue();
  if (!issue || issue.is_fixed) return;
  const button = $("#applyFix");
  button.disabled = true;
  button.querySelector("span").textContent = "Applying…";
  $("#mascot").classList.add("thinking");
  try {
    const applied = await api("/api/patch", { project_dir: state.project_dir, relative_path: issue.path, old_text: issue.bad, new_text: issue.fixed });
    const verification = await api("/api/demo/verify", { issue_id: issue.id });
    if (!verification.verified) {
      await loadState();
      $("#mascot").classList.remove("thinking");
      toast(verification.message || "The fix was written, but runtime verification needs attention.");
      return;
    }
    if (verification.runtime_verified) {
      if (!localProfile.verified.includes(issue.id)) localProfile.verified.push(issue.id);
    }
    if (verification.runtime_verified && !localProfile.fixed.includes(issue.id)) {
      localProfile.fixed.push(issue.id);
      localProfile.xp += issue.xp;
    }
    persistProfile();
    await loadState();
    $("#verificationText").textContent = `${verification.message} ${verification.remaining ? `${verification.remaining} seeded error${verification.remaining === 1 ? "" : "s"} remain.` : "All three seeded routes now pass."} Backup saved: ${applied.backup}`;
    $("#mascot").classList.remove("thinking");
    if (verification.runtime_verified) {
      $("#mascot").classList.add("celebrate");
      confettiBurst();
      toast(`Verified fix! +${issue.xp} XP`);
    } else {
      toast("Source changed. Runtime verification is pending; no XP awarded yet.");
    }
  } catch (error) {
    $("#mascot").classList.remove("thinking");
    toast(error.message);
  } finally {
    button.disabled = false;
    button.querySelector("span").textContent = "Apply fix";
  }
}

async function verifyCurrentFix() {
  const issue = currentIssue();
  if (!issue?.is_fixed) return;
  try {
    const result = await api("/api/demo/verify", { issue_id: issue.id });
    if (result.runtime_verified) {
      if (!localProfile.verified.includes(issue.id)) localProfile.verified.push(issue.id);
      if (!localProfile.fixed.includes(issue.id)) { localProfile.fixed.push(issue.id); localProfile.xp += issue.xp; }
      persistProfile();
      await loadState();
      confettiBurst();
      toast(`Verified fix! +${issue.xp} XP`);
    } else {
      toast(result.message || "Runtime verification is still pending.");
    }
  } catch (error) { toast(error.message); }
}

async function undoCurrentFix() {
  const issue = currentIssue();
  if (!issue?.is_fixed) return;
  try {
    await api("/api/patch", { project_dir: state.project_dir, relative_path: issue.path, old_text: issue.fixed, new_text: issue.bad });
    const prior = localProfile.fixed.indexOf(issue.id);
    if (prior >= 0) { localProfile.fixed.splice(prior, 1); localProfile.xp = Math.max(0, localProfile.xp - issue.xp); }
    localProfile.verified = localProfile.verified.filter((id) => id !== issue.id);
    localProfile.quizzed = localProfile.quizzed.filter((id) => id !== issue.id);
    persistProfile();
    await loadState();
    toast("Fix undone. The original error is back and ready to inspect.");
  } catch (error) { toast(error.message); }
}

function openQuiz() {
  const issue = currentIssue();
  if (!issue || localProfile.quizzed.includes(issue.id)) return;
  quizIssue = issue;
  $("#quizQuestion").textContent = issue.bonus_question;
  $("#quizFeedback").textContent = "Choose an answer to earn 20 bonus XP.";
  $("#quizAnswers").innerHTML = issue.bonus_answers.map((answer, i) => `<button class="quiz-answer" data-answer="${i}">${escapeHtml(answer)}</button>`).join("");
  $$(".quiz-answer").forEach((button) => button.addEventListener("click", () => {
    const correct = Number(button.dataset.answer) === 0;
    $$(".quiz-answer").forEach((b) => b.disabled = true);
    button.classList.add(correct ? "correct" : "wrong");
    $("#quizFeedback").textContent = correct ? "Exactly! You understand why the guard matters. +20 XP" : `Not quite. ${quizIssue.explanation}`;
    if (correct && !localProfile.quizzed.includes(quizIssue.id)) {
      localProfile.quizzed.push(quizIssue.id); localProfile.xp += 20; persistProfile(); renderProfile(); $("#quizButton").textContent = "Bonus earned ✓"; $("#quizButton").disabled = true;
    }
  }));
  $("#quizDialog").showModal();
}

function applyFlowTransform() { $("#flowCanvas").style.transform = `translate(${flowOffset.x}px,${flowOffset.y}px) scale(${flowScale})`; }
function flowZoom(factor) { flowScale = Math.max(.68, Math.min(1.6, flowScale * factor)); applyFlowTransform(); }

$("#prevError").addEventListener("click", () => moveIssue(-1));
$("#nextError").addEventListener("click", () => moveIssue(1));
$("#nextErrorLabel").addEventListener("click", () => moveIssue(1));
$("#applyFix").addEventListener("click", applyCurrentFix);
$("#undoFix").addEventListener("click", undoCurrentFix);
$("#verifyAgain").addEventListener("click", verifyCurrentFix);
$("#rejectFix").addEventListener("click", () => { $("#fixedCode").innerHTML = $("#originalCode").innerHTML; toast("Suggested fix rejected. Your source file is unchanged."); });
$("#openQuickFix").addEventListener("click", () => { $("#whyTooltip").classList.toggle("visible"); const line = $("#originalCode .error-line"); if (line) $("#originalScroll").scrollTo({ top: Math.max(0, line.offsetTop - 110), behavior: "smooth" }); });
$("#explainButton").addEventListener("click", () => $("#explainPanel").classList.toggle("hidden"));
$("#closeExplain").addEventListener("click", () => $("#explainPanel").classList.add("hidden"));
$("#quizButton").addEventListener("click", openQuiz);
$("#collapseTree").addEventListener("click", () => document.body.classList.toggle("tree-collapsed"));
$("#flowZoomIn").addEventListener("click", () => flowZoom(1.12));
$("#flowZoomOut").addEventListener("click", () => flowZoom(.89));
$("#flowReset").addEventListener("click", () => { flowScale = 1; flowOffset = { x: 0, y: 0 }; applyFlowTransform(); });
$("#flowFocus").addEventListener("click", () => { $("#flowViewport").scrollIntoView({ block: "center", behavior: "smooth" }); flowScale = 1.1; applyFlowTransform(); });
$("#flowViewport").addEventListener("wheel", (event) => { event.preventDefault(); flowZoom(event.deltaY < 0 ? 1.05 : .95); }, { passive: false });
$("#flowViewport").addEventListener("pointerdown", (event) => { if (event.target.closest(".flow-node")) return; draggingFlow = true; lastPoint = { x: event.clientX, y: event.clientY }; $("#flowViewport").classList.add("dragging"); });
window.addEventListener("pointermove", (event) => { if (!draggingFlow || !lastPoint) return; flowOffset.x += event.clientX - lastPoint.x; flowOffset.y += event.clientY - lastPoint.y; lastPoint = { x: event.clientX, y: event.clientY }; applyFlowTransform(); });
window.addEventListener("pointerup", () => { draggingFlow = false; lastPoint = null; $("#flowViewport").classList.remove("dragging"); });
$$(".flow-node").forEach((node) => node.addEventListener("click", () => {
  const issue = currentIssue();
  const errorLine = $("#originalCode .error-line");
  if (errorLine) $("#originalScroll").scrollTo({ top: Math.max(0, errorLine.offsetTop - 110), behavior: "smooth" });
  const fixLine = $("#fixedCode .diff-added");
  if (node.dataset.select === "fix" && fixLine) $("#fixedScroll").scrollTo({ top: Math.max(0, fixLine.offsetTop - 110), behavior: "smooth" });
  if (node.dataset.select === "variable" || node.dataset.select === "call") { $("#whyTooltip").classList.add("visible"); $("#whyText").textContent = issue.explanation; }
}));
$$((".theme-button")).forEach((button) => button.addEventListener("click", () => setTheme(button.dataset.themeChoice)));
$("#quizDialog .close-dialog").addEventListener("click", () => $("#quizDialog").close());
$("#originalScroll").addEventListener("scroll", () => { const other = $("#fixedScroll"); other.scrollTop = $("#originalScroll").scrollTop; other.scrollLeft = $("#originalScroll").scrollLeft; }, { passive: true });
$("#fixedScroll").addEventListener("scroll", () => { const other = $("#originalScroll"); other.scrollTop = $("#fixedScroll").scrollTop; other.scrollLeft = $("#fixedScroll").scrollLeft; }, { passive: true });
window.addEventListener("keydown", (event) => {
  const editing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
  if (editing || $("#quizDialog").open) return;
  if (event.key.toLowerCase() === "j") { event.preventDefault(); moveIssue(1); }
  if (event.key.toLowerCase() === "k") { event.preventDefault(); moveIssue(-1); }
  if (event.key === "Enter" && !currentIssue()?.is_fixed) { event.preventDefault(); applyCurrentFix(); }
});
setTheme(localStorage.getItem("fairDropTheme") || "beginner");
renderProfile();
history.scrollRestoration = "manual";
window.scrollTo(0, 0);
setTimeout(() => window.scrollTo({ top: 0, behavior: "instant" }), 0);
syncScroll($("#originalScroll"), $("#fixedScroll"));
loadState().catch((error) => { toast(`Could not load seeded project: ${error.message}`); $("#issueTitle").textContent = "Sample project unavailable"; });
