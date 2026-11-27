
const $ = id => document.getElementById(id);

let last = null;
let graphBounds = null;
let graphTimer = null;
let graphRequestId = 0;
let graphEventsAttached = false;
let graphReady = false;
let graphGeneration = 0;
let graphController = null;

// ========================================
// NUMBER AND MATH FORMATTING
// ========================================

const fmt = n =>
    typeof n === "number" && Number.isFinite(n)
        ? n.toFixed(3)
        : String(n);

const approxFmt = n =>
    n === null || n === undefined || !Number.isFinite(n)
        ? "Undefined"
        : Number(n).toFixed(3);

const smallNonzero = n =>
    Number.isFinite(n) && n !== 0 && Math.abs(n) < 0.0005
        ? "<0.001"
        : fmt(n);

const escapeHtml = value =>
    String(value).replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));

const tex = expression =>
    `<div class="mathline">\\[${expression}\\]</div>`;

const mathSection = (heading, contents) =>
    `<section class="work-part">
        <h4>${heading}</h4>
        ${contents}
    </section>`;

const numberTex = n =>
    Number.isFinite(n)
        ? Number(n).toFixed(3)
        : "\\text{Undefined}";

const safeEq = eq =>
    String(eq).replace(/\\/g, "").replace(/[<>]/g, "");

function mathRender() {
    if (window.MathJax?.typesetPromise) {
        window.MathJax.typesetPromise([
            $("solutionOverview"),
            $("steps")
        ]).catch(console.error);
    }
}

// ========================================
// COPY AND DOWNLOAD RESULTS
// ========================================

function textResult(d) {
    return [
        "NEWTON-RAPHSON SOLUTION",
        `Equation: ${d.equation}`,
        `Approximate root: ${fmt(d.root)}`,
        `Residual: ${smallNonzero(d.residual)}`,
        `Status: ${d.message}`,
        `Iterations: ${d.steps.length}`,
        "",
        "Newton-Raphson Formula:",
        "x_next = x - f(x) / f'(x)",
        "",
        "Approximate Relative Error:",
        "Ea = |(Present - Previous) / Present| * 100%",
        "",
        ...d.steps.map(s => [
            `Iteration ${s.iteration}`,
            `Given: x = ${fmt(s.x)}`,
            `f(x) = ${fmt(s.fx)}`,
            `f'(x) = ${fmt(s.derivative)}`,
            "",
            "Substitution:",
            `x_next = ${fmt(s.x)} - (${fmt(s.fx)}) / (${fmt(s.derivative)})`,
            "",
            `Answer: x_next = ${fmt(s.nextX)}`,
            `Approximate Error = ${approxFmt(s.approximateErrorPercent)}%`,
            ""
        ].join("\n"))
    ].join("\n");
}

// ========================================
// CALCULATOR KEYPAD
// ========================================

document.querySelectorAll(
    "[data-insert], [data-backspace]"
).forEach(button => {
    button.addEventListener("click", () => {
        const field = $("equation");

        const start = field.selectionStart ?? field.value.length;
        const end = field.selectionEnd ?? start;
        const insertion = button.dataset.insert || "";

        if (button.dataset.backspace) {
            if (start === end && start > 0) {
                field.setRangeText("", start - 1, end, "end");
            } else {
                field.setRangeText("", start, end, "end");
            }
        } else {
            field.setRangeText(insertion, start, end, "end");
        }

        field.focus();
    });
});

// ========================================
// SOLVE EQUATION
// ========================================

$("solverForm").addEventListener("submit", async event => {
    event.preventDefault();

    $("message").textContent = "";
    $("solveBtn").disabled = true;

    const stoppingError = $("tolerance").value.trim();

    if (!stoppingError || Number(stoppingError) <= 0 ||
        !Number.isFinite(Number(stoppingError))) {
        $("message").textContent =
            "Enter a valid positive stopping error percentage.";
        $("solveBtn").disabled = false;
        return;
    }

    try {
        const response = await fetch("/api/solve", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                equation: $("equation").value,
                initialGuess: Number($("guess").value),
                stoppingErrorPercent: Number(stoppingError),
                maxIterations: Number($("iterations").value)
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(
                error.detail ||
                error.message ||
                "Unable to calculate. Check your inputs."
            );
        }

        last = await response.json();
        render(last);

    } catch (error) {
        $("message").textContent = error.message;
        $("results").classList.add("hidden");
        $("placeholder").classList.remove("hidden");

        last = null;
        invalidateGraph();

    } finally {
        $("solveBtn").disabled = false;
    }
});

// ========================================
// RESET CALCULATOR
// ========================================

$("resetBtn").onclick = () => {
    $("solverForm").reset();
    $("results").classList.add("hidden");
    $("placeholder").classList.remove("hidden");
    $("message").textContent = "";

    last = null;
    invalidateGraph();
};

// ========================================
// COPY RESULTS
// ========================================

$("copyBtn").onclick = async () => {
    if (!last) return;

    try {
        await navigator.clipboard.writeText(textResult(last));

        $("copyBtn").textContent = "Copied!";

        setTimeout(() => {
            $("copyBtn").textContent = "Copy results";
        }, 1500);

    } catch (error) {
        $("message").textContent =
            "Copy failed. Use Download instead.";
    }
};

// ========================================
// DOWNLOAD RESULTS
// ========================================

$("downloadBtn").onclick = () => {
    if (!last) return;

    const blob = new Blob([textResult(last)], {
        type: "text/plain"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "newton-raphson-solution.txt";
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ========================================
// DISPLAY CALCULATION RESULTS
// ========================================

function render(d) {
    $("results").classList.remove("hidden");
    $("placeholder").classList.add("hidden");

    $("root").textContent = fmt(d.root);
    $("residual").textContent = smallNonzero(d.residual);
    $("count").textContent = d.steps.length;
    $("status").textContent = d.message;
    $("status").className = d.converged ? "good" : "bad";

    $("rows").replaceChildren();
    $("steps").replaceChildren();

    const eq = safeEq(d.equation);
    const guess = Number($("guess").value);
    const stop = $("tolerance").value;

    $("solutionOverview").innerHTML =
        "<h3>Given and Formulas</h3>" +

        mathSection(
            "Given",
            tex(`\\text{Function: }${escapeHtml(eq)}`) +
            tex(`x_0=${fmt(guess)}`) +
            tex(`\\varepsilon_{\\mathrm{stop}}=${escapeHtml(stop)}\\%`)
        ) +

        mathSection(
            "Newton-Raphson Formula",
            tex("x_{n+1}=x_n-\\frac{f(x_n)}{f'(x_n)}")
        ) +

        mathSection(
            "Approximate Relative Error",
            tex(
                "\\varepsilon_a=" +
                "\\left|\\frac{x_{n+1}-x_n}{x_{n+1}}\\right|" +
                "\\times100\\%"
            )
        ) +

        `<p class="small-note">
            Stop when the unrounded approximate relative error
            is less than or equal to the percentage entered.
            Derivatives are estimated using central differences.
            All calculations use full precision, while results
            are displayed to three decimal places.
        </p>`;

    d.steps.forEach(s => {
        // Iteration table
        const tr = document.createElement("tr");

        [
            String(s.iteration),
            fmt(s.x),
            fmt(s.fx),
            fmt(s.derivative),
            fmt(s.nextX),
            approxFmt(s.approximateErrorPercent)
        ].forEach(value => {
            const td = document.createElement("td");
            td.textContent = value;
            tr.appendChild(td);
        });

        $("rows").appendChild(tr);

        // Approximate relative error
        const percent = Number.isFinite(s.approximateErrorPercent)
            ? tex(
                `\\varepsilon_a=${numberTex(s.approximateErrorPercent)}\\%`
            )
            : `<p class="small-note">
                Relative error is undefined because
                the new approximation is zero.
               </p>`;

        const percentSub = s.nextX !== 0
            ? tex(
                `\\varepsilon_a=` +
                `\\left|\\frac{${fmt(s.nextX)}-(${fmt(s.x)})}` +
                `{${fmt(s.nextX)}}\\right|\\times100\\%`
            )
            : "";

        const block = document.createElement("article");
        block.className = "step";

        block.innerHTML =
            `<div class="step-heading">
                Iteration ${s.iteration}
            </div>
            <div class="step-content">` +

            mathSection(
                "1. Given",
                tex(`x_{${s.iteration - 1}}=${fmt(s.x)}`) +
                tex(`f(x_{${s.iteration - 1}})=${fmt(s.fx)}`) +
                tex(
                    `f'(x_{${s.iteration - 1}})` +
                    `\\approx${fmt(s.derivative)}`
                )
            ) +

            mathSection(
                "2. Formula",
                tex("x_{n+1}=x_n-\\frac{f(x_n)}{f'(x_n)}") +
                tex(
                    "\\varepsilon_a=" +
                    "\\left|\\frac{x_{n+1}-x_n}{x_{n+1}}\\right|" +
                    "\\times100\\%"
                )
            ) +

            mathSection(
                "3. Substitution",
                tex(
                    `x_{${s.iteration}}=${fmt(s.x)}` +
                    `-\\frac{${fmt(s.fx)}}{${fmt(s.derivative)}}`
                )
            ) +

            mathSection(
                "4. Solution",
                tex(`x_{${s.iteration}}=${fmt(s.nextX)}`) +
                percentSub +
                percent
            ) +

            mathSection(
                "5. Final Answer",
                `<div class="work-answer">` +
                tex(
                    `\\boxed{x_{${s.iteration}}=${fmt(s.nextX)}}`
                ) +
                (
                    Number.isFinite(s.approximateErrorPercent)
                        ? tex(
                            `\\boxed{\\varepsilon_a=` +
                            `${fmt(s.approximateErrorPercent)}\\%}`
                        )
                        : "<p>Relative error undefined</p>"
                ) +
                "</div>"
            ) +

            "</div>";

        $("steps").appendChild(block);
    });

    mathRender();
    drawGraph(d);
}

// ========================================
// GRAPH UTILITIES
// ========================================

function invalidateGraph() {
    graphGeneration++;
    graphRequestId++;
    graphReady = false;
    graphBounds = null;

    clearTimeout(graphTimer);

    if (graphController) {
        graphController.abort();
        graphController = null;
    }
}

function finitePoints(points) {
    return (points || [])
        .filter(p => p && Number.isFinite(p.x))
        .sort((a, b) => a.x - b.x);
}

// Calculate y-axis bounds for the visible curve.
// Uses finite values and includes the zero line.
function getYRange(points, xMin, xMax) {
    const visible = points.filter(p =>
        p &&
        Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        p.x >= xMin &&
        p.x <= xMax
    );

    if (visible.length === 0) {
        return [-5, 5];
    }

    const values = visible.map(p => p.y);

    // Reduce the effect of extreme values near
    // discontinuities when determining the initial view.
    const sorted = [...values].sort((a, b) => a - b);

    const lowIndex = Math.floor((sorted.length - 1) * 0.01);
    const highIndex = Math.ceil((sorted.length - 1) * 0.99);

    let min = Math.min(0, sorted[lowIndex]);
    let max = Math.max(0, sorted[highIndex]);

    const padding = Math.max((max - min) * 0.12, 0.1);

    return [min - padding, max + padding];
}

// ========================================
// GRAPH API REQUEST
// ========================================

async function requestGraph(xMin, xMax, signal) {
    if (!last) {
        throw new Error("No equation has been calculated.");
    }

    const response = await fetch("/api/graph", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        signal,
        body: JSON.stringify({
            equation: last.equation,
            xMin,
            xMax,
            points: 800
        })
    });

    if (!response.ok) {
        throw new Error(
            "Unable to generate graph points. Check the Java backend."
        );
    }

    return await response.json();
}

// ========================================
// INITIAL INTERACTIVE GRAPH
// ========================================

function drawGraph(d) {
    invalidateGraph();

    if (!window.Plotly) {
        $("graphNote").textContent =
            "Plotly could not load. Check your internet connection.";
        return;
    }

    const points = finitePoints(d.graph);

    if (points.length < 2) {
        $("graphNote").textContent =
            "No graph data available.";
        return;
    }

    const generation = graphGeneration;
    const graph = $("graph");

    const xMin = points[0].x;
    const xMax = points[points.length - 1].x;

    const yRange = getYRange(points, xMin, xMax);

    graphBounds = {
        x: [xMin, xMax],
        y: yRange
    };

    const curve = {
        x: points.map(p => p.x),
        y: points.map(p => p.y),
        type: "scatter",
        mode: "lines",
        name: "f(x)",
        connectgaps: false,
        line: {
            color: "#2e72d2",
            width: 3
        },
        hovertemplate:
            "x: %{x:.3f}<br>f(x): %{y:.3f}<extra></extra>"
    };

    const rootMarker = {
        x: [d.root],
        y: [0],
        type: "scatter",
        mode: "markers",
        name: "Approximate root",
        marker: {
            color: "#e36b35",
            size: 12
        },
        hovertemplate:
            "Approximate root: %{x:.3f}<extra></extra>"
    };

    const layout = {
        autosize: true,
        height: 420,
        margin: {
            l: 65,
            r: 25,
            t: 30,
            b: 60
        },
        xaxis: {
            title: "x",
            range: [...graphBounds.x],
            showgrid: true,
            gridcolor: "#e8edf4",
            zeroline: true,
            zerolinecolor: "#777"
        },
        yaxis: {
            title: "f(x)",
            range: [...graphBounds.y],
            showgrid: true,
            gridcolor: "#e8edf4",
            zeroline: true,
            zerolinecolor: "#777"
        },
        dragmode: "pan",
        hovermode: "closest",
        showlegend: false,
        paper_bgcolor: "#ffffff",
        plot_bgcolor: "#ffffff",
        uirevision: "newton-graph"
    };

    const config = {
        responsive: true,
        displaylogo: false,
        scrollZoom: true,
        modeBarButtonsToRemove: [
            "lasso2d",
            "select2d"
        ]
    };

    Plotly.react(
        graph,
        [curve, rootMarker],
        layout,
        config
    ).then(() => {
        if (generation !== graphGeneration) return;

        graphReady = true;
        attachGraphEvents();
    }).catch(error => {
        if (generation === graphGeneration) {
            $("graphNote").textContent =
                "Unable to display graph: " + error.message;
        }
    });

    $("graphNote").textContent =
        "Drag to pan, scroll to zoom, or use Reset view.";
}

// ========================================
// DYNAMIC GRAPH RANGE
// ========================================

async function updateGraphRange() {
    if (!last || !graphReady || !window.Plotly) {
        return;
    }

    const graph = $("graph");
    const range = graph.layout?.xaxis?.range;

    if (!range || range.length !== 2) return;

    const xMin = Number(range[0]);
    const xMax = Number(range[1]);

    if (
        !Number.isFinite(xMin) ||
        !Number.isFinite(xMax) ||
        xMin >= xMax
    ) {
        return;
    }

    // Prevent unsupported ranges.
    const width = xMax - xMin;
    if (width > 600000 || width < 1e-12) {
        $("graphNote").textContent =
            "Zoom to a smaller graph range to display the function.";
        return;
    }

    const generation = graphGeneration;
    const requestId = ++graphRequestId;

    if (graphController) {
        graphController.abort();
    }

    graphController = new AbortController();

    try {
        // Add points outside the visible range
        // so small movements do not expose empty edges.
        const extra = width * 0.20;

        const points = finitePoints(
            await requestGraph(
                xMin - extra,
                xMax + extra,
                graphController.signal
            )
        );

        if (
            generation !== graphGeneration ||
            requestId !== graphRequestId
        ) {
            return;
        }

        const yRange = getYRange(points, xMin, xMax);

        // Replace only the function trace.
        // Preserve the root marker and current x-axis view.
        await Plotly.restyle(graph, {
            x: [points.map(p => p.x)],
            y: [points.map(p => p.y)]
        }, [0]);

        if (
            generation !== graphGeneration ||
            requestId !== graphRequestId
        ) {
            return;
        }

        await Plotly.relayout(graph, {
            "yaxis.range": yRange
        });

        $("graphNote").textContent =
            "Graph updated. Drag to pan or scroll to zoom.";

    } catch (error) {
        if (error.name === "AbortError") return;

        if (
            generation === graphGeneration &&
            requestId === graphRequestId
        ) {
            $("graphNote").textContent =
                "Could not extend the graph. " +
                "Check that /api/graph is available.";
        }
    }
}

// ========================================
// GRAPH NAVIGATION EVENTS
// ========================================

function scheduleGraphUpdate() {
    clearTimeout(graphTimer);

    graphTimer = setTimeout(() => {
        updateGraphRange();
    }, 180);
}

function attachGraphEvents() {
    const graph = $("graph");

    if (graphEventsAttached) return;
    if (typeof graph.on !== "function") return;

    graph.on("plotly_relayout", event => {
        if (!graphReady) return;

        const xChanged =
            event["xaxis.range[0]"] !== undefined ||
            event["xaxis.range[1]"] !== undefined ||
            event["xaxis.range"] !== undefined ||
            event["xaxis.autorange"] === true;

        if (xChanged) {
            scheduleGraphUpdate();
        }
    });

    graphEventsAttached = true;
}

// ========================================
// ZOOM IN / ZOOM OUT
// ========================================

function scaleGraph(factor) {
    if (!graphBounds || !window.Plotly || !graphReady) {
        return;
    }

    const graph = $("graph");
    const range = graph.layout?.xaxis?.range;

    if (!range || range.length !== 2) return;

    const middle = (range[0] + range[1]) / 2;
    const halfWidth = (range[1] - range[0]) * factor / 2;

    Plotly.relayout(graph, {
        "xaxis.range": [
            middle - halfWidth,
            middle + halfWidth
        ]
    });
}

$("zoomIn").onclick = () => scaleGraph(0.7);
$("zoomOut").onclick = () => scaleGraph(1.4);

// ========================================
// RESET GRAPH VIEW
// ========================================

$("resetView").onclick = () => {
    if (!graphBounds || !window.Plotly || !graphReady) {
        return;
    }

    Plotly.relayout($("graph"), {
        "xaxis.range": [...graphBounds.x],
        "yaxis.range": [...graphBounds.y]
    });

    scheduleGraphUpdate();
};

// ========================================
// EXPAND / MINIMIZE GRAPH
// ========================================

$("fullGraph").onclick = () => {
    const graph = $("graph");
    const section = graph.closest(".result-section");

    if (!section) return;

    section.classList.toggle("graph-expanded");

    const expanded =
        section.classList.contains("graph-expanded");

    $("fullGraph").textContent = expanded
        ? "Minimize graph"
        : "Expand graph";

    if (window.Plotly) {
        requestAnimationFrame(() => {
            Plotly.Plots.resize(graph);
        });
    }
};
