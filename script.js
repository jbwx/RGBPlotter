const editorElement = document.getElementById("editor");
const canvas = document.getElementById("colorCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const consoleOutput = document.getElementById("consoleOutput");

const mainContentElement = document.querySelector(".main-content");
const canvasPaneElement = document.querySelector(".canvas-pane");

const plotButton = document.getElementById("plotButton");
const shareButton = document.getElementById("shareButton");
const downloadButton = document.getElementById("downloadButton");
const resetButton = document.getElementById("resetButton");

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 1000;
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

var editor = ace.edit(editorElement);
editor.setTheme("ace/theme/chaos");
editor.session.setMode("ace/mode/javascript");
editor.setFontSize(14);
editor.$blockScrolling = Infinity;

const defaultJsCode = `// x and y range from 0 – 1000
// r, g, b should be from between 0 – 255

r = abs(tan(tan(pow(abs(sin((((y/2) )/500)*1.7+tan((((x/2) )/500)*1)*1))+10,log(abs(sin((((y/2) )/500)*1.7+tan((((x/2) )/500)*1)*1)+sin((((x/2) )/500)*tan((((y/2) )/500)*1)*1))+1))*1.7)*400))*50;
g = abs(tan(tan(pow(abs(sin((((y/2) )/500)*1.7+tan((((x/2) )/500)*1)*1))+10,log(abs(sin((((y/2) )/500)*1.7+tan((((x/2) )/500)*1)*1)+sin((((x/2) )/500)*tan((((y/2) )/500)*1)*1))+1))*1.7)*400+PI/3.0))*50;
b = abs(tan(tan(pow(abs(sin((((y/2) )/500)*1.7+tan((((x/2) )/500)*1)*1))+10,log(abs(sin((((y/2) )/500)*1.7+tan((((x/2) )/500)*1)*1)+sin((((x/2) )/500)*tan((((y/2) )/500)*1)*1))+1))*1.7)*400+(1.7*PI)/3.0))*50;`;

// Store original console functions for internal use if needed during silent test
const _trueConsole = {
  log: console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
};

function logToConsole(message, type = "info") {
  consoleOutput.style.display = "block";
  const entry = document.createElement("div");
  entry.classList.add(type);
  let prefix = `[${type.toUpperCase()}]`;
  if (type === "log") prefix = "[LOG]";
  entry.textContent = `${prefix} ${new Date().toLocaleTimeString()}: ${message}`;
  consoleOutput.appendChild(entry);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

const originalCustomConsoleLog = console.log;
const originalCustomConsoleError = console.error;
const originalCustomConsoleWarn = console.warn;
const originalCustomConsoleInfo = console.info;

console.log = (...args) => {
  originalCustomConsoleLog.apply(console, args);
  logToConsole(args.join(" "), "log");
};
console.error = (...args) => {
  originalCustomConsoleError.apply(console, args);
  logToConsole(args.join(" "), "error");
};
console.warn = (...args) => {
  originalCustomConsoleWarn.apply(console, args);
  logToConsole(args.join(" "), "warn");
};
console.info = (...args) => {
  originalCustomConsoleInfo.apply(console, args);
  logToConsole(args.join(" "), "info");
};

const mathHelperScope = `
                const sin = Math.sin; const cos = Math.cos; const tan = Math.tan;
                const asin = Math.asin; const acos = Math.acos; const atan = Math.atan; const atan2 = Math.atan2;
                const pow = Math.pow; const sqrt = Math.sqrt; const cbrt = Math.cbrt;
                const abs = Math.abs; const floor = Math.floor; const ceil = Math.ceil; const round = Math.round;
                const exp = Math.exp; const log = Math.log; const log10 = Math.log10; const log2 = Math.log2;
                const min = Math.min; const max = Math.max; const sign = Math.sign;
                const random = Math.random; /* Note: non-deterministic */
                const PI = Math.PI; const E = Math.E;
                const SQRT2 = Math.SQRT2; const SQRT1_2 = Math.SQRT1_2;
                const LN2 = Math.LN2; const LN10 = Math.LN10;
                const LOG2E = Math.LOG2E; const LOG10E = Math.LOG10E;
                // Add any other Math properties or simple functions you want accessible
            `;

let lastRenderTime = 0;
let isRendering = false;

async function renderCanvas() {
  if (isRendering) {
    _trueConsole.warn("Plotting already in progress."); // Use true console for this internal warning
    return;
  }
  isRendering = true;
  plotButton.disabled = true;
  resetButton.disabled = true; // Disable reset while plotting

  const now = performance.now();
  if (now - lastRenderTime < 100 && lastRenderTime !== 0) {
    _trueConsole.info("Render debounced."); // Use true console
    isRendering = false;
    plotButton.disabled = false;
    resetButton.disabled = false;
    return;
  }
  lastRenderTime = now;
  console.info("Preparing to plot...");

  let userCode = editor.getValue();
  if (!userCode || !userCode.trim()) {
    console.error("No code to execute.");
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    isRendering = false;
    plotButton.disabled = false;
    resetButton.disabled = false;
    return;
  }

  const fullFunctionBodyTemplate = (code) => `
                    ${mathHelperScope}
                    let r, g, b;
                    try {
                        ${code}
                    } catch (e) {
                        // This console.error will go to the custom logger
                        console.error("Error in user function (pixel x:" + x + ", y:" + y + "): " + e.message + (e.stack ? "\\nStack: " + (e.stack.split("\\n").find(line => line.includes("<anonymous>") || line.includes("eval")) || e.stack.split("\\n")[1] || "").trim() : ""));
                        return {r_val: 255, g_val: 0, b_val: 0, hasError: true}; // Use different names to avoid conflict
                    }
                    // These console.warn will go to the custom logger if issues found
                    if (typeof r === 'undefined') { console.warn("Variable 'r' was not set by the script at (x:" + x + ", y:" + y + "). Defaulting to 0."); r = 0; }
                    if (typeof g === 'undefined') { console.warn("Variable 'g' was not set by the script at (x:" + x + ", y:" + y + "). Defaulting to 0."); g = 0; }
                    if (typeof b === 'undefined') { console.warn("Variable 'b' was not set by the script at (x:" + x + ", y:" + y + "). Defaulting to 0."); b = 0; }

                    const r_num = parseFloat(r);
                    const g_num = parseFloat(g);
                    const b_num = parseFloat(b);

                    if (isNaN(r_num)) { console.warn("'r' is NaN at (x:" + x + ", y:" + y + "). Defaulting to 0."); r = 0; } else { r = r_num; }
                    if (isNaN(g_num)) { console.warn("'g' is NaN at (x:" + x + ", y:" + y + "). Defaulting to 0."); g = 0; } else { g = g_num; }
                    if (isNaN(b_num)) { console.warn("'b' is NaN at (x:" + x + ", y:" + y + "). Defaulting to 0."); b = 0; } else { b = b_num; }

                    return {r_val: r, g_val: g, b_val: b, hasError: false};
                `;

  let userFunc;
  try {
    userFunc = new Function("x", "y", fullFunctionBodyTemplate(userCode));
  } catch (e) {
    console.error(
      // This goes to custom console
      "Syntax error in function definition: " + e.message,
    );
    const iDataErr = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
    const dErr = iDataErr.data;
    for (let k = 0; k < dErr.length; k += 4) {
      dErr[k] = 30;
      dErr[k + 1] = 30;
      dErr[k + 2] = 30;
      dErr[k + 3] = 255;
    }
    ctx.putImageData(iDataErr, 0, 0);
    isRendering = false;
    plotButton.disabled = false;
    resetButton.disabled = false;
    return;
  }

  // --- Pre-plot Test ---
  _trueConsole.info("Running pre-plot test with x=100, y=100..."); // Internal log
  const testTimeoutDuration = 1000; // ms, increased a bit
  const testX = 100,
    testY = 100;
  let prePlotTestPassed = false;

  // Temporarily redirect console.error/warn for the test to avoid polluting user console on non-fatal test issues
  const tempCapturedTestLogs = [];
  const tempConsoleError = console.error;
  const tempConsoleWarn = console.warn;

  console.error = (...args) => {
    tempCapturedTestLogs.push({ type: "error", args });
    tempConsoleError(...args);
  };
  console.warn = (...args) => {
    tempCapturedTestLogs.push({ type: "warn", args });
    tempConsoleWarn(...args);
  };

  const testPromise = new Promise((resolve, reject) => {
    try {
      const result = userFunc(testX, testY);
      if (result.hasError) {
        reject(
          new Error(
            `Pre-plot test (x:${testX},y:${testY}): Error reported by user function wrapper. Check custom console.`,
          ),
        );
        return;
      }
      // result.r_val, g_val, b_val are already checked for undefined/NaN inside the wrapper
      resolve(result);
    } catch (e) {
      // Catch errors from userFunc execution itself if not caught by its internal try-catch
      reject(
        new Error(
          `Pre-plot test (x:${testX},y:${testY}): Uncaught exception during execution: ${e.message}`,
        ),
      );
    }
  });

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(
          `Pre-plot test (x:${testX},y:${testY}) timed out after ${testTimeoutDuration}ms. Possible infinite loop or very slow code.`,
        ),
      );
    }, testTimeoutDuration);
  });

  try {
    await Promise.race([testPromise, timeoutPromise]);
    prePlotTestPassed = true;
    // _trueConsole.info("Pre-plot test successful."); // No need to log success to user
  } catch (error) {
    // Restore console first so the error log goes to the right place
    console.error = tempConsoleError;
    console.warn = tempConsoleWarn;
    console.error("Pre-plot test failed: " + error.message); // Log the specific failure reason
    isRendering = false;
    plotButton.disabled = false;
    resetButton.disabled = false;
    return;
  } finally {
    // Always restore console
    console.error = tempConsoleError;
    console.warn = tempConsoleWarn;
  }

  if (!prePlotTestPassed) {
    // Should be caught by try-catch above
    isRendering = false;
    plotButton.disabled = false;
    resetButton.disabled = false;
    return;
  }
  // --- End Pre-plot Test ---

  console.info("Starting main plot..."); // This goes to custom console
  const imageData = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
  const data = imageData.data;
  let pixelErrorCount = 0,
    pixelWarningCount = 0; // These counts are for warnings/errors from the userFunc wrapper
  const MAX_PIXEL_ISSUES_TO_LOG = 5; // Max warnings/errors from userFunc for EACH type to show in console

  // For counting specific types of warnings from the wrapper
  let rUndefinedCount = 0,
    gUndefinedCount = 0,
    bUndefinedCount = 0;
  let rNaNCount = 0,
    gNaNCount = 0,
    bNaNCount = 0;

  // Temporarily capture console for pixel loop to count specific warnings
  const pixelLoopConsoleError = console.error;
  const pixelLoopConsoleWarn = console.warn;
  console.error = (...args) => {
    pixelErrorCount++;
    pixelLoopConsoleError(...args);
  };
  console.warn = (...args) => {
    const msg = args.join(" ").toLowerCase();
    if (msg.includes("'r' was not set")) rUndefinedCount++;
    else if (msg.includes("'g' was not set")) gUndefinedCount++;
    else if (msg.includes("'b' was not set")) bUndefinedCount++;
    else if (msg.includes("'r' is nan")) rNaNCount++;
    else if (msg.includes("'g' is nan")) gNaNCount++;
    else if (msg.includes("'b' is nan")) bNaNCount++;
    else pixelWarningCount++; // Generic warnings

    // Limit logging for each specific type
    if (
      (msg.includes("'r' was not set") &&
        rUndefinedCount > MAX_PIXEL_ISSUES_TO_LOG) ||
      (msg.includes("'g' was not set") &&
        gUndefinedCount > MAX_PIXEL_ISSUES_TO_LOG) ||
      (msg.includes("'b' was not set") &&
        bUndefinedCount > MAX_PIXEL_ISSUES_TO_LOG) ||
      (msg.includes("'r' is nan") && rNaNCount > MAX_PIXEL_ISSUES_TO_LOG) ||
      (msg.includes("'g' is nan") && gNaNCount > MAX_PIXEL_ISSUES_TO_LOG) ||
      (msg.includes("'b' is nan") && bNaNCount > MAX_PIXEL_ISSUES_TO_LOG) ||
      (!msg.includes("was not set") &&
        !msg.includes("nan") &&
        pixelWarningCount > MAX_PIXEL_ISSUES_TO_LOG)
    ) {
      // Suppress if this specific type of warning exceeded its limit
    } else {
      pixelLoopConsoleWarn(...args);
    }
  };

  for (let j = 0; j < CANVAS_HEIGHT; j++) {
    for (let i = 0; i < CANVAS_WIDTH; i++) {
      const current_x = i;
      const current_y = j;
      let R_val = 0,
        G_val = 0,
        B_val = 0;
      try {
        const result = userFunc(current_x, current_y);
        R_val = result.r_val;
        G_val = result.g_val;
        B_val = result.b_val;
        // Error/warning logging is handled inside userFunc wrapper
      } catch (e) {
        // Should be rare due to robust inner try-catch
        if (pixelErrorCount < MAX_PIXEL_ISSUES_TO_LOG) {
          pixelLoopConsoleError(
            // Use the one that counts for this loop
            `Critical runtime error at pixel (${current_x}, ${current_y}): ${e.message}`,
          );
        }
        R_val = 255;
        G_val = 0;
        B_val = 255;
      }
      const index = (j * CANVAS_WIDTH + current_x) * 4;
      data[index] = Math.max(0, Math.min(255, R_val)) & 0xff;
      data[index + 1] = Math.max(0, Math.min(255, G_val)) & 0xff;
      data[index + 2] = Math.max(0, Math.min(255, B_val)) & 0xff;
      data[index + 3] = 255;
    }
  }

  // Restore console after pixel loop
  console.error = pixelLoopConsoleError;
  console.warn = pixelLoopConsoleWarn;

  ctx.putImageData(imageData, 0, 0);
  console.info(
    // This goes to custom console
    `Plot complete. Took ${(performance.now() - now).toFixed(2)}ms.`,
  );
  if (rUndefinedCount > MAX_PIXEL_ISSUES_TO_LOG)
    console.warn(
      `'r' undefined warning count: ${rUndefinedCount}. Further similar warnings suppressed.`,
    );
  if (gUndefinedCount > MAX_PIXEL_ISSUES_TO_LOG)
    console.warn(
      `'g' undefined warning count: ${gUndefinedCount}. Further similar warnings suppressed.`,
    );
  if (bUndefinedCount > MAX_PIXEL_ISSUES_TO_LOG)
    console.warn(
      `'b' undefined warning count: ${bUndefinedCount}. Further similar warnings suppressed.`,
    );
  if (rNaNCount > MAX_PIXEL_ISSUES_TO_LOG)
    console.warn(
      `'r' NaN warning count: ${rNaNCount}. Further similar warnings suppressed.`,
    );
  if (gNaNCount > MAX_PIXEL_ISSUES_TO_LOG)
    console.warn(
      `'g' NaN warning count: ${gNaNCount}. Further similar warnings suppressed.`,
    );
  if (bNaNCount > MAX_PIXEL_ISSUES_TO_LOG)
    console.warn(
      `'b' NaN warning count: ${bNaNCount}. Further similar warnings suppressed.`,
    );
  if (pixelErrorCount > MAX_PIXEL_ISSUES_TO_LOG)
    console.warn(
      `Pixel execution error count: ${pixelErrorCount}. Further similar errors suppressed.`,
    );
  if (pixelWarningCount > MAX_PIXEL_ISSUES_TO_LOG)
    console.warn(
      `Other pixel warning count: ${pixelWarningCount}. Further similar warnings suppressed.`,
    );

  isRendering = false;
  plotButton.disabled = false;
  resetButton.disabled = false;
}

plotButton.addEventListener("click", renderCanvas);
shareButton.addEventListener("click", () => {
  if (isRendering) return;
  const codeToShare = editor.getValue();
  const url = new URL(window.location.href);
  url.searchParams.set("code", encodeURIComponent(codeToShare));
  navigator.clipboard
    .writeText(url.toString())
    .then(() => console.info("Share URL copied to clipboard!"))
    .catch((err) => {
      console.error("Failed to copy share URL: ", err);
      alert("Failed to copy URL.");
    });
});
downloadButton.addEventListener("click", () => {
  if (isRendering) return;
  const dataURL = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.download = `RGBPlot_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.png`;
  link.href = dataURL;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  console.info("Image download initiated.");
});
resetButton.addEventListener("click", () => {
  if (isRendering) return;
  editor.setValue(defaultJsCode, -1);
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  const rID = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);
  const rD = rID.data;
  for (let i = 0; i < rD.length; i += 4) {
    rD[i] = 240;
    rD[i + 1] = 240;
    rD[i + 2] = 240;
    rD[i + 3] = 255;
  }
  ctx.putImageData(rID, 0, 0);
  consoleOutput.innerHTML = "";
  consoleOutput.style.display = "none";
  console.info("Editor, canvas, and console reset.");
  renderCanvas();
});

function loadFromURLParams() {
  const params = new URLSearchParams(window.location.search);
  const codeParam = params.get("code");
  let loaded = false;
  if (codeParam) {
    try {
      editor.setValue(decodeURIComponent(codeParam), -1);
      loaded = true;
      console.info("Code loaded from URL parameters.");
    } catch (e) {
      console.error("Error loading code from URL: ", e);
    }
  }
  if (!loaded) editor.setValue(defaultJsCode, -1);
  renderCanvas();
}

function adjustLayout() {
  if (!mainContentElement || !canvasPaneElement || !editor) return;
  const paneHeight = canvasPaneElement.offsetHeight;
  canvasPaneElement.style.width = `${paneHeight}px`;
  editor.resize();
}

window.addEventListener("DOMContentLoaded", () => {
  loadFromURLParams();
  adjustLayout();
  const resizeObserver = new ResizeObserver((entries) => {
    for (let entry of entries) {
      if (entry.target === mainContentElement) adjustLayout();
    }
  });
  if (mainContentElement) resizeObserver.observe(mainContentElement);
  else window.addEventListener("resize", adjustLayout);
});
