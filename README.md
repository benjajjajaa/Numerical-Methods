# Newton-Raphson Numerical Solver

A Java Spring Boot web application for finding approximate roots with Newton-Raphson iteration. Includes a browser UI, step-by-step results, iteration table, graph, and text export.

## Run in GitHub Codespaces

1. Open the repository in **Code > Codespaces > Create codespace on main**.
2. Open the terminal in the repository root (the directory containing `pom.xml`).
3. Run `mvn spring-boot:run`.
4. In Codespaces, open the **Ports** tab and open the forwarded **8080** port in your browser. The port can remain private for personal use.

Requires Java 17+ and Maven (both usually available in standard Java Codespaces images). Maven will download dependencies the first time.

## Supported input

Examples: `x^3-x-2`, `x^2-4`, `cos(x)-x`, `exp(x)-3*x`, `log(x)-1`.
Use `*` for multiplication and `^` for powers. Enter the left-hand function f(x), not `f(x)=0`.

## Numerical method

`x_next = x - f(x)/f'(x)`

The derivative is approximated by central differences, not symbolic differentiation:
`f'(x) ≈ (f(x+h)-f(x-h))/(2h)`, where `h = cbrt(machine epsilon)*max(1,abs(x))`.

Convergence requires BOTH `abs(x_next-x) <= tolerance` and `abs(f(x_next)) <= tolerance`. Newton-Raphson is not guaranteed to converge. Near-zero derivatives, undefined functions, and iteration limits are handled. The browser graph supports common expressions and may be unavailable for some valid backend expressions.

## Main files

- `src/main/java/com/example/newton/Application.java` – server entry point
- `src/main/java/com/example/newton/SolverController.java` – REST endpoint and algorithm
- `src/main/resources/static/index.html` – user interface
- `src/main/resources/static/style.css` – styling
- `src/main/resources/static/script.js` – UI, graph, export

## Test example

Equation: `x^3-x-2`; initial guess: `1.5`; tolerance: `0.000001`; maximum iterations: `50`. Expected approximate root: `1.5213797068`.
