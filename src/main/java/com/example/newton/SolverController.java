
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
  public record Request(String equation, Double initialGuess, Double stoppingErrorPercent, Integer maxIterations) {}
  public record Step(int iteration, double x, double fx, double derivative, double nextX, double error, double approximateErrorPercent, double residual) {}
  public record PlotPoint(double x, Double y) {}
  public record Result(String equation, double root, double residual, boolean converged, String message, List<Step> steps, List<PlotPoint> graph) {}

  private List<PlotPoint> sampleGraph(Expression e, double center) {
    List<PlotPoint> points = new ArrayList<>();
    double span = Math.max(2.0, Math.abs(center) * 0.35);
    for (int i = 0; i <= 450; i++) {
      double x = center - span + 2 * span * i / 450.0;
      Double y = null;
      try {
        double v = e.setVariable("x", x).evaluate();
        if (Double.isFinite(v)) y = v;
      } catch (Exception ignored) { }
      points.add(new PlotPoint(x, y));
    }
    return points;
  }
  private Result result(String equation, double root, double residual, boolean converged,
                        String message, List<Step> steps, Expression expression) {
    return new Result(equation, root, residual, converged, message, steps, sampleGraph(expression, root));
  }

  private Expression parse(String raw) {
    if(raw == null || raw.isBlank() || raw.length()>250) throw new IllegalArgumentException("Enter an equation (maximum 250 characters).");
    String eq=raw.trim().replace('×','*').replace('−','-').replace("π","pi");
    if(eq.contains("=")) throw new IllegalArgumentException("Enter f(x) only, without '= 0'.");
    try { return new ExpressionBuilder(eq).variable("x").build(); }
    catch(Exception ex) { throw new IllegalArgumentException("Invalid equation. Use x^3-x-2, sin(x), cos(x), log(x), or exp(x)."); }
  }
  private double value(Expression e,double x) {
    double v=e.setVariable("x",x).evaluate();
    if(!Double.isFinite(v)) throw new IllegalArgumentException("Function is undefined at x = "+x);
    return v;
  }
  private double derivative(Expression e,double x) {
    double h=Math.cbrt(Math.ulp(1.0))*Math.max(1.0,Math.abs(x));
    return (value(e,x+h)-value(e,x-h))/(2*h);
  }
  @PostMapping("/solve")
  public Result solve(@RequestBody Request request) {
    try {
      if(request==null || request.initialGuess()==null || request.stoppingErrorPercent()==null || request.maxIterations()==null) throw new IllegalArgumentException("Complete all input fields.");
      double x=request.initialGuess(),tol=request.stoppingErrorPercent(); int max=request.maxIterations();
      if(!Double.isFinite(x)||!Double.isFinite(tol)||tol<=0||tol>100) throw new IllegalArgumentException("Stopping error must be greater than 0 and at most 100%.");
      if(max<1||max>500) throw new IllegalArgumentException("Maximum iterations must be between 1 and 500.");
      Expression e=parse(request.equation()); List<Step> steps=new ArrayList<>();
      double fx=value(e,x);
      if(fx == 0.0) return result(request.equation(),x,0.0,true,"Initial guess is an exact root.",steps,e);
      for(int i=1;i<=max;i++) {
        double d=derivative(e,x);
        if(!Double.isFinite(d)||Math.abs(d)<1e-12) return result(request.equation(),x,Math.abs(fx),false,"Derivative is zero or too small. Try another initial guess.",steps,e);
        double next=x-fx/d;
        if(!Double.isFinite(next)) return result(request.equation(),x,Math.abs(fx),false,"Calculation overflowed. Try another initial guess.",steps,e);
        double error=Math.abs(next-x);
        double nextFx;
        try {nextFx=value(e,next);} catch(Exception ex) {return result(request.equation(),x,Math.abs(fx),false,"Function is undefined at the next approximation. Try another initial guess.",steps,e);}
        double approximateErrorPercent = next == 0.0 ? (error == 0.0 ? 0.0 : Double.NaN) : Math.abs((next - x) / next) * 100.0;
        steps.add(new Step(i,x,fx,d,next,error,approximateErrorPercent,Math.abs(nextFx)));
        x=next; fx=nextFx;
        if(Double.isFinite(approximateErrorPercent) && approximateErrorPercent<=tol) return result(request.equation(),x,Math.abs(fx),true,"Stopping error reached successfully.",steps,e);
      }
      return result(request.equation(),x,Math.abs(fx),false,"Maximum iterations reached before the requested stopping error was met.",steps,e);
    } catch(IllegalArgumentException ex) {throw new ResponseStatusException(HttpStatus.BAD_REQUEST,ex.getMessage());}
      catch(Exception ex) {throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Could not evaluate the equation. Check its syntax and domain.");}
  }
}
