# AdaptiveGuard // Research Platform & Simulation Studio

An interactive research platform and comparative simulation frontend for **AdaptiveGuard**: Proactive Mixed-Criticality Real-Time Scheduling with Dual-Threshold Hysteresis and Graceful Service Degradation.

---

## 🚀 Quickstart: Launching the Platform

### Option 1: Python Web Server (Recommended)
From the repository root:
```bash
cd web
python3 server.py
```
Open **[http://localhost:8080](http://localhost:8080)** in your browser.

### Option 2: Direct File Open
Because the platform includes a self-contained, pre-compiled JavaScript research bundle (`js/data.js`), you can also open `web/index.html` directly in any modern browser without needing a server.

---

## 🔬 Evaluated Approaches & Baselines

The platform visualizes and simulates all 7 mixed-criticality real-time scheduling approaches evaluated in the research:

1. **AdaptiveGuard (Proposed Unified Framework)**:
   - Continuous 4-factor risk estimation: $R_{total}(t) = 0.30 R_{util} + 0.30 R_{laxity} + 0.25 R_{overrun} + 0.15 R_{deadline}$
   - Dual-threshold hysteresis dampening ($T_{warn} = 0.50$, $T_{hi} = 0.80$, $T_{rec} = 0.40$)
   - Utility-density knapsack degradation ($\rho_i = U_i / C_i^{LO}$)
   - Gradual multi-step recovery protocol (0.43 ms automatic return-to-LO)
2. **Classical Reactive Mixed-Criticality** (*Vestal 2007 Baseline / AMC*):
   - Strict static isolation that abruptly discards all low-criticality (LO) tasks upon the first HI task overrun.
3. **EDF-VD + Degraded LO Service** (*Su & Zhu 2013 / Liu et al. 2014*):
   - Virtual deadline scaling with uniform 50% service budget reduction for all LO tasks.
4. **EDF-VD (Virtual Deadlines)** (*Baruah et al. RTSS 2011 / RTS 2012*):
   - Classical virtual deadline assignment with complete LO task dropping upon HI mode switch.
5. **Flexible Mixed-Criticality** (*Burns & Baruah RTSS 2013*):
   - Dynamic slack-aware task adjustments with partial degradation.
6. **Proactive Risk / Mode Change**:
   - Continuous multi-factor risk monitoring without hysteresis, illustrating severe mode chattering (662.9 switches).
7. **EDF (Earliest Deadline First)** (*Liu & Layland 1973*):
   - Non-criticality baseline demonstrating a fatal 77.3% HI deadline miss ratio under overload.

---

## 🕹️ Interactive Features & Views

### 1. 🎬 Simulation Studio
- **Interactive Discrete-Event Playback**: Play, pause, scrub timeline (0 to 40 ms), step backward/forward, adjust speed (0.25x to 5.0x).
- **CPU Execution Gantt Chart**: High-resolution schedule displaying consolidated CPU track alongside individual task lanes (H1, H2, L1, L2, L3, L4, IDLE), with preemption indicators, overrun warning textures, and deadline flags.
- **Side-by-Side Dual Comparison Mode**: View AdaptiveGuard directly alongside any baseline (e.g., Classical Reactive MC) running in synchronized lockstep.
- **Mode State Machine Visualizer**: 4-node animated graph (LO $\leftrightarrow$ WARNING $\leftrightarrow$ HI $\leftrightarrow$ RECOVERY) displaying active state and transition triggers.
- **Continuous Multi-Factor Risk Gauge**: Real-time gauge and stacked factor breakdown of utilization pressure, execution laxity, overrun ratio, and deadline urgency.
- **Knapsack Service Level Rack**: Dynamic meters illustrating how AdaptiveGuard preserves high-density telemetry (L1) while selectively throttling low-density logging (L2, L3, L4).
- **Live Event Audit Stream**: Terminal-style chronological log of job releases, dispatches, preemptions, mode changes, and completion alerts.

### 2. 📊 Comparative Evaluation Matrix
- Full empirical matrix across 12,600 simulation runs.
- Multidimensional Radar / Spider Chart comparing normalized safety, utility, efficiency, and overhead scores.
- Pareto Frontier (Safety vs. Utility) Scatter Plot showing the optimal trade-off quadrant.

### 3. 📈 Research Sweeps & Component Ablation
- **System Utilization Sweep ($U \in [0.40, 1.50]$)**: Interactive curve visualizer comparing HI deadline misses, LO utility preservation, mode switch chattering, and computational overhead.
- **Modular Ablation Study (Configs A through F)**: Step-by-step breakdown proving the independent contribution of each sub-system.

### 4. 🧠 Taskset & Mathematical Formulations
- Complete 6-tuple specifications for all benchmark tasks (`Flight_Control`, `Braking_Control`, `Telemetry`, `Logging_A`, `Logging_B`, `Logging_C`).
- Interactive math formula cards for risk estimation, utility density, and hysteresis dampening.

### 5. ⚙️ Interactive Parameter Sandbox
- Client-side discrete-event simulator allowing users to adjust $T_{warn}$, $T_{hi}$, $T_{rec}$, overrun severity multipliers, and computational overhead, executing live in the browser.
