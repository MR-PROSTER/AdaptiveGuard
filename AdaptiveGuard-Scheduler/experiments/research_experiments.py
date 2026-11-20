"""
Reproducible Research Experiment Framework for Mixed-Criticality Real-Time Scheduling.

Strict Comparative Evaluation between:
1. All existing research-paper approaches:
   - EDF (Liu & Layland 1973)
   - EDF-VD (Baruah et al. 2011/2012)
   - Classical Reactive Mixed-Criticality (Vestal 2007 baseline)
   - EDF-VD + Degraded LO Service (Su & Zhu 2013 / Liu et al. 2014 baseline)
   - Flexible MC (Burns & Baruah 2013 baseline)
   - Proactive Risk / Mode Change (Simulator design baseline)
2. Our proposed AdaptiveGuard approach

Features:
- Common Task Model (T_i, D_i = T_i, C_i^LO, C_i^HI, criticality, utility)
- Common Workloads (stress_20ms + UUniFast synthetic grid)
- 5 Execution Scenarios (NORMAL, SINGLE HI OVERRUN, MULTIPLE HI OVERRUN, BURSTY, RECOVERY)
- All 24 Common Metrics + Primary Metrics (HI miss ratio, LO utility ratio)
- Scientific Missing-Metric Classification (Directly Supported, Derived, Not Applicable, Not Reproducible)
- Strict Fairness Guarantees (identical tasksets, release sequences, execution traces, seeds, CPU)
- Statistical Aggregation (mean, median, std, min, max, 95% CI)
- Dual Reporting (Raw Metrics + Normalized Scores)
- Research Integrity Verification
- Timestamped Result Directories and Artifact Exporters
"""

import sys
import os
import json
import csv
import math
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional, Tuple
from concurrent.futures import ProcessPoolExecutor
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from config.default_config import SimulationConfig
from workloads.generator import TasksetGenerator
from workloads.fixed_workload import get_fixed_workload, ExecutionScenario
from simulator.simulation import Simulation
from simulator.task import Criticality
from schedulers.edf import EDFScheduler
from schedulers.edf_vd import EDFVDScheduler
from schedulers.classical_mc import ClassicalReactiveMCScheduler
from schedulers.degraded_edf_vd import EDFVDDegradedScheduler
from schedulers.flexible_mc import FlexibleMCScheduler
from schedulers.proactive_risk_mc import ProactiveRiskMCScheduler
from schedulers.adaptive_guard import AdaptiveGuardScheduler

# Experimental parameter domains defined by research specification
DEFAULT_TASK_COUNTS = [5, 10, 20, 30, 50]
DEFAULT_TARGET_UTILIZATIONS = [0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00, 1.10, 1.20, 1.30, 1.40, 1.50]
DEFAULT_HI_RATIOS = [0.20, 0.40, 0.60]  # 20/80, 40/60, 60/40

RESEARCH_METRICS_FIELDNAMES = [
    "experiment_id",
    "timestamp",
    "scheduler",
    "num_tasks",
    "target_utilization",
    "hi_ratio",
    "seed",
    "scenario",
    "duration",
    "warmup_time",
    "U_LO",
    "U_HI_LO",
    "U_HI_HI",
    "U_total_LO",
    "U_total_HI",
    # Primary Metrics
    "hi_miss_ratio",             # Primary Safety Metric (Lower is better)
    "lo_utility_ratio",          # Primary Quality Metric (Higher is better)
    # 24 Common Metrics
    "lo_completion_ratio",       # Metric 1
    "cpu_utilization",           # Metric 2
    "average_response_time",     # Metric 3
    "worst_response_time",       # Metric 4
    "average_tardiness",         # Metric 5
    "maximum_tardiness",         # Metric 6
    "number_of_deadline_misses", # Metric 7
    "hi_deadline_misses",        # Metric 8
    "lo_deadline_misses",        # Metric 9
    "mode_switches",             # Metric 10
    "warning_duration",          # Metric 11
    "hi_duration",               # Alias
    "hi_mode_duration",          # Metric 12
    "recovery_duration",         # Metric 13
    "recovery_time",             # Metric 14
    "scheduler_decisions",        # Metric 15
    "risk_calculations",         # Metric 16
    "total_overhead",            # Alias
    "computational_overhead",    # Metric 17
    "overhead_percentage",       # Metric 18
    "lo_utility",                # Metric 19
    "lo_utility_loss",           # Metric 20
    "service_preservation",      # Metric 21
    "number_of_dropped_suspended_lo_jobs", # Metric 22
    "number_of_preemptions",     # Metric 23
    "number_of_context_switches",# Metric 24
    # Raw Counts
    "hi_released_count",
    "hi_missed_count",
    "lo_released_count",
    "lo_completed_count",
    "maximum_possible_LO_utility",
]

METRIC_CLASSIFICATIONS = {
    "EDF": {
        "hi_miss_ratio": "A. DIRECTLY SUPPORTED",
        "lo_completion_ratio": "A. DIRECTLY SUPPORTED",
        "lo_utility_ratio": "B. DERIVED",
        "cpu_utilization": "A. DIRECTLY SUPPORTED",
        "average_response_time": "A. DIRECTLY SUPPORTED",
        "worst_response_time": "A. DIRECTLY SUPPORTED",
        "average_tardiness": "B. DERIVED",
        "maximum_tardiness": "B. DERIVED",
        "number_of_deadline_misses": "A. DIRECTLY SUPPORTED",
        "hi_deadline_misses": "A. DIRECTLY SUPPORTED",
        "lo_deadline_misses": "A. DIRECTLY SUPPORTED",
        "mode_switches": "C. NOT APPLICABLE (0: EDF has no mode-switching mechanism)",
        "warning_duration": "C. NOT APPLICABLE (0: EDF has no warning state)",
        "hi_mode_duration": "C. NOT APPLICABLE (0: EDF has no HI mode)",
        "recovery_duration": "C. NOT APPLICABLE (0: EDF has no recovery state)",
        "recovery_time": "C. NOT APPLICABLE (N/A: EDF has no recovery mechanism)",
        "scheduler_decisions": "A. DIRECTLY SUPPORTED",
        "risk_calculations": "C. NOT APPLICABLE (0: EDF has no risk estimator)",
        "computational_overhead": "A. DIRECTLY SUPPORTED",
        "overhead_percentage": "A. DIRECTLY SUPPORTED",
        "lo_utility": "B. DERIVED",
        "lo_utility_loss": "B. DERIVED",
        "service_preservation": "B. DERIVED",
        "number_of_dropped_suspended_lo_jobs": "B. DERIVED",
        "number_of_preemptions": "A. DIRECTLY SUPPORTED",
        "number_of_context_switches": "A. DIRECTLY SUPPORTED",
    },
    "EDF-VD": {
        "hi_miss_ratio": "A. DIRECTLY SUPPORTED",
        "lo_completion_ratio": "A. DIRECTLY SUPPORTED",
        "lo_utility_ratio": "B. DERIVED",
        "cpu_utilization": "A. DIRECTLY SUPPORTED",
        "average_response_time": "A. DIRECTLY SUPPORTED",
        "worst_response_time": "A. DIRECTLY SUPPORTED",
        "average_tardiness": "B. DERIVED",
        "maximum_tardiness": "B. DERIVED",
        "number_of_deadline_misses": "A. DIRECTLY SUPPORTED",
        "hi_deadline_misses": "A. DIRECTLY SUPPORTED",
        "lo_deadline_misses": "A. DIRECTLY SUPPORTED",
        "mode_switches": "A. DIRECTLY SUPPORTED (1: switches LO -> HI upon overrun)",
        "warning_duration": "C. NOT APPLICABLE (0: no warning mode in standard EDF-VD)",
        "hi_mode_duration": "A. DIRECTLY SUPPORTED",
        "recovery_duration": "C. NOT APPLICABLE (0: classical EDF-VD never returns to LO mode)",
        "recovery_time": "C. NOT APPLICABLE (N/A: classical EDF-VD has no recovery mechanism)",
        "scheduler_decisions": "A. DIRECTLY SUPPORTED",
        "risk_calculations": "C. NOT APPLICABLE (0: no proactive risk in standard EDF-VD)",
        "computational_overhead": "A. DIRECTLY SUPPORTED",
        "overhead_percentage": "A. DIRECTLY SUPPORTED",
        "lo_utility": "B. DERIVED",
        "lo_utility_loss": "B. DERIVED",
        "service_preservation": "B. DERIVED",
        "number_of_dropped_suspended_lo_jobs": "A. DIRECTLY SUPPORTED",
        "number_of_preemptions": "A. DIRECTLY SUPPORTED",
        "number_of_context_switches": "A. DIRECTLY SUPPORTED",
    },
    "Classical Reactive MC": {
        "hi_miss_ratio": "A. DIRECTLY SUPPORTED",
        "lo_completion_ratio": "A. DIRECTLY SUPPORTED",
        "lo_utility_ratio": "B. DERIVED",
        "cpu_utilization": "A. DIRECTLY SUPPORTED",
        "average_response_time": "A. DIRECTLY SUPPORTED",
        "worst_response_time": "A. DIRECTLY SUPPORTED",
        "average_tardiness": "B. DERIVED",
        "maximum_tardiness": "B. DERIVED",
        "number_of_deadline_misses": "A. DIRECTLY SUPPORTED",
        "hi_deadline_misses": "A. DIRECTLY SUPPORTED",
        "lo_deadline_misses": "A. DIRECTLY SUPPORTED",
        "mode_switches": "A. DIRECTLY SUPPORTED (1: switches LO -> HI upon overrun)",
        "warning_duration": "C. NOT APPLICABLE (0: no warning state)",
        "hi_mode_duration": "A. DIRECTLY SUPPORTED",
        "recovery_duration": "C. NOT APPLICABLE (0: no recovery state)",
        "recovery_time": "C. NOT APPLICABLE (N/A: classical MC has no recovery mechanism)",
        "scheduler_decisions": "A. DIRECTLY SUPPORTED",
        "risk_calculations": "C. NOT APPLICABLE (0: no risk calculation)",
        "computational_overhead": "A. DIRECTLY SUPPORTED",
        "overhead_percentage": "A. DIRECTLY SUPPORTED",
        "lo_utility": "B. DERIVED",
        "lo_utility_loss": "B. DERIVED",
        "service_preservation": "B. DERIVED",
        "number_of_dropped_suspended_lo_jobs": "A. DIRECTLY SUPPORTED",
        "number_of_preemptions": "A. DIRECTLY SUPPORTED",
        "number_of_context_switches": "A. DIRECTLY SUPPORTED",
    },
    "EDF-VD + Degraded LO Service": {
        "hi_miss_ratio": "A. DIRECTLY SUPPORTED",
        "lo_completion_ratio": "A. DIRECTLY SUPPORTED",
        "lo_utility_ratio": "B. DERIVED",
        "cpu_utilization": "A. DIRECTLY SUPPORTED",
        "average_response_time": "A. DIRECTLY SUPPORTED",
        "worst_response_time": "A. DIRECTLY SUPPORTED",
        "average_tardiness": "B. DERIVED",
        "maximum_tardiness": "B. DERIVED",
        "number_of_deadline_misses": "A. DIRECTLY SUPPORTED",
        "hi_deadline_misses": "A. DIRECTLY SUPPORTED",
        "lo_deadline_misses": "A. DIRECTLY SUPPORTED",
        "mode_switches": "A. DIRECTLY SUPPORTED (1: switches LO -> HI upon overrun)",
        "warning_duration": "C. NOT APPLICABLE (0: no proactive warning)",
        "hi_mode_duration": "A. DIRECTLY SUPPORTED",
        "recovery_duration": "C. NOT APPLICABLE (0: static degraded model does not recover)",
        "recovery_time": "C. NOT APPLICABLE (N/A: no recovery mechanism)",
        "scheduler_decisions": "A. DIRECTLY SUPPORTED",
        "risk_calculations": "C. NOT APPLICABLE (0: no risk estimator)",
        "computational_overhead": "A. DIRECTLY SUPPORTED",
        "overhead_percentage": "A. DIRECTLY SUPPORTED",
        "lo_utility": "B. DERIVED",
        "lo_utility_loss": "B. DERIVED",
        "service_preservation": "A. DIRECTLY SUPPORTED",
        "number_of_dropped_suspended_lo_jobs": "B. DERIVED",
        "number_of_preemptions": "A. DIRECTLY SUPPORTED",
        "number_of_context_switches": "A. DIRECTLY SUPPORTED",
    },
    "Flexible MC": {
        "hi_miss_ratio": "A. DIRECTLY SUPPORTED",
        "lo_completion_ratio": "A. DIRECTLY SUPPORTED",
        "lo_utility_ratio": "B. DERIVED",
        "cpu_utilization": "A. DIRECTLY SUPPORTED",
        "average_response_time": "A. DIRECTLY SUPPORTED",
        "worst_response_time": "A. DIRECTLY SUPPORTED",
        "average_tardiness": "B. DERIVED",
        "maximum_tardiness": "B. DERIVED",
        "number_of_deadline_misses": "A. DIRECTLY SUPPORTED",
        "hi_deadline_misses": "A. DIRECTLY SUPPORTED",
        "lo_deadline_misses": "A. DIRECTLY SUPPORTED",
        "mode_switches": "A. DIRECTLY SUPPORTED (count of independently escalated tasks)",
        "warning_duration": "C. NOT APPLICABLE (0: per-task escalation without warning state)",
        "hi_mode_duration": "B. DERIVED",
        "recovery_duration": "C. NOT APPLICABLE (0: escalated tasks do not de-escalate)",
        "recovery_time": "C. NOT APPLICABLE (N/A: no recovery mechanism)",
        "scheduler_decisions": "A. DIRECTLY SUPPORTED",
        "risk_calculations": "C. NOT APPLICABLE (0: no risk estimator)",
        "computational_overhead": "A. DIRECTLY SUPPORTED",
        "overhead_percentage": "A. DIRECTLY SUPPORTED",
        "lo_utility": "B. DERIVED",
        "lo_utility_loss": "B. DERIVED",
        "service_preservation": "B. DERIVED",
        "number_of_dropped_suspended_lo_jobs": "B. DERIVED",
        "number_of_preemptions": "A. DIRECTLY SUPPORTED",
        "number_of_context_switches": "A. DIRECTLY SUPPORTED",
    },
    "Proactive Risk / Mode Change": {
        "hi_miss_ratio": "A. DIRECTLY SUPPORTED",
        "lo_completion_ratio": "A. DIRECTLY SUPPORTED",
        "lo_utility_ratio": "B. DERIVED",
        "cpu_utilization": "A. DIRECTLY SUPPORTED",
        "average_response_time": "A. DIRECTLY SUPPORTED",
        "worst_response_time": "A. DIRECTLY SUPPORTED",
        "average_tardiness": "B. DERIVED",
        "maximum_tardiness": "B. DERIVED",
        "number_of_deadline_misses": "A. DIRECTLY SUPPORTED",
        "hi_deadline_misses": "A. DIRECTLY SUPPORTED",
        "lo_deadline_misses": "A. DIRECTLY SUPPORTED",
        "mode_switches": "A. DIRECTLY SUPPORTED",
        "warning_duration": "A. DIRECTLY SUPPORTED",
        "hi_mode_duration": "A. DIRECTLY SUPPORTED",
        "recovery_duration": "A. DIRECTLY SUPPORTED",
        "recovery_time": "A. DIRECTLY SUPPORTED",
        "scheduler_decisions": "A. DIRECTLY SUPPORTED",
        "risk_calculations": "A. DIRECTLY SUPPORTED",
        "computational_overhead": "A. DIRECTLY SUPPORTED",
        "overhead_percentage": "A. DIRECTLY SUPPORTED",
        "lo_utility": "B. DERIVED",
        "lo_utility_loss": "B. DERIVED",
        "service_preservation": "B. DERIVED",
        "number_of_dropped_suspended_lo_jobs": "A. DIRECTLY SUPPORTED",
        "number_of_preemptions": "A. DIRECTLY SUPPORTED",
        "number_of_context_switches": "A. DIRECTLY SUPPORTED",
    },
    "AdaptiveGuard": {
        "hi_miss_ratio": "A. DIRECTLY SUPPORTED",
        "lo_completion_ratio": "A. DIRECTLY SUPPORTED",
        "lo_utility_ratio": "A. DIRECTLY SUPPORTED",
        "cpu_utilization": "A. DIRECTLY SUPPORTED",
        "average_response_time": "A. DIRECTLY SUPPORTED",
        "worst_response_time": "A. DIRECTLY SUPPORTED",
        "average_tardiness": "A. DIRECTLY SUPPORTED",
        "maximum_tardiness": "A. DIRECTLY SUPPORTED",
        "number_of_deadline_misses": "A. DIRECTLY SUPPORTED",
        "hi_deadline_misses": "A. DIRECTLY SUPPORTED",
        "lo_deadline_misses": "A. DIRECTLY SUPPORTED",
        "mode_switches": "A. DIRECTLY SUPPORTED",
        "warning_duration": "A. DIRECTLY SUPPORTED",
        "hi_mode_duration": "A. DIRECTLY SUPPORTED",
        "recovery_duration": "A. DIRECTLY SUPPORTED",
        "recovery_time": "A. DIRECTLY SUPPORTED",
        "scheduler_decisions": "A. DIRECTLY SUPPORTED",
        "risk_calculations": "A. DIRECTLY SUPPORTED",
        "computational_overhead": "A. DIRECTLY SUPPORTED",
        "overhead_percentage": "A. DIRECTLY SUPPORTED",
        "lo_utility": "A. DIRECTLY SUPPORTED",
        "lo_utility_loss": "A. DIRECTLY SUPPORTED",
        "service_preservation": "A. DIRECTLY SUPPORTED",
        "number_of_dropped_suspended_lo_jobs": "A. DIRECTLY SUPPORTED",
        "number_of_preemptions": "A. DIRECTLY SUPPORTED",
        "number_of_context_switches": "A. DIRECTLY SUPPORTED",
    },
}


@dataclass
class ResearchExperimentConfig:
    """Configuration parameters for research experiments."""
    task_counts: List[int] = None
    target_utilizations: List[float] = None
    hi_ratios: List[float] = None
    duration: float = 5000.0
    warmup_time: float = 500.0
    c_hi_factor: float = 2.5
    num_tasksets: int = 10
    seed_base: int = 42
    scenario: str = "BOTH_OVERRUN"
    enable_overhead: bool = True
    output_base_dir: str = "results"

    def __post_init__(self):
        if self.task_counts is None:
            self.task_counts = list(DEFAULT_TASK_COUNTS)
        if self.target_utilizations is None:
            self.target_utilizations = list(DEFAULT_TARGET_UTILIZATIONS)
        if self.hi_ratios is None:
            self.hi_ratios = list(DEFAULT_HI_RATIOS)


def create_timestamped_directory(base_dir: str = "results") -> Path:
    """Create a unique timestamped results directory to prevent overwriting prior runs."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = Path(base_dir) / f"experiments_{timestamp}"
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir


def create_schedulers_for_taskset(taskset: list) -> List[Any]:
    """Instantiate all 7 research schedulers for a generated taskset."""
    return [
        EDFScheduler(),
        EDFVDScheduler(tasks=taskset),
        ClassicalReactiveMCScheduler(),
        EDFVDDegradedScheduler(tasks=taskset, degraded_service_level=0.50),
        FlexibleMCScheduler(tasks=taskset),
        ProactiveRiskMCScheduler(tasks=taskset),
        AdaptiveGuardScheduler(tasks=taskset),
    ]


def run_experiment_on_taskset(
    taskset: list,
    schedulers: list,
    duration: float,
    warmup_time: float,
    seed: int,
    scenario: str = "BOTH_OVERRUN",
    enable_overhead: bool = True,
) -> List[Dict[str, Any]]:
    """
    Execute all schedulers on the exact same taskset under identical conditions.
    """
    results: List[Dict[str, Any]] = []

    for scheduler in schedulers:
        sim_config = SimulationConfig(
            duration=duration,
            warmup_time=warmup_time,
            verbose=False,
            enable_overhead=enable_overhead,
            scheduler_overhead=0.01,
            risk_estimation_overhead=0.005,
            mode_transition_overhead=0.01,
        )
        is_monitoring = scheduler.name in ("AdaptiveGuard", "Proactive Risk / Mode Change")
        sim = Simulation(
            tasks=taskset,
            config=sim_config,
            scheduler=scheduler,
            scenario=scenario,
            seed=seed,
            enable_monitoring=is_monitoring,
        )
        res = sim.run()
        results.append(res)

    return results


def verify_research_integrity(results: List[Dict[str, Any]]) -> List[str]:
    """
    Perform rigorous validation checks on empirical results according to Section 25.
    Returns list of issues detected (empty list if clean).
    """
    issues: List[str] = []

    for r in results:
        sched = r.get("scheduler", "Unknown")

        # 1. Non-negativity check
        if r.get("cpu_utilization", 0.0) < 0.0:
            issues.append(f"[{sched}] Negative CPU utilization: {r['cpu_utilization']}")
        if r.get("cpu_utilization", 0.0) > 1.0 + 1e-6:
            issues.append(f"[{sched}] Impossible CPU utilization > 1.0: {r['cpu_utilization']}")
        if r.get("average_response_time", 0.0) < 0.0:
            issues.append(f"[{sched}] Negative response time: {r['average_response_time']}")
        if r.get("average_tardiness", 0.0) < 0.0:
            issues.append(f"[{sched}] Negative tardiness: {r['average_tardiness']}")

        # 2. Impossible bounds check
        if r.get("hi_miss_ratio", 0.0) > 1.0 + 1e-6 or r.get("hi_miss_ratio", 0.0) < -1e-6:
            issues.append(f"[{sched}] HI miss ratio outside [0,1]: {r['hi_miss_ratio']}")
        if r.get("lo_utility_ratio", 0.0) > 1.0 + 1e-6 or r.get("lo_utility_ratio", 0.0) < -1e-6:
            issues.append(f"[{sched}] LO utility ratio outside [0,1]: {r['lo_utility_ratio']}")
        if r.get("service_preservation", 0.0) > 1.0 + 1e-6:
            issues.append(f"[{sched}] Service preservation exceeds 100%: {r['service_preservation']}")

        # 3. Overhead check
        if r.get("enable_overhead", False):
            if r.get("scheduler_decisions", 0) > 0 and r.get("computational_overhead", 0.0) <= 0.0:
                issues.append(f"[{sched}] Scheduler made decisions but recorded zero overhead")

        # 4. Mode switch check for EDF
        if sched == "EDF" and r.get("mode_switches", 0) != 0:
            issues.append(f"[EDF] EDF must have 0 mode switches, got {r['mode_switches']}")

    return issues


def compute_statistics(values: List[float]) -> Dict[str, float]:
    """Calculate mean, median, std, min, max, and 95% confidence interval."""
    if not values:
        return {"mean": 0.0, "median": 0.0, "std": 0.0, "min": 0.0, "max": 0.0, "ci_95": 0.0}

    arr = np.array(values, dtype=float)
    mean_val = float(np.mean(arr))
    med_val = float(np.median(arr))
    std_val = float(np.std(arr, ddof=1)) if len(arr) > 1 else 0.0
    min_val = float(np.min(arr))
    max_val = float(np.max(arr))
    ci_95 = float(1.96 * (std_val / math.sqrt(len(arr)))) if len(arr) > 1 else 0.0

    return {
        "mean": mean_val,
        "median": med_val,
        "std": std_val,
        "min": min_val,
        "max": max_val,
        "ci_95": ci_95,
    }


def generate_summary_tables(raw_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Generate comprehensive statistical summaries grouped by scheduler and by utilization.
    Also builds the required comparison table and normalized comparison table.
    """
    from collections import defaultdict

    sched_groups = defaultdict(list)
    util_groups = defaultdict(list)

    for r in raw_results:
        sched_groups[r["scheduler"]].append(r)
        util_groups[(r.get("target_utilization", 0.0), r["scheduler"])].append(r)

    # 1. Summary by scheduler with comprehensive statistics
    sched_summary = []
    for s_name in [
        "EDF",
        "EDF-VD",
        "Classical Reactive MC",
        "EDF-VD + Degraded LO Service",
        "Flexible MC",
        "Proactive Risk / Mode Change",
        "AdaptiveGuard",
    ]:
        rows = sched_groups.get(s_name, [])
        if not rows:
            continue

        n_runs = len(rows)

        def get_stat(key: str) -> Dict[str, float]:
            vals = [float(r[key]) for r in rows if r.get(key) is not None]
            return compute_statistics(vals)

        hi_miss_stat = get_stat("hi_miss_ratio")
        lo_comp_stat = get_stat("lo_completion_ratio")
        lo_util_stat = get_stat("lo_utility_ratio")
        cpu_util_stat = get_stat("cpu_utilization")
        avg_resp_stat = get_stat("average_response_time")
        worst_resp_stat = get_stat("worst_response_time")
        avg_tard_stat = get_stat("average_tardiness")
        max_tard_stat = get_stat("maximum_tardiness")
        ddl_miss_stat = get_stat("number_of_deadline_misses")
        hi_miss_cnt_stat = get_stat("hi_deadline_misses")
        lo_miss_cnt_stat = get_stat("lo_deadline_misses")
        switches_stat = get_stat("mode_switches")
        warn_dur_stat = get_stat("warning_duration")
        hi_dur_stat = get_stat("hi_mode_duration")
        rec_dur_stat = get_stat("recovery_duration")
        rec_time_stat = get_stat("recovery_time")
        sched_dec_stat = get_stat("scheduler_decisions")
        risk_calc_stat = get_stat("risk_calculations")
        overhead_stat = get_stat("computational_overhead")
        overhead_pct_stat = get_stat("overhead_percentage")
        lo_util_val_stat = get_stat("lo_utility")
        lo_util_loss_stat = get_stat("lo_utility_loss")
        serv_pres_stat = get_stat("service_preservation")
        lo_drop_stat = get_stat("number_of_dropped_suspended_lo_jobs")
        preempt_stat = get_stat("number_of_preemptions")
        cswitch_stat = get_stat("number_of_context_switches")

        rec_time_display = f"{rec_time_stat['mean']:.2f}" if s_name in ("AdaptiveGuard", "Proactive Risk / Mode Change") else "N/A"

        sched_summary.append({
            "scheduler": s_name,
            "runs_count": n_runs,
            # Primary metrics
            "hi_miss_ratio": hi_miss_stat["mean"],
            "hi_miss_ratio_mean": hi_miss_stat["mean"],
            "hi_miss_ratio_std": hi_miss_stat["std"],
            "hi_miss_ratio_ci95": hi_miss_stat["ci_95"],
            "lo_utility_ratio": lo_util_stat["mean"],
            "lo_utility_ratio_mean": lo_util_stat["mean"],
            "lo_utility_ratio_std": lo_util_stat["std"],
            "lo_utility_ratio_ci95": lo_util_stat["ci_95"],
            # 24 metrics (means)
            "lo_completion_ratio": lo_comp_stat["mean"],
            "cpu_utilization": cpu_util_stat["mean"],
            "average_response_time": avg_resp_stat["mean"],
            "worst_response_time": worst_resp_stat["max"],
            "average_tardiness": avg_tard_stat["mean"],
            "maximum_tardiness": max_tard_stat["max"],
            "number_of_deadline_misses": ddl_miss_stat["mean"],
            "hi_deadline_misses": hi_miss_cnt_stat["mean"],
            "lo_deadline_misses": lo_miss_cnt_stat["mean"],
            "mode_switches": switches_stat["mean"],
            "warning_duration": warn_dur_stat["mean"],
            "hi_duration": hi_dur_stat["mean"],
            "hi_mode_duration": hi_dur_stat["mean"],
            "recovery_duration": rec_dur_stat["mean"],
            "recovery_time": rec_time_display,
            "scheduler_decisions": sched_dec_stat["mean"],
            "risk_calculations": risk_calc_stat["mean"],
            "total_overhead": overhead_stat["mean"],
            "computational_overhead": overhead_stat["mean"],
            "overhead_percentage": overhead_pct_stat["mean"],
            "lo_utility": lo_util_val_stat["mean"],
            "lo_utility_loss": lo_util_loss_stat["mean"],
            "service_preservation": serv_pres_stat["mean"],
            "number_of_dropped_suspended_lo_jobs": lo_drop_stat["mean"],
            "number_of_preemptions": preempt_stat["mean"],
            "number_of_context_switches": cswitch_stat["mean"],
        })

    # 2. Required comparison table (Section 19)
    required_table = []
    for r in sched_summary:
        s_name = r["scheduler"]
        rec_time_str = r["recovery_time"]
        mode_sw_str = "0 (N/A)" if s_name == "EDF" else f"{r['mode_switches']:.2f}"
        required_table.append({
            "Approach": s_name,
            "HI Miss Ratio (↓)": f"{r['hi_miss_ratio_mean']:.4f} ± {r['hi_miss_ratio_std']:.4f}",
            "LO Completion Ratio (↑)": f"{r['lo_completion_ratio']:.4f}",
            "LO Utility Ratio (↑)": f"{r['lo_utility_ratio_mean']:.4f} ± {r['lo_utility_ratio_std']:.4f}",
            "CPU Utilization": f"{r['cpu_utilization']:.3f}",
            "Avg Response Time (ms)": f"{r['average_response_time']:.2f}",
            "Worst Response Time (ms)": f"{r['worst_response_time']:.2f}",
            "Deadline Misses": f"{r['number_of_deadline_misses']:.1f}",
            "Mode Switches": mode_sw_str,
            "LO Jobs Dropped": f"{r['number_of_dropped_suspended_lo_jobs']:.1f}",
            "Preemptions": f"{r['number_of_preemptions']:.1f}",
            "Overhead (%)": f"{r['overhead_percentage']:.2f}%",
            "Recovery Time (ms)": rec_time_str,
        })

    # 3. Normalized comparison table (Section 20)
    normalized_table = []
    for r in sched_summary:
        s_name = r["scheduler"]
        hi_m = r["hi_miss_ratio_mean"]
        lo_u = r["lo_utility_ratio_mean"]
        cpu_u = r["cpu_utilization"]
        oh_pct = r["overhead_percentage"]

        safety_score = max(0.0, 1.0 - hi_m)
        utility_score = max(0.0, min(1.0, lo_u))
        efficiency_score = min(1.0, max(0.0, cpu_u))
        overhead_score = max(0.0, 1.0 - min(1.0, oh_pct / 10.0))

        normalized_table.append({
            "Approach": s_name,
            "Safety Score (↑)": round(safety_score, 4),
            "Utility Score (↑)": round(utility_score, 4),
            "Efficiency Score (↑)": round(efficiency_score, 4),
            "Overhead Score (↑)": round(overhead_score, 4),
        })

    return {
        "by_scheduler": sched_summary,
        "required_table": required_table,
        "normalized_table": normalized_table,
    }


def save_raw_results(results: List[Dict[str, Any]], csv_path: Path) -> None:
    """Write raw experimental results into CSV."""
    with open(csv_path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=RESEARCH_METRICS_FIELDNAMES)
        writer.writeheader()
        for r in results:
            row = {field: r.get(field, "") for field in RESEARCH_METRICS_FIELDNAMES}
            writer.writerow(row)


def run_fixed_stress_20ms_experiment(duration: float = 200.0, enable_overhead: bool = True) -> List[Dict[str, Any]]:
    """
    Run all 7 schedulers on the canonical fixed stress_20ms workload across all 5 scenarios:
    1. NORMAL
    2. SINGLE HI OVERRUN (H1_OVERRUN)
    3. MULTIPLE HI OVERRUN (BOTH_OVERRUN)
    4. BURSTY OVERLOAD (BURSTY)
    5. RECOVERY (RECOVERY)
    """
    scenarios = [
        ("NORMAL", ExecutionScenario.NORMAL),
        ("SINGLE_HI_OVERRUN", ExecutionScenario.H1_OVERRUN),
        ("MULTIPLE_HI_OVERRUN", ExecutionScenario.BOTH_OVERRUN),
        ("BURSTY_OVERLOAD", ExecutionScenario.BURSTY),
        ("RECOVERY", ExecutionScenario.RECOVERY),
    ]

    fixed_results = []
    exp_idx = 0

    for sc_name, sc_enum in scenarios:
        taskset = get_fixed_workload()
        schedulers = create_schedulers_for_taskset(taskset)

        for sched in schedulers:
            exp_idx += 1
            sim_cfg = SimulationConfig(
                duration=duration,
                warmup_time=0.0,
                verbose=False,
                enable_overhead=enable_overhead,
                scheduler_overhead=0.01,
                risk_estimation_overhead=0.005,
                mode_transition_overhead=0.01,
            )
            is_mon = sched.name in ("AdaptiveGuard", "Proactive Risk / Mode Change")
            sim = Simulation(
                tasks=taskset,
                config=sim_cfg,
                scheduler=sched,
                scenario=sc_enum,
                seed=42,
                enable_monitoring=is_mon,
            )
            res = sim.run()

            row = {
                "experiment_id": f"STRESS_{exp_idx:04d}",
                "timestamp": datetime.now().isoformat(),
                "scheduler": sched.name,
                "num_tasks": len(taskset),
                "target_utilization": 0.70,
                "hi_ratio": 2.0 / 6.0,
                "seed": 42,
                "scenario": sc_name,
                "duration": duration,
                "warmup_time": 0.0,
                "U_LO": 0.45,
                "U_HI_LO": 0.25,
                "U_HI_HI": 0.65,
                "U_total_LO": 0.70,
                "U_total_HI": 1.10,
                "hi_miss_ratio": res["hi_miss_ratio"],
                "lo_utility_ratio": res["LO_utility_ratio"],
                "lo_completion_ratio": res["lo_completion_ratio"],
                "cpu_utilization": res["cpu_utilization"],
                "average_response_time": res["average_response_time"],
                "worst_response_time": res["worst_response_time"],
                "average_tardiness": res["average_tardiness"],
                "maximum_tardiness": res["maximum_tardiness"],
                "number_of_deadline_misses": res["number_of_deadline_misses"],
                "hi_deadline_misses": res["hi_deadline_misses"],
                "lo_deadline_misses": res["lo_deadline_misses"],
                "mode_switches": res["mode_switches_count"],
                "warning_duration": res["warning_duration"],
                "hi_mode_duration": res["hi_mode_duration"],
                "recovery_duration": res["recovery_duration"],
                "recovery_time": res["recovery_time"],
                "scheduler_decisions": res["scheduler_decisions"],
                "risk_calculations": res["risk_calculations"],
                "computational_overhead": res["computational_overhead"],
                "overhead_percentage": res["overhead_percentage"],
                "lo_utility": res["lo_utility"],
                "lo_utility_loss": res["lo_utility_loss"],
                "service_preservation": res["service_preservation"],
                "number_of_dropped_suspended_lo_jobs": res["number_of_dropped_suspended_lo_jobs"],
                "number_of_preemptions": res["number_of_preemptions"],
                "number_of_context_switches": res["number_of_context_switches"],
                "hi_released_count": res["hi_released_jobs_count"],
                "hi_missed_count": res["hi_missed_jobs_count"],
                "lo_released_count": res["lo_released_jobs_count"],
                "lo_completed_count": res["lo_completed_jobs_count"],
                "maximum_possible_LO_utility": res["maximum_possible_LO_utility"],
            }
            fixed_results.append(row)

    return fixed_results


def _eval_single_taskset_item(args: Tuple) -> List[Dict[str, Any]]:
    """Worker function to evaluate all 7 schedulers on a single generated taskset."""
    (
        exp_counter,
        n_tasks,
        u_target,
        hi_r,
        ts_idx,
        c_hi_factor,
        seed_base,
        duration,
        warmup_time,
        scenario,
        enable_overhead,
    ) = args

    seed = seed_base + (n_tasks * 100000) + int(u_target * 1000) + int(hi_r * 100) + ts_idx
    generator = TasksetGenerator(c_hi_factor=c_hi_factor)
    taskset = generator.generate_taskset(
        num_tasks=n_tasks,
        target_utilization=u_target,
        hi_ratio=hi_r,
        seed=seed,
    )
    ts_metrics = TasksetGenerator.calculate_taskset_metrics(taskset)
    schedulers = create_schedulers_for_taskset(taskset)

    sim_results = run_experiment_on_taskset(
        taskset=taskset,
        schedulers=schedulers,
        duration=duration,
        warmup_time=warmup_time,
        seed=seed,
        scenario=scenario,
        enable_overhead=enable_overhead,
    )

    rows = []
    for s_res in sim_results:
        row = {
            "experiment_id": f"EXP_{exp_counter:06d}",
            "timestamp": datetime.now().isoformat(),
            "scheduler": s_res["scheduler"],
            "num_tasks": n_tasks,
            "target_utilization": u_target,
            "hi_ratio": hi_r,
            "seed": seed,
            "scenario": scenario,
            "duration": duration,
            "warmup_time": warmup_time,
            "U_LO": ts_metrics.U_LO,
            "U_HI_LO": ts_metrics.U_HI_LO,
            "U_HI_HI": ts_metrics.U_HI_HI,
            "U_total_LO": ts_metrics.U_total_LO,
            "U_total_HI": ts_metrics.U_total_HI,
            "hi_miss_ratio": s_res["hi_miss_ratio"],
            "lo_utility_ratio": s_res["LO_utility_ratio"],
            "lo_completion_ratio": s_res["lo_completion_ratio"],
            "cpu_utilization": s_res["cpu_utilization"],
            "average_response_time": s_res["average_response_time"],
            "worst_response_time": s_res["worst_response_time"],
            "average_tardiness": s_res["average_tardiness"],
            "maximum_tardiness": s_res["maximum_tardiness"],
            "number_of_deadline_misses": s_res["number_of_deadline_misses"],
            "hi_deadline_misses": s_res["hi_deadline_misses"],
            "lo_deadline_misses": s_res["lo_deadline_misses"],
            "mode_switches": s_res["mode_switches_count"],
            "warning_duration": s_res["warning_duration"],
            "hi_mode_duration": s_res["hi_mode_duration"],
            "recovery_duration": s_res["recovery_duration"],
            "recovery_time": s_res["recovery_time"],
            "scheduler_decisions": s_res["scheduler_decisions"],
            "risk_calculations": s_res["risk_calculations"],
            "computational_overhead": s_res["computational_overhead"],
            "overhead_percentage": s_res["overhead_percentage"],
            "lo_utility": s_res["lo_utility"],
            "lo_utility_loss": s_res["lo_utility_loss"],
            "service_preservation": s_res["service_preservation"],
            "number_of_dropped_suspended_lo_jobs": s_res["number_of_dropped_suspended_lo_jobs"],
            "number_of_preemptions": s_res["number_of_preemptions"],
            "number_of_context_switches": s_res["number_of_context_switches"],
            "hi_released_count": s_res["hi_released_jobs_count"],
            "hi_missed_count": s_res["hi_missed_jobs_count"],
            "lo_released_count": s_res["lo_released_jobs_count"],
            "lo_completed_count": s_res["lo_completed_jobs_count"],
            "maximum_possible_LO_utility": s_res["maximum_possible_LO_utility"],
        }
        rows.append(row)
    return rows


def run_research_experiments(
    config: Optional[ResearchExperimentConfig] = None,
    output_dir: Optional[Path] = None,
) -> Dict[str, Any]:
    """
    Run full or sampled research experiments across the parameter grid.
    Saves timestamped outputs, executes research integrity verification,
    and returns complete summary metrics.
    """
    cfg = config or ResearchExperimentConfig()
    out_dir = output_dir or create_timestamped_directory(cfg.output_base_dir)

    raw_results: List[Dict[str, Any]] = []

    total_tasksets = len(cfg.task_counts) * len(cfg.target_utilizations) * len(cfg.hi_ratios) * cfg.num_tasksets
    print(f"\n" + "=" * 90)
    print(f"Starting Research Experiments: {total_tasksets} Tasksets | Schedulers: 7 | Output: {out_dir}")
    print(f"Task Counts: {cfg.task_counts}")
    print(f"Target Utilizations: {cfg.target_utilizations}")
    print(f"HI/LO Ratios: {cfg.hi_ratios}")
    print(f"Duration: {cfg.duration}ms | Warm-up: {cfg.warmup_time}ms | Repetitions: {cfg.num_tasksets}")
    print("=" * 90 + "\n")

    items = []
    exp_counter = 0
    for n_tasks in cfg.task_counts:
        for u_target in cfg.target_utilizations:
            for hi_r in cfg.hi_ratios:
                for ts_idx in range(cfg.num_tasksets):
                    exp_counter += 1
                    items.append((
                        exp_counter,
                        n_tasks,
                        u_target,
                        hi_r,
                        ts_idx,
                        cfg.c_hi_factor,
                        cfg.seed_base,
                        cfg.duration,
                        cfg.warmup_time,
                        cfg.scenario,
                        cfg.enable_overhead,
                    ))

    max_workers = min(8, os.cpu_count() or 1)
    if total_tasksets > 4:
        with ProcessPoolExecutor(max_workers=max_workers) as executor:
            completed = 0
            for batch in executor.map(_eval_single_taskset_item, items):
                raw_results.extend(batch)
                completed += 1
                if completed % max(1, (total_tasksets // 10)) == 0 or completed == total_tasksets:
                    print(f"Progress: [{completed}/{total_tasksets} tasksets evaluated] ({len(raw_results)} total simulation runs)")
    else:
        for item in items:
            raw_results.extend(_eval_single_taskset_item(item))

    # Research Integrity Check
    integrity_issues = verify_research_integrity(raw_results)
    if integrity_issues:
        print("\n[RESEARCH INTEGRITY WARNING] Issues flagged:")
        for issue in integrity_issues[:10]:
            print(f"  - {issue}")
        if len(integrity_issues) > 10:
            print(f"  ... and {len(integrity_issues) - 10} more.")

    # Save outputs to timestamped directory
    raw_csv_path = out_dir / "raw_results.csv"
    save_raw_results(raw_results, raw_csv_path)

    # Compute summaries and comparison tables
    summaries = generate_summary_tables(raw_results)

    # Save summary CSVs inside timestamped dir
    sched_csv_path = out_dir / "final_comparison.csv"
    with open(sched_csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(summaries["required_table"][0].keys()))
        writer.writeheader()
        writer.writerows(summaries["required_table"])

    norm_csv_path = out_dir / "normalized_comparison.csv"
    with open(norm_csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(summaries["normalized_table"][0].keys()))
        writer.writeheader()
        writer.writerows(summaries["normalized_table"])

    # Also save to canonical root results directory
    root_results_dir = Path(cfg.output_base_dir)
    root_results_dir.mkdir(parents=True, exist_ok=True)
    (root_results_dir / "raw").mkdir(parents=True, exist_ok=True)
    (root_results_dir / "tables").mkdir(parents=True, exist_ok=True)

    with open(root_results_dir / "final_comparison.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(summaries["required_table"][0].keys()))
        writer.writeheader()
        writer.writerows(summaries["required_table"])

    with open(root_results_dir / "normalized_comparison.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(summaries["normalized_table"][0].keys()))
        writer.writeheader()
        writer.writerows(summaries["normalized_table"])

    # Save metadata JSON
    meta_path = out_dir / "metadata.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        meta = {
            "timestamp": datetime.now().isoformat(),
            "config": asdict(cfg),
            "total_tasksets": total_tasksets,
            "total_simulations": len(raw_results),
            "integrity_checks_passed": len(integrity_issues) == 0,
            "integrity_issues_count": len(integrity_issues),
            "files": {
                "raw_results_csv": str(raw_csv_path.name),
                "final_comparison_csv": "final_comparison.csv",
                "normalized_comparison_csv": "normalized_comparison.csv",
            }
        }
        json.dump(meta, f, indent=2)

    return {
        "output_dir": str(out_dir),
        "raw_results_count": len(raw_results),
        "summaries": summaries,
        "integrity_issues": integrity_issues,
    }


def print_comparison_tables(summaries: Dict[str, Any]) -> None:
    """Print the required output table and normalized comparison table."""
    req_table = summaries.get("required_table", [])
    norm_table = summaries.get("normalized_table", [])

    if not req_table:
        return

    print("\n" + "=" * 145)
    print(" " * 45 + "REQUIRED RESEARCH COMPARISON TABLE (RAW METRICS)")
    print("=" * 145)
    headers = [
        "Approach",
        "HI Miss (↓)",
        "LO Comp (↑)",
        "LO Util (↑)",
        "CPU Util",
        "Avg Resp(ms)",
        "Worst Resp",
        "Misses",
        "Switches",
        "LO Dropped",
        "Preempt",
        "Overhead",
        "Recov Time",
    ]
    print(
        f"{headers[0]:<30} | {headers[1]:<17} | {headers[2]:<12} | {headers[3]:<17} | "
        f"{headers[4]:<8} | {headers[5]:<12} | {headers[6]:<10} | {headers[7]:<7} | "
        f"{headers[8]:<9} | {headers[9]:<10} | {headers[10]:<8} | {headers[11]:<9} | {headers[12]:<10}"
    )
    print("-" * 145)
    for r in req_table:
        print(
            f"{r['Approach']:<30} | {r['HI Miss Ratio (↓)']:<17} | {r['LO Completion Ratio (↑)']:<12} | "
            f"{r['LO Utility Ratio (↑)']:<17} | {r['CPU Utilization']:<8} | {r['Avg Response Time (ms)']:<12} | "
            f"{r['Worst Response Time (ms)']:<10} | {r['Deadline Misses']:<7} | {r['Mode Switches']:<9} | "
            f"{r['LO Jobs Dropped']:<10} | {r['Preemptions']:<8} | {r['Overhead (%)']:<9} | {r['Recovery Time (ms)']:<10}"
        )
    print("=" * 145)
    print("  * Notes on N/A and 0.0 values:")
    print("    - EDF: Mode Switches = 0 (semantically meaningful: EDF has no mode-switching mechanism).")
    print("    - EDF / EDF-VD / Classical MC / Degraded / Flexible: Recovery Time = N/A (no recovery mechanism defined).")
    print("    - Proactive Risk MC: LO Utility is unweighted (no utility-density knapsack degradation).")
    print()

    print("=" * 95)
    print(" " * 30 + "NORMALIZED SCORES COMPARISON TABLE")
    print("=" * 95)
    print(
        f"{'Approach':<30} | {'Safety Score (↑)':<17} | {'Utility Score (↑)':<18} | "
        f"{'Efficiency Score (↑)':<20} | {'Overhead Score (↑)':<18}"
    )
    print("-" * 95)
    for r in norm_table:
        print(
            f"{r['Approach']:<30} | {r['Safety Score (↑)']:<17.4f} | {r['Utility Score (↑)']:<18.4f} | "
            f"{r['Efficiency Score (↑)']:<20.4f} | {r['Overhead Score (↑)']:<18.4f}"
        )
    print("=" * 95)
    print("  * Safety Score = 1 - HI Miss Ratio | Utility Score = LO Utility Ratio")
    print("  * Efficiency Score = CPU Util | Overhead Score = 1 - min(1, Overhead% / 10.0)")
    print()


def run_initial_validation_experiment(num_tasksets: int = 10) -> Dict[str, Any]:
    """
    Run the complete comparison on the small validation set first as requested:
    - 10 task sets per configuration
    - 7 schedulers evaluated under identical conditions
    - fixed stress_20ms workload evaluated across all 5 scenarios
    """
    print(f"\n>>> Running Small Validation Experiment ({num_tasksets} task sets per configuration) <<<")
    cfg = ResearchExperimentConfig(
        task_counts=[10],
        target_utilizations=[0.60, 0.80, 1.00],
        hi_ratios=[0.40],
        duration=2000.0,
        warmup_time=200.0,
        num_tasksets=num_tasksets,
        scenario="BOTH_OVERRUN",
        enable_overhead=True,
    )
    res = run_research_experiments(cfg)
    print_comparison_tables(res["summaries"])
    return res


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="AdaptiveGuard Research Experiment Framework")
    parser.add_argument("--num-tasksets", type=int, default=10, help="Number of task sets per configuration")
    parser.add_argument("--validation", action="store_true", help="Run small validation set first")
    parser.add_argument("--full-grid", action="store_true", help="Run full parameter grid across all configurations")
    parser.add_argument("--duration", type=float, default=2000.0, help="Simulation duration in ms")
    parser.add_argument("--warmup", type=float, default=200.0, help="Warm-up duration in ms")

    args = parser.parse_args()

    if args.full_grid:
        cfg = ResearchExperimentConfig(
            duration=args.duration,
            warmup_time=args.warmup,
            num_tasksets=args.num_tasksets,
        )
        res = run_research_experiments(cfg)
        print_comparison_tables(res["summaries"])
    else:
        run_initial_validation_experiment(num_tasksets=args.num_tasksets)
