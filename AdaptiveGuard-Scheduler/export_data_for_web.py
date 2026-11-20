import sys
import os
import json
import csv
from pathlib import Path
from typing import List, Dict, Any

# Ensure project root is in path
project_root = Path(__file__).resolve().parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from config.default_config import SimulationConfig
from workloads.fixed_workload import get_fixed_workload, ExecutionScenario
from simulator.task import Criticality
from simulator.simulation import Simulation
from controllers.degradation_controller import rank_lo_tasks_by_utility_density, calculate_utility_density
from schedulers.edf import EDFScheduler
from schedulers.edf_vd import EDFVDScheduler
from schedulers.classical_mc import ClassicalReactiveMCScheduler
from schedulers.degraded_edf_vd import EDFVDDegradedScheduler
from schedulers.flexible_mc import FlexibleMCScheduler
from schedulers.proactive_risk_mc import ProactiveRiskMCScheduler
from schedulers.adaptive_guard import AdaptiveGuardScheduler

def run_single_simulation(scheduler_key: str, scenario_key: str, enable_overhead: bool = True) -> Dict[str, Any]:
    taskset = get_fixed_workload()
    
    scheduler_map = {
        "EDF": lambda t: EDFScheduler(),
        "EDF-VD": lambda t: EDFVDScheduler(tasks=t),
        "Classical Reactive MC": lambda t: ClassicalReactiveMCScheduler(),
        "EDF-VD + Degraded LO Service": lambda t: EDFVDDegradedScheduler(tasks=t, degraded_service_level=0.50),
        "Flexible MC": lambda t: FlexibleMCScheduler(tasks=t),
        "Proactive Risk / Mode Change": lambda t: ProactiveRiskMCScheduler(tasks=t),
        "AdaptiveGuard": lambda t: AdaptiveGuardScheduler(tasks=t),
    }
    
    scenario_map = {
        "NORMAL": ExecutionScenario.NORMAL,
        "H1_OVERRUN": ExecutionScenario.H1_OVERRUN,
        "BOTH_OVERRUN": ExecutionScenario.BOTH_OVERRUN,
        "BURSTY": ExecutionScenario.BURSTY,
        "RECOVERY": ExecutionScenario.RECOVERY,
    }
    
    sched = scheduler_map[scheduler_key](taskset)
    scen = scenario_map[scenario_key]
    
    config = SimulationConfig(
        duration=40.0,
        cpu_speed=1.0,
        verbose=False,
        enable_overhead=enable_overhead,
        scheduler_overhead=0.01,
        risk_estimation_overhead=0.005,
        mode_transition_overhead=0.01,
    )
    
    is_proactive = scheduler_key in ("Proactive Risk / Mode Change", "AdaptiveGuard")
    sim = Simulation(
        tasks=taskset,
        config=config,
        scheduler=sched,
        scenario=scen,
        monitor_interval=0.5,
        enable_monitoring=is_proactive or enable_overhead,
    )
    if is_proactive:
        sim.mode_controller.warning_enter = 0.50

    # Track CPU execution intervals
    raw_slices = []
    orig_execute = sim.cpu.execute
    def tracked_execute(duration: float, current_time: float) -> float:
        job = sim.cpu.current_job
        actual = orig_execute(duration, current_time)
        if actual > 1e-9 and job:
            raw_slices.append({
                "start": round(current_time, 4),
                "end": round(current_time + actual, 4),
                "duration": round(actual, 4),
                "task_name": job.task.name,
                "task_short": sim._get_task_short_name(job.task),
                "task_id": job.task.task_id,
                "job_id": job.job_id,
                "criticality": job.task.criticality.value,
            })
        return actual
    sim.cpu.execute = tracked_execute

    summary = sim.run()

    # Coalesce contiguous slices of the same job
    coalesced_slices = []
    for s in raw_slices:
        if (coalesced_slices and 
            coalesced_slices[-1]["job_id"] == s["job_id"] and 
            abs(coalesced_slices[-1]["end"] - s["start"]) < 1e-5):
            coalesced_slices[-1]["end"] = s["end"]
            coalesced_slices[-1]["duration"] = round(coalesced_slices[-1]["duration"] + s["duration"], 4)
        else:
            coalesced_slices.append(dict(s))

    # Clean state timeline
    cleaned_state_timeline = []
    for st in summary.get("state_timeline", []):
        cleaned_state_timeline.append({
            "time": round(st.get("time", 0.0), 4),
            "running_job": st.get("running_job", "IDLE"),
            "risk": round(st.get("risk", 0.0), 4),
            "mode": st.get("mode", "LO"),
            "trigger": st.get("trigger", ""),
            "r_util": round(st.get("r_util", 0.0), 4),
            "r_laxity": round(st.get("r_laxity", 0.0), 4),
            "r_overrun": round(st.get("r_overrun", 0.0), 4),
            "r_deadline": round(st.get("r_deadline", 0.0), 4),
            "service_levels": {k: round(v, 2) for k, v in st.get("service_levels", {}).items()},
        })

    # Timeline events
    cleaned_events = []
    for t_val, evt_str in summary.get("timeline", []):
        cleaned_events.append({
            "time": round(t_val, 4),
            "text": evt_str,
        })

    # Extract clean metrics
    metrics = {
        "scheduler": summary.get("scheduler"),
        "scenario": scenario_key,
        "duration": summary.get("duration", 40.0),
        "total_jobs_released": summary.get("total_jobs_released", 0),
        "completed_jobs_count": summary.get("completed_jobs_count", 0),
        "missed_jobs_count": summary.get("missed_jobs_count", 0),
        "hi_missed_jobs_count": summary.get("hi_missed_jobs_count", 0),
        "hi_miss_ratio": round(summary.get("hi_miss_ratio", 0.0), 4),
        "lo_completion_ratio": round(summary.get("lo_completion_ratio", 0.0), 4),
        "lo_completed_jobs_count": summary.get("lo_completed_jobs_count", 0),
        "lo_released_jobs_count": summary.get("lo_released_jobs_count", 0),
        "lo_utility": round(summary.get("lo_utility", 0.0), 2),
        "lo_utility_ratio": round(summary.get("LO_utility_ratio", 0.0), 4),
        "maximum_possible_LO_utility": summary.get("maximum_possible_LO_utility", 130.0),
        "cpu_utilization": round(summary.get("cpu_utilization", 0.0), 4),
        "average_response_time": round(summary.get("average_response_time", 0.0), 2),
        "worst_response_time": round(summary.get("worst_response_time", 0.0), 2),
        "mode_switches": summary.get("mode_switches_count", 0),
        "lo_jobs_dropped": summary.get("lo_dropped_jobs_count", 0),
        "preemptions": summary.get("preemptions_count", 0),
        "context_switches": summary.get("context_switches_count", 0),
        "overhead_percentage": round(summary.get("overhead_percentage", 0.0), 4),
        "recovery_time": round(summary.get("recovery_time", 0.0), 2) if summary.get("recovery_time") is not None else None,
    }

    return {
        "scheduler": scheduler_key,
        "scenario": scenario_key,
        "slices": coalesced_slices,
        "state_timeline": cleaned_state_timeline,
        "events": cleaned_events,
        "metrics": metrics,
    }

def main():
    print("Exporting complete simulation dataset for frontend...")
    
    schedulers = [
        "AdaptiveGuard",
        "Classical Reactive MC",
        "EDF-VD + Degraded LO Service",
        "EDF-VD",
        "Flexible MC",
        "Proactive Risk / Mode Change",
        "EDF",
    ]
    
    scenarios = [
        "NORMAL",
        "H1_OVERRUN",
        "BOTH_OVERRUN",
        "BURSTY",
        "RECOVERY",
    ]

    all_traces = {}
    for scen in scenarios:
        all_traces[scen] = {}
        for sched in schedulers:
            print(f"  Running {sched} under {scen}...")
            res = run_single_simulation(sched, scen, enable_overhead=True)
            all_traces[scen][sched] = res

    # Taskset metadata
    taskset = get_fixed_workload()
    tasks_meta = []
    alias_map = {
        "Flight_Control": "H1",
        "Braking_Control": "H2",
        "Telemetry": "L1",
        "Logging_A": "L2",
        "Logging_B": "L3",
        "Logging_C": "L4",
    }
    for t in taskset:
        density = calculate_utility_density(t) if t.criticality == Criticality.LO else 0.0
        tasks_meta.append({
            "task_id": t.task_id,
            "name": t.name,
            "short_name": alias_map.get(t.name, t.name),
            "criticality": t.criticality.value,
            "period": t.period,
            "relative_deadline": t.relative_deadline,
            "C_LO": t.C_LO,
            "C_HI": t.C_HI,
            "utility": t.utility,
            "utility_density": round(density, 4),
            "minimum_service": t.minimum_service,
            "maximum_service": t.maximum_service,
            "release_offset": t.release_offset,
        })

    # Read final_comparison.csv
    comp_file = project_root / "results" / "final_comparison.csv"
    benchmark_table = []
    if comp_file.exists():
        with open(comp_file, "r") as f:
            reader = csv.DictReader(f)
            for row in reader:
                benchmark_table.append(row)

    # Read normalized_comparison.csv
    norm_file = project_root / "results" / "normalized_comparison.csv"
    normalized_table = []
    if norm_file.exists():
        with open(norm_file, "r") as f:
            reader = csv.DictReader(f)
            for row in reader:
                normalized_table.append(row)

    # Read ablation_results.csv
    ablation_file = project_root / "results" / "data" / "ablation_results.csv"
    ablation_table = []
    if ablation_file.exists():
        with open(ablation_file, "r") as f:
            reader = csv.DictReader(f)
            for row in reader:
                ablation_table.append(row)

    # Aggregate utilization sweep curves (mean per utilization point)
    sweep_file = project_root / "results" / "data" / "utilization_sweep.csv"
    sweep_curves = {}
    if sweep_file.exists():
        import pandas as pd
        df = pd.read_csv(sweep_file)
        # Group by target_utilization and scheduler
        grouped = df.groupby(["scheduler", "target_utilization"]).agg({
            "hi_miss_ratio": "mean",
            "lo_utility_ratio": "mean",
            "lo_completion_ratio": "mean",
            "cpu_utilization": "mean",
            "overhead_percentage": "mean",
            "mode_switches": "mean",
            "recovery_time": "mean",
        }).reset_index()

        for sched in schedulers:
            sched_df = grouped[grouped["scheduler"] == sched].sort_values("target_utilization")
            sweep_curves[sched] = {
                "utilizations": [round(x, 2) for x in sched_df["target_utilization"].tolist()],
                "hi_miss_ratio": [round(x, 4) for x in sched_df["hi_miss_ratio"].fillna(0).tolist()],
                "lo_utility_ratio": [round(x, 4) for x in sched_df["lo_utility_ratio"].fillna(0).tolist()],
                "lo_completion_ratio": [round(x, 4) for x in sched_df["lo_completion_ratio"].fillna(0).tolist()],
                "cpu_utilization": [round(x, 4) for x in sched_df["cpu_utilization"].fillna(0).tolist()],
                "overhead_percentage": [round(x, 4) for x in sched_df["overhead_percentage"].fillna(0).tolist()],
                "mode_switches": [round(x, 2) for x in sched_df["mode_switches"].fillna(0).tolist()],
                "recovery_time": [round(x, 4) for x in sched_df["recovery_time"].fillna(0).tolist()],
            }

    # Monitoring interval results
    mon_file = project_root / "results" / "data" / "monitoring_interval_results.csv"
    mon_results = []
    if mon_file.exists():
        with open(mon_file, "r") as f:
            reader = csv.DictReader(f)
            for row in reader:
                mon_results.append(row)

    dataset = {
        "tasks": tasks_meta,
        "scenarios": scenarios,
        "schedulers": schedulers,
        "traces": all_traces,
        "benchmark_table": benchmark_table,
        "normalized_table": normalized_table,
        "ablation_table": ablation_table,
        "sweep_curves": sweep_curves,
        "monitoring_interval_results": mon_results,
    }

    # Write as JSON
    out_json = Path("/home/proster/VS Code/AdaptiveGuard/web/data/sim_data.json")
    with open(out_json, "w") as f:
        json.dump(dataset, f, indent=2)
    print(f"Exported JSON dataset to {out_json} ({out_json.stat().st_size / 1024:.1f} KB)")

    # Write as JS object for zero-config file:// and http:// compatibility
    out_js = Path("/home/proster/VS Code/AdaptiveGuard/web/js/data.js")
    with open(out_js, "w") as f:
        f.write("/* Auto-generated simulation & research dataset */\n")
        f.write("window.ADAPTIVE_GUARD_DATA = ")
        json.dump(dataset, f, indent=2)
        f.write(";\n")
    print(f"Exported JS bundle to {out_js} ({out_js.stat().st_size / 1024:.1f} KB)")

if __name__ == "__main__":
    main()
