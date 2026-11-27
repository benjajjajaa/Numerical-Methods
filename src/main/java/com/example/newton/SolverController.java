
package com.example.newton;

import net.objecthunter.exp4j.Expression;
import net.objecthunter.exp4j.ExpressionBuilder;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@RestController
@RequestMapping("/api")
public class SolverController {

    public record Request(
        String equation,
        Double initialGuess,
        Double stoppingErrorPercent,
        Integer maxIterations
    ) {}

    public record GraphRequest(
        String equation,
        Double xMin,
        Double xMax,
        Integer points
    ) {}

    public record Step(
        int iteration,
        double x,
        double fx,
        double derivative,
        double nextX,
        double error,
        double approximateErrorPercent,
        double residual
    ) {}

    public record PlotPoint(double x, Double y) {}

    public record Result(
        String equation,
        double root,
        double residual,
        boolean converged,
        String message,
        List<Step> steps,
        List<PlotPoint> graph
    ) {}

    // Parse the mathematical equation.
    private Expression parse(String raw) {
        if (raw == null || raw.isBlank() || raw.length() > 250) {
            throw new IllegalArgumentException(
                "Enter an equation (maximum 250 characters)."
            );
        }

        String eq = raw.trim()
            .replace('×', '*')
            .replace('−', '-')
            .replace("π", "pi");

        eq = eq.replaceAll("\\blog\\s*\\(", "log10(");
        eq = eq.replaceAll("\\bln\\s*\\(", "log(");

        if (eq.contains("=")) {
            throw new IllegalArgumentException(
                "Enter f(x) only, without '= 0'."
            );
        }

        try {
            return new ExpressionBuilder(eq)
                .variable("x")
                .build();
        } catch (Exception ex) {
            throw new IllegalArgumentException(
                "Invalid equation. Check the mathematical syntax."
            );
        }
    }

    private double value(Expression e, double x) {
        double v = e.setVariable("x", x).evaluate();

        if (!Double.isFinite(v)) {
            throw new IllegalArgumentException(
                "Function is undefined at x = " + x
            );
        }

        return v;
    }

    // Numerical derivative using central differences.
    private double derivative(Expression e, double x) {
        double h = Math.cbrt(Math.ulp(1.0))
            * Math.max(1.0, Math.abs(x));

        return (value(e, x + h) - value(e, x - h))
            / (2.0 * h);
    }

    // Generate graph points for any requested x-range.
    private List<PlotPoint> sampleGraph(
        Expression e,
        double xMin,
        double xMax,
        int count
    ) {
        List<PlotPoint> result = new ArrayList<>();

        for (int i = 0; i <= count; i++) {
            double x = xMin
                + (xMax - xMin) * i / (double) count;

            Double y = null;

            try {
                double v = e.setVariable("x", x).evaluate();

                if (Double.isFinite(v)) {
                    y = v;
                }
            } catch (Exception ignored) {
                // Undefined points create gaps in the graph.
            }

            result.add(new PlotPoint(x, y));
        }

        return result;
    }

    // New endpoint for interactive graph navigation.
    @PostMapping("/graph")
    public List<PlotPoint> graph(
        @RequestBody GraphRequest request
    ) {
        try {
            if (request == null
                || request.xMin() == null
                || request.xMax() == null) {

                throw new IllegalArgumentException(
                    "Graph range is required."
                );
            }

            double min = request.xMin();
            double max = request.xMax();

            if (!Double.isFinite(min)
                || !Double.isFinite(max)
                || min >= max
                || max - min > 1_000_000) {

                throw new IllegalArgumentException(
                    "Invalid graph range."
                );
            }

            int count = request.points() == null
                ? 600
                : Math.max(100, Math.min(1500, request.points()));

            Expression e = parse(request.equation());

            return sampleGraph(e, min, max, count);

        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                ex.getMessage()
            );
        }
    }

    // Initial graph centered around the calculated root.
    private Result result(
        String equation,
        double root,
        double residual,
        boolean converged,
        String message,
        List<Step> steps,
        Expression expression
    ) {
        double span = Math.max(
            2.0,
            Math.abs(root) * 0.35
        );

        return new Result(
            equation,
            root,
            residual,
            converged,
            message,
            steps,
            sampleGraph(
                expression,
                root - span,
                root + span,
                600
            )
        );
    }

    @PostMapping("/solve")
    public Result solve(@RequestBody Request request) {
        try {
            if (request == null
                || request.initialGuess() == null
                || request.stoppingErrorPercent() == null
                || request.maxIterations() == null) {

                throw new IllegalArgumentException(
                    "Complete all input fields."
                );
            }

            double x = request.initialGuess();
            double tol = request.stoppingErrorPercent();
            int max = request.maxIterations();

            if (!Double.isFinite(x)
                || !Double.isFinite(tol)
                || tol <= 0
                || tol > 100) {

                throw new IllegalArgumentException(
                    "Stopping error must be greater than 0 and at most 100%."
                );
            }

            if (max < 1 || max > 500) {
                throw new IllegalArgumentException(
                    "Maximum iterations must be between 1 and 500."
                );
            }

            Expression e = parse(request.equation());
            List<Step> steps = new ArrayList<>();

            double fx = value(e, x);

            if (fx == 0.0) {
                return result(
                    request.equation(), x, 0.0, true,
                    "Initial guess is an exact root.",
                    steps, e
                );
            }

            for (int i = 1; i <= max; i++) {
                double d = derivative(e, x);

                if (!Double.isFinite(d)
                    || Math.abs(d) < 1e-12) {

                    return result(
                        request.equation(), x, Math.abs(fx),
                        false,
                        "Derivative is zero or too small. Try another initial guess.",
                        steps, e
                    );
                }

                double next = x - fx / d;

                if (!Double.isFinite(next)) {
                    return result(
                        request.equation(), x, Math.abs(fx),
                        false,
                        "Calculation overflowed. Try another initial guess.",
                        steps, e
                    );
                }

                double error = Math.abs(next - x);

                double nextFx;

                try {
                    nextFx = value(e, next);
                } catch (Exception ex) {
                    return result(
                        request.equation(), x, Math.abs(fx),
                        false,
                        "Function is undefined at the next approximation.",
                        steps, e
                    );
                }

                double approximateErrorPercent =
                    next == 0.0
                        ? (error == 0.0 ? 0.0 : Double.NaN)
                        : Math.abs((next - x) / next) * 100.0;

                steps.add(new Step(
                    i,
                    x,
                    fx,
                    d,
                    next,
                    error,
                    approximateErrorPercent,
                    Math.abs(nextFx)
                ));

                x = next;
                fx = nextFx;

                if (Double.isFinite(approximateErrorPercent)
                    && approximateErrorPercent <= tol) {

                    return result(
                        request.equation(), x, Math.abs(fx),
                        true,
                        "Stopping error reached successfully.",
                        steps, e
                    );
                }
            }

            return result(
                request.equation(), x, Math.abs(fx),
                false,
                "Maximum iterations reached before the requested stopping error was met.",
                steps, e
            );

        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                ex.getMessage()
            );
        } catch (Exception ex) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Could not evaluate the equation. Check its syntax and domain."
            );
        }
    }
}
