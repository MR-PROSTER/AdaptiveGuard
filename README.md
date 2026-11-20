# AdaptiveGuard: Proactive and Graceful Mixed-Criticality Real-Time Scheduling Framework

[![Python Version](https://img.shields.io/badge/python-3.14%2B-blue.svg)](https://www.python.org/)
[![Tests](https://img.shields.io/badge/pytest-85%20passed%20(100%25)-brightgreen.svg)](AdaptiveGuard-Scheduler/tests/)
[![Paper](https://img.shields.io/badge/research--paper-IIIT%20Dharwad%20(2026)-purple.svg)](Real%20Time%20Systems%20Research%20Paper.pdf)
[![Web Platform](https://img.shields.io/badge/web--studio-interactive%20simulator-orange.svg)](web/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**AdaptiveGuard** is a research-grade simulation framework, comparative evaluation suite, and interactive research platform for **Mixed-Criticality (MC) Real-Time Systems**. It introduces a closed-loop scheduling architecture that unifies Earliest Deadline First with Virtual Deadlines (**EDF-VD**), continuous multi-factor runtime risk estimation, dual-threshold hysteresis mode control (`LO` $\leftrightarrow$ `WARNING` $\leftrightarrow$ `HI` $\to$ `RECOVERY`), utility-density knapsack task degradation, and gradual multi-step service recovery.

This repository consolidates the **complete academic research artifact**: the discrete-event simulation engine, seven evaluated real-time scheduling algorithms, an 85-test unit verification suite, empirical datasets spanning 12,600 simulation runs, publication figures, the formal academic research paper, and an interactive web-based Simulation Studio.

---

## 📑 Table of Contents

- [1. Repository Architecture & Layout](#1-repository-architecture--layout)
- [2. System Architecture & Closed-Loop Control](#2-system-architecture--closed-loop-control)
- [3. Interactive Web Simulation Studio](#3-interactive-web-simulation-studio)
- [4. Schedulers Evaluated](#4-schedulers-evaluated)
- [5. Empirical Results & Performance Matrix](#5-empirical-results--performance-matrix)
- [6. Ablation Study & Component Analysis](#6-ablation-study--component-analysis)
- [7. Installation & Quickstart](#7-installation--quickstart)
- [8. Academic Paper & Citation](#8-academic-paper--citation)
- [9. License](#9-license)

---

## 1. Repository Architecture & Layout

```
AdaptiveGuard/
├── README.md                           # Master repository documentation (this file)
├── Real Time Systems Research Paper.pdf # Full academic research paper (IIIT Dharwad, 2026)
│
├── AdaptiveGuard-Scheduler/            # Discrete-Event Simulation & Scheduling Core
│   ├── README.md                       # Core scheduler documentation
│   ├── main.py                         # Benchmark runner (stress_20ms scenario matrix)
│   ├── run_experiments.py              # Full empirical research orchestrator & report builder
│   ├── export_data_for_web.py          # Data pipeline exporting simulation traces to web UI
│   ├── config/
│   │   ├── default_config.py           # Simulation timings, overheads, and parameters
│   │   └── ablation_config.py          # Component ablation matrix configurations (A through F)
│   ├── controllers/
│   │   ├── runtime_monitor.py          # Job laxity, execution, and overrun monitor
│   │   ├── risk_estimator.py           # 4-factor continuous risk scoring engine (R_total)
│   │   ├── mode_controller.py          # 4-state machine with dual-threshold hysteresis
│   │   ├── degradation_controller.py   # Utility-density knapsack LO-task degradation
│   │   └── recovery_controller.py      # Staged, gradual LO-task service restoration
│   ├── schedulers/
│   │   ├── base_scheduler.py           # Abstract real-time scheduler base class
│   │   ├── edf.py                      # Classical EDF (Liu & Layland 1973)
│   │   ├── edf_vd.py                   # EDF with Virtual Deadlines (Baruah et al. 2011/2012)
│   │   ├── classical_mc.py             # Classical Reactive MC (Vestal 2007 / AMC)
│   │   ├── degraded_edf_vd.py          # EDF-VD with Uniform Degraded LO Service (Su & Zhu 2013)
│   │   ├── flexible_mc.py              # Flexible Mixed-Criticality (Burns & Baruah 2013)
│   │   ├── proactive_risk_mc.py        # Proactive Risk / Mode Change (unbuffered baseline)
│   │   └── adaptive_guard.py           # Proposed Unified AdaptiveGuard Scheduler
│   ├── simulator/
│   │   ├── task.py                     # Mixed-criticality task model & validation
│   │   ├── job.py                      # Dynamic job instance tracking
│   │   ├── event.py                    # Discrete simulation event structures
│   │   ├── event_queue.py              # Min-heap priority event queue
│   │   ├── cpu.py                      # Single-core preemption & execution model
│   │   ├── clock.py                    # High-precision microsecond simulation clock
│   │   └── simulation.py               # Core discrete-event simulation engine
│   ├── workloads/
│   │   ├── fixed_workload.py           # Canonical 6-task 20 ms planetary drone benchmark
│   │   ├── uunifast.py                 # UUniFast utilization distribution generator
│   │   └── generator.py                # Synthetic taskset generator across N, U, and mixes
│   ├── metrics/
│   │   ├── deadline_metrics.py         # Deadline miss ratios & response times
│   │   ├── utility_metrics.py          # Utility retention & preservation ratios
│   │   ├── overhead_metrics.py         # Microsecond computational overhead accounting
│   │   └── mode_metrics.py             # Criticality transitions & chattering statistics
│   ├── visualization/
│   │   ├── final_plots.py              # Publication-grade chart generation pipeline
│   │   ├── timeline.py                 # Interactive execution timeline generator
│   │   ├── utilization_plot.py         # Sweep curves vs. system utilization
│   │   ├── utility_plot.py             # Utility preservation & sampling analysis
│   │   ├── risk_plot.py                # Continuous risk and mode trajectories
│   │   └── comparison.py               # Recovery duration & ablation comparison
│   ├── results/                        # Generated experimental data, figures, & reports
│   │   ├── final_report.md             # Formal comprehensive research evaluation report
│   │   ├── algorithm_comparison.md     # Comparative mechanism analysis
│   │   ├── figures/                    # 14 publication-grade generated PNG figures
│   │   └── data/                       # Sweep, ablation, and timeline CSV datasets
│   └── tests/                          # 85 Unit tests across 14 test suites (100% passing)
│
├── web/                                # Interactive Simulation Studio & Research Platform
│   ├── index.html                      # Single-page simulation studio application
│   ├── server.py                       # Zero-dependency local development web server (port 8080)
│   ├── README.md                       # Web platform documentation & visualizer user guide
│   ├── css/
│   │   └── style.css                   # Modern dark-mode UI styling
│   ├── js/
│   │   ├── app.js                      # Core frontend controller & view coordinator
│   │   ├── simulator.js                # In-browser client-side discrete-event simulator
│   │   ├── gantt.js                    # High-resolution interactive CPU & task Gantt engine
│   │   ├── charts.js                   # Chart.js integration (radar, sweeps, Pareto frontier)
│   │   └── data.js                     # Pre-bundled empirical research dataset (zero-config)
│   └── data/
│       └── sim_data.json               # Exported multi-scenario JSON research dataset
│
├── results/                            # Consolidated project results & visualizations
│   ├── experiment_report.md            # Empirical experiment summary report
│   ├── plots/                          # High-resolution research plots (PNG)
│   └── raw/
│       └── simulation_results.csv      # Empirical simulation data across 12,600 runs
└── venv/                               # Python 3.14 virtual environment
```

---

## 2. System Architecture & Closed-Loop Control

Classical mixed-criticality models enforce safety through **binary abandonment**: when any high-criticality (HI) job exceeds its nominal execution budget $C_i(\text{LO})$, the system immediately drops all low-criticality (LO) tasks. In cyber-physical missions (e.g., UAVs, rovers, autonomous driving), LO tasks such as video telemetry, mapping, and logging carry critical operational value.

AdaptiveGuard replaces static mode drops with a **closed-loop proactive control cycle**:

```
               ┌─────────────────────────────────────────────────────────┐
               │                     Job Execution                       │
               └────────────────────────────┬────────────────────────────┘
                                            │
                                            ▼
               ┌─────────────────────────────────────────────────────────┐
               │            Runtime Monitor (Laxity & Overrun)           │
               └────────────────────────────┬────────────────────────────┘
                                            │
                                            ▼
               ┌─────────────────────────────────────────────────────────┐
               │        Proactive Risk Estimator (R_total score)         │
               └────────────────────────────┬────────────────────────────┘
                                            │
                                            ▼
               ┌─────────────────────────────────────────────────────────┐
               │    Mode Controller (LO <-> WARNING <-> HI -> RECOVERY)  │
               └────────────────────────────┬────────────────────────────┘
                                            │
                                            ▼
               ┌─────────────────────────────────────────────────────────┐
               │ Degradation / Recovery Controller (Utility Density U_i/C)│
               └────────────────────────────┬────────────────────────────┘
                                            │
                                            ▼
               ┌─────────────────────────────────────────────────────────┐
               │         EDF-VD Scheduler (Virtual Deadlines d'_i)       │
               └────────────────────────────┬────────────────────────────┘
                                            │
                                            ▼
               ┌─────────────────────────────────────────────────────────┐
               │                       CPU Core                          │
               └────────────────────────────┬────────────────────────────┘
                                            │
                                            └────( repeat control cycle )
```

### Core Algorithmic Components

#### 1. Multi-Factor Continuous Risk Estimator
Every sampling period ($0.5\text{ ms}$ default), AdaptiveGuard evaluates a composite risk metric $R_{\text{total}}(t) \in [0.0, 1.0]$:

$$R_{\text{total}}(t) = 0.30 R_{\text{util}}(t) + 0.30 R_{\text{laxity}}(t) + 0.25 R_{\text{overrun}}(t) + 0.15 R_{\text{deadline}}(t)$$

- **Utilization Pressure ($R_{\text{util}}$)**: Ratio of total remaining active execution demand to time remaining until the latest active deadline:
  $$R_{\text{util}}(t) = \min\left(1.0, \frac{\sum_{j \in \mathcal{A}(t)} j.c_{\text{rem}}}{\max(1.0, \max_j j.d_{\text{abs}} - t)}\right)$$
- **Dynamic Laxity Threat ($R_{\text{laxity}}$)**: Proximity of the most urgent active job to its deadline relative to remaining work:
  $$R_{\text{laxity}}(t) = \max_{j \in \mathcal{A}(t)} \left(1.0 - \frac{j.d_{\text{abs}} - t - j.c_{\text{rem}}}{j.T}\right)$$
- **Overrun Probability ($R_{\text{overrun}}$)**: Normalized execution of active HI jobs exceeding their nominal $C_i(\text{LO})$ budget:
  $$R_{\text{overrun}}(t) = \frac{\sum_{j \in \mathcal{A}_{\text{HI}}(t)} \max(0, j.c_{\text{exec}} - C_i^{\text{LO}})}{\sum_{j \in \mathcal{A}_{\text{HI}}(t)} (C_i^{\text{HI}} - C_i^{\text{LO}})}$$
- **Near-Deadline HI Urgency ($R_{\text{deadline}}$)**: Indicator flag active when any HI job is within $20\%$ of its deadline:
  $$R_{\text{deadline}}(t) = \mathbb{I}_{\exists j \in \mathcal{A}_{\text{HI}}: j.d_{\text{abs}} - t \le 0.20 T_i}$$

#### 2. Four-State Mode Machine with Dual-Threshold Hysteresis
To prevent rapid mode chattering under boundary oscillations, state changes are governed by hysteresis and hold windows:
- $\mathbf{LO} \to \mathbf{WARNING}$: Triggered when $R_{\text{total}} \ge 0.50$ (or $0.60$). Activates selective degradation.
- $\mathbf{WARNING} \to \mathbf{HI}$: Triggered when $R_{\text{total}} \ge 0.80$ or when a HI job experiences an acute budget overrun.
- $\mathbf{HI} \to \mathbf{RECOVERY}$: Triggered only after $R_{\text{total}} \le 0.40$ continuously for a hold duration $t_{\text{hold}} = 5.0\text{ ms}$.
- $\mathbf{RECOVERY} \to \mathbf{LO}$: Triggered once all LO tasks have been incrementally restored to full capacity ($1.00$).

#### 3. Utility-Density Knapsack Degradation
Rather than universally dropping or scaling LO tasks uniformly, LO tasks are ranked in descending order of **utility density** $\rho_i$:

$$\rho_i = \frac{U_i}{C_i^{\text{LO}}}$$

In `WARNING` mode, tasks with lower utility density (e.g., background diagnostics, logging) are throttled first ($1.00 \to 0.75 \to 0.50 \to 0.25 \to 0.00$), reserving execution capacity for high-density tasks (e.g., flight telemetry) and protecting HI critical control.

#### 4. Gradual Multi-Step Recovery Protocol
When returning from `HI` mode, AdaptiveGuard restores LO task service budgets incrementally in discrete steps ($0.00 \to 0.25 \to 0.50 \to 0.75 \to 1.00$), restoring highest utility-density tasks first. This prevents **recovery shock** (CPU re-saturation caused by sudden simultaneous budget reactivation).

#### 5. Virtual Deadlines (EDF-VD)
HI tasks are scheduled using virtual deadlines during nominal and warning states:
$$d'_i = r_i + x \cdot (D_i - r_i), \quad x = \frac{U_{\text{HI}}^{\text{LO}}}{1 - U_{\text{LO}}}$$
reverting to actual deadlines $D_i$ when entering `HI` or `RECOVERY` modes.

---

## 3. Interactive Web Simulation Studio

The repository includes a modern, zero-dependency interactive Simulation Studio located in [`web/`](web/):

```
┌────────────────────────────────────────────────────────────────────────┐
│  AdaptiveGuard // Interactive Simulation Studio & Research Platform   │
├────────────────────────────────────────────────────────────────────────┤
│  [Play / Pause] [Step] [Speed: 1x] [Timeline: 0.00ms ───────●─ 40.0ms] │
├──────────────────────────────────┬─────────────────────────────────────┤
│  CPU & Task Execution Gantt     │  Mode State Machine Visualizer      │
│  ├─ CPU Core Track               │  (LO) <──> [WARNING] <──> (HI)      │
│  ├─ H1: Flight_Control           │              │                      │
│  ├─ H2: Braking_Control          │              └──> (RECOVERY)        │
│  ├─ L1: Telemetry (Density=16.7) ├─────────────────────────────────────┤
│  └─ L2-L4: Logging (Throttled)   │  Multi-Factor Risk Gauge (R_total)  │
├──────────────────────────────────┼─────────────────────────────────────┤
│  Side-by-Side Dual Comparison    │  Knapsack Service Level Meters      │
│  AdaptiveGuard vs Classical MC   │  L1: [100%] L2: [0%] L3: [0%]       │
├──────────────────────────────────┼─────────────────────────────────────┤
│  Comparative Evaluation Radar    │  Live Chronological Event Audit Log │
└──────────────────────────────────┴─────────────────────────────────────┘
```

### Key Platform Features
1. **Interactive Discrete-Event Playback**: Play, pause, scrub from $0.00\text{ ms}$ to $40.00\text{ ms}$, step frame-by-frame, and adjust simulation speed ($0.25\times$ to $5.0\times$).
2. **High-Resolution Gantt Chart**: Consolidated CPU track alongside individual task lanes (`H1`, `H2`, `L1`, `L2`, `L3`, `L4`, `IDLE`) with visual markers for preemptions, overrun textures, and deadline flags.
3. **Side-by-Side Dual Comparison**: Synchronized execution of AdaptiveGuard alongside any baseline (e.g., Classical Reactive MC or EDF-VD) under identical workload conditions.
4. **Animated Mode State Machine**: Live 4-node state graph tracking transitions between `LO`, `WARNING`, `HI`, and `RECOVERY`.
5. **Real-Time Risk Gauge**: Dynamic gauge displaying composite risk $R_{\text{total}}$ alongside stacked bar factor contributions ($R_{\text{util}}, R_{\text{laxity}}, R_{\text{overrun}}, R_{\text{deadline}}$).
6. **Knapsack Service Rack**: Live meters showing how AdaptiveGuard maintains telemetry at $100\%$ while selectively degrading logging services.
7. **Empirical Radar & Pareto Charts**: Multidimensional radar chart comparing normalized Safety, Utility, Efficiency, and Overhead, plus Pareto frontier scatter plots across 12,600 simulation runs.
8. **Client-Side Parameter Sandbox**: Adjust $T_{\text{warn}}$, $T_{\text{hi}}$, $T_{\text{rec}}$, and overrun multipliers in real time with immediate in-browser simulation.

### Launching the Web Platform

#### Option A: Built-in Python Server (Recommended)
From the repository root:
```bash
python3 web/server.py
```
Then navigate to **[http://localhost:8080](http://localhost:8080)** in your browser.

#### Option B: Direct Browser Open (Zero Setup)
Open [`web/index.html`](web/index.html) directly in any modern web browser. The platform includes a pre-bundled dataset ([`web/js/data.js`](web/js/data.js)) allowing full functionality without requiring an active HTTP server.

---

## 4. Schedulers Evaluated

AdaptiveGuard is evaluated against six established mixed-criticality baselines under identical tasksets, arrival sequences, and execution traces:

| # | Scheduler | Semantics & Execution Policy | Mode Switch Policy | LO Task Treatment |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **EDF** | Earliest Deadline First (Liu & Layland 1973). Non-criticality aware. | None (Single-mode) | Runs unconstrained until deadline |
| **2** | **EDF-VD** | EDF with Virtual Deadlines (Baruah et al. 2011/2012). Virtual deadlines $d'_i$ for HI tasks in LO mode. | Binary switch upon HI overrun | Dropped completely upon HI mode entry |
| **3** | **Classical Reactive MC** | Vestal (2007) / AMC model. Nominal execution under LO mode. | Binary switch upon HI overrun | Dropped immediately upon mode switch |
| **4** | **EDF-VD + Degraded LO** | Su & Zhu (2013) / Liu et al. (2014). Virtual deadlines with reduced LO execution. | Binary switch upon HI overrun | Throttled uniformly to $50\%$ of $C_i^{\text{LO}}$ |
| **5** | **Flexible MC** | Burns & Baruah (2013). Dynamic per-task budget escalation. | Per-task local escalation | Partial execution subject to remaining slack |
| **6** | **Proactive Risk MC** | Proactive multi-factor risk monitoring without hysteresis dampening. | Continuous threshold switch | Binary drop without utility ranking |
| **7** | **AdaptiveGuard** | **Proposed Unified Architecture**: Proactive 4-factor risk + dual-threshold hysteresis + utility-density knapsack degradation + staged recovery. | 4-state machine with hold time | Graded degradation by utility density ($U_i/C_i^{\text{LO}}$) |

---

## 5. Empirical Results & Performance Matrix

Comprehensive evaluations were conducted across **1,800 synthetic tasksets** generated via UUniFast ($N \in \{5, 10, 20, 30, 50\}$, $U \in [0.4, 1.5]$, HI/LO mixes $20/80, 40/60, 60/40$, 10 random seeds), totaling **12,600 independent simulation runs**.

### Overall Empirical Summary Matrix

| Approach | HI Miss Ratio (↓) | LO Completion (↑) | LO Utility Ratio (↑) | CPU Util | Mode Switches (↓) | Dropped LO Jobs | Overhead (%) | Recovery (ms) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **EDF** | 0.7733 ± 0.406 | 0.6593 | 0.6477 ± 0.248 | 0.964 | 0 (N/A) | 312.9 | 5.13% | N/A |
| **EDF-VD** | **0.4069 ± 0.482** | 0.0000 | 0.0000 ± 0.000 | 0.768 | 1.00 | 940.7 | **4.63%** | N/A |
| **Classical Reactive MC** | **0.4069 ± 0.482** | 0.0000 | 0.0000 ± 0.000 | 0.768 | 1.00 | 940.7 | **4.63%** | N/A |
| **EDF-VD + Degraded LO** | 0.4164 ± 0.482 | 0.4969 | 0.2415 ± 0.224 | 0.890 | 1.00 | 433.6 | 5.20% | N/A |
| **Flexible MC** | 0.7733 ± 0.406 | 0.6593 | 0.6477 ± 0.248 | 0.964 | 9.20 | 312.9 | 5.14% | N/A |
| **Proactive Risk MC** | 0.4997 ± 0.444 | **0.6874** | 0.3499 ± 0.392 | 0.970 | 662.93 | **263.0** | 12.89% | 0.00 |
| **AdaptiveGuard** | 0.5342 ± 0.434 | 0.4978 | **0.4558 ± 0.433** | **0.973** | **18.96** | 434.7 | 12.44% | **0.43** |

> **Key Research Takeaways**:
> 1. **Utility Preservation**: AdaptiveGuard achieves a mean LO utility ratio of **$0.4558$**, representing an **$+88.8\%$ increase** over uniform degraded EDF-VD ($0.2415$), while classical EDF-VD drops all LO utility to $0.0000$.
> 2. **Chattering Suppression**: Dual-threshold hysteresis dampening reduces mode switches from **$662.93$ down to $18.96$** (a **$97.1\%$ reduction**) compared to unbuffered proactive risk.
> 3. **Automatic Self-Healing**: AdaptiveGuard is the **only evaluated approach** featuring stable, automatic recovery ($0.43\text{ ms}$ average recovery time).
> 4. **Safety Trade-off & Candid Scope**: Under persistent worst-case overruns, AdaptiveGuard incurs a higher HI miss ratio ($0.534$) than static EDF-VD ($0.407$) due to delaying LO drops during `WARNING` mode. AdaptiveGuard is tailored for **firm-real-time cyber-physical systems** where LO utility has mission value, rather than provable hard-real-time isolation.

### Normalized Multi-Dimensional Scores

| Approach | Safety Score ($1 - \text{Miss}_{\text{HI}}$) | Utility Score ($\text{Ratio}_{\text{LO}}$) | Efficiency Score ($\text{Util}_{\text{CPU}}$) | Overhead Score ($1 - \text{Ovhd}/10$) |
| :--- | :---: | :---: | :---: | :---: |
| **EDF** | 0.2267 | 0.6477 | 0.9644 | 0.4870 |
| **EDF-VD** | **0.5931** | 0.0000 | 0.7677 | **0.5365** |
| **Classical Reactive MC** | **0.5931** | 0.0000 | 0.7678 | **0.5365** |
| **EDF-VD + Degraded LO** | 0.5836 | 0.2415 | 0.8900 | 0.4803 |
| **Flexible MC** | 0.2267 | 0.6477 | 0.9644 | 0.4861 |
| **Proactive Risk MC** | 0.5003 | 0.3499 | 0.9703 | 0.0000 |
| **AdaptiveGuard** | 0.4658 | **0.4558** | **0.9727** | 0.0000 |

---

## 6. Ablation Study & Component Analysis

To verify that each algorithmic layer of AdaptiveGuard contributes positively to overall performance, six modular configurations were evaluated under identical overload scenarios:

| Config | Architectural Composition | HI Miss Ratio (↓) | LO Utility Ratio (↑) | LO Comp Ratio | CPU Util | Mode Switches | Overhead (%) |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **A** | EDF-VD (Baseline) | **0.0000** | 0.0000 | 0.0400 | 0.658 | **0** | **0.80%** |
| **B** | EDF-VD + Generic Degraded LO Service | **0.0000** | 0.5000 | **1.0000** | 0.885 | **0** | 1.00% |
| **C** | EDF-VD + Proactive Risk (No Degradation) | **0.0000** | 0.7538 | 0.9800 | 1.000 | 60 | 5.07% |
| **D** | EDF-VD + Utility-Aware Degradation | **0.0000** | **0.8462** | 0.5200 | 1.000 | **0** | 0.85% |
| **E** | EDF-VD + Proactive Risk + Degradation | **0.0000** | 0.8308 | 0.9800 | 1.000 | 114 | 5.16% |
| **F** | **Full AdaptiveGuard** (Proactive + Hysteresis + Degradation + Recovery) | **0.0000** | **0.8087** | 0.7200 | 1.000 | 71 | 5.08% |

### Key Ablation Insights:
- **A $\to$ B**: Adding degraded LO service prevents complete utility collapse ($0.0 \to 0.50$).
- **B $\to$ D**: Introducing utility-density prioritization over uniform degradation yields an immediate **$+69.2\%$ utility increase** ($0.50 \to 0.8462$) by protecting high-density tasks.
- **E $\to$ F**: Adding dual-threshold hysteresis and gradual recovery reduces mode transitions by **$37.7\%$** ($114 \to 71$), stabilizing the system against chattering.

---

## 7. Installation & Quickstart

### Prerequisites
- Python 3.10+ (tested on **Python 3.14**)
- Standard scientific stack: `matplotlib`, `pandas`, `numpy`, `tabulate`, `pytest`

### Setup Environment
```bash
# Clone the repository
git clone https://github.com/praneeth-madasu/AdaptiveGuard.git
cd AdaptiveGuard

# Activate existing virtual environment or create a new one
source venv/bin/activate
# or: python3 -m venv venv && source venv/bin/activate

# Install required packages
pip install pytest matplotlib pandas numpy tabulate
```

### Running the Test Suite (85 Passing Tests)
AdaptiveGuard includes an extensive test suite verifying task models, scheduling logic, mode controllers, degradation algorithms, and overhead models:
```bash
pytest
```
*Output: `85 passed in 0.48s`*

### Running the Fixed Workload Benchmark (`stress_20ms`)
Executes all 7 schedulers across 4 scenarios (`NORMAL`, `H1_OVERRUN`, `BOTH_OVERRUN`, `RECOVERY`) under both **Idealized (Overhead-Free)** and **Overhead-Enabled** modes:
```bash
python AdaptiveGuard-Scheduler/main.py
```

### Launching the Interactive Simulation Studio
```bash
python3 web/server.py
```
Open **[http://localhost:8080](http://localhost:8080)** in your browser.

### Running Full Research Experiments & Building Reports
To execute the synthetic experiment suite, generate CSV datasets, produce 14 publication figures, and compile markdown reports:
```bash
cd AdaptiveGuard-Scheduler
python run_experiments.py
```
For the comprehensive 1,000-taskset research run:
```bash
python run_experiments.py --full
```

### Re-Exporting Data for the Web Platform
Whenever simulation parameters or benchmarks are modified, regenerate the web bundles with:
```bash
python AdaptiveGuard-Scheduler/export_data_for_web.py
```

---

## 8. Academic Paper & Citation

This repository implements the research presented in the paper:

> **AdaptiveGuard: Proactive Risk-Aware Scheduling with Utility-Density Degradation and Hysteresis-Protected Recovery in Mixed-Criticality Real-Time Systems**  
> *M. Praneeth, Aryan Ubale, Md. Kamraan Ajmal, M. Praveen Kumar, Shaurya Paka*  
> Under the guidance of *Dr. Swagatika Sahoo*  
> Department of Computer Science and Engineering, Indian Institute of Information Technology Dharwad (IIIT Dharwad), November 2026.  
> 📄 Complete Paper: [Real Time Systems Research Paper.pdf](Real%20Time%20Systems%20Research%20Paper.pdf)

### BibTeX Citation
```bibtex
@article{praneeth2026adaptiveguard,
  title     = {AdaptiveGuard: Proactive Risk-Aware Scheduling with Utility-Density Degradation and Hysteresis-Protected Recovery in Mixed-Criticality Real-Time Systems},
  author    = {Praneeth, M. and Ubale, Aryan and Ajmal, Md. Kamraan and Kumar, M. Praveen and Paka, Shaurya and Sahoo, Swagatika},
  journal   = {Department of Computer Science and Engineering, IIIT Dharwad Technical Report},
  year      = {2026},
  month     = {November}
}
```

---

## 9. License

This project is licensed under the **MIT License** - see the [`LICENSE`](LICENSE) file for details.
