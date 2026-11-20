/**
 * ADAPTIVEGUARD // CHARTS MODULE
 * High-performance Canvas Chart Renderers: Radar Chart, Pareto Trade-off, and Utilization Curves
 */

const Charts = (function () {
  const SCHEDULER_COLORS = {
    "AdaptiveGuard": { color: "#ffffff", glow: "rgba(255, 255, 255, 0.25)", name: "AdaptiveGuard" },
    "Classical Reactive MC": { color: "#ef4444", glow: "rgba(239, 68, 68, 0.25)", name: "Classical MC" },
    "EDF-VD + Degraded LO Service": { color: "#fbbf24", glow: "rgba(251, 191, 36, 0.25)", name: "EDF-VD + Degraded" },
    "EDF-VD": { color: "#c084fc", glow: "rgba(192, 132, 252, 0.25)", name: "EDF-VD" },
    "Flexible MC": { color: "#34d399", glow: "rgba(52, 211, 153, 0.25)", name: "Flexible MC" },
    "Proactive Risk / Mode Change": { color: "#38bdf8", glow: "rgba(56, 189, 248, 0.25)", name: "Proactive Risk" },
    "EDF": { color: "#71717a", glow: "rgba(113, 113, 122, 0.25)", name: "EDF" },
  };

  /**
   * Render Multi-Dimensional Radar Chart on Canvas
   */
  function renderRadarChart(canvasId, normalizedData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2 - 10;
    const radius = Math.min(centerX, centerY) - 50;

    const axes = [
      { key: "Safety Score (↑)", label: "Safety (1 - HI Miss)" },
      { key: "Utility Score (↑)", label: "LO Utility Score" },
      { key: "Efficiency Score (↑)", label: "CPU Efficiency" },
      { key: "Overhead Score (↑)", label: "Low Overhead" },
    ];
    const numAxes = axes.length;
    const angleStep = (Math.PI * 2) / numAxes;

    // Draw concentric web rings
    const rings = 4;
    for (let r = 1; r <= rings; r++) {
      const ringRadius = (radius / rings) * r;
      ctx.beginPath();
      for (let i = 0; i < numAxes; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const x = centerX + Math.cos(angle) * ringRadius;
        const y = centerY + Math.sin(angle) * ringRadius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Ring label (percentage)
      ctx.fillStyle = "rgba(148, 163, 184, 0.5)";
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.fillText(`${(r * 25)}%`, centerX + 6, centerY - ringRadius + 4);
    }

    // Draw axis lines and labels
    for (let i = 0; i < numAxes; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.stroke();

      // Label position
      const labelDistance = radius + 22;
      const lx = centerX + Math.cos(angle) * labelDistance;
      const ly = centerY + Math.sin(angle) * labelDistance;

      ctx.fillStyle = "#cbd5e1";
      ctx.font = "bold 11px 'Inter', sans-serif";
      ctx.textAlign = Math.abs(Math.cos(angle)) < 0.1 ? "center" : (Math.cos(angle) > 0 ? "left" : "right");
      ctx.textBaseline = "middle";
      ctx.fillText(axes[i].label, lx, ly);
    }

    // Plot Schedulers
    const selectedSchedulers = [
      "AdaptiveGuard",
      "Classical Reactive MC",
      "EDF-VD + Degraded LO Service",
      "EDF",
      "Flexible MC"
    ];

    selectedSchedulers.forEach(schedName => {
      const row = normalizedData.find(d => d.Approach === schedName);
      if (!row) return;

      const meta = SCHEDULER_COLORS[schedName] || { color: "#ffffff", glow: "rgba(255,255,255,0.3)" };
      const isAdaptiveGuard = schedName === "AdaptiveGuard";

      ctx.beginPath();
      for (let i = 0; i < numAxes; i++) {
        const val = parseFloat(row[axes[i].key]) || 0;
        const currentRadius = radius * Math.min(1.0, Math.max(0, val));
        const angle = i * angleStep - Math.PI / 2;
        const x = centerX + Math.cos(angle) * currentRadius;
        const y = centerY + Math.sin(angle) * currentRadius;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      // Style polygon
      ctx.strokeStyle = meta.color;
      ctx.lineWidth = isAdaptiveGuard ? 2.8 : 1.6;
      ctx.stroke();

      if (isAdaptiveGuard) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
        ctx.fill();
      }

      // Draw vertex dots
      for (let i = 0; i < numAxes; i++) {
        const val = parseFloat(row[axes[i].key]) || 0;
        const currentRadius = radius * Math.min(1.0, Math.max(0, val));
        const angle = i * angleStep - Math.PI / 2;
        const x = centerX + Math.cos(angle) * currentRadius;
        const y = centerY + Math.sin(angle) * currentRadius;

        ctx.beginPath();
        ctx.arc(x, y, isAdaptiveGuard ? 4.5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = meta.color;
        ctx.fill();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  }

  /**
   * Render Pareto Frontier (Safety vs Utility) Scatter Chart
   */
  function renderParetoChart(canvasId, comparisonData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const padLeft = 60;
    const padRight = 30;
    const padTop = 30;
    const padBottom = 50;

    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;

    // Grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 1;
    for (let step = 0; step <= 5; step++) {
      const y = padTop + (plotHeight / 5) * step;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + plotWidth, y);
      ctx.stroke();

      const val = (1.0 - (step * 0.2)).toFixed(1);
      ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText(val, padLeft - 8, y + 3);

      const x = padLeft + (plotWidth / 5) * step;
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, padTop + plotHeight);
      ctx.stroke();

      const xVal = (step * 0.2).toFixed(1);
      ctx.textAlign = "center";
      ctx.fillText(xVal, x, padTop + plotHeight + 16);
    }

    // Axis Labels
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "bold 11px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("LO Utility Preservation Ratio (↑ Higher is Better)", padLeft + plotWidth / 2, height - 12);

    ctx.save();
    ctx.translate(16, padTop + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Safety Score: 1 - HI Miss Ratio (↑ Higher is Better)", 0, 0);
    ctx.restore();

    // High Safety / High Utility Desirable Quadrant Box
    ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
    ctx.fillRect(padLeft + plotWidth * 0.4, padTop, plotWidth * 0.6, plotHeight * 0.5);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.strokeRect(padLeft + plotWidth * 0.4, padTop, plotWidth * 0.6, plotHeight * 0.5);

    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.font = "9px 'Inter', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("★ Pareto Optimal Zone", padLeft + plotWidth - 8, padTop + 14);

    // Plot Schedulers
    comparisonData.forEach(row => {
      const sched = row.Approach;
      const meta = SCHEDULER_COLORS[sched] || { color: "#ffffff", name: sched };

      const hiMiss = parseFloat((row["HI Miss Ratio (↓)"] || "0").split("±")[0].trim()) || 0;
      const loUtil = parseFloat((row["LO Utility Ratio (↑)"] || "0").split("±")[0].trim()) || 0;

      const safetyScore = Math.max(0, Math.min(1.0, 1.0 - hiMiss));
      const utilityScore = Math.max(0, Math.min(1.0, loUtil));

      const px = padLeft + utilityScore * plotWidth;
      const py = padTop + (1.0 - safetyScore) * plotHeight;

      const isAG = sched === "AdaptiveGuard";

      // Draw Halo if AG
      if (isAG) {
        ctx.beginPath();
        ctx.arc(px, py, 12, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
        ctx.fill();
      }

      // Point circle
      ctx.beginPath();
      ctx.arc(px, py, isAG ? 6.5 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = meta.color;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = isAG ? 2 : 1;
      ctx.stroke();

      // Label text
      ctx.fillStyle = isAG ? "#ffffff" : "#a1a1aa";
      ctx.font = isAG ? "bold 11px 'Inter', sans-serif" : "10px 'Inter', sans-serif";
      ctx.textAlign = px > width - 120 ? "right" : "left";
      ctx.fillText(meta.name, px + (px > width - 120 ? -10 : 10), py + 4);
    });
  }

  /**
   * Render System Utilization Sweep Chart (U in [0.4, 1.5])
   */
  function renderUtilizationSweepChart(canvasId, sweepData, metricKey) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !sweepData) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const padLeft = 65;
    const padRight = 35;
    const padTop = 30;
    const padBottom = 45;

    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;

    const utilizations = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5];
    const minU = 0.4;
    const maxU = 1.5;

    // Find max value for scaling
    let maxY = 1.0;
    if (metricKey === "mode_switches") maxY = 700;
    else if (metricKey === "overhead_percentage") maxY = 15.0;
    else if (metricKey === "recovery_time") maxY = 1.5;

    Object.values(sweepData).forEach(schedCurve => {
      const vals = schedCurve[metricKey] || [];
      vals.forEach(v => {
        if (v > maxY) maxY = v * 1.1;
      });
    });

    // Horizontal grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 1;
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const y = padTop + (plotHeight / ySteps) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + plotWidth, y);
      ctx.stroke();

      const yVal = maxY - (maxY / ySteps) * i;
      ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText(yVal > 10 ? yVal.toFixed(0) : yVal.toFixed(2), padLeft - 8, y + 3);
    }

    // Vertical grid lines (U points)
    utilizations.forEach((u, idx) => {
      const x = padLeft + ((u - minU) / (maxU - minU)) * plotWidth;
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, padTop + plotHeight);
      ctx.strokeStyle = u === 1.0 ? "rgba(251, 191, 36, 0.3)" : "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = u === 1.0 ? 1.5 : 1;
      ctx.stroke();

      ctx.fillStyle = u === 1.0 ? "#fbbf24" : "rgba(161, 161, 170, 0.6)";
      ctx.font = u === 1.0 ? "bold 10px 'JetBrains Mono', monospace" : "10px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(u.toFixed(2), x, padTop + plotHeight + 16);
    });

    // U = 1.0 Capacity Limit Label
    const capX = padLeft + ((1.0 - minU) / (maxU - minU)) * plotWidth;
    ctx.fillStyle = "#fbbf24";
    ctx.font = "9px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("CPU Capacity (U = 1.0)", capX, padTop - 10);

    // Axis titles
    ctx.fillStyle = "#a1a1aa";
    ctx.font = "bold 11px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Total System Utilization U (Synthetic Workload Grid)", padLeft + plotWidth / 2, height - 8);

    // Plot curves for each scheduler
    const schedulers = Object.keys(sweepData);
    schedulers.forEach(schedName => {
      const curve = sweepData[schedName];
      if (!curve || !curve[metricKey]) return;

      const meta = SCHEDULER_COLORS[schedName] || { color: "#94a3b8" };
      const vals = curve[metricKey];
      const isAG = schedName === "AdaptiveGuard";

      ctx.beginPath();
      let started = false;
      for (let i = 0; i < utilizations.length; i++) {
        const u = utilizations[i];
        const val = vals[i] !== undefined ? vals[i] : null;
        if (val === null) continue;

        const x = padLeft + ((u - minU) / (maxU - minU)) * plotWidth;
        const y = padTop + (1.0 - (val / maxY)) * plotHeight;

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.strokeStyle = meta.color;
      ctx.lineWidth = isAG ? 3.0 : 1.7;
      if (schedName === "EDF") ctx.setLineDash([4, 3]);
      else if (schedName.includes("Degraded")) ctx.setLineDash([6, 3]);
      else ctx.setLineDash([]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Plot point markers
      for (let i = 0; i < utilizations.length; i++) {
        const u = utilizations[i];
        const val = vals[i] !== undefined ? vals[i] : null;
        if (val === null) continue;

        const x = padLeft + ((u - minU) / (maxU - minU)) * plotWidth;
        const y = padTop + (1.0 - (val / maxY)) * plotHeight;

        ctx.beginPath();
        ctx.arc(x, y, isAG ? 4 : 2.5, 0, Math.PI * 2);
        ctx.fillStyle = meta.color;
        ctx.fill();
      }
    });
  }

  return {
    renderRadarChart,
    renderParetoChart,
    renderUtilizationSweepChart,
    SCHEDULER_COLORS,
  };
})();
