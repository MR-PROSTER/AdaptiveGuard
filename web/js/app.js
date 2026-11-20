/**
 * ADAPTIVEGUARD // MAIN APPLICATION CONTROLLER
 * Coordinates Simulation Playback, UI Binding, Dynamic Telemetry, and Side-by-Side Comparison
 */

document.addEventListener("DOMContentLoaded", () => {
  // Ensure research dataset is loaded
  const DATA = window.ADAPTIVE_GUARD_DATA;
  if (!DATA) {
    console.error("AdaptiveGuard dataset not found! Check data.js load.");
    return;
  }

  // Application State
  const state = {
    currentTime: 0.0,
    duration: 40.0,
    isPlaying: false,
    playbackSpeed: 1.0,
    scheduler: "AdaptiveGuard",
    scenario: "H1_OVERRUN",
    viewMode: "single", // "single" | "compare"
    secondaryScheduler: "Classical Reactive MC",
    sweepMetric: "hi_miss_ratio",
    activeTab: "studio",
    animationFrameId: null,
    lastTickTimestamp: null,
  };

  // DOM Elements - Navigation & Global
  const navTabs = document.querySelectorAll(".nav-tab");
  const tabPanes = document.querySelectorAll(".tab-pane");
  const globalModeBadge = document.getElementById("global-mode-badge");
  const globalModeText = document.getElementById("global-mode-text");
  const globalTimeBadge = document.getElementById("global-time-badge");
  const currentSchedulerBadge = document.getElementById("current-scheduler-badge");
  const currentScenarioBadge = document.getElementById("current-scenario-badge");

  // DOM Elements - Studio Controls
  const selectScheduler = document.getElementById("select-scheduler");
  const selectScenario = document.getElementById("select-scenario");
  const selectSecondaryScheduler = document.getElementById("select-secondary-scheduler");
  const secondarySchedContainer = document.getElementById("secondary-sched-container");
  const studioGrid = document.getElementById("studio-grid-container");
  const secondaryColumn = document.getElementById("secondary-column");
  const btnModeSingle = document.getElementById("btn-mode-single");
  const btnModeCompare = document.getElementById("btn-mode-compare");

  const btnPlayPause = document.getElementById("btn-play-pause");
  const playIcon = document.getElementById("play-icon");
  const pauseIcon = document.getElementById("pause-icon");
  const playText = document.getElementById("play-text");
  const btnStepBack = document.getElementById("btn-step-back");
  const btnStepFwd = document.getElementById("btn-step-fwd");
  const btnReset = document.getElementById("btn-reset");
  const selectSpeed = document.getElementById("select-speed");

  const simTimeSlider = document.getElementById("sim-time-slider");
  const scrubberTimeDisplay = document.getElementById("scrubber-time-display");

  // DOM Elements - Primary Canvas & HUD
  const primaryGanttCanvas = document.getElementById("gantt-canvas-primary");
  const secondaryGanttCanvas = document.getElementById("gantt-canvas-secondary");
  const ganttTooltip = document.getElementById("gantt-tooltip");

  const primarySchedLabel = document.getElementById("primary-sched-label");
  const primaryScenarioLabel = document.getElementById("primary-scenario-label");
  const secondarySchedLabel = document.getElementById("secondary-sched-label");
  const secondaryScenarioLabel = document.getElementById("secondary-scenario-label");

  // Mode Nodes
  const nodeLo = document.getElementById("node-lo");
  const nodeWarn = document.getElementById("node-warning");
  const nodeHi = document.getElementById("node-hi");
  const nodeRec = document.getElementById("node-recovery");
  const modeStateTag = document.getElementById("mode-state-tag");
  const primaryTriggerText = document.getElementById("primary-trigger-text");

  // Risk Elements
  const primaryRiskBadge = document.getElementById("primary-risk-badge");
  const primaryRiskFill = document.getElementById("primary-risk-fill");
  const pRfUtil = document.getElementById("p-rf-util");
  const pRfLaxity = document.getElementById("p-rf-laxity");
  const pRfOverrun = document.getElementById("p-rf-overrun");
  const pRfDeadline = document.getElementById("p-rf-deadline");
  const pRfillUtil = document.getElementById("p-rfill-util");
  const pRfillLaxity = document.getElementById("p-rfill-laxity");
  const pRfillOverrun = document.getElementById("p-rfill-overrun");
  const pRfillDeadline = document.getElementById("p-rfill-deadline");

  // Knapsack Service Meters
  const sfillL1 = document.getElementById("sfill-l1");
  const sfillL2 = document.getElementById("sfill-l2");
  const sfillL3 = document.getElementById("sfill-l3");
  const sfillL4 = document.getElementById("sfill-l4");
  const spctL1 = document.getElementById("spct-l1");
  const spctL2 = document.getElementById("spct-l2");
  const spctL3 = document.getElementById("spct-l3");
  const spctL4 = document.getElementById("spct-l4");

  // Secondary Knapsack
  const s2fillL1 = document.getElementById("s2fill-l1");
  const s2fillL2 = document.getElementById("s2fill-l2");
  const s2fillL3 = document.getElementById("s2fill-l3");
  const s2fillL4 = document.getElementById("s2fill-l4");
  const s2pctL1 = document.getElementById("s2pct-l1");
  const s2pctL2 = document.getElementById("s2pct-l2");
  const s2pctL3 = document.getElementById("s2pct-l3");
  const s2pctL4 = document.getElementById("s2pct-l4");
  const sModeStateTag = document.getElementById("s-mode-state-tag");
  const sBannerText = document.getElementById("s-banner-text");

  // Events Log
  const primaryEventsLog = document.getElementById("primary-events-log");
  const primaryEventsCount = document.getElementById("primary-events-count");
  const secondaryEventsLog = document.getElementById("secondary-events-log");
  const secondaryEventsCount = document.getElementById("secondary-events-count");

  // Metrics Chips
  const pHiMisses = document.getElementById("p-hi-misses");
  const pLoUtil = document.getElementById("p-lo-util");
  const pSwitches = document.getElementById("p-switches");
  const pOverhead = document.getElementById("p-overhead");

  const sHiMisses = document.getElementById("s-hi-misses");
  const sLoUtil = document.getElementById("s-lo-util");
  const sLoDropped = document.getElementById("s-lo-dropped");
  const sOverhead = document.getElementById("s-overhead");

  /**
   * Helper: Get current trace data
   */
  function getTrace(schedulerKey, scenarioKey) {
    if (DATA.traces && DATA.traces[scenarioKey] && DATA.traces[scenarioKey][schedulerKey]) {
      return DATA.traces[scenarioKey][schedulerKey];
    }
    return null;
  }

  /**
   * Helper: Find nearest state entry in timeline for time t
   */
  function getStateAtTime(stateTimeline, time) {
    if (!stateTimeline || stateTimeline.length === 0) return null;
    let closest = stateTimeline[0];
    for (const item of stateTimeline) {
      if (item.time <= time + 1e-4) {
        closest = item;
      } else {
        break;
      }
    }
    return closest;
  }

  /**
   * Helper: Update system mode badges and nodes
   */
  function updateModeUI(modeName, triggerText) {
    const cleanMode = (modeName || "LO").toUpperCase();

    // Global Header Badge
    globalModeBadge.className = `mode-badge mode-${cleanMode.toLowerCase()}`;
    globalModeText.textContent = cleanMode;

    // State Tag
    modeStateTag.textContent = `${cleanMode} MODE`;
    modeStateTag.className = `card-badge mode-${cleanMode.toLowerCase()}`;

    // Node active highlights
    [nodeLo, nodeWarn, nodeHi, nodeRec].forEach(n => n.classList.remove("active"));

    if (cleanMode === "LO") nodeLo.classList.add("active");
    else if (cleanMode === "WARNING") nodeWarn.classList.add("active");
    else if (cleanMode === "HI") nodeHi.classList.add("active");
    else if (cleanMode === "RECOVERY") nodeRec.classList.add("active");

    if (triggerText && primaryTriggerText) {
      primaryTriggerText.textContent = `Trigger: ${triggerText}`;
    }
  }

  /**
   * Helper: Update Continuous Risk Gauge & Components
   */
  function updateRiskUI(stateObj) {
    if (!stateObj) return;
    const rTotal = stateObj.risk || 0.0;
    primaryRiskBadge.textContent = `R = ${rTotal.toFixed(3)}`;
    primaryRiskFill.style.width = `${Math.min(100, rTotal * 100)}%`;

    const rUtil = stateObj.r_util || 0.0;
    const rLaxity = stateObj.r_laxity || 0.0;
    const rOverrun = stateObj.r_overrun || 0.0;
    const rDeadline = stateObj.r_deadline || 0.0;

    pRfUtil.textContent = rUtil.toFixed(2);
    pRfLaxity.textContent = rLaxity.toFixed(2);
    pRfOverrun.textContent = rOverrun.toFixed(2);
    pRfDeadline.textContent = rDeadline.toFixed(2);

    pRfillUtil.style.width = `${rUtil * 100}%`;
    pRfillLaxity.style.width = `${rLaxity * 100}%`;
    pRfillOverrun.style.width = `${rOverrun * 100}%`;
    pRfillDeadline.style.width = `${rDeadline * 100}%`;
  }

  /**
   * Helper: Update Knapsack Service Meters
   */
  function updateKnapsackUI(serviceMap) {
    if (!serviceMap) return;
    const l1 = serviceMap.L1 !== undefined ? serviceMap.L1 : 1.0;
    const l2 = serviceMap.L2 !== undefined ? serviceMap.L2 : 1.0;
    const l3 = serviceMap.L3 !== undefined ? serviceMap.L3 : 1.0;
    const l4 = serviceMap.L4 !== undefined ? serviceMap.L4 : 1.0;

    sfillL1.style.width = `${l1 * 100}%`;
    spctL1.textContent = `${Math.round(l1 * 100)}%`;

    sfillL2.style.width = `${l2 * 100}%`;
    spctL2.textContent = `${Math.round(l2 * 100)}%`;

    sfillL3.style.width = `${l3 * 100}%`;
    spctL3.textContent = `${Math.round(l3 * 100)}%`;

    sfillL4.style.width = `${l4 * 100}%`;
    spctL4.textContent = `${Math.round(l4 * 100)}%`;
  }

  /**
   * Helper: Update Secondary Baseline Knapsack
   */
  function updateSecondaryUI(time, secTrace) {
    if (!secTrace) return;
    const stateObj = getStateAtTime(secTrace.state_timeline, time);
    const mode = stateObj ? stateObj.mode : "LO";

    sModeStateTag.textContent = `${mode} MODE`;
    sBannerText.textContent = mode === "HI" ? "Operating in HI Mode (Degraded / Dropped)" : "Operating in LO Mode";

    let lVal = 1.0;
    if (mode === "HI") {
      lVal = state.secondaryScheduler.includes("Degraded") ? 0.50 : 0.0;
    }

    s2fillL1.style.width = `${lVal * 100}%`;
    s2pctL1.textContent = `${Math.round(lVal * 100)}%`;
    s2fillL2.style.width = `${lVal * 100}%`;
    s2pctL2.textContent = `${Math.round(lVal * 100)}%`;
    s2fillL3.style.width = `${lVal * 100}%`;
    s2pctL3.textContent = `${Math.round(lVal * 100)}%`;
    s2fillL4.style.width = `${lVal * 100}%`;
    s2pctL4.textContent = `${Math.round(lVal * 100)}%`;
  }

  /**
   * Helper: Update Live Event Audit Stream
   */
  function updateEventsLogUI(time, eventsList, container, countEl) {
    if (!eventsList || !container) return;
    const pastEvents = eventsList.filter(e => e.time <= time + 1e-4);

    container.innerHTML = "";
    if (countEl) countEl.textContent = `${pastEvents.length} events`;

    // Show last 25 events up to current time
    const displayEvents = pastEvents.slice(-25).reverse();
    displayEvents.forEach(evt => {
      const row = document.createElement("div");
      row.className = "event-entry";
      if (evt.text.includes("DEADLINE") || evt.text.includes("MISS") || evt.text.includes("ESCALATION")) {
        row.classList.add("event-alert");
      } else if (evt.text.includes("MODE") || evt.text.includes("RECOVERY")) {
        row.classList.add("event-mode");
      }

      const tSpan = document.createElement("span");
      tSpan.className = "event-time";
      tSpan.textContent = `[${evt.time.toFixed(1)}ms]`;

      const txtSpan = document.createElement("span");
      txtSpan.className = "event-text";
      txtSpan.textContent = evt.text;

      row.appendChild(tSpan);
      row.appendChild(txtSpan);
      container.appendChild(row);
    });
  }

  /**
   * Main Render Cycle: Updates Gantt canvases and telemetry widgets
   */
  function renderAll() {
    const t = state.currentTime;

    // 1. Scrubber and Global Time Readouts
    globalTimeBadge.textContent = `${t.toFixed(2)} ms`;
    scrubberTimeDisplay.textContent = `T = ${t.toFixed(2)} ms`;
    simTimeSlider.value = t;

    // Progress bar fill
    const progressEl = document.getElementById("slider-progress-bar");
    if (progressEl) {
      progressEl.style.width = `${(t / state.duration) * 100}%`;
    }

    // 2. Primary Trace Data
    const pTrace = getTrace(state.scheduler, state.scenario);
    if (pTrace) {
      // Draw Primary Gantt
      Gantt.render(primaryGanttCanvas, pTrace.slices, t, { duration: state.duration });

      // State at current time
      const stateObj = getStateAtTime(pTrace.state_timeline, t);
      if (stateObj) {
        updateModeUI(stateObj.mode, stateObj.trigger);
        updateRiskUI(stateObj);
        updateKnapsackUI(stateObj.service_levels);
      }

      // Events log
      updateEventsLogUI(t, pTrace.events, primaryEventsLog, primaryEventsCount);

      // Summary metrics
      if (pTrace.metrics) {
        pHiMisses.textContent = pTrace.metrics.hi_missed_jobs_count || 0;
        pLoUtil.textContent = `${(pTrace.metrics.lo_utility_ratio * 100).toFixed(1)}%`;
        pSwitches.textContent = pTrace.metrics.mode_switches || 0;
        pOverhead.textContent = `${(pTrace.metrics.overhead_percentage || 0).toFixed(2)}%`;
      }
    }

    // 3. Secondary Trace (if in comparison mode)
    if (state.viewMode === "compare") {
      const sTrace = getTrace(state.secondaryScheduler, state.scenario);
      if (sTrace) {
        Gantt.render(secondaryGanttCanvas, sTrace.slices, t, { duration: state.duration });
        updateSecondaryUI(t, sTrace);
        updateEventsLogUI(t, sTrace.events, secondaryEventsLog, secondaryEventsCount);

        if (sTrace.metrics) {
          sHiMisses.textContent = sTrace.metrics.hi_missed_jobs_count || 0;
          sLoUtil.textContent = `${(sTrace.metrics.lo_utility_ratio * 100).toFixed(1)}%`;
          sLoDropped.textContent = `${sTrace.metrics.lo_jobs_dropped || 0} jobs`;
          sOverhead.textContent = `${(sTrace.metrics.overhead_percentage || 0).toFixed(2)}%`;
        }
      }
    }
  }

  /**
   * Playback Loop (Smooth clock advancement)
   */
  function playbackTick(timestamp) {
    if (!state.isPlaying) return;

    if (!state.lastTickTimestamp) {
      state.lastTickTimestamp = timestamp;
    }

    const elapsedRealMs = timestamp - state.lastTickTimestamp;
    state.lastTickTimestamp = timestamp;

    // Simulation advances: 1 real second = 10ms simulation time * speed
    const advanceSimMs = (elapsedRealMs / 1000.0) * 10.0 * state.playbackSpeed;
    state.currentTime += advanceSimMs;

    if (state.currentTime >= state.duration) {
      state.currentTime = state.duration;
      pausePlayback();
    }

    renderAll();

    if (state.isPlaying) {
      state.animationFrameId = requestAnimationFrame(playbackTick);
    }
  }

  function startPlayback() {
    if (state.currentTime >= state.duration) {
      state.currentTime = 0.0;
    }
    state.isPlaying = true;
    state.lastTickTimestamp = null;
    playIcon.classList.add("hidden");
    pauseIcon.classList.remove("hidden");
    playText.textContent = "PAUSE";
    btnPlayPause.classList.add("btn-playing");
    state.animationFrameId = requestAnimationFrame(playbackTick);
  }

  function pausePlayback() {
    state.isPlaying = false;
    state.lastTickTimestamp = null;
    if (state.animationFrameId) {
      cancelAnimationFrame(state.animationFrameId);
      state.animationFrameId = null;
    }
    playIcon.classList.remove("hidden");
    pauseIcon.classList.add("hidden");
    playText.textContent = "PLAY";
    btnPlayPause.classList.remove("btn-playing");
  }

  // Event Listeners - Playback Controls
  btnPlayPause.addEventListener("click", () => {
    if (state.isPlaying) pausePlayback();
    else startPlayback();
  });

  btnStepBack.addEventListener("click", () => {
    pausePlayback();
    state.currentTime = Math.max(0, state.currentTime - 0.5);
    renderAll();
  });

  btnStepFwd.addEventListener("click", () => {
    pausePlayback();
    state.currentTime = Math.min(state.duration, state.currentTime + 0.5);
    renderAll();
  });

  btnReset.addEventListener("click", () => {
    pausePlayback();
    state.currentTime = 0.0;
    renderAll();
  });

  simTimeSlider.addEventListener("input", (e) => {
    pausePlayback();
    state.currentTime = parseFloat(e.target.value);
    renderAll();
  });

  selectSpeed.addEventListener("change", (e) => {
    state.playbackSpeed = parseFloat(e.target.value);
  });

  // Event Listeners - Approach & Scenario Selectors
  selectScheduler.addEventListener("change", (e) => {
    state.scheduler = e.target.value;
    currentSchedulerBadge.textContent = state.scheduler;
    primarySchedLabel.textContent = state.scheduler;
    renderAll();
  });

  selectScenario.addEventListener("change", (e) => {
    state.scenario = e.target.value;
    currentScenarioBadge.textContent = state.scenario;
    primaryScenarioLabel.textContent = state.scenario;
    secondaryScenarioLabel.textContent = state.scenario;
    renderAll();
  });

  selectSecondaryScheduler.addEventListener("change", (e) => {
    state.secondaryScheduler = e.target.value;
    secondarySchedLabel.textContent = state.secondaryScheduler;
    renderAll();
  });

  // View Mode: Single vs Dual Comparison
  btnModeSingle.addEventListener("click", () => {
    state.viewMode = "single";
    btnModeSingle.classList.add("active");
    btnModeCompare.classList.remove("active");
    studioGrid.classList.remove("dual-mode");
    secondaryColumn.classList.add("hidden");
    secondarySchedContainer.classList.add("hidden");
    renderAll();
  });

  btnModeCompare.addEventListener("click", () => {
    state.viewMode = "compare";
    btnModeCompare.classList.add("active");
    btnModeSingle.classList.remove("active");
    studioGrid.classList.add("dual-mode");
    secondaryColumn.classList.remove("hidden");
    secondarySchedContainer.classList.remove("hidden");
    renderAll();
  });

  // Gantt Tooltip on hover
  function handleGanttHover(canvas, e, isSecondary = false) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const schedKey = isSecondary ? state.secondaryScheduler : state.scheduler;
    const trace = getTrace(schedKey, state.scenario);
    if (!trace) return;

    const slice = Gantt.findSliceAtPoint(canvas, trace.slices, x, y, { duration: state.duration });
    if (slice) {
      ganttTooltip.classList.remove("hidden");
      ganttTooltip.style.left = `${e.pageX}px`;
      ganttTooltip.style.top = `${e.pageY - 10}px`;
      ganttTooltip.innerHTML = `
        <div style="font-weight: 700; color: #ffffff; margin-bottom: 2px;">${slice.task_name} (${slice.task_short})</div>
        <div>Job: <strong>${slice.job_id}</strong> | Crit: <strong>${slice.criticality}</strong></div>
        <div>Start: <strong>${slice.start.toFixed(2)} ms</strong> | End: <strong>${slice.end.toFixed(2)} ms</strong></div>
        <div>Duration: <strong>${slice.duration.toFixed(2)} ms</strong></div>
      `;
    } else {
      ganttTooltip.classList.add("hidden");
    }
  }

  primaryGanttCanvas.addEventListener("mousemove", (e) => handleGanttHover(primaryGanttCanvas, e, false));
  primaryGanttCanvas.addEventListener("mouseleave", () => ganttTooltip.classList.add("hidden"));
  secondaryGanttCanvas.addEventListener("mousemove", (e) => handleGanttHover(secondaryGanttCanvas, e, true));
  secondaryGanttCanvas.addEventListener("mouseleave", () => ganttTooltip.classList.add("hidden"));

  // Click Gantt to scrub time
  function handleGanttClick(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const padLeftRatio = 135 / canvas.width;
    const plotRatio = (canvas.width - 135 - 25) / canvas.width;
    const clickRatio = x / rect.width;

    if (clickRatio >= padLeftRatio && clickRatio <= (padLeftRatio + plotRatio)) {
      const tRatio = (clickRatio - padLeftRatio) / plotRatio;
      state.currentTime = Math.max(0, Math.min(state.duration, tRatio * state.duration));
      renderAll();
    }
  }
  primaryGanttCanvas.addEventListener("click", (e) => handleGanttClick(primaryGanttCanvas, e));
  secondaryGanttCanvas.addEventListener("click", (e) => handleGanttClick(secondaryGanttCanvas, e));

  // Navigation Tab Switching
  navTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      navTabs.forEach(t => t.classList.remove("active"));
      tabPanes.forEach(p => p.classList.remove("active"));

      tab.classList.add("active");
      const targetPane = document.getElementById(`pane-${target}`);
      if (targetPane) targetPane.classList.add("active");
      state.activeTab = target;

      // Trigger redraw of charts on tab open
      if (target === "comparison") {
        initComparisonTab();
      } else if (target === "sweeps") {
        initSweepsTab();
      } else if (target === "architecture") {
        initArchitectureTab();
      } else if (target === "studio") {
        renderAll();
      }
    });
  });

  /**
   * Initialize Tab 2: Comparative Evaluation
   */
  function initComparisonTab() {
    const tbody = document.getElementById("tbody-comparison");
    if (!tbody || !DATA.benchmark_table) return;

    tbody.innerHTML = "";
    DATA.benchmark_table.forEach(row => {
      const tr = document.createElement("tr");
      const isAG = row.Approach === "AdaptiveGuard";
      if (isAG) tr.className = "row-highlight-ag";

      const colorMeta = Charts.SCHEDULER_COLORS[row.Approach] || { color: "#ffffff" };

      tr.innerHTML = `
        <td class="approach-cell">
          <span class="dot-indicator" style="background: ${colorMeta.color};"></span>
          ${row.Approach}
        </td>
        <td class="mono ${row["HI Miss Ratio (↓)"].startsWith("0.33") || row["HI Miss Ratio (↓)"].startsWith("0.40") ? "val-good" : (row["HI Miss Ratio (↓)"].startsWith("0.77") ? "val-bad" : "")}">${row["HI Miss Ratio (↓)"]}</td>
        <td class="mono">${row["LO Completion Ratio (↑)"]}</td>
        <td class="mono ${isAG ? "val-cyan font-bold" : ""}">${row["LO Utility Ratio (↑)"]}</td>
        <td class="mono">${row["CPU Utilization"]}</td>
        <td class="mono">${row["Avg Response Time (ms)"]}</td>
        <td class="mono">${row["Worst Response Time (ms)"]}</td>
        <td class="mono">${row["Deadline Misses"]}</td>
        <td class="mono ${isAG ? "val-good font-bold" : (row["Mode Switches"] > 100 ? "val-bad" : "")}">${row["Mode Switches"]}</td>
        <td class="mono">${row["LO Jobs Dropped"]}</td>
        <td class="mono">${row["Preemptions"]}</td>
        <td class="mono">${row["Overhead (%)"]}</td>
        <td class="mono ${isAG ? "val-good font-bold" : ""}">${row["Recovery Time (ms)"]}</td>
      `;
      tbody.appendChild(tr);
    });

    // Render Radar Chart
    if (DATA.normalized_table) {
      Charts.renderRadarChart("canvas-radar", DATA.normalized_table);

      // Radar Legend
      const rLegend = document.getElementById("radar-legend");
      if (rLegend) {
        rLegend.innerHTML = "";
        const scheds = ["AdaptiveGuard", "Classical Reactive MC", "EDF-VD + Degraded LO Service", "EDF", "Flexible MC"];
        scheds.forEach(s => {
          const meta = Charts.SCHEDULER_COLORS[s];
          const item = document.createElement("span");
          item.className = "legend-item";
          item.innerHTML = `<span class="legend-box" style="background: ${meta.color};"></span> ${meta.name}`;
          rLegend.appendChild(item);
        });
      }
    }

    // Render Pareto Chart
    Charts.renderParetoChart("canvas-pareto", DATA.benchmark_table);
  }

  /**
   * Initialize Tab 3: Sweeps & Ablation
   */
  function initSweepsTab() {
    if (!DATA.sweep_curves) return;

    // Render sweep chart
    Charts.renderUtilizationSweepChart("canvas-sweep", DATA.sweep_curves, state.sweepMetric);

    // Legend
    const sLegend = document.getElementById("sweep-legend");
    if (sLegend) {
      sLegend.innerHTML = "";
      Object.keys(DATA.sweep_curves).forEach(s => {
        const meta = Charts.SCHEDULER_COLORS[s] || { color: "#ffffff" };
        const item = document.createElement("span");
        item.className = "legend-item";
        item.innerHTML = `<span class="legend-box" style="background: ${meta.color};"></span> ${meta.name || s}`;
        sLegend.appendChild(item);
      });
    }

    // Metric selector buttons
    const metricBtns = document.querySelectorAll("#sweep-metric-selector .seg-btn");
    metricBtns.forEach(btn => {
      btn.onclick = () => {
        metricBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.sweepMetric = btn.dataset.metric;
        Charts.renderUtilizationSweepChart("canvas-sweep", DATA.sweep_curves, state.sweepMetric);
      };
    });

    // Populate Ablation Cards
    const abCardsContainer = document.getElementById("ablation-cards-container");
    const abTbody = document.getElementById("tbody-ablation");

    if (abCardsContainer && DATA.ablation_table) {
      abCardsContainer.innerHTML = "";
      abTbody.innerHTML = "";

      DATA.ablation_table.forEach(cfg => {
        const code = cfg.ablation_code || cfg.Config || "A";
        const title = cfg.scheduler || cfg["Architecture Description"] || `Config ${code}`;
        const hiMiss = cfg.hi_miss_ratio !== undefined ? parseFloat(cfg.hi_miss_ratio).toFixed(2) : (cfg["HI Miss Ratio (↓)"] || "0.00");
        const loUtilVal = cfg.lo_utility_ratio !== undefined ? parseFloat(cfg.lo_utility_ratio) : (parseFloat(cfg["LO Utility Ratio (↑)"]) || 0);
        const loUtil = (loUtilVal * 100).toFixed(0) + "%";
        const loComp = cfg.lo_completion_ratio !== undefined ? (parseFloat(cfg.lo_completion_ratio) * 100).toFixed(0) + "%" : (cfg["LO Comp Ratio"] || "-");
        const cpuUtil = cfg.cpu_utilization !== undefined ? (parseFloat(cfg.cpu_utilization) * 100).toFixed(1) + "%" : (cfg["CPU Util"] || "-");
        const modeSwitches = cfg.mode_switches !== undefined ? cfg.mode_switches : (cfg["Mode Switches"] || "0");
        const overhead = cfg.overhead_percentage !== undefined ? parseFloat(cfg.overhead_percentage).toFixed(2) + "%" : (cfg["Overhead %"] || "-");

        // Card
        const card = document.createElement("div");
        card.className = "ablation-card";
        if (code === "F") card.style.borderColor = "var(--white)";

        card.innerHTML = `
          <div class="ablation-badge">Config ${code}</div>
          <div class="ablation-title">${title}</div>
          <div class="ablation-stats">
            <div>HI Miss: <span class="val-good">${hiMiss}</span></div>
            <div>LO Utility: <span class="val-cyan">${loUtil}</span></div>
            <div>Mode Switches: <strong>${modeSwitches}</strong></div>
            <div>Overhead: <strong>${overhead}</strong></div>
          </div>
          <div class="ablation-insight">
            ${getAblationInsight(code)}
          </div>
        `;
        abCardsContainer.appendChild(card);

        // Table row
        const tr = document.createElement("tr");
        if (code === "F") tr.className = "row-highlight-ag";
        tr.innerHTML = `
          <td class="font-bold">Config ${code}</td>
          <td>${title}</td>
          <td class="mono val-good">${hiMiss}</td>
          <td class="mono val-cyan font-bold">${(loUtilVal).toFixed(2)}</td>
          <td class="mono">${loComp}</td>
          <td class="mono">${cpuUtil}</td>
          <td class="mono">${modeSwitches}</td>
          <td class="mono">${overhead}</td>
        `;
        abTbody.appendChild(tr);
      });
    }
  }

  function getAblationInsight(cfg) {
    const map = {
      "A": "Baseline EDF-VD: zero HI misses but totally starves LO tasks (0% utility).",
      "B": "Uniform degradation allows 50% LO utility without violating HI deadlines.",
      "C": "Adding continuous risk without hysteresis causes severe chattering (60 switches).",
      "D": "Knapsack utility density prioritization boosts LO utility to 84.6% (+69.2% gain!).",
      "E": "Proactive risk + knapsack without hysteresis peaks at 114 mode switches.",
      "F": "Full AdaptiveGuard: dual-threshold hysteresis cuts switches to 71 while preserving high utility & smooth recovery.",
    };
    return map[cfg] || "";
  }

  /**
   * Initialize Tab 4: Architecture & Taskset
   */
  function initArchitectureTab() {
    const tbody = document.getElementById("tbody-tasks");
    if (!tbody || !DATA.tasks) return;

    tbody.innerHTML = "";
    const roleMap = {
      "H1": "Fly-by-wire Flight Control Actuation",
      "H2": "Anti-lock Emergency Braking Actuator",
      "L1": "Live Telemetry & Sensor Downlink Stream",
      "L2": "High-Frequency Flight Event Logging",
      "L3": "Diagnostic Health Monitoring Logging",
      "L4": "Auxiliary System Status Logging",
    };

    DATA.tasks.forEach(t => {
      const tr = document.createElement("tr");
      const isHI = t.criticality === "HI";
      tr.innerHTML = `
        <td class="mono font-bold">${t.task_id}</td>
        <td class="font-bold">${t.name} (${t.short_name})</td>
        <td><span class="task-badge ${isHI ? "task-h1" : "task-l1"}">${t.criticality}</span></td>
        <td class="mono">${t.period} ms</td>
        <td class="mono">${t.relative_deadline} ms</td>
        <td class="mono">${t.C_LO} ms</td>
        <td class="mono font-bold ${isHI ? "val-bad" : ""}">${t.C_HI} ms</td>
        <td class="mono">${t.utility}</td>
        <td class="mono val-cyan font-bold">${t.utility_density > 0 ? t.utility_density.toFixed(2) : "—"}</td>
        <td class="mono">${t.minimum_service} – ${t.maximum_service}</td>
        <td style="color: var(--text-muted);">${roleMap[t.short_name] || "Avionics Subsystem"}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  /**
   * Initialize Tab 5: Sandbox
   */
  function initSandboxTab() {
    const btnRunSandbox = document.getElementById("btn-run-sandbox");
    const btnResetParams = document.getElementById("btn-reset-sandbox-params");
    const sandboxCanvas = document.getElementById("sandbox-gantt-canvas");
    const sandboxLog = document.getElementById("sandbox-log");

    const inputTWarn = document.getElementById("input-t-warn");
    const inputTHi = document.getElementById("input-t-hi");
    const inputTRec = document.getElementById("input-t-rec");
    const inputH1Factor = document.getElementById("input-h1-factor");
    const inputH2Factor = document.getElementById("input-h2-factor");
    const checkOverhead = document.getElementById("check-enable-overhead");

    const valTWarn = document.getElementById("val-t-warn");
    const valTHi = document.getElementById("val-t-hi");
    const valTRec = document.getElementById("val-t-rec");
    const valH1Factor = document.getElementById("val-h1-factor");
    const valH2Factor = document.getElementById("val-h2-factor");

    const sbHiMisses = document.getElementById("sb-hi-misses");
    const sbLoUtil = document.getElementById("sb-lo-util");
    const sbCpuUtil = document.getElementById("sb-cpu-util");
    const sbSwitches = document.getElementById("sb-switches");

    // Slider value readouts
    inputTWarn.addEventListener("input", (e) => valTWarn.textContent = parseFloat(e.target.value).toFixed(2));
    inputTHi.addEventListener("input", (e) => valTHi.textContent = parseFloat(e.target.value).toFixed(2));
    inputTRec.addEventListener("input", (e) => valTRec.textContent = parseFloat(e.target.value).toFixed(2));
    inputH1Factor.addEventListener("input", (e) => valH1Factor.textContent = `${parseFloat(e.target.value).toFixed(1)}x`);
    inputH2Factor.addEventListener("input", (e) => valH2Factor.textContent = `${parseFloat(e.target.value).toFixed(2)}x`);

    btnResetParams.addEventListener("click", () => {
      inputTWarn.value = 0.50; valTWarn.textContent = "0.50";
      inputTHi.value = 0.80; valTHi.textContent = "0.80";
      inputTRec.value = 0.40; valTRec.textContent = "0.40";
      inputH1Factor.value = 3.0; valH1Factor.textContent = "3.0x";
      inputH2Factor.value = 2.33; valH2Factor.textContent = "2.33x";
      checkOverhead.checked = true;
    });

    btnRunSandbox.addEventListener("click", () => {
      const simParams = {
        duration: 40.0,
        tWarn: parseFloat(inputTWarn.value),
        tHi: parseFloat(inputTHi.value),
        tRec: parseFloat(inputTRec.value),
        h1Factor: parseFloat(inputH1Factor.value),
        h2Factor: parseFloat(inputH2Factor.value),
        enableOverhead: checkOverhead.checked,
      };

      const result = ClientSimulator.runSimulation(simParams);

      // Render Sandbox Gantt
      Gantt.render(sandboxCanvas, result.slices, 40.0, { duration: 40.0 });

      // Update metrics
      sbHiMisses.textContent = result.metrics.hi_misses;
      sbLoUtil.textContent = result.metrics.lo_utility_pct;
      sbCpuUtil.textContent = result.metrics.cpu_utilization;
      sbSwitches.textContent = result.metrics.mode_switches;

      // Update log
      sandboxLog.innerHTML = "";
      result.logEvents.slice(-20).reverse().forEach(evt => {
        const item = document.createElement("div");
        item.className = "log-entry";
        item.textContent = evt;
        sandboxLog.appendChild(item);
      });
    });
  }

  // Initial Boot
  initSandboxTab();
  renderAll();

  // Support URL hash navigation for tabs and search params
  if (window.location.search.includes("mode=compare")) {
    btnModeCompare.click();
  }
  function applyHashTab() {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      const matchingTab = Array.from(navTabs).find(t => t.dataset.tab === hash);
      if (matchingTab) matchingTab.click();
    }
  }
  applyHashTab();
  window.addEventListener("hashchange", applyHashTab);

  console.log("AdaptiveGuard Simulation Platform initialized successfully.");
});
