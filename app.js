(() => {
  "use strict";

  const state = {
    projectName: "Landing page",
    projectPath: "~/Projects/landing-page",
    projectUrl: "http://localhost:5173",
    evidence: "mobile",
    finding: "overflow",
    answerRevealed: false,
    labelAnswerRevealed: false,
    patchApplied: false,
    verificationDone: false,
    auditRunning: false,
    filterVisualOnly: false,
    lastAuditMode: "complete",
    activeChapter: "evidence",
    soundEnabled: true
  };

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  // DOM Elements
  const runButton = $("#run-audit");
  const runButtonHero = $("#run-audit-hero");
  const runButtonLabel = $("#run-audit-label");
  const auditProgress = $("#audit-progress");
  const auditFeedback = $("#audit-feedback");
  const captureFrame = $("#capture-frame");
  const captureArea = $("#capture-area");
  const captureStage = $(".capture-stage");
  const sourceEvidence = $(".source-evidence");
  const desktopCaption = $("#desktop-caption");
  const overflowDetail = $("#overflow-detail");
  const labelDetail = $("#label-detail");
  const answerReveal = $("#answer-reveal");
  const labelAnswer = $("#label-answer");
  const patchModal = $("#patch-modal");
  const projectModal = $("#project-modal");
  const fullMenu = $("#full-menu");
  const burgerToggle = $("#burger-toggle");
  const chaptersTrigger = $("#chapters-trigger");
  const chaptersDrawer = $("#chapters-drawer");
  const soundToggle = $("#sound-toggle");

  let focusBeforeModal = null;
  let toastTimer = 0;

  // Web Audio Telemetry Synthesizer (Zero-dependency audio clicks & blips)
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx && typeof window.AudioContext !== "undefined") {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTelemetrySound(type = "tick") {
    if (!state.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === "tick") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.04);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === "blip") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === "success") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.08); // A5
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      }
    } catch {
      // Audio policy safe
    }
  }

  // Create Synthetic Signals & DOM evidence container
  const signalsEvidence = document.createElement("div");
  signalsEvidence.className = "signals-evidence";
  signalsEvidence.hidden = true;
  signalsEvidence.setAttribute("aria-label", "Synthetic browser console and DOM evidence");
  signalsEvidence.innerHTML = `
    <div class="signals-evidence-heading">
      <div>
        <span class="signal-label-kicker">SYNTHETIC BROWSER LOG</span>
        <h3>Console &amp; page errors</h3>
      </div>
      <span class="signal-evidence-status">1 warning · 0 errors</span>
    </div>
    <div class="console-line" id="console-sample-line">
      <span class="console-level">WARN</span>
      <code>Image resource used a fallback placeholder in the demo card.</code>
      <span class="console-time">10:42:08</span>
    </div>
    <div class="console-empty" id="console-no-errors"><span>✓</span> No page exceptions in the bundled sample.</div>
    <div class="console-empty console-unavailable" id="console-unavailable" hidden><span>!</span> Console evidence is unavailable in this partial-result example.</div>
    <div class="signals-evidence-heading dom-heading">
      <div>
        <span class="signal-label-kicker">SYNTHETIC DOM SNAPSHOT</span>
        <h3>Relevant elements</h3>
      </div>
      <span class="signal-evidence-status dom-status">6 nodes</span>
    </div>
    <div class="dom-list">
      <div class="dom-node"><span class="dom-depth">01</span><code>&lt;main&gt;</code><span>landmark</span><b>OK</b></div>
      <div class="dom-node dom-node-focus"><span class="dom-depth">02</span><code>&lt;article.feature-card&gt;</code><span>width: 520px</span><b>OVERFLOW</b></div>
      <div class="dom-node"><span class="dom-depth">03</span><code>&lt;button&gt;</code><span>accessible name: missing</span><b>REVIEW</b></div>
      <div class="dom-node"><span class="dom-depth">04</span><code>&lt;footer&gt;</code><span>landmark</span><b>OK</b></div>
    </div>
    <div class="signals-evidence-note">All console and DOM entries above are fixed demo data, not collected from a browser.</div>
  `;
  if (captureStage) captureStage.append(signalsEvidence);

  const sampleConsoleLine = $("#console-sample-line", signalsEvidence);
  const consoleNoErrorsLine = $("#console-no-errors", signalsEvidence);
  const unavailableConsoleLine = $("#console-unavailable", signalsEvidence);
  const consoleEvidenceStatus = $(".signal-evidence-status", signalsEvidence);

  function showToast(message, type = "success") {
    const region = $("#toast-region");
    if (!region) return;
    const toast = document.createElement("div");
    toast.className = `toast${type === "error" ? " toast-error" : ""}`;
    const mark = document.createElement("span");
    mark.className = "toast-mark";
    mark.textContent = type === "error" ? "!" : "✓";
    const text = document.createElement("span");
    text.textContent = message;
    toast.append(mark, text);
    region.replaceChildren(toast);
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.remove(), 3600);
    playTelemetrySound(type === "error" ? "blip" : "success");
  }

  function setFeedback(kind, title, detail) {
    if (!auditFeedback) return;
    auditFeedback.className = `audit-feedback${kind === "partial" ? " partial" : kind === "error" ? " error" : ""}`;
    auditFeedback.replaceChildren();
    const icon = document.createElement("span");
    icon.className = "feedback-icon";
    icon.textContent = kind === "error" ? "!" : kind === "partial" ? "◐" : "✓";
    const copy = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = `${title} `;
    copy.append(strong, document.createTextNode(detail));
    auditFeedback.append(icon, copy);
    auditFeedback.hidden = false;
  }

  function hideFeedback() {
    if (auditFeedback) auditFeedback.hidden = true;
  }

  function setConsoleEvidenceAvailable(available) {
    if (sampleConsoleLine) sampleConsoleLine.hidden = !available;
    if (consoleNoErrorsLine) consoleNoErrorsLine.hidden = !available;
    if (unavailableConsoleLine) unavailableConsoleLine.hidden = available;
    if (consoleEvidenceStatus) {
      consoleEvidenceStatus.textContent = available ? "1 warning · 0 errors" : "Unavailable";
      consoleEvidenceStatus.classList.toggle("is-unavailable", !available);
    }
  }

  function setProgress(stage, detail, width) {
    const titleEl = $("#progress-title");
    const detailEl = $("#progress-detail");
    const fillEl = $("#progress-fill");
    if (titleEl) titleEl.textContent = stage;
    if (detailEl) detailEl.textContent = detail;
    if (fillEl) fillEl.style.width = `${width}%`;
    playTelemetrySound("tick");
  }

  function startAudit(mode = "complete") {
    if (state.auditRunning) return;
    state.auditRunning = true;
    hideFeedback();
    if (auditProgress) auditProgress.hidden = false;
    if (runButton) runButton.disabled = true;
    if (runButtonHero) runButtonHero.disabled = true;
    if (runButtonLabel) runButtonLabel.textContent = "Auditing…";

    playTelemetrySound("blip");
    setProgress("Initiating precision audit…", "Loading the synthetic sample evidence telemetry", 18);
    window.setTimeout(() => setProgress("Reviewing viewport signals…", "Comparing fixed mobile (390px) and desktop (1440px) metrics", 58), 400);
    window.setTimeout(() => setProgress("Synthesizing findings…", "Organizing multi-angle reviewer diagnostics", 84), 850);
    window.setTimeout(() => {
      if (auditProgress) auditProgress.hidden = true;
      if (runButton) runButton.disabled = false;
      if (runButtonHero) runButtonHero.disabled = false;
      if (runButtonLabel) runButtonLabel.textContent = "Run audit";
      state.auditRunning = false;

      if (mode === "error") {
        setFeedback("error", "Audit couldn't complete.", "This simulated error state surfaces how telemetry run disruptions are communicated. Retry Run audit to continue.");
        showToast("Demo error state simulated. No browser process failed.", "error");
        return;
      }

      if (mode === "partial") {
        state.lastAuditMode = "partial";
        setConsoleEvidenceAvailable(false);
        const sigTitle = $("#signal-summary-title");
        const conSummary = $("#console-summary");
        const sigCount = $(".signal-count");
        if (sigTitle) sigTitle.textContent = "2 of 3 evidence sources";
        if (conSummary) conSummary.textContent = "Unavailable in this partial-result run";
        if (sigCount) sigCount.textContent = "1";
        setFeedback("partial", "Partial result.", "Visual telemetry is active, but synthetic console logging is flagged unavailable. Treat findings as partial.");
        showToast("Partial telemetry result. One source unavailable.");
        return;
      }

      state.lastAuditMode = "complete";
      setConsoleEvidenceAvailable(true);
      const sigTitle = $("#signal-summary-title");
      const conSummary = $("#console-summary");
      const sigCount = $(".signal-count");
      if (sigTitle) sigTitle.textContent = "3 evidence sources";
      if (conSummary) conSummary.textContent = "1 warning · 0 page errors";
      if (sigCount) sigCount.textContent = "2";
      setFeedback("complete", "Precision audit complete.", "Two seeded findings identified. No external files read or modified.");
      showToast("Synthetic audit telemetry is ready.");
    }, 1300);
  }

  function setEvidence(mode) {
    state.evidence = mode;
    playTelemetrySound("tick");
    $$(".evidence-tab, .segment-tab").forEach((tab) => {
      const active = tab.dataset.evidence === mode;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });

    const showingSignals = mode === "signals";
    if (signalsEvidence) signalsEvidence.hidden = !showingSignals;
    if (sourceEvidence) sourceEvidence.hidden = showingSignals;
    if (captureFrame) captureFrame.hidden = showingSignals;
    if (desktopCaption) desktopCaption.hidden = true;
    if (captureArea) captureArea.classList.toggle("is-repaired", state.patchApplied);

    const captureUrl = $("#capture-url");
    const captureViewport = $("#capture-viewport");
    const captureStateLabel = $("#capture-state-label");

    if (showingSignals) {
      if (captureUrl) captureUrl.textContent = "synthetic bundle";
      if (captureViewport) captureViewport.textContent = "3 sources";
      if (captureStateLabel) captureStateLabel.textContent = state.lastAuditMode === "partial" ? "PARTIAL BUNDLE" : "SYNTHETIC LOG + DOM";
      return;
    }

    if (captureUrl) captureUrl.textContent = hostFromUrl(state.projectUrl);
    const mobile = mode === "mobile";
    if (captureViewport) captureViewport.textContent = mobile ? "390 × 844" : "1440 × 900";
    if (captureFrame) {
      captureFrame.classList.toggle("is-mobile", mobile);
      captureFrame.classList.toggle("is-desktop", !mobile);
      captureFrame.classList.toggle("is-patched", state.patchApplied);
      captureFrame.classList.toggle("is-fixed", !state.patchApplied);
    }
    if (desktopCaption) desktopCaption.hidden = mobile || state.patchApplied;
    if (captureStateLabel) {
      captureStateLabel.textContent = state.patchApplied ? "FITS SAMPLE VIEWPORT" : mobile ? "OVERFLOW DETECTED" : "LAYOUT FITS";
    }
  }

  function selectFinding(finding) {
    state.finding = finding;
    playTelemetrySound("tick");
    $$(".finding-card, .finding-item").forEach((item) => {
      const active = item.dataset.finding === finding;
      item.classList.toggle("is-selected", active);
      item.setAttribute("aria-current", String(active));
    });
    if (overflowDetail) overflowDetail.hidden = finding !== "overflow";
    if (labelDetail) labelDetail.hidden = finding !== "label";
    if (finding === "label") setEvidence("signals");
    else if (state.evidence === "signals") setEvidence("mobile");
  }

  function revealAnswer(which) {
    playTelemetrySound("blip");
    if (which === "overflow") {
      state.answerRevealed = true;
      if (answerReveal) answerReveal.hidden = false;
      const btn = $("#reveal-answer");
      if (btn) btn.hidden = true;
      const openPatchBtn = $("#open-patch");
      if (openPatchBtn) openPatchBtn.focus({ preventScroll: true });
    } else {
      state.labelAnswerRevealed = true;
      if (labelAnswer) labelAnswer.hidden = false;
      const btn = $("#reveal-label-answer");
      if (btn) btn.hidden = true;
    }
  }

  function openModal(modal) {
    if (!modal) return;
    playTelemetrySound("blip");
    focusBeforeModal = document.activeElement;
    modal.hidden = false;
    const closeButton = $("[data-close-modal], .modal-close", modal);
    if (closeButton) closeButton.focus();
  }

  function closeModal(modal) {
    if (!modal || modal.hidden) return;
    playTelemetrySound("tick");
    modal.hidden = true;
    if (focusBeforeModal && typeof focusBeforeModal.focus === "function") focusBeforeModal.focus();
  }

  function hostFromUrl(value) {
    try {
      return new URL(value).host;
    } catch {
      return "localhost:5173";
    }
  }

  function isLoopbackUrl(value) {
    return window.DevSightSafety ? window.DevSightSafety.isLoopbackUrl(value) : true;
  }

  function openProjectForm() {
    const nameIn = $("#project-name-input");
    const pathIn = $("#project-path-input");
    const urlIn = $("#project-url-input");
    const err = $("#project-form-error");
    if (nameIn) nameIn.value = state.projectName;
    if (pathIn) pathIn.value = state.projectPath;
    if (urlIn) urlIn.value = state.projectUrl;
    if (err) err.hidden = true;
    openModal(projectModal);
    if (nameIn) nameIn.focus({ preventScroll: true });
  }

  function syncProjectDetails() {
    const pName = $("#project-name");
    const sName = $("#sidebar-project-name");
    const setPName = $("#settings-project-name");
    const pPath = $("#project-path");
    const setPPath = $("#settings-project-path");
    const locUrl = $("#local-url");
    const setLocUrl = $("#settings-local-url");
    const capUrl = $("#capture-url");

    if (pName) pName.textContent = state.projectName;
    if (sName) sName.textContent = state.projectName;
    if (setPName) setPName.textContent = state.projectName;
    if (pPath) pPath.textContent = state.projectPath;
    if (setPPath) setPPath.textContent = state.projectPath;
    if (locUrl) locUrl.textContent = state.projectUrl;
    if (setLocUrl) setLocUrl.textContent = state.projectUrl;
    if (capUrl) capUrl.textContent = hostFromUrl(state.projectUrl);
  }

  function showView(name) {
    playTelemetrySound("blip");
    const viewNames = ["overview", "history", "project", "privacy"];
    if (!viewNames.includes(name)) return;
    viewNames.forEach((viewName) => {
      const page = $(`#${viewName}-view`);
      if (page) {
        page.hidden = viewName !== name;
        page.classList.toggle("is-visible", viewName === name);
      }
    });
    $$("[data-view]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.view === name);
    });
    const crumbCurrent = $("#crumb-current");
    const labels = { overview: "Audit overview", history: "Run history", project: "Project settings", privacy: "Privacy & limits" };
    if (crumbCurrent) crumbCurrent.textContent = labels[name];

    closeFullMenu();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function approvePatch() {
    state.patchApplied = true;
    state.verificationDone = false;
    closeModal(patchModal);

    if (captureFrame) {
      captureFrame.classList.remove("is-fixed");
      captureFrame.classList.add("is-patched");
    }
    if (captureArea) captureArea.classList.add("is-repaired");

    const srcSnippet = $("#source-snippet");
    if (srcSnippet) {
      srcSnippet.innerHTML = `<span class="code-selector">.feature-card</span> { <span class="code-property">width</span>: <span class="code-value">100%</span>; <span class="code-property">max-width</span>: <span class="code-value">520px</span>; }`;
    }
    const srcStatus = $("#source-status");
    if (srcStatus) {
      srcStatus.classList.add("is-fixed");
      srcStatus.lastChild.textContent = " Demo patch staged";
    }
    const capState = $("#capture-state-label");
    if (capState) capState.textContent = "DEMO PATCH APPROVED";

    const findingStatusTag = $("#finding-status-tag");
    if (findingStatusTag) {
      findingStatusTag.classList.add("tag-status");
      findingStatusTag.innerHTML = `<span class="status-dot"></span> Patch approved · pending check`;
    }

    const verPanel = $("#verification-panel");
    const verCopy = $("#verification-copy");
    const afterState = $("#after-state");
    const compareFitMark = $("#compare-fit-mark");
    const compareAfter = $("#compare-after");
    const afterCaption = $("#after-caption");

    if (verPanel) verPanel.hidden = false;
    if (verCopy) verCopy.textContent = "The patch is staged in the demo. Run the comparative telemetry verification check to confirm mobile responsiveness.";
    if (afterState) afterState.textContent = "Pending rerun";
    if (compareFitMark) compareFitMark.textContent = "AWAITING CHECK";
    if (compareAfter) compareAfter.classList.remove("is-fixed");
    if (afterCaption) afterCaption.textContent = "The simulated patch is staged; verification is not yet run.";

    showToast("Demo patch approved. Responsive CSS staged.");
    const verifyBlock = $("#chapter-verify");
    if (verifyBlock) verifyBlock.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function verifyFix() {
    if (!state.patchApplied) {
      showToast("Stage and approve the demo patch before verification.", "error");
      return;
    }
    const verifyButton = $("#verify-fix");
    const verifyLabel = $("#verify-label");
    if (verifyButton) verifyButton.disabled = true;
    if (verifyLabel) verifyLabel.textContent = "Verifying…";

    const verResult = $("#verification-result");
    const verCopy = $("#verification-copy");
    if (verResult) verResult.hidden = true;
    if (verCopy) verCopy.textContent = "Rerunning synthetic comparative telemetry check across viewports.";

    setEvidence("mobile");
    hideFeedback();
    if (auditProgress) auditProgress.hidden = false;
    setProgress("Analyzing simulated viewport…", "Comparing mock card margins against 390px boundary", 36);
    window.setTimeout(() => setProgress("Checking staged responsive rule…", "Updating synthetic verification telemetry summary", 75), 480);
    window.setTimeout(() => {
      if (auditProgress) auditProgress.hidden = true;
      if (verifyButton) verifyButton.disabled = false;
      if (verifyLabel) verifyLabel.textContent = "Run verification again";
      state.verificationDone = true;

      if (verCopy) verCopy.textContent = "The comparative telemetry check passed. Card flexes inside the 390px mobile viewport.";
      if (verResult) verResult.hidden = false;
      const afterState = $("#after-state");
      const compareFitMark = $("#compare-fit-mark");
      const compareAfter = $("#compare-after");
      const afterCaption = $("#after-caption");
      const findingStatusTag = $("#finding-status-tag");
      const histResult = $("#history-result");

      if (afterState) afterState.textContent = "Demo check passed";
      if (compareFitMark) compareFitMark.textContent = "FITS VIEWPORT";
      if (compareAfter) compareAfter.classList.add("is-fixed");
      if (afterCaption) afterCaption.textContent = "Responsive width: 100% max-width: 520px applied.";
      if (findingStatusTag) {
        findingStatusTag.classList.remove("tag-status");
        findingStatusTag.classList.add("tag-accessibility");
        findingStatusTag.innerHTML = `<span class="status-dot"></span> Resolved in demo`;
      }
      if (histResult) {
        histResult.textContent = "Verified · demo";
        histResult.classList.remove("history-result-pending");
      }
      setFeedback("complete", "Verification demo complete.", "The staged responsive rule resolves mobile clipping in the simulated sample.");
      showToast("Responsive fix verified! Viewport fit confirmed.");
    }, 1150);
  }

  // Chapter Navigation & Scroll Spy
  const chapters = [
    { id: "chapter-evidence", label: "01 / Evidence", dockId: "evidence" },
    { id: "chapter-signals", label: "02 / Signals", dockId: "signals" },
    { id: "chapter-findings", label: "03 / Findings", dockId: "findings" },
    { id: "chapter-verify", label: "04 / Verify", dockId: "verify" }
  ];

  function updateActiveChapter(chapterId) {
    const match = chapters.find(c => c.id === chapterId || c.dockId === chapterId);
    if (!match) return;
    state.activeChapter = match.dockId;

    const label1 = $("#header-active-chapter");
    if (label1) label1.textContent = match.label;

    $$(".dock-btn, .dock-item").forEach(item => {
      item.classList.toggle("is-active", item.dataset.dock === match.dockId);
    });

    $$(".chapter-item").forEach(item => {
      item.classList.toggle("is-active", item.dataset.chapter === match.dockId);
    });
  }

  function handleScrollSpy() {
    const scrollPos = window.scrollY + 200;
    for (let i = chapters.length - 1; i >= 0; i--) {
      const el = document.getElementById(chapters[i].id);
      if (el && el.offsetTop <= scrollPos) {
        updateActiveChapter(chapters[i].id);
        break;
      }
    }
  }

  window.addEventListener("scroll", handleScrollSpy, { passive: true });

  // Parallax animation on hero image and forward scroll
  const heroBgImg = $(".hero-bg-img");
  const heroVideo = $(".hero-video");

  window.addEventListener("scroll", () => {
    const scrollY = window.scrollY;
    if (scrollY < 900) {
      const scale = 1.03 + (scrollY / 900) * 0.12;
      const transY = scrollY * 0.25;
      if (heroBgImg) heroBgImg.style.transform = `scale(${scale}) translateY(${transY}px)`;
      if (heroVideo) heroVideo.style.transform = `scale(${scale}) translateY(${transY}px)`;
    }
  }, { passive: true });

  // Chapter Drawer Toggle
  if (chaptersTrigger && chaptersDrawer) {
    chaptersTrigger.addEventListener("click", () => {
      playTelemetrySound("tick");
      const isExpanded = chaptersTrigger.getAttribute("aria-expanded") === "true";
      chaptersTrigger.setAttribute("aria-expanded", String(!isExpanded));
      chaptersDrawer.hidden = isExpanded;
    });

    $$(".chapter-item").forEach(item => {
      item.addEventListener("click", () => {
        playTelemetrySound("tick");
        chaptersTrigger.setAttribute("aria-expanded", "false");
        chaptersDrawer.hidden = true;
      });
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest("#chapters-trigger") && !e.target.closest("#chapters-drawer")) {
        chaptersTrigger.setAttribute("aria-expanded", "false");
        chaptersDrawer.hidden = true;
      }
    });
  }

  // Full Menu Overlay Toggle
  function openFullMenu() {
    playTelemetrySound("blip");
    if (fullMenu) fullMenu.hidden = false;
    if (burgerToggle) {
      burgerToggle.classList.add("is-open");
      burgerToggle.setAttribute("aria-expanded", "true");
    }
    document.body.style.overflow = "hidden";
  }

  function closeFullMenu() {
    if (fullMenu) fullMenu.hidden = true;
    if (burgerToggle) {
      burgerToggle.classList.remove("is-open");
      burgerToggle.setAttribute("aria-expanded", "false");
    }
    document.body.style.overflow = "";
  }

  if (burgerToggle) {
    burgerToggle.addEventListener("click", () => {
      const isOpen = burgerToggle.classList.contains("is-open");
      if (isOpen) closeFullMenu();
      else openFullMenu();
    });
  }

  // Sound Toggle
  if (soundToggle) {
    soundToggle.addEventListener("click", () => {
      state.soundEnabled = !state.soundEnabled;
      soundToggle.classList.toggle("is-muted", !state.soundEnabled);
      const text = state.soundEnabled ? "Sound on" : "Sound off";
      const soundText = $(".sound-text", soundToggle);
      if (soundText) soundText.textContent = text;
      if (state.soundEnabled) playTelemetrySound("blip");
    });
  }

  // Hero Scroll to Explore Click
  const scrollExplore = $(".scroll-explore");
  if (scrollExplore) {
    scrollExplore.addEventListener("click", () => {
      playTelemetrySound("tick");
      const ch1 = $("#chapter-evidence");
      if (ch1) ch1.scrollIntoView({ behavior: "smooth" });
    });
  }

  // Dock Jump to Chapters
  $$(".dock-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      playTelemetrySound("tick");
      const targetId = `chapter-${btn.dataset.dock}`;
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  // Dock Jump to Top
  const dockToTop = $("#dock-to-top");
  if (dockToTop) {
    dockToTop.addEventListener("click", () => {
      playTelemetrySound("tick");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Menu Jump to Finding Fix
  const menuJumpFix = $("#menu-jump-fix");
  if (menuJumpFix) {
    menuJumpFix.addEventListener("click", () => {
      closeFullMenu();
      showView("overview");
      selectFinding("overflow");
      revealAnswer("overflow");
      const findingsBlock = $("#chapter-findings");
      if (findingsBlock) findingsBlock.scrollIntoView({ behavior: "smooth" });
    });
  }

  const menuSettingsBtn = $("#menu-settings-btn");
  if (menuSettingsBtn) {
    menuSettingsBtn.addEventListener("click", () => {
      closeFullMenu();
      showView("project");
    });
  }

  // Event Listeners for Buttons and Forms
  if (runButton) runButton.addEventListener("click", () => startAudit("complete"));
  if (runButtonHero) runButtonHero.addEventListener("click", () => startAudit("complete"));

  const verifyFixBtn = $("#verify-fix");
  if (verifyFixBtn) verifyFixBtn.addEventListener("click", verifyFix);

  $$(".evidence-tab, .segment-tab").forEach((tab) => tab.addEventListener("click", () => setEvidence(tab.dataset.evidence)));
  $$("[data-evidence-shortcut]").forEach((button) => button.addEventListener("click", () => setEvidence(button.dataset.evidenceShortcut)));
  $$(".finding-card, .finding-item").forEach((item) => item.addEventListener("click", () => selectFinding(item.dataset.finding)));

  const revealBtn = $("#reveal-answer");
  if (revealBtn) revealBtn.addEventListener("click", () => revealAnswer("overflow"));
  const revealLabelBtn = $("#reveal-label-answer");
  if (revealLabelBtn) revealLabelBtn.addEventListener("click", () => revealAnswer("label"));

  const openPatchBtn = $("#open-patch");
  if (openPatchBtn) openPatchBtn.addEventListener("click", () => openModal(patchModal));
  const approvePatchBtn = $("#approve-patch");
  if (approvePatchBtn) approvePatchBtn.addEventListener("click", approvePatch);

  const configProjBtn = $("#configure-project");
  if (configProjBtn) configProjBtn.addEventListener("click", openProjectForm);
  const settingsConfBtn = $("#settings-configure");
  if (settingsConfBtn) settingsConfBtn.addEventListener("click", openProjectForm);

  const projForm = $("#project-form");
  if (projForm) {
    projForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const error = $("#project-form-error");
      const name = $("#project-name-input").value.trim();
      const path = $("#project-path-input").value.trim();
      const url = $("#project-url-input").value.trim();

      if (!name || !path || !url) {
        if (error) {
          error.textContent = "Please specify project name, path, and dev URL.";
          error.hidden = false;
        }
        return;
      }
      if (window.DevSightSafety && !window.DevSightSafety.isSafeDisplayPath(path)) {
        if (error) {
          error.textContent = "Display directory path cannot contain parent traversal (..) or control characters.";
          error.hidden = false;
        }
        return;
      }
      if (!isLoopbackUrl(url)) {
        if (error) {
          error.textContent = "For safety, use localhost or loopback addresses only.";
          error.hidden = false;
        }
        return;
      }

      state.projectName = name;
      state.projectPath = path;
      state.projectUrl = url;
      syncProjectDetails();
      closeModal(projectModal);
      showToast("Workspace settings updated.");
    });
  }

  $$("[data-close-modal], .modal-close").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.closest(".modal-backdrop")));
  });

  [projectModal, patchModal].forEach((modal) => {
    if (!modal) return;
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal(modal);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal(projectModal);
      closeModal(patchModal);
      closeRunMenu();
      closeFullMenu();
    }
  });

  function closeRunMenu() {
    const runMenu = $("#run-menu");
    const runToggle = $("#run-menu-toggle");
    if (runMenu) runMenu.hidden = true;
    if (runToggle) runToggle.setAttribute("aria-expanded", "false");
  }

  const runMenuToggle = $("#run-menu-toggle");
  if (runMenuToggle) {
    runMenuToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      playTelemetrySound("tick");
      const menu = $("#run-menu");
      if (menu) {
        menu.hidden = !menu.hidden;
        runMenuToggle.setAttribute("aria-expanded", String(!menu.hidden));
      }
    });
  }

  $$("[data-run-mode]").forEach((button) => button.addEventListener("click", () => {
    closeRunMenu();
    startAudit(button.dataset.runMode);
  }));

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".run-menu-wrap")) closeRunMenu();
  });

  $$("[data-view]").forEach((button) => button.addEventListener("click", (e) => {
    e.preventDefault();
    showView(button.dataset.view);
  }));

  $$("[data-view-jump]").forEach((button) => button.addEventListener("click", (e) => {
    e.preventDefault();
    showView(button.dataset.viewJump);
  }));

  $$("[data-open-privacy]").forEach((button) => button.addEventListener("click", (e) => {
    e.preventDefault();
    showView("privacy");
  }));

  const findingFilter = $("#finding-filter");
  if (findingFilter) {
    findingFilter.addEventListener("click", () => {
      playTelemetrySound("tick");
      state.filterVisualOnly = !state.filterVisualOnly;
      findingFilter.textContent = state.filterVisualOnly ? "Visual only ⌄" : "All findings ⌄";
      const labelCard = $("[data-finding='label']");
      if (labelCard) labelCard.hidden = state.filterVisualOnly;
    });
  }

  // Subtle telemetry sound on interactive buttons
  document.addEventListener("mouseenter", (e) => {
    if (e.target && (e.target.matches?.(".btn-primary, .btn-ghost, .nav-text-btn, .dock-btn, .chapter-item, .finding-card, .segment-tab"))) {
      playTelemetrySound("tick");
    }
  }, true);

  // Initial State Setup
  closeRunMenu();
  setEvidence("mobile");
  selectFinding("overflow");
  syncProjectDetails();
})();
