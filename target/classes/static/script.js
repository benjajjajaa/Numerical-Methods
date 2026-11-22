const $=id=>document.getElementById(id);let last=null;
const fmt=n=>Number.isFinite(n)?Number(n).toFixed(3):String(n);
const textResult=d=>["NEWTON-RAPHSON SOLUTION",`Equation: ${d.equation}`,`Approximate root: ${fmt(d.root)}`,`Residual: ${fmt(d.residual)}`,`Status: ${d.message}`,`Iterations: ${d.steps.length}`,"","Formula: x_next = x - f(x) / f'(x)","Derivative estimated using central differences.","",...d.steps.map(s=>`Iteration ${s.iteration}: x=${fmt(s.x)}, f(x)=${fmt(s.fx)}, f'(x)=${fmt(s.derivative)}\nx_next=${fmt(s.x)} - (${fmt(s.fx)}) / (${fmt(s.derivative)}) = ${fmt(s.nextX)}\nAbsolute change=${fmt(s.error)}, residual=${fmt(s.residual)}\n`)].join('\n');
document.querySelectorAll('[data-insert], [data-backspace]').forEach(button=>button.addEventListener('click',()=>{const field=$('equation'),start=field.selectionStart??field.value.length,end=field.selectionEnd??start;let insertion=button.dataset.insert||'';if(button.dataset.backspace){if(start===end&&start>0){field.setRangeText('',start-1,end,'end')}else field.setRangeText('',start,end,'end')}else{field.setRangeText(insertion,start,end,'end')}field.focus()}));
$('solverForm').addEventListener('submit',async e=>{e.preventDefault();$('message').textContent='';$('solveBtn').disabled=true;try{const response=await fetch('/api/solve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({equation:$('equation').value,initialGuess:Number($('guess').value),stoppingErrorPercent:Number($('tolerance').value),maxIterations:Number($('iterations').value)})});if(!response.ok){const err=await response.json();throw Error(err.detail||err.message||'Unable to calculate. Check your inputs.')}last=await response.json();render(last)}catch(err){$('message').textContent=err.message;$('results').classList.add('hidden');$('placeholder').classList.remove('hidden')}finally{$('solveBtn').disabled=false}});
$('resetBtn').onclick=()=>{ $('solverForm').reset();$('results').classList.add('hidden');$('placeholder').classList.remove('hidden');$('message').textContent='';last=null};
$('copyBtn').onclick=async()=>{if(!last)return;try{await navigator.clipboard.writeText(textResult(last));$('copyBtn').textContent='Copied!';setTimeout(()=>$('copyBtn').textContent='Copy results',1500)}catch(e){$('message').textContent='Copy failed. Use Download instead.'}};
$('downloadBtn').onclick=()=>{if(!last)return;const a=document.createElement('a'),url=URL.createObjectURL(new Blob([textResult(last)],{type:'text/plain'}));a.href=url;a.download='newton-raphson-solution.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
const approxFmt = n => n === null || n === undefined || !Number.isFinite(n) ? 'Undefined' : Number(n).toFixed(3);
const smallNonzero = n => Number.isFinite(n) && n !== 0 && Math.abs(n) < 0.0005 ? '<0.001' : fmt(n);
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fraction = (top,bottom) => `<span class="frac"><span class="frac-top">${top}</span><span class="frac-bottom">${bottom}</span></span>`;
const line = html => `<div class="mathline">${html}</div>`;
const part = (heading, content) => `<section class="work-part"><h4>${heading}</h4>${content}</section>`;
function substitutedEquation(eq,x){
  // This is a readable textual substitution, not a symbolic derivative.
  // Avoid replacing the x inside function names such as exp(x).
  return escapeHtml(eq).replace(/\bx\b/g,`(${fmt(x)})`);
}
// MathJax displays uniform, properly aligned mathematics. All arithmetic remains full precision in Java.
const tex = expression => `<div class="mathline">\\[${expression}\\]</div>`;
const mathSection=(heading,contents)=>`<section class="work-part"><h4>${heading}</h4>${contents}</section>`;
const numberTex=n=>Number.isFinite(n)?Number(n).toFixed(3):'\\text{Undefined}';
const safeEq=eq=>String(eq).replace(/\\/g,'').replace(/[<>]/g,'');
const mathRender=()=>{if(window.MathJax?.typesetPromise)window.MathJax.typesetPromise([$('solutionOverview'),$('steps')]).catch(console.error)};
function render(d){
 $('results').classList.remove('hidden');$('placeholder').classList.add('hidden');
 $('root').textContent=fmt(d.root);$('residual').textContent=smallNonzero(d.residual);
 $('count').textContent=d.steps.length;$('status').textContent=d.message;
 $('status').className=d.converged?'good':'bad';
 $('rows').replaceChildren();$('steps').replaceChildren();
 const eq=safeEq(d.equation);
 $('solutionOverview').innerHTML='<h3>Given and formulas</h3>'+tex(`f(x) = \\text{${eq}}`)+
 tex(`x_0=${fmt(Number($('guess').value))}`)+
 tex(`\\varepsilon_{\\mathrm{stop}}=${escapeHtml($('tolerance').value)}\\%`)+
 mathSection('Newton–Raphson formula',tex('x_{n+1}=x_n-\\frac{f(x_n)}{f\\prime(x_n)}'))+
 mathSection('Approximate relative error',tex('\\varepsilon_a=\\left|\\frac{x_{n+1}-x_n}{x_{n+1}}\\right|\\times100\\%'))+
 `<p class="small-note">Stop when the unrounded approximate relative error is at most the percentage you entered. Derivatives are estimated using central differences. Values are displayed to three decimal places, but calculations use full precision.</p>`;
 d.steps.forEach(s=>{
  const tr=document.createElement('tr');
  [String(s.iteration),fmt(s.x),fmt(s.fx),fmt(s.derivative),fmt(s.nextX),approxFmt(s.approximateErrorPercent)].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.appendChild(td)});
  $('rows').appendChild(tr);
  const percent=Number.isFinite(s.approximateErrorPercent)?tex(`\\varepsilon_a=${numberTex(s.approximateErrorPercent)}\\%`):'<p class="small-note">Relative error is undefined because the new approximation is zero.</p>';
  const percentSub=Math.abs(s.nextX)>0?tex(`\\varepsilon_a=\\left|\\frac{${fmt(s.nextX)}-(${fmt(s.x)})}{${fmt(s.nextX)}}\\right|\\times100\\%`):'';
  const block=document.createElement('article');block.className='step';
  block.innerHTML=`<div class="step-heading">Iteration ${s.iteration}</div><div class="step-content">`+
   mathSection('1. Given',tex(`x_${s.iteration-1}=${fmt(s.x)}`)+tex(`f(x_${s.iteration-1})=${fmt(s.fx)}`)+tex(`f\\prime(x_${s.iteration-1})\\approx ${fmt(s.derivative)}`))+
   mathSection('2. Formula',tex('x_{n+1}=x_n-\\frac{f(x_n)}{f\\prime(x_n)}')+tex('\\varepsilon_a=\\left|\\frac{x_{n+1}-x_n}{x_{n+1}}\\right|\\times100\\%'))+
   mathSection('3. Substitution',tex(`x_${s.iteration}=${fmt(s.x)}-\\frac{${fmt(s.fx)}}{${fmt(s.derivative)}}`))+
   mathSection('4. Solution',tex(`x_${s.iteration}=${fmt(s.nextX)}`)+percentSub+percent)+
   mathSection('5. Final answer',`<div class="work-answer">${tex(`\\boxed{x_${s.iteration}=${fmt(s.nextX)}}`)}${Number.isFinite(s.approximateErrorPercent)?tex(`\\boxed{\\varepsilon_a=${fmt(s.approximateErrorPercent)}\\%}`):'<p>Relative error undefined</p>'}</div>`)+
   '</div>';
  $('steps').appendChild(block);
 });
 mathRender();drawGraph(d);
}
let graphBounds=null;
function drawGraph(d){
 const points=(d.graph||[]).filter(p=>p&&Number.isFinite(p.x));
 const valid=points.filter(p=>Number.isFinite(p.y));
 if(valid.length<2){$('graphNote').textContent='No finite graph values near this root.';return;}
 if(!window.Plotly){$('graphNote').textContent='Interactive graph library could not load. Check your internet connection.';return;}
 const ys=valid.map(p=>p.y).sort((a,b)=>a-b);
 let ymin=Math.min(0,ys[Math.floor(ys.length*.03)]),ymax=Math.max(0,ys[Math.floor(ys.length*.97)]);
 const pad=Math.max(.001,(ymax-ymin)*.15);ymin-=pad;ymax+=pad;
 graphBounds={x:[points[0].x,points[points.length-1].x],y:[ymin,ymax]};
 const trace={x:points.map(p=>p.x),y:points.map(p=>p.y),type:'scatter',mode:'lines',name:'f(x)',line:{color:'#2e72d2',width:2.5},connectgaps:false};
 const marker={x:[d.root],y:[Number.isFinite(d.residual)?valid.reduce((a,b)=>Math.abs(a.x-d.root)<Math.abs(b.x-d.root)?a:b).y:0],type:'scatter',mode:'markers',name:'Approximation',marker:{color:'#e36b35',size:11}};
 Plotly.react('graph',[trace,marker],{margin:{l:58,r:20,t:15,b:48},height:370,hovermode:'closest',dragmode:'pan',xaxis:{title:'x',range:graphBounds.x,zeroline:true,gridcolor:'#e8edf4'},yaxis:{title:'f(x)',range:graphBounds.y,zeroline:true,gridcolor:'#e8edf4'},paper_bgcolor:'#fff',plot_bgcolor:'#fff',showlegend:false},{responsive:true,displaylogo:false,scrollZoom:true,modeBarButtonsToRemove:['lasso2d','select2d']});
 $('graphNote').textContent='Drag to pan; scroll to zoom; use the toolbar or Reset view to restore the graph.';
}
function scaleGraph(factor){if(!graphBounds||!window.Plotly)return;const g=$('graph'),l=g.layout;if(!l?.xaxis?.range||!l?.yaxis?.range)return;const scaled=arr=>{const m=(arr[0]+arr[1])/2,h=(arr[1]-arr[0])*factor/2;return[m-h,m+h]};Plotly.relayout(g,{'xaxis.range':scaled(l.xaxis.range),'yaxis.range':scaled(l.yaxis.range)});}
$('zoomIn').onclick=()=>scaleGraph(.7);
$('zoomOut').onclick=()=>scaleGraph(1.4);
$('resetView').onclick=()=>{if(graphBounds&&window.Plotly)Plotly.relayout('graph',{'xaxis.range':graphBounds.x,'yaxis.range':graphBounds.y});};
$('fullGraph').onclick=()=>{const el=$('graph').closest('.result-section');el.classList.toggle('graph-expanded');$('fullGraph').textContent=el.classList.contains('graph-expanded')?'Minimize graph':'Expand graph';if(window.Plotly)Plotly.Plots.resize($('graph'));};
