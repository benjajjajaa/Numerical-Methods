const $=id=>document.getElementById(id);let last=null;
const fmt=n=>Number.isFinite(n)?Number(n).toFixed(3):String(n);
const textResult=d=>["NEWTON-RAPHSON SOLUTION",`Equation: ${d.equation}`,`Approximate root: ${fmt(d.root)}`,`Residual: ${fmt(d.residual)}`,`Status: ${d.message}`,`Iterations: ${d.steps.length}`,"","Formula: x_next = x - f(x) / f'(x)","Derivative estimated using central differences.","",...d.steps.map(s=>`Iteration ${s.iteration}: x=${fmt(s.x)}, f(x)=${fmt(s.fx)}, f'(x)=${fmt(s.derivative)}\nx_next=${fmt(s.x)} - (${fmt(s.fx)}) / (${fmt(s.derivative)}) = ${fmt(s.nextX)}\nAbsolute change=${fmt(s.error)}, residual=${fmt(s.residual)}\n`)].join('\n');
document.querySelectorAll('[data-insert], [data-backspace]').forEach(button=>button.addEventListener('click',()=>{const field=$('equation'),start=field.selectionStart??field.value.length,end=field.selectionEnd??start;let insertion=button.dataset.insert||'';if(button.dataset.backspace){if(start===end&&start>0){field.setRangeText('',start-1,end,'end')}else field.setRangeText('',start,end,'end')}else{field.setRangeText(insertion,start,end,'end')}field.focus()}));
$('solverForm').addEventListener('submit',async e=>{e.preventDefault();$('message').textContent='';$('solveBtn').disabled=true;try{const response=await fetch('/api/solve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({equation:$('equation').value,initialGuess:Number($('guess').value),tolerance:Number($('tolerance').value),maxIterations:Number($('iterations').value)})});if(!response.ok){const err=await response.json();throw Error(err.detail||err.message||'Unable to calculate. Check your inputs.')}last=await response.json();render(last)}catch(err){$('message').textContent=err.message;$('results').classList.add('hidden');$('placeholder').classList.remove('hidden')}finally{$('solveBtn').disabled=false}});
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
function render(d){
  $('results').classList.remove('hidden');$('placeholder').classList.add('hidden');
  $('root').textContent=fmt(d.root);$('residual').textContent=smallNonzero(d.residual);
  $('count').textContent=d.steps.length;$('status').textContent=d.message;
  $('status').className=d.converged?'good':'bad';
  $('rows').replaceChildren();$('steps').replaceChildren();
  const equation=escapeHtml(d.equation);
  $('solutionOverview').innerHTML=`<h3>Given and formulas</h3>`+
    line(`f(x) = ${equation}`)+
    line(`Initial guess x₀ = ${fmt(Number($('guess').value))}`)+
    line(`Tolerance = ${escapeHtml($('tolerance').value)}; Maximum iterations = ${escapeHtml($('iterations').value)}`)+
    part('Newton–Raphson formula',line(`xₙ₊₁ = xₙ − ${fraction('f(xₙ)',"f′(xₙ)")}`))+
    part('Approximate relative error',line(`εₐ = | ${fraction('Present − Previous','Present')} | × 100%`)+line(`εₐ = | ${fraction('xₙ₊₁ − xₙ','xₙ₊₁')} | × 100%`))+
    `<p class="small-note">Derivative values are estimated using central differences. Calculations retain full precision; displayed values use three decimal places. A small nonzero residual or error is shown as &lt;0.001. The tolerance applies to the absolute change and residual, not the percentage error.</p>`;
  d.steps.forEach(s=>{
    const tr=document.createElement('tr');
    [String(s.iteration),fmt(s.x),fmt(s.fx),fmt(s.derivative),fmt(s.nextX),smallNonzero(s.error),approxFmt(s.approximateErrorPercent),smallNonzero(s.residual)].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.appendChild(td)});
    $('rows').appendChild(tr);
    const numericFraction=fraction(`(${fmt(s.fx)})`,`(${fmt(s.derivative)})`);
    const percentExpression = Math.abs(s.nextX) < 1e-15
      ? `<p class="small-note">Approximate relative error is undefined because the present approximation is zero${s.error === 0 ? ' (0/0)' : ''}.</p>`
      : line(`εₐ = | ${fraction(`${fmt(s.nextX)} − ${fmt(s.x)}`,fmt(s.nextX))} | × 100%`)+line(`εₐ = ${approxFmt(s.approximateErrorPercent)}%`);
    const block=document.createElement('article');block.className='step';
    block.innerHTML=`<div class="step-heading">${s.iteration}${s.iteration===1?'st':s.iteration===2?'nd':s.iteration===3?'rd':'th'} Iteration</div><div class="step-content">`+
      part('A. Given',line(`xₙ = ${fmt(s.x)}`)+line(`f(xₙ) = ${fmt(s.fx)}`)+line(`f′(xₙ) ≈ ${fmt(s.derivative)}`))+
      part('B. Formula',line(`xₙ₊₁ = xₙ − ${fraction('f(xₙ)',"f′(xₙ)")}`))+
      part('C. Substitution and solution',
        line(`f(${fmt(s.x)}) = ${substitutedEquation(d.equation,s.x)}`)+
        line(`xₙ₊₁ = ${fmt(s.x)} − ${numericFraction}`)+
        line(`xₙ₊₁ = ${fmt(s.nextX)}`)+
        `<h4 style="margin-top:14px">Approximate relative error</h4>`+percentExpression)+
      part('D. Final answer',`<div class="work-answer"><div class="answer-line">x${s.iteration} = ${fmt(s.nextX)}</div><div class="answer-line">εₐ = ${approxFmt(s.approximateErrorPercent)}%</div><div class="small-note">|Δx| = ${smallNonzero(s.error)} · |f(xₙ₊₁)| = ${smallNonzero(s.residual)}</div></div>`)+
      `</div>`;
    $('steps').appendChild(block);
  });
  drawGraph(d);
}
// The Java backend supplies plot points using the exact same exp4j expression
// as the solver, so the graph cannot disagree with the calculation parser.
function drawGraph(d) {
  const c=$('graph'), ctx=c.getContext('2d'), W=c.width, H=c.height;
  ctx.clearRect(0,0,W,H);
  $('graphNote').textContent='';
  const points=(d.graph||[]).filter(p=>p && Number.isFinite(p.x));
  const valid=points.filter(p=>p.y!==null && Number.isFinite(p.y));
  if(valid.length<2){$('graphNote').textContent='No finite function values near this approximation.';return;}
  const xmin=points[0].x,xmax=points[points.length-1].x;
  const sorted=valid.map(p=>p.y).sort((a,b)=>a-b);
  let ymin=Math.min(0,sorted[Math.floor((sorted.length-1)*.03)]);
  let ymax=Math.max(0,sorted[Math.floor((sorted.length-1)*.97)]);
  const margin=Math.max((ymax-ymin)*.15,0.001);
  ymin-=margin;ymax+=margin;
  const left=58,right=18,top=24,bottom=42;
  const px=x=>left+(x-xmin)/(xmax-xmin)*(W-left-right);
  const py=y=>H-bottom-(y-ymin)/(ymax-ymin)*(H-top-bottom);
  ctx.strokeStyle='#e5e9ef';ctx.lineWidth=1;ctx.font='12px sans-serif';ctx.fillStyle='#667386';
  for(let i=0;i<=4;i++){
    const y=ymin+(ymax-ymin)*i/4,yy=py(y);
    ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(W-right,yy);ctx.stroke();
    ctx.fillText(y.toFixed(2),5,yy+4);
  }
  if(xmin<=0&&xmax>=0){ctx.strokeStyle='#b2bac7';ctx.beginPath();ctx.moveTo(px(0),top);ctx.lineTo(px(0),H-bottom);ctx.stroke();}
  if(ymin<=0&&ymax>=0){ctx.strokeStyle='#b2bac7';ctx.beginPath();ctx.moveTo(left,py(0));ctx.lineTo(W-right,py(0));ctx.stroke();}
  for(let i=0;i<=4;i++){const x=xmin+(xmax-xmin)*i/4;ctx.fillText(x.toFixed(2),Math.min(W-55,Math.max(left,px(x)-17)),H-17);}
  ctx.save();ctx.beginPath();ctx.rect(left,top,W-left-right,H-top-bottom);ctx.clip();
  ctx.strokeStyle='#2e72d2';ctx.lineWidth=2.5;ctx.beginPath();let active=false;
  for(const p of points){
    if(p.y===null||!Number.isFinite(p.y)||p.y<ymin-5*(ymax-ymin)||p.y>ymax+5*(ymax-ymin)){active=false;continue;}
    if(!active){ctx.moveTo(px(p.x),py(p.y));active=true;}else ctx.lineTo(px(p.x),py(p.y));
  }
  ctx.stroke();
  if(Number.isFinite(d.root)&&Number.isFinite(d.residual)){
    const nearest=valid.reduce((a,b)=>Math.abs(a.x-d.root)<Math.abs(b.x-d.root)?a:b);
    const x=px(d.root),y=py(nearest.y);
    ctx.fillStyle='#e36b35';ctx.beginPath();ctx.arc(x,y,6,0,2*Math.PI);ctx.fill();
  }
  ctx.restore();
  $('graphNote').textContent=`Function graph near x = ${fmt(d.root)}. Orange marker shows the computed approximation.`;
}
