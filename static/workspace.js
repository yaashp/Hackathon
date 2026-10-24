(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const api = async (url, body) => {
    const response = await fetch(url, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
    return data;
  };
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const today = () => new Date().toLocaleDateString("en-CA");
  const player = JSON.parse(localStorage.getItem("devsightPlayer") || "{}");
  player.xp ||= 0; player.discovered ||= []; player.fixed ||= []; player.quizzed ||= []; player.auditDays ||= []; player.diagnosed ||= []; player.diagnosisHintLevels ||= {}; player.hintsUsed ||= 0; player.independent ||= [];
  const savePlayer = () => localStorage.setItem("devsightPlayer", JSON.stringify(player));
  const state = { audit: null, findings: [], selected: null, shot: "desktop", source: null, proposed: null, isRunning: false, baseline: [], pending: null, mission: { hintLevel: 0, unlocked: false, diagnosed: false }, sampleProject: "" };
  const sourcePicker = $(".source-picker");
  if (sourcePicker) {
    const sourcePath = $("#sourcePath"), sourceLine = $("#sourceLine"), loadButton = $("#loadSource");
    const pathField = document.createElement("label"), lineField = document.createElement("label");
    pathField.append("SOURCE FILE PATH · PROJECT RELATIVE", sourcePath); lineField.append("LINE", sourceLine); sourcePicker.replaceChildren(pathField, lineField, loadButton);
  }

  function showToast(message) { const toast = $("#toast"); toast.textContent = message; toast.classList.add("show"); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("show"), 3200); }
  function award(points, reason) { player.xp += points; savePlayer(); renderPlayer(); showToast(`${reason} · +${points} XP`); }
  function renderPlayer() {
    const level = Math.floor(player.xp / 100) + 1; const progress = player.xp % 100;
    $("#xpTotal").textContent = `${player.xp} XP`; $("#levelLabel").textContent = `Level ${level}`;
    $("#levelBadge").textContent = String(level).padStart(2, "0");
    $("#levelName").textContent = ["Apprentice", "Investigator", "Debugger", "Engineer", "Mentor"][Math.min(level - 1, 4)];
    $("#nextLevelXP").textContent = progress; $("#levelTarget").textContent = 100; $("#xpProgress").style.width = `${progress}%`;
    const days = [...new Set(player.auditDays)].sort(); let streak = 0; let cursor = new Date(`${today()}T12:00:00`);
    const keys = new Set(days); while (keys.has(cursor.toLocaleDateString("en-CA"))) { streak++; cursor.setDate(cursor.getDate() - 1); }
    $("#streakCount").textContent = `🔥 ${streak}`;
    $("#missionsDone").textContent = player.fixed.length; $("#conceptsLearned").textContent = player.diagnosed.length; $("#hintsCount").textContent = player.hintsUsed;
    const badges = [{ name: "Evidence Collector", earned: player.discovered.length > 0, icon: "🔎" }, { name: "Root-Cause Detective", earned: player.diagnosed.length > 0, icon: "🕵️" }, { name: "Independent Debugger", earned: player.independent.length > 0, icon: "🧠" }, { name: "First Fix", earned: player.fixed.length > 0, icon: "🛠️" }, { name: "Bug Hunter ×10", earned: player.fixed.length >= 10, icon: "🏆" }];
    $("#badgeRow").innerHTML = badges.map((b) => `<span class="badge ${b.earned ? "" : "locked"}">${b.earned ? b.icon : "🔒"} ${b.name}</span>`).join("");
  }
  function setStep(index, title, detail, percent) {
    document.querySelectorAll("#stepper li").forEach((step, i) => { step.classList.toggle("done", i < index); step.classList.toggle("active", i === index); });
    $("#journeyTitle").textContent = title; $("#journeyMeta").textContent = detail;
    $("#progressTitle").textContent = title; $("#progressDetail").textContent = detail; $("#progressBar").style.width = `${percent}%`;
  }
  async function runAudit({ verification = false } = {}) {
    if (state.isRunning) return null;
    const project_dir = $("#projectPath").value.trim(); const url = $("#projectUrl").value.trim();
    if (!project_dir || !url) { showToast("Enter the project folder and its localhost URL first."); return null; }
    state.isRunning = true; $("#runAudit").disabled = true; $("#progressWrap").classList.remove("hidden"); $("#emptyEvidence").classList.add("hidden");
    localStorage.setItem("devsightProject", JSON.stringify({ project_dir, url }));
    const stages = [[0, "Detecting errors…", "Opening the selected localhost app", 18], [1, "Analyzing browser evidence…", "Capturing desktop and mobile views", 43], [2, "Tracing the cause…", "Checking runtime errors and responsive signals", 65], [3, "Preparing the review…", "Mapping findings to the local source", 84], [4, "Finishing audit…", "Organizing evidence and recommendations", 96]];
    try {
      setStep(...stages[0]); const request = api("/api/audit", { project_dir, url, mode: "auto" });
      for (let i = 1; i < stages.length; i++) { await delay(280); setStep(...stages[i]); }
      const audit = await request;
      if (verification) {
        state.audit = audit;
        $("#evidenceHeading").textContent = audit.result.summary || "Verification rerun complete";
        $("#findingCount").textContent = (audit.result.findings || []).length;
        $("#runSummary").textContent = `${(audit.result.findings || []).length} finding${(audit.result.findings || []).length === 1 ? "" : "s"} after verification · ${new Date().toLocaleTimeString()}`;
        const shot = (audit.screenshots || []).find((s) => s.label === state.shot) || audit.screenshots?.[0];
        if (shot) $("#evidenceImage").src = shot.url;
        state.findings = audit.result.findings || []; state.selected = state.findings.findIndex((f) => signature(f) === signature(state.pending?.finding));
        renderFindings();
        $("#progressWrap").classList.add("hidden");
        return audit;
      }
      state.audit = audit; state.findings = audit.result.findings || [];
      $("#progressWrap").classList.add("hidden"); $("#evidenceHeading").textContent = audit.result.summary || "Local audit complete";
      $("#runSummary").textContent = `${state.findings.length} finding${state.findings.length === 1 ? "" : "s"} · ${new Date().toLocaleTimeString()}`;
      $("#journeyTitle").textContent = state.findings.length ? "Inspect a finding to uncover its cause" : "Audit complete · review the evidence";
      const shots = audit.screenshots || []; const shot = shots.find((s) => s.label === state.shot) || shots[0];
      if (shot) { $("#evidenceImage").src = shot.url; $("#evidenceImage").classList.remove("hidden"); $("#captureLabel").textContent = `${new URL(url).host} · local screenshot`; }
      $("#emptyEvidence").classList.toggle("hidden", !!shot); $("#findingCount").textContent = state.findings.length;
      renderFindings(); $("#successCard").classList.add("hidden"); $("#journeyMeta").textContent = `${state.findings.length} finding${state.findings.length === 1 ? "" : "s"} · choose one to inspect`;
      document.querySelectorAll("#stepper li").forEach((step, i) => { step.classList.toggle("done", i < 3); step.classList.toggle("active", i === 3); });
      const day = today(); if (!player.auditDays.includes(day)) { player.auditDays.push(day); player.xp += 10; }
      for (const finding of state.findings) { const sig = signature(finding); if (!player.discovered.includes(sig)) { player.discovered.push(sig); player.xp += 5; } }
      savePlayer(); renderPlayer(); showToast(`Audit complete · ${state.findings.length} finding${state.findings.length === 1 ? "" : "s"}`);
      if (state.findings.length) selectFinding(0); else { state.selected = null; $("#detailEmpty").classList.remove("hidden"); $("#detailContent").classList.add("hidden"); $("#detailTitle").textContent = "No findings returned"; }
      return audit;
    } catch (error) { $("#progressWrap").classList.add("hidden"); $("#emptyEvidence").classList.remove("hidden"); $("#evidenceHeading").textContent = "Audit could not complete"; showToast(error.message); return null; }
    finally { state.isRunning = false; $("#runAudit").disabled = false; }
  }
  function signature(finding) { return `${finding.category || ""}|${finding.title || ""}`.toLowerCase().trim(); }
  function missionHints(finding) {
    const category = `${finding.category || ""} ${finding.title || ""} ${finding.evidence || ""}`.toLowerCase();
    const file = finding.file ? `Open ${finding.file}${finding.line ? ` at line ${finding.line}` : ""}.` : "Inspect the browser evidence and identify the element or value involved.";
    if (/undefined|null|map|typeerror|runtime|exception/.test(category)) return ["Start with the exact browser error and the value named in it.", file, "Trace where that value is created or received, just before the failing operation.", "Methods such as .map() need a collection. Missing data can be undefined while an API or state is loading.", "Try guarding the value or using a safe empty default, then rerun the same route."];
    if (/overflow|responsive|width|viewport/.test(category)) return ["Compare the page width with the viewport where the issue appears.", file, "Look for the element whose rendered size exceeds its available container.", "Fixed dimensions do not automatically shrink on a narrower screen.", "Try a fluid width with an appropriate max-width, then check mobile and desktop."];
    if (/accessib|label|name/.test(category)) return ["Inspect the affected control and how assistive technology identifies it.", file, "Check for a visible label, accessible name, or associated description.", "A control needs a programmatic name even when its visual purpose seems obvious.", "Add the missing accessible name and rerun the accessibility check."];
    if (/network|request|resource|image|404|failed/.test(category)) return ["Start with the failed request URL and its response status.", file, "Check whether the URL, route, and resource actually exist.", "A failed request often comes from a path mismatch, missing file, or unavailable service.", "Correct the source or route and repeat the request to confirm it succeeds."];
    return ["Read the evidence and identify what the browser actually observed.", file, "Inspect the referenced element, source line, or failed request.", "Separate the observed symptom from a possible cause; look for the rule or value that explains it.", "Make one small change and rerun the same check to see whether the evidence changes."];
  }
  function unlockMission({ diagnosed = false, solution = false } = {}) {
    state.mission.unlocked = true; state.mission.diagnosed ||= diagnosed;
    $("#causeBox").classList.remove("hidden"); $("#generateFix").disabled = !state.source;
    $("#diagnosisOptions").querySelectorAll("button").forEach((button) => { button.disabled = true; if (button.dataset.correct === "true") button.classList.add("correct"); });
    $("#checkDiagnosis").disabled = true; $("#revealSolution").classList.add("hidden");
    if (solution) $("#diagnosisFeedback").textContent = "Solution revealed. Review the cause, then inspect the source and test a small change.";
    validateEdit();
  }
  function renderMission(finding) {
    state.mission = { hintLevel: 0, unlocked: false, diagnosed: false, diagnosisIndependent: false };
    const sig = signature(finding); const category = `${finding.category || ""} ${finding.title || ""}`.toLowerCase();
    const difficulty = /security|crash|data-loss|critical/.test(category) ? ["Engineer", "5–10 min"] : /overflow|accessib|missing|undefined|typeerror|runtime/.test(category) ? ["Apprentice", "3–5 min"] : ["Investigator", "4–7 min"];
    $("#missionDifficulty").textContent = `${difficulty[0]} · ${finding.severity || "medium"}`;
    $("#missionTime").textContent = `⏱ ${difficulty[1]}`;
    $("#missionStatus").textContent = state.audit?.project_dir === state.sampleProject ? "Practice · seeded sample" : "Live audit · observed evidence";
    $("#rootCause").textContent = finding.root_cause || "Inspect the evidence and surrounding source to identify the cause.";
    $("#lessonRecap").textContent = finding.recommended_fix ? `A possible next step: ${finding.recommended_fix}` : "After verification, compare what changed with the evidence that first exposed the bug.";
    $("#learningHint").textContent = finding.socratic_hint || "Use the evidence to decide which value, request, or rule to inspect first.";
    $("#causeBox").classList.add("hidden"); $("#hintReveal").classList.add("hidden"); $("#diagnosisFeedback").textContent = "";
    $("#questStep").textContent = "1 / 3"; $("#nextHint").textContent = "Need a hint · 1/5"; $("#nextHint").disabled = false;
    $("#checkDiagnosis").disabled = false; $("#revealSolution").classList.remove("hidden"); $("#diagnosisOptions").replaceChildren();
    const correct = finding.root_cause || finding.recommended_fix || `The evidence points to ${finding.title}.`;
    const options = [{ text: correct, correct: true }, { text: "The browser reported an issue, but the source or element evidence is unrelated.", correct: false }, { text: "This is expected behavior and does not need a check.", correct: false }];
    const rotate = Math.abs([...sig].reduce((n, ch) => n + ch.charCodeAt(0), 0)) % options.length;
    const shuffled = options.slice(rotate).concat(options.slice(0, rotate));
    $("#diagnosisOptions").innerHTML = shuffled.map((o, i) => `<button type="button" data-correct="${o.correct}" data-choice="${i}">${escapeHtml(o.text)}</button>`).join("");
    $("#diagnosisOptions").querySelectorAll("button").forEach((button) => button.addEventListener("click", () => { $("#diagnosisOptions").querySelectorAll("button").forEach((b) => b.classList.remove("chosen")); button.classList.add("chosen"); }));
    $("#checkDiagnosis").dataset.signature = sig;
    if (player.diagnosed.includes(sig)) { state.mission.diagnosisIndependent = player.diagnosisHintLevels[sig] === 0; unlockMission({ diagnosed: true }); }
  }
  function checkDiagnosis() {
    const selected = $("#diagnosisOptions .chosen"); if (!selected) { $("#diagnosisFeedback").textContent = "Choose the explanation that best fits the evidence."; return; }
    const sig = $("#checkDiagnosis").dataset.signature; const correct = selected.dataset.correct === "true";
    if (!correct) { $("#diagnosisFeedback").textContent = "Not quite. Recheck the evidence or reveal a hint; there is no XP penalty."; selected.classList.add("incorrect"); return; }
    $("#diagnosisFeedback").textContent = "Good diagnosis! You connected the evidence to the likely cause. +10 XP";
    const firstDiagnosis = !player.diagnosed.includes(sig); if (firstDiagnosis) { player.diagnosed.push(sig); player.diagnosisHintLevels[sig] = state.mission.hintLevel; player.xp += 10; }
    state.mission.diagnosisIndependent = player.diagnosisHintLevels[sig] === 0;
    savePlayer(); renderPlayer(); unlockMission({ diagnosed: true });
    if (firstDiagnosis) showToast(state.mission.hintLevel === 0 ? "Independent diagnosis · +10 XP" : "Root cause identified · +10 XP");
  }
  function revealHint() {
    if (state.mission.unlocked) return;
    const finding = state.findings[state.selected]; if (!finding) return;
    const hints = missionHints(finding); state.mission.hintLevel = Math.min(state.mission.hintLevel + 1, hints.length);
    player.hintsUsed++; savePlayer(); $("#hintReveal").textContent = `Hint ${state.mission.hintLevel}: ${hints[state.mission.hintLevel - 1]}`; $("#hintReveal").classList.remove("hidden");
    $("#nextHint").textContent = state.mission.hintLevel < hints.length ? `Need a hint · ${state.mission.hintLevel + 1}/5` : "All hints shown"; $("#nextHint").disabled = state.mission.hintLevel >= hints.length;
    $("#questStep").textContent = state.mission.hintLevel >= 4 ? "2 / 3" : "1 / 3";
  }
  function renderFindings() {
    const list = $("#findingList");
    if (!state.findings.length) { list.innerHTML = '<div class="empty-list">No findings from this scan. Review the evidence and limitations before calling the app clean.</div>'; return; }
    list.innerHTML = state.findings.map((f, i) => `<button class="finding-item ${state.selected === i ? "selected" : ""}" data-index="${i}"><span class="finding-number">${String(i + 1).padStart(2, "0")}</span><span class="finding-text"><b>${escapeHtml(f.title)}</b><small>${escapeHtml(f.file || f.category || "browser evidence")}${f.line ? ` · line ${f.line}` : ""}</small></span><span class="finding-severity ${escapeHtml(f.severity || "medium")}">${escapeHtml((f.severity || "medium").toUpperCase())}</span></button>`).join("");
    list.querySelectorAll(".finding-item").forEach((button) => button.addEventListener("click", () => selectFinding(Number(button.dataset.index))));
  }
  function selectFinding(index) {
    const finding = state.findings[index]; if (!finding) return;
    state.selected = index; state.source = null; state.proposed = null; state.pending = null;
    $("#detailTitle").textContent = finding.title; $("#detailEmpty").classList.add("hidden"); $("#detailContent").classList.remove("hidden"); $("#successCard").classList.add("hidden");
    $("#severityBadge").textContent = (finding.severity || "medium").toUpperCase(); $("#severityBadge").className = `severity ${finding.severity || "medium"}`;
    $("#detailEvidence").textContent = finding.evidence || "The browser reported a finding without additional evidence.";
    renderMission(finding);
    $("#fileLocation").textContent = finding.file ? `${finding.file}${finding.line ? `:${finding.line}` : ""}` : "Choose a source file to map this finding";
    $("#confidenceValue").textContent = `Confidence ${Math.round((finding.confidence ?? .5) * 100)}%`;
    $("#flowFile").textContent = finding.file || "choose source file"; $("#flowFunction").textContent = finding.file ? finding.file.split(/[/.]/).slice(-2, -1)[0] : "browser evidence"; $("#flowFail").textContent = finding.category || "finding";
    $("#sourcePath").value = finding.file || ""; $("#sourceLine").value = finding.line || ""; $("#fixSource").textContent = finding.file || "Select a source file to load its code";
    $("#oldText").textContent = "Load a file to prepare a reviewable edit."; $("#sourceContext").classList.add("hidden"); $("#newText").value = ""; $("#newText").placeholder = "Generate a safe proposal with Gemma, or paste a small replacement here.";
    $("#applyPatch").disabled = true; $("#verifyAgain").classList.add("hidden"); $("#successCard").classList.add("hidden"); $("#fixNotice").classList.remove("hidden");
    $("#fixNotice").textContent = finding.file ? "Load the mapped file to inspect the relevant code, then generate or edit a small replacement." : "The stack trace did not map to a source file. Enter a project-relative file path below to inspect it.";
    $("#generateFix").disabled = !finding.file || !state.mission.unlocked; renderFindings();
    if (finding.file) loadSource();
  }
  async function loadSource() {
    const finding = state.findings[state.selected]; const relative_path = $("#sourcePath").value.trim();
    if (!relative_path || !state.audit) { showToast("Enter a project-relative source path, such as src/page.tsx."); return; }
    try {
      const file = await api("/api/source", { project_dir: state.audit.project_dir, relative_path });
      const lines = file.content.split("\n"); const at = Math.min(lines.length - 1, Math.max(0, (Number($("#sourceLine").value) || finding?.line || 1) - 1)); const start = Math.max(0, at - 3); const end = Math.min(lines.length, at + 4);
      const oldText = lines[at] || "";
      state.source = { path: file.path, content: file.content, oldText, start, end, lines };
      $("#sourcePath").value = file.path; $("#fixSource").textContent = file.path; $("#fileLocation").textContent = `${file.path}${finding?.line ? `:${finding.line}` : ""}`;
      $("#sourceLine").value = at + 1; $("#sourceContext").innerHTML = lines.slice(start, end).map((row, i) => { const lineNo = start + i + 1; const text = `${String(lineNo).padStart(4, " ")}  ${escapeHtml(row)}`; return lineNo === at + 1 ? `<span class="focus-line">${text}</span>` : text; }).join("\n"); $("#sourceContext").classList.remove("hidden");
      $("#oldText").textContent = oldText; $("#newText").value = oldText;
      $("#fixNotice").textContent = `Showing lines ${start + 1}–${end}. Review a minimal change; applying it creates a backup.`;
      $("#generateFix").disabled = !state.mission.unlocked; validateEdit();
    } catch (error) { $("#fixNotice").textContent = error.message; showToast(error.message); }
  }
  async function generateFix() {
    const finding = state.findings[state.selected]; if (!state.source || !finding) return;
     if (!state.mission.unlocked) { showToast("Make a diagnosis or reveal the solution before generating a fix."); return; }
     const button = $("#generateFix"); button.disabled = true; button.textContent = "Analyzing…";
    try {
      const patch = await api("/api/propose", { project_dir: state.audit.project_dir, relative_path: state.source.path, title: finding.title, evidence: finding.evidence || "", recommended_fix: finding.recommended_fix || finding.root_cause || "" });
      state.proposed = patch; $("#oldText").textContent = patch.old_text; $("#newText").value = patch.new_text;
      $("#fixNotice").textContent = "Gemma proposed a minimal edit. Read both sides before applying."; validateEdit();
    } catch (error) { $("#fixNotice").textContent = error.message.includes("GEMINI_API_KEY") ? "Gemma is not configured yet. Add your key to the local .env file, or edit the replacement below and apply it yourself." : error.message; }
    finally { button.disabled = !state.source; button.textContent = "✦ Generate with Gemma"; }
  }
  function validateEdit() {
    const oldText = state.proposed?.old_text || state.source?.oldText || ""; const newText = $("#newText").value;
     $("#applyPatch").disabled = !state.mission.unlocked || !state.source || !oldText || !newText.trim() || newText === oldText;
  }
  async function applyFix() {
     if (!state.mission.unlocked) { showToast("Complete the diagnosis or reveal the solution first."); return; }
     if (!state.source || !state.audit || state.selected == null) return;
    const finding = state.findings[state.selected]; const old_text = state.proposed?.old_text || state.source.oldText; const new_text = $("#newText").value;
    if (!old_text || !new_text || old_text === new_text) { showToast("Review and edit the proposed replacement before applying."); return; }
    const baseline = state.findings.map(signature); $("#applyPatch").disabled = true; $("#applyPatch").textContent = "Applying…";
    try {
      const result = await api("/api/patch", { project_dir: state.audit.project_dir, relative_path: state.source.path, old_text, new_text });
      state.pending = { finding, baseline, backup: result.backup, old_text, new_text, path: state.source.path };
      $("#fixNotice").textContent = `Patch applied. Backup: ${result.backup}. Reloading your app and checking the result…`;
      await verifyPending();
    } catch (error) { $("#fixNotice").textContent = error.message; showToast(error.message); }
    finally { $("#applyPatch").disabled = false; $("#applyPatch").textContent = "Apply fix"; validateEdit(); }
  }
  async function verifyPending() {
    if (!state.pending) return;
    const pending = state.pending; $("#verifyAgain").disabled = true; $("#verifyAgain").textContent = "Checking…";
    try {
      const audit = await runAudit({ verification: true }); if (!audit) throw new Error("The app could not be reloaded for verification.");
      const after = audit.result.findings || []; const targetRemains = after.some((f) => signature(f) === signature(pending.finding));
      const newFindings = after.filter((f) => !pending.baseline.includes(signature(f)));
      const verified = !targetRemains && newFindings.length === 0;
      if (!verified) { $("#successCard").classList.remove("hidden"); $("#successTitle").textContent = "Verification needs another look"; $("#successCopy").textContent = targetRemains ? "The selected finding still appears after the reload." : "The original finding changed, but the rerun reported a new issue."; $("#quizToggle").classList.add("hidden"); $("#quizArea").classList.add("hidden"); $("#verifyAgain").classList.remove("hidden"); $("#fixNotice").textContent = "The change is saved, but DevSight has not marked it fixed. Review the new evidence or revise the patch."; return; }
       const sig = signature(pending.finding); const firstFix = !player.fixed.includes(sig); const independent = state.mission.diagnosisIndependent && !player.independent.includes(sig); if (firstFix) player.fixed.push(sig); if (independent) player.independent.push(sig); savePlayer();
      $("#successCard").classList.remove("hidden"); $("#successTitle").textContent = "Fix verified!"; $("#successCopy").textContent = `The rerun found no repeat of this issue or new browser findings. Backup saved: ${pending.backup}`;
      $("#quizToggle").classList.remove("hidden"); $("#quizToggle").textContent = player.quizzed.includes(sig) ? "Learning bonus earned ✓" : "Earn learning bonus +15 XP →";
      $("#quizToggle").disabled = player.quizzed.includes(sig); $("#quizArea").classList.add("hidden"); $("#verifyAgain").classList.add("hidden");
      document.querySelectorAll("#stepper li").forEach((step, i) => { step.classList.toggle("done", i < 5); step.classList.remove("active"); });
       $("#journeyTitle").textContent = "Bug fixed and verified!"; $("#journeyMeta").textContent = independent ? "Independent diagnosis · verified fix" : "A clean rerun earns the fix badge"; confetti(); if (firstFix) award(independent ? 40 : 30, independent ? "Verified independent fix" : "Verified fix"); else { renderPlayer(); showToast("Fix verified. XP already earned for this finding."); }
    } catch (error) { $("#successCard").classList.remove("hidden"); $("#successTitle").textContent = "Verification unavailable"; $("#successCopy").textContent = error.message; $("#verifyAgain").classList.remove("hidden"); }
    finally { $("#verifyAgain").disabled = false; $("#verifyAgain").textContent = "↻ Verify again"; }
  }
  async function undoFix() {
    if (!state.pending) return;
    const pending = state.pending;
    try {
      await api("/api/patch", { project_dir: state.audit.project_dir, relative_path: pending.path, old_text: pending.new_text, new_text: pending.old_text });
      $("#successTitle").textContent = "Patch undone"; $("#successCopy").textContent = "The original source has been restored. Re-run the audit to inspect the finding again."; $("#quizToggle").classList.add("hidden"); $("#undoPatch").classList.add("hidden"); $("#quizArea").classList.add("hidden");
      state.pending = null; showToast("Original source restored. Your learning XP stays earned.");
    } catch (error) { showToast(error.message); }
  }
  function confetti() { if (matchMedia("(prefers-reduced-motion: reduce)").matches) return; for (let i = 0; i < 24; i++) { const p = document.createElement("i"); p.className = "confetti"; p.style.left = `${45 + Math.random() * 10}%`; p.style.setProperty("--dx", `${(Math.random() - .5) * 280}px`); p.style.background = ["#ffca6d", "#38d39a", "#f25d77", "#859dff"][i % 4]; document.body.append(p); setTimeout(() => p.remove(), 950); } }
  function openQuiz() {
    if (!state.pending) return; const sig = signature(state.pending.finding); if (player.quizzed.includes(sig)) return;
    $("#quizQuestion").textContent = state.pending.finding.socratic_hint || `What caused “${state.pending.finding.title}”?`;
    const answers = ["The value or rule shown in the evidence was handled incorrectly.", "The browser always reports this when an app starts.", "A change to the page title caused it."];
    $("#quizOptions").innerHTML = answers.map((answer, i) => `<button data-answer="${i}">${escapeHtml(answer)}</button>`).join(""); $("#quizArea").classList.remove("hidden"); $("#quizFeedback").textContent = "Choose the answer that best matches the finding.";
    $("#quizOptions").querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
      const right = button.dataset.answer === "0"; $("#quizOptions").querySelectorAll("button").forEach((b) => { b.disabled = true; if (b.dataset.answer === "0") b.classList.add("correct"); });
      $("#quizFeedback").textContent = right ? "Exactly — connect the evidence to the root cause. +15 XP" : "Not quite. Re-read the evidence and root cause above.";
      if (right) { player.quizzed.push(sig); player.xp += 15; savePlayer(); renderPlayer(); $("#quizToggle").textContent = "Learning bonus earned ✓"; $("#quizToggle").disabled = true; }
    }));
  }
  async function loadModelStatus() {
    try { const status = await api("/api/status"); state.sampleProject = status.sample_project; $("#modelStatus").textContent = status.model_configured ? `Gemma ready · ${status.model}` : "Rule-based scan · Gemma optional"; $("#modelStatus").classList.toggle("ready", status.model_configured); $("#projectPath").value ||= status.sample_project; $("#projectUrl").value ||= status.sample_url; }
    catch { $("#modelStatus").textContent = "Backend unavailable"; }
    const saved = JSON.parse(localStorage.getItem("devsightProject") || "{}"); if (saved.project_dir) $("#projectPath").value = saved.project_dir; if (saved.url) $("#projectUrl").value = saved.url;
  }
  $("#runAudit").addEventListener("click", () => runAudit());
  $("#loadDemo").addEventListener("click", async () => { try { const status = await api("/api/status"); $("#projectPath").value = status.sample_project; $("#projectUrl").value = status.sample_url; showToast("Sample project connected. Run an audit when ready."); } catch (error) { showToast(error.message); } });
  $("#loadSource").addEventListener("click", loadSource); $("#generateFix").addEventListener("click", generateFix); $("#applyPatch").addEventListener("click", applyFix); $("#verifyAgain").addEventListener("click", verifyPending); $("#undoPatch").addEventListener("click", undoFix); $("#quizToggle").addEventListener("click", openQuiz); $("#newText").addEventListener("input", validateEdit);
  $("#checkDiagnosis").addEventListener("click", checkDiagnosis); $("#nextHint").addEventListener("click", revealHint); $("#revealSolution").addEventListener("click", () => { unlockMission({ solution: true }); $("#questStep").textContent = "2 / 3"; });
  $("#sourcePath").addEventListener("keydown", (e) => { if (e.key === "Enter") loadSource(); });
  document.querySelectorAll(".theme-switch button[data-theme]").forEach((button) => button.addEventListener("click", () => { document.body.dataset.theme = button.dataset.theme; localStorage.setItem("devsightTheme", button.dataset.theme); document.querySelectorAll(".theme-switch button").forEach((b) => b.classList.toggle("active", b === button)); }));
  document.querySelectorAll("[data-shot]").forEach((button) => button.addEventListener("click", () => { state.shot = button.dataset.shot; document.querySelectorAll("[data-shot]").forEach((b) => b.classList.toggle("active", b === button)); const shot = state.audit?.screenshots.find((s) => s.label === state.shot); if (shot) { $("#evidenceImage").src = shot.url; $("#captureSize").textContent = state.shot === "mobile" ? "390 × 844" : "1440 × 900"; } }));
  document.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.target.matches("textarea") && (e.target.matches("input") || e.target === document.body)) { e.preventDefault(); runAudit(); } });
  document.addEventListener("keydown", (e) => { if (e.target.matches("input,textarea,button")) return; if ((e.key === "j" || e.key === "k") && state.findings.length) { const direction = e.key === "j" ? 1 : -1; const current = Math.max(state.selected, 0); selectFinding((current + direction + state.findings.length) % state.findings.length); } });
  document.body.dataset.theme = localStorage.getItem("devsightTheme") || "pro"; document.querySelectorAll(".theme-switch button").forEach((b) => b.classList.toggle("active", b.dataset.theme === document.body.dataset.theme));
  renderPlayer(); loadModelStatus();
})();
