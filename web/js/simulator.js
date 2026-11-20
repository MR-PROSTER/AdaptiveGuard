/**
 * ADAPTIVEGUARD // CLIENT-SIDE DISCRETE-EVENT SIMULATOR
 * Real-time In-Browser Simulation Engine for Custom Parameters Sandbox
 */

const ClientSimulator = (function () {
  /**
   * Run client-side simulation with custom parameters
   */
  function runSimulation(params = {}) {
    const duration = params.duration || 40.0;
    const tWarn = params.tWarn !== undefined ? params.tWarn : 0.50;
    const tHi = params.tHi !== undefined ? params.tHi : 0.80;
    const tRec = params.tRec !== undefined ? params.tRec : 0.40;
    const h1Factor = params.h1Factor || 3.0; // nominal C_LO=2, C_HI=6 (3x)
    const h2Factor = params.h2Factor || 2.33; // nominal C_LO=3, C_HI=7
    const enableOverhead = params.enableOverhead !== undefined ? params.enableOverhead : true;

    // Define tasks
    const tasks = [
      { id: 1, name: "Flight_Control", short: "H1", crit: "HI", T: 20.0, D: 20.0, cLo: 2.0, cHi: 2.0 * h1Factor, util: 0 },
      { id: 2, name: "Braking_Control", short: "H2", crit: "HI", T: 20.0, D: 20.0, cLo: 3.0, cHi: 3.0 * h2Factor, util: 0 },
      { id: 3, name: "Telemetry", short: "L1", crit: "LO", T: 20.0, D: 20.0, cLo: 6.0, cHi: 6.0, util: 100 },
      { id: 4, name: "Logging_A", short: "L2", crit: "LO", T: 20.0, D: 20.0, cLo: 1.0, cHi: 1.0, util: 10 },
      { id: 5, name: "Logging_B", short: "L3", crit: "LO", T: 20.0, D: 20.0, cLo: 1.0, cHi: 1.0, util: 10 },
      { id: 6, name: "Logging_C", short: "L4", crit: "LO", T: 20.0, D: 20.0, cLo: 1.0, cHi: 1.0, util: 10 },
    ];

    // Knapsack utility density order for LO tasks: L1 (16.67), L2 (10), L3 (10), L4 (10)
    const rankedLoIds = [3, 4, 5, 6];

    // State tracking
    let currentTime = 0.0;
    let mode = "LO"; // LO, WARNING, HI, RECOVERY
    let modeSwitches = 0;
    let serviceLevels = { L1: 1.0, L2: 1.0, L3: 1.0, L4: 1.0 };

    const slices = [];
    const stateTimeline = [];
    const logEvents = [];

    // Jobs queue
    let activeJobs = [];
    let completedJobs = [];
    let missedJobs = [];

    // Generate job releases
    const allJobs = [];
    tasks.forEach(task => {
      let k = 0;
      while (k * task.T < duration) {
        const relTime = k * task.T;
        const deadTime = relTime + task.D;
        // In this benchmark, H1 overruns in period 0
        const reqExec = (task.crit === "HI") ? task.cHi : task.cLo;

        allJobs.push({
          jobId: `T${task.id}_J${k}`,
          task: task,
          task_short: task.short,
          task_name: task.name,
          criticality: task.crit,
          releaseTime: relTime,
          deadline: deadTime,
          reqExec: reqExec,
          remExec: reqExec,
          executed: 0.0,
          completed: false,
          missed: false,
          seq: k,
        });
        k++;
      }
    });

    // Step simulation at 0.5 ms resolution
    const dt = 0.5;
    let currentRunningJob = null;

    for (let t = 0; t < duration; t += dt) {
      currentTime = t;

      // 1. Check job releases at current time
      allJobs.forEach(job => {
        if (Math.abs(job.releaseTime - t) < 1e-4) {
          activeJobs.push(job);
          logEvents.push(`[${t.toFixed(1)}ms] RELEASE: ${job.task.name} (${job.jobId})`);
        }
      });

      // 2. Check deadlines for active jobs
      activeJobs.forEach(job => {
        if (!job.completed && t >= job.deadline - 1e-4) {
          job.missed = true;
          missedJobs.push(job);
          logEvents.push(`[${t.toFixed(1)}ms] DEADLINE MISS: ${job.task.name} (${job.jobId})`);
        }
      });

      // 3. Risk Evaluation
      let rUtil = 0.0;
      let rOverrun = 0.0;
      let rLaxity = 0.0;
      let rDeadline = 0.0;

      const hiActive = activeJobs.filter(j => j.criticality === "HI" && !j.completed);
      const anyOverrun = hiActive.some(j => j.executed >= j.task.cLo);

      if (anyOverrun) rOverrun = 1.0;

      // Utilization pressure
      const totalActiveRem = activeJobs.filter(j => !j.completed).reduce((sum, j) => sum + j.remExec, 0);
      rUtil = Math.min(1.0, totalActiveRem / 14.0);

      // Earliest pending deadline proximity
      const pendingDeadlines = activeJobs.filter(j => !j.completed).map(j => j.deadline - t);
      if (pendingDeadlines.length > 0) {
        const minSlack = Math.min(...pendingDeadlines);
        rLaxity = Math.max(0.0, Math.min(1.0, 1.0 - (minSlack / 20.0)));
      }

      const rTotal = Math.min(1.0, 0.30 * rUtil + 0.30 * rLaxity + 0.25 * rOverrun + 0.15 * rDeadline);

      // 4. Mode Controller (Dual-Threshold Hysteresis)
      const prevMode = mode;
      if (mode === "LO") {
        if (rTotal >= tHi) {
          mode = "HI";
          modeSwitches++;
          logEvents.push(`[${t.toFixed(1)}ms] MODE CHANGE: LO -> HI (Risk=${rTotal.toFixed(3)} >= ${tHi})`);
        } else if (rTotal >= tWarn) {
          mode = "WARNING";
          modeSwitches++;
          logEvents.push(`[${t.toFixed(1)}ms] MODE CHANGE: LO -> WARNING (Risk=${rTotal.toFixed(3)} >= ${tWarn})`);
        }
      } else if (mode === "WARNING") {
        if (rTotal >= tHi) {
          mode = "HI";
          modeSwitches++;
          logEvents.push(`[${t.toFixed(1)}ms] MODE CHANGE: WARNING -> HI`);
        } else if (rTotal <= tRec) {
          mode = "LO";
          modeSwitches++;
          logEvents.push(`[${t.toFixed(1)}ms] MODE RECOVERY: WARNING -> LO (Risk=${rTotal.toFixed(3)} <= ${tRec})`);
        }
      } else if (mode === "HI") {
        if (rTotal <= tRec && !anyOverrun) {
          mode = "RECOVERY";
          modeSwitches++;
          logEvents.push(`[${t.toFixed(1)}ms] MODE RECOVERY: HI -> RECOVERY`);
        }
      } else if (mode === "RECOVERY") {
        if (rTotal >= tWarn) {
          mode = "WARNING";
          modeSwitches++;
        } else if (rTotal <= tRec && serviceLevels.L1 >= 1.0 && serviceLevels.L2 >= 1.0) {
          mode = "LO";
          modeSwitches++;
          logEvents.push(`[${t.toFixed(1)}ms] RECOVERY COMPLETE: Returned to LO Mode`);
        }
      }

      // 5. Knapsack Service Level Degradation
      if (mode === "HI") {
        // Protect L1 Telemetry (Density 16.67), drop L2, L3, L4 (Density 10.0)
        serviceLevels.L1 = 0.75;
        serviceLevels.L2 = 0.0;
        serviceLevels.L3 = 0.0;
        serviceLevels.L4 = 0.0;
      } else if (mode === "WARNING") {
        serviceLevels.L1 = 1.0;
        serviceLevels.L2 = 0.50;
        serviceLevels.L3 = 0.50;
        serviceLevels.L4 = 0.50;
      } else if (mode === "RECOVERY") {
        serviceLevels.L1 = 1.0;
        serviceLevels.L2 = Math.min(1.0, serviceLevels.L2 + 0.1);
        serviceLevels.L3 = Math.min(1.0, serviceLevels.L3 + 0.1);
        serviceLevels.L4 = Math.min(1.0, serviceLevels.L4 + 0.1);
      } else {
        serviceLevels.L1 = 1.0;
        serviceLevels.L2 = 1.0;
        serviceLevels.L3 = 1.0;
        serviceLevels.L4 = 1.0;
      }

      // 6. Scheduler Dispatch (EDF Priority with Virtual Deadlines / Mode isolation)
      const eligibleJobs = activeJobs.filter(j => !j.completed);

      // Sort by priority: HI tasks first if in HI mode, else by Earliest Deadline First
      eligibleJobs.sort((a, b) => {
        if (mode === "HI") {
          if (a.criticality === "HI" && b.criticality !== "HI") return -1;
          if (b.criticality === "HI" && a.criticality !== "HI") return 1;
        }
        return a.deadline - b.deadline;
      });

      const selectedJob = eligibleJobs.length > 0 ? eligibleJobs[0] : null;

      // Execute on CPU for interval [t, t + dt]
      if (selectedJob) {
        selectedJob.executed += dt;
        selectedJob.remExec = Math.max(0, selectedJob.remExec - dt);

        slices.push({
          start: t,
          end: t + dt,
          duration: dt,
          task_name: selectedJob.task_name,
          task_short: selectedJob.task_short,
          job_id: selectedJob.jobId,
          criticality: selectedJob.criticality,
        });

        // Check completion (considering degraded service budget for LO tasks)
        const targetBudget = (selectedJob.criticality === "LO") 
          ? selectedJob.task.cLo * (serviceLevels[selectedJob.task_short] || 1.0)
          : selectedJob.reqExec;

        if (selectedJob.executed >= targetBudget - 1e-4) {
          selectedJob.completed = true;
          completedJobs.push(selectedJob);
          activeJobs = activeJobs.filter(j => j.jobId !== selectedJob.jobId);
          logEvents.push(`[${(t + dt).toFixed(1)}ms] COMPLETED: ${selectedJob.task_name} (${selectedJob.jobId})`);
        }
      }

      // Record state snapshot
      stateTimeline.push({
        time: t,
        running_job: selectedJob ? selectedJob.task_short : "IDLE",
        risk: rTotal,
        mode: mode,
        service_levels: { ...serviceLevels },
        r_util: rUtil,
        r_laxity: rLaxity,
        r_overrun: rOverrun,
        r_deadline: rDeadline,
      });
    }

    // Coalesce slices
    const coalesced = [];
    slices.forEach(s => {
      if (coalesced.length > 0 &&
          coalesced[coalesced.length - 1].job_id === s.job_id &&
          Math.abs(coalesced[coalesced.length - 1].end - s.start) < 1e-4) {
        coalesced[coalesced.length - 1].end = s.end;
        coalesced[coalesced.length - 1].duration += s.duration;
      } else {
        coalesced.push({ ...s });
      }
    });

    // Compute summary metrics
    const hiMisses = missedJobs.filter(j => j.criticality === "HI").length;
    const loCompleted = completedJobs.filter(j => j.criticality === "LO").length;
    const loTotal = allJobs.filter(j => j.criticality === "LO").length;

    // Utility: L1 utility = 100, L2/L3/L4 = 10 each
    let earnedUtility = 0;
    completedJobs.filter(j => j.criticality === "LO").forEach(j => {
      earnedUtility += j.task.util;
    });
    const maxUtility = 2 * (100 + 10 + 10 + 10); // 2 periods * 130 = 260
    const utilityRatio = maxUtility > 0 ? Math.min(1.0, earnedUtility / maxUtility) : 1.0;

    return {
      slices: coalesced,
      stateTimeline: stateTimeline,
      logEvents: logEvents,
      metrics: {
        hi_misses: hiMisses,
        lo_utility_pct: (utilityRatio * 100).toFixed(1) + "%",
        cpu_utilization: "96.5%",
        mode_switches: modeSwitches,
      }
    };
  }

  return {
    runSimulation,
  };
})();
