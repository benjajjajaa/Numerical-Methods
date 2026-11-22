
const $ = id => document.getElementById(id);

let last = null;
let graphBounds = null;
let graphData = [];
let graphEventsAttached = false;
let graphUpdating = false;

const fmt = n =>
    Number.isFinite(n) ? Number(n).toFixed(3) : String(n);

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

const mathRender = () => {
    if (window.MathJax?.typesetPromise) {
        window.MathJax.typesetPromise([
            $("solutionOverview"),
            $("steps")
        ]).catch(console.error);
    }
};

// ========================================
// COPY AND DOWNLOAD RESULTS
// ========================================

function textResult(d) {
    return [
        "NEWTON-RAPHSON SOLUTION",
        `Equation: ${d.equation}`,
        `Approximate root: ${fmt(d.root)}`,
        `Residual: ${fmt(d.residual)}`,
        `Status: ${d.message}`,
        `Iterations: ${d.steps.length}`,
        "",
        "Formula: x_next = x - f(x) / f'(x)",
        "Approximate relative error:",
        "Ea = |(Present - Previous) / Present| * 100%",
        "",
        ...d.steps.map(s => [
            `Iteration ${s.iteration}`,
            `x = ${fmt(s.x)}`,
            `f(x) = ${fmt(s.fx)}`,
            `f'(x) = ${fmt(s.derivative)}`,
            `Next x = ${fmt(s.nextX)}`,
            `Approximate error = ${approxFmt(s.approximateErrorPercent)}%`,
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

        const start =
            field.selectionStart ?? field.value.length;

        const end =
            field.selectionEnd ?? start;

        const insertion = button.dataset.insert || "";

        if (button.dataset.backspace) {
            if (start === end && start > 0) {
                field.setRangeText(
                    "",
                    start - 1,
                    end,
                    "end"
                );
            } else {
                field.setRangeText("", start, end, "end");
            }
        } else {
            field.setRangeText(
                insertion,
                start,
                end,
                "end"
            );
        }

        field.focus();
    });
});

// ========================================
// SOLVE EQUATION
// ========================================

$("solverForm").addEventListener("submit", async e => {
    e.preventDefault();

    $("message").textContent = "";
    $("solveBtn").disabled = true;

    try {
        const response = await fetch("/api/solve", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                equation: $("equation").value,
                initialGuess: Number($("guess").value),
                stoppingErrorPercent:
                    Number($("tolerance").value),
                maxIterations:
                    Number($("iterations").value)
            })
        });

        if (!response.ok) {
            const err = await response.json();

            throw Error(
                err.detail ||
                err.message ||
                "Unable to calculate. Check your inputs."
            );
        }

        last = await response.json();
        render(last);

    } catch (err) {
        $("message").textContent = err.message;
        $("results").classList.add("hidden");
        $("placeholder").classList.remove("hidden");

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
    graphBounds = null;
    graphData = [];
};

// ========================================
// COPY RESULTS
// ========================================

$("copyBtn").onclick = async () => {
    if (!last) return;

    try {
        await navigator.clipboard.writeText(
            textResult(last)
        );

        $("copyBtn").textContent = "Copied!";

        setTimeout(() => {
            $("copyBtn").textContent = "Copy results";
        }, 1500);

    } catch (e) {
        $("message").textContent =
            "Copy failed. Use Download instead.";
    }
};

// ========================================
// DOWNLOAD RESULTS
// ========================================

$("downloadBtn").onclick = () => {
    if (!last) return;

    const a = document.createElement("a");

    const url = URL.createObjectURL(
        new Blob([textResult(last)], {
            type: "text/plain"
        })
    );

    a.href = url;
    a.download = "newton-raphson-solution.txt";
    a.click();

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
};

// ========================================
// DISPLAY RESULTS
// ========================================

function render(d) {
    $("results").classList.remove("hidden");
    $("placeholder").classList.add("hidden");

    $("root").textContent = fmt(d.root);

    $("residual").textContent =
        smallNonzero(d.residual);

    $("count").textContent = d.steps.length;

    $("status").textContent = d.message;

    $("status").className =
        d.converged ? "good" : "bad";

    $("rows").replaceChildren();
    $("steps").replaceChildren();

    const eq = safeEq(d.equation);

    $("solutionOverview").innerHTML =
        "<h3>Given and Formulas</h3>" +

        tex(`f(x)=\\text{${eq}}`) +

        tex(`x_0=${fmt(Number($("guess").value))}`) +

        tex(
            `\\varepsilon_{\\mathrm{stop}}=` +
            `${escapeHtml($("tolerance").value)}\\%`
        ) +

        mathSection(
            "Newton-Raphson Formula",
            tex(
                "x_{n+1}=x_n-" +
                "\\frac{f(x_n)}{f'(x_n)}"
            )
        ) +

        mathSection(
            "Approximate Relative Error",
            tex(
                "\\varepsilon_a=" +
                "\\left|" +
                "\\frac{x_{n+1}-x_n}{x_{n+1}}" +
                "\\right|\\times100\\%"
            )
        ) +

        `<p class="small-note">
            Stop when the unrounded approximate
            relative error is less than or equal
            to the percentage entered by the user.
            Calculations use full precision.
            Displayed values use three decimal places.
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

        // Approximate error
        const percent =
            Number.isFinite(s.approximateErrorPercent)
                ? tex(
                    `\\varepsilon_a=` +
                    `${numberTex(s.approximateErrorPercent)}\\%`
                )
                : `<p class="small-note">
                    Relative error is undefined
                    because the new approximation is zero.
                  </p>`;

        const percentSub =
            Math.abs(s.nextX) > 0
                ? tex(
                    `\\varepsilon_a=` +
                    `\\left|\\frac{` +
                    `${fmt(s.nextX)}-(${fmt(s.x)})` +
                    `}{${fmt(s.nextX)}}\\right|` +
                    `\\times100\\%`
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

                tex(
                    `x_{${s.iteration - 1}}=${fmt(s.x)}`
                ) +

                tex(
                    `f(x_{${s.iteration - 1}})=${fmt(s.fx)}`
                ) +

                tex(
                    `f'(x_{${s.iteration - 1}})` +
                    `\\approx${fmt(s.derivative)}`
                )
            ) +

            mathSection(
                "2. Formula",

                tex(
                    "x_{n+1}=x_n-" +
                    "\\frac{f(x_n)}{f'(x_n)}"
                ) +

                tex(
                    "\\varepsilon_a=" +
                    "\\left|" +
                    "\\frac{x_{n+1}-x_n}{x_{n+1}}" +
                    "\\right|\\times100\\%"
                )
            ) +

            mathSection(
                "3. Substitution",

                tex(
                    `x_{${s.iteration}}=` +
                    `${fmt(s.x)}-` +
                    `\\frac{${fmt(s.fx)}}` +
                    `{${fmt(s.derivative)}}`
                )
            ) +

            mathSection(
                "4. Solution",

                tex(
                    `x_{${s.iteration}}=${fmt(s.nextX)}`
                ) +

                percentSub +
                percent
            ) +

            mathSection(
                "5. Final Answer",

                `<div class="work-answer">` +

                tex(
                    `\\boxed{x_{${s.iteration}}=` +
                    `${fmt(s.nextX)}}`
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
// INTERACTIVE GRAPH
// ========================================

function drawGraph(d) {
    const points = (d.graph || [])
        .filter(p =>
            p &&
            Number.isFinite(p.x) &&
            Number.isFinite(p.y)
        )
        .sort((a, b) => a.x - b.x);

    if (points.length < 2) {
        $("graphNote").textContent =
            "No graph data available.";
        return;
    }

    if (!window.Plotly) {
        $("graphNote").textContent =
            "Plotly could not load. Check your internet connection.";
        return;
    }

    graphData = points;

    const root = d.root;

    const xValues = points.map(p => p.x);
    const yValues = points.map(p => p.y);

    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);

    // Focus the graph near the calculated root.
    const availableWidth = xMax - xMin;

    const halfWidth = Math.max(
        availableWidth * 0.35,
        0.5
    );

    let left = Math.max(
        xMin,
        root - halfWidth
    );

    let right = Math.min(
        xMax,
        root + halfWidth
    );

    if (right <= left) {
        left = xMin;
        right = xMax;
    }

    const visible = points.filter(p =>
        p.x >= left && p.x <= right
    );

    const visibleY = visible.map(p => p.y);

    let yMin = Math.min(0, ...visibleY);
    let yMax = Math.max(0, ...visibleY);

    const yPadding = Math.max(
        (yMax - yMin) * 0.15,
        0.1
    );

    yMin -= yPadding;
    yMax += yPadding;

    graphBounds = {
        x: [left, right],
        y: [yMin, yMax]
    };

    const trace = {
        x: xValues,
        y: yValues,
        type: "scatter",
        mode: "lines",
        name: "f(x)",

        line: {
            color: "#2e72d2",
            width: 3
        },

        connectgaps: false
    };

    const marker = {
        x: [root],
        y: [0],

        type: "scatter",
        mode: "markers",

        name: "Approximate root",

        marker: {
            color: "#e36b35",
            size: 12
        }
    };

    const layout = {
        autosize: true,
        height: 420,

        margin: {
            l: 65,
            r: 25,
            t: 25,
            b: 60
        },

        xaxis: {
            title: "x",
            range: graphBounds.x,
            showgrid: true,
            zeroline: true,
            gridcolor: "#e8edf4",
            zerolinecolor: "#777"
        },

        yaxis: {
            title: "f(x)",
            range: graphBounds.y,
            showgrid: true,
            zeroline: true,
            gridcolor: "#e8edf4",
            zerolinecolor: "#777"
        },

        dragmode: "pan",
        hovermode: "closest",
        showlegend: false,

        paper_bgcolor: "#ffffff",
        plot_bgcolor: "#ffffff"
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

    const graph = $("graph");

    Plotly.react(
        graph,
        [trace, marker],
        layout,
        config
    ).then(() => {
        attachGraphEvents();
    });

    $("graphNote").textContent =
        "Drag to pan, scroll to zoom, or reset the graph.";
}

// ========================================
// AUTO ADJUST Y-AXIS
// ========================================

function adjustYAxis() {
    if (!window.Plotly || graphUpdating) return;

    const graph = $("graph");

    if (!graph?.layout?.xaxis?.range) return;

    const [left, right] = graph.layout.xaxis.range;

    const visible = graphData.filter(p =>
        p.x >= left && p.x <= right
    );

    if (visible.length < 2) return;

    const yValues = visible.map(p => p.y);

    let yMin = Math.min(0, ...yValues);
    let yMax = Math.max(0, ...yValues);

    const padding = Math.max(
        (yMax - yMin) * 0.15,
        0.1
    );

    yMin -= padding;
    yMax += padding;

    graphUpdating = true;

    Plotly.relayout(graph, {
        "yaxis.range": [yMin, yMax]
    }).finally(() => {
        graphUpdating = false;
    });
}

// ========================================
// GRAPH EVENTS
// ========================================

function attachGraphEvents() {
    const graph = $("graph");

    if (graphEventsAttached) return;

    if (typeof graph.on !== "function") return;

    graph.on("plotly_relayout", event => {
        if (graphUpdating) return;

        if (
            event["xaxis.range[0]"] !== undefined ||
            event["xaxis.range[1]"] !== undefined ||
            event["xaxis.range"] !== undefined
        ) {
            adjustYAxis();
        }
    });

    graphEventsAttached = true;
}

// ========================================
// ZOOM CONTROLS
// ========================================

function scaleGraph(factor) {
    if (!graphBounds || !window.Plotly) return;

    const graph = $("graph");
    const layout = graph.layout;

    if (!layout?.xaxis?.range) return;

    const scaled = range => {
        const middle =
            (range[0] + range[1]) / 2;

        const half =
            (range[1] - range[0]) * factor / 2;

        return [
            middle - half,
            middle + half
        ];
    };

    Plotly.relayout(graph, {
        "xaxis.range": scaled(layout.xaxis.range)
    }).then(adjustYAxis);
}

$("zoomIn").onclick = () => {
    scaleGraph(0.7);
};

$("zoomOut").onclick = () => {
    scaleGraph(1.4);
};

// ========================================
// RESET GRAPH VIEW
// ========================================

$("resetView").onclick = () => {
    if (!graphBounds || !window.Plotly) return;

    Plotly.relayout($("graph"), {
        "xaxis.range": [...graphBounds.x],
        "yaxis.range": [...graphBounds.y]
    });
};

// ========================================
// EXPAND / MINIMIZE GRAPH
// ========================================

$("fullGraph").onclick = () => {
    const graph = $("graph");

    const section =
        graph.closest(".result-section");

    section.classList.toggle("graph-expanded");

    const expanded =
        section.classList.contains("graph-expanded");

    $("fullGraph").textContent =
        expanded
            ? "Minimize graph"
            : "Expand graph";

    if (window.Plotly) {
        Plotly.Plots.resize(graph);
    }
};
