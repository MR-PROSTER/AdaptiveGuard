/**
 * ADAPTIVEGUARD // GANTT MODULE
 * High-resolution Interactive CPU Execution Gantt Chart Renderer
 */

const Gantt = (function () {
  const TASK_LANES = [
    { key: "CPU", label: "CPU ACTIVE", color: "#e4e4e7", isCpuTrack: true },
    { key: "H1", label: "H1 Flight_Ctrl (HI)", color: "#c084fc", task_id: 1, c_lo: 2.0, c_hi: 6.0 },
    { key: "H2", label: "H2 Braking_Ctrl (HI)", color: "#fb7185", task_id: 2, c_lo: 3.0, c_hi: 7.0 },
    { key: "L1", label: "L1 Telemetry (LO)", color: "#38bdf8", task_id: 3, c_lo: 6.0, c_hi: 6.0 },
    { key: "L2", label: "L2 Logging_A (LO)", color: "#fbbf24", task_id: 4, c_lo: 1.0, c_hi: 1.0 },
    { key: "L3", label: "L3 Logging_B (LO)", color: "#fb923c", task_id: 5, c_lo: 1.0, c_hi: 1.0 },
    { key: "L4", label: "L4 Logging_C (LO)", color: "#34d399", task_id: 6, c_lo: 1.0, c_hi: 1.0 },
  ];

  /**
   * Render Gantt Chart on Canvas
   */
  function render(canvas, slices, currentTime, options = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    const padLeft = 135;
    const padRight = 25;
    const padTop = 28;
    const padBottom = 24;

    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;
    const duration = options.duration || 40.0;

    ctx.clearRect(0, 0, width, height);

    // Background fill
    ctx.fillStyle = "#080808";
    ctx.fillRect(0, 0, width, height);

    // Time-to-X conversion
    function timeToX(t) {
      return padLeft + (Math.max(0, Math.min(duration, t)) / duration) * plotWidth;
    }

    // Lane definitions
    const numLanes = TASK_LANES.length;
    const laneHeight = plotHeight / numLanes;

    // 1. Draw Time Axis and Vertical Grid Lines
    const stepTime = 5.0; // 5ms increments
    for (let t = 0; t <= duration; t += stepTime) {
      const x = timeToX(t);

      // Grid line
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, padTop + plotHeight);
      ctx.strokeStyle = (t % 20 === 0) ? "rgba(255, 255, 255, 0.14)" : "rgba(255, 255, 255, 0.04)";
      ctx.lineWidth = (t % 20 === 0) ? 1.5 : 1;
      ctx.stroke();

      // Time label on top axis
      ctx.fillStyle = (t % 20 === 0) ? "#ffffff" : "rgba(161, 161, 170, 0.7)";
      ctx.font = (t % 20 === 0) ? "bold 10px 'JetBrains Mono', monospace" : "9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${t}ms`, x, padTop - 8);

      // Period boundary markers (20ms, 40ms)
      if (t > 0 && t % 20 === 0) {
        ctx.fillStyle = "rgba(251, 191, 36, 0.8)";
        ctx.font = "8px 'Inter', sans-serif";
        ctx.fillText(`Period ${t/20}`, x, padTop + plotHeight + 14);
      }
    }

    // 2. Draw Task Lane Tracks
    TASK_LANES.forEach((lane, idx) => {
      const y = padTop + idx * laneHeight;

      // Lane background alternate shading
      if (idx % 2 === 1) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.015)";
        ctx.fillRect(padLeft, y, plotWidth, laneHeight);
      }

      // Lane separator line
      ctx.beginPath();
      ctx.moveTo(padLeft - 10, y + laneHeight);
      ctx.lineTo(padLeft + plotWidth, y + laneHeight);
      ctx.strokeStyle = lane.isCpuTrack ? "rgba(255, 255, 255, 0.18)" : "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = lane.isCpuTrack ? 1.5 : 1;
      ctx.stroke();

      // Lane Label
      ctx.fillStyle = lane.isCpuTrack ? "#ffffff" : "#a1a1aa";
      ctx.font = lane.isCpuTrack ? "bold 10px 'JetBrains Mono', monospace" : "10px 'Inter', sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(lane.label, padLeft - 12, y + laneHeight / 2);

      // Color indicator dot
      ctx.beginPath();
      ctx.arc(14, y + laneHeight / 2, 4, 0, Math.PI * 2);
      ctx.fillStyle = lane.color;
      ctx.fill();
    });

    // 3. Draw Task Release & Deadline Markers on individual lanes
    // For fixed workload: tasks release at 0ms and 20ms, deadline at 20ms and 40ms
    for (let periodIdx = 0; periodIdx < 2; periodIdx++) {
      const relTime = periodIdx * 20.0;
      const deadTime = relTime + 20.0;
      const rx = timeToX(relTime);
      const dx = timeToX(deadTime);

      TASK_LANES.forEach((lane, laneIdx) => {
        if (lane.isCpuTrack) return;
        const ly = padTop + laneIdx * laneHeight;

        // Release marker (green downward small tick)
        ctx.fillStyle = "rgba(16, 185, 129, 0.6)";
        ctx.fillRect(rx, ly + 2, 2, 6);

        // Deadline marker (red flag tick)
        ctx.fillStyle = "rgba(239, 68, 68, 0.7)";
        ctx.fillRect(dx - 2, ly + 2, 2, laneHeight - 4);
      });
    }

    // 4. Draw Execution Slices
    const barPadding = 3;

    slices.forEach(slice => {
      const sx = timeToX(slice.start);
      const ex = timeToX(slice.end);
      const barW = Math.max(1.5, ex - sx);

      // Match task lane
      const taskLaneIdx = TASK_LANES.findIndex(l => l.key === slice.task_short);
      const lane = TASK_LANES[taskLaneIdx] || { color: "#64748b" };

      // Helper to draw rounded slice box
      function drawSliceBox(targetLaneIdx, isCpuBar) {
        const y = padTop + targetLaneIdx * laneHeight + barPadding;
        const h = laneHeight - barPadding * 2;

        ctx.save();

        // Check if slice has executed up to or past currentTime
        const isPastOrCurrent = slice.start <= currentTime;
        const isCurrentlyRunning = slice.start <= currentTime && currentTime < slice.end;

        // Base color
        ctx.fillStyle = lane.color;
        if (!isPastOrCurrent) {
          ctx.globalAlpha = 0.35; // Future unexecuted portion is dimmed
        }

        // Draw slice rectangle
        ctx.beginPath();
        const r = 3; // border radius
        ctx.roundRect ? ctx.roundRect(sx, y, barW, h, r) : ctx.rect(sx, y, barW, h);
        ctx.fill();

        // Overrun pattern detection: if H1/H2 executes past nominal C_LO
        if (slice.criticality === "HI") {
          const nominalLimit = slice.task_short === "H1" ? 2.0 : 3.0;
          // Check if this segment represents overrun execution
          const jobSeq = parseInt(slice.job_id.split("_J")[1] || "0");
          const periodStart = jobSeq * 20.0;
          const overrunStart = periodStart + nominalLimit;

          if (slice.end > overrunStart) {
            const ovSx = Math.max(sx, timeToX(overrunStart));
            const ovW = ex - ovSx;
            if (ovW > 0) {
              ctx.fillStyle = "rgba(239, 68, 68, 0.4)";
              ctx.beginPath();
              ctx.roundRect ? ctx.roundRect(ovSx, y, ovW, h, [0, r, r, 0]) : ctx.rect(ovSx, y, ovW, h);
              ctx.fill();

              // Red striped border
              ctx.strokeStyle = "#ef4444";
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
        }

        // Active running glow pulse
        if (isCurrentlyRunning) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.shadowColor = lane.color;
          ctx.shadowBlur = 10;
          ctx.stroke();
        } else if (isPastOrCurrent) {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
          ctx.lineWidth = 0.75;
          ctx.stroke();
        }

        // Slice text label if width allows
        if (barW > 24) {
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 9px 'JetBrains Mono', monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const labelText = isCpuBar ? `${slice.task_short}` : `${slice.job_id} (${slice.duration.toFixed(1)})`;
          ctx.fillText(labelText, sx + barW / 2, y + h / 2);
        }

        ctx.restore();
      }

      // Draw in Consolidated CPU Track (lane 0)
      drawSliceBox(0, true);

      // Draw in Task's Individual Lane
      if (taskLaneIdx > 0) {
        drawSliceBox(taskLaneIdx, false);
      }
    });

    // 5. Draw Current Time Needle (Scrubber Playhead)
    const curX = timeToX(currentTime);

    ctx.save();
    // Needle line
    ctx.beginPath();
    ctx.moveTo(curX, padTop - 12);
    ctx.lineTo(curX, padTop + plotHeight + 6);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "rgba(255, 255, 255, 0.4)";
    ctx.shadowBlur = 4;
    ctx.stroke();

    // Needle top cap / head
    ctx.beginPath();
    ctx.moveTo(curX - 5, padTop - 12);
    ctx.lineTo(curX + 5, padTop - 12);
    ctx.lineTo(curX, padTop - 4);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    // Current time readout box above needle
    ctx.fillStyle = "#141414";
    ctx.fillRect(curX - 26, padTop - 25, 52, 13);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(curX - 26, padTop - 25, 52, 13);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 9px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${currentTime.toFixed(1)}ms`, curX, padTop - 19);

    ctx.restore();
  }

  /**
   * Hit test for tooltip
   */
  function findSliceAtPoint(canvas, slices, x, y, options = {}) {
    if (!canvas || !slices) return null;
    const width = canvas.width;
    const height = canvas.height;
    const padLeft = 135;
    const padRight = 25;
    const padTop = 28;
    const padBottom = 24;
    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;
    const duration = options.duration || 40.0;

    const timeAtX = ((x - padLeft) / plotWidth) * duration;
    if (timeAtX < 0 || timeAtX > duration) return null;

    const numLanes = TASK_LANES.length;
    const laneHeight = plotHeight / numLanes;
    const laneIdx = Math.floor((y - padTop) / laneHeight);
    if (laneIdx < 0 || laneIdx >= numLanes) return null;

    const lane = TASK_LANES[laneIdx];

    // Find matching slice
    for (const slice of slices) {
      if (timeAtX >= slice.start && timeAtX <= slice.end) {
        if (lane.isCpuTrack || lane.key === slice.task_short) {
          return slice;
        }
      }
    }
    return null;
  }

  return {
    render,
    findSliceAtPoint,
    TASK_LANES,
  };
})();
