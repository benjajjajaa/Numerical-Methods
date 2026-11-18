const $=id=>document.getElementById(id);let last=null;
const fmt=n=>Number.isFinite(n)?Number(n).toFixed(3):String(n);
const textResult=d=>["NEWTON-RAPHSON SOLUTION",`Equation: ${d.equation}`,`Approximate root: ${fmt(d.root)}`,`Residual: ${fmt(d.residual)}`,`Status: ${d.message}`,`Iterations: ${d.steps.length}`,"","Formula: x_next = x - f(x) / f'(x)","Derivative estimated using central differences.","",...d.steps.map(s=>`Iteration ${s.iteration}: x=${fmt(s.x)}, f(x)=${fmt(s.fx)}, f'(x)=${fmt(s.derivative)}\nx_next=${fmt(s.x)} - (${fmt(s.fx)}) / (${fmt(s.derivative)}) = ${fmt(s.nextX)}\nAbsolute change=${fmt(s.error)}, residual=${fmt(s.residual)}\n`)].join('\n');
document.querySelectorAll('[data-insert], [data-backspace]').forEach(button=>button.addEventListener('click',()=>{const field=$('equation'),start=field.selectionStart??field.value.length,end=field.selectionEnd??start;let insertion=button.dataset.insert||'';if(button.dataset.backspace){if(start===end&&start>0){field.setRangeText('',start-1,end,'end')}else field.setRangeText('',start,end,'end')}else{field.setRangeText(insertion,start,end,'end')}field.focus()}));
$('solverForm').addEventListener('submit',async e=>{e.preventDefault();$('message').textContent='';$('solveBtn').disabled=true;try{const response=await fetch('/api/solve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({equation:$('equation').value,initialGuess:Number($('guess').value),tolerance:Number($('tolerance').value),maxIterations:Number($('iterations').value)})});if(!response.ok){const err=await response.json();throw Error(err.detail||err.message||'Unable to calculate. Check your inputs.')}last=await response.json();render(last)}catch(err){$('message').textContent=err.message;$('results').classList.add('hidden');$('placeholder').classList.remove('hidden')}finally{$('solveBtn').disabled=false}});
$('resetBtn').onclick=()=>{ $('solverForm').reset();$('results').classList.add('hidden');$('placeholder').classList.remove('hidden');$('message').textContent='';last=null};
$('copyBtn').onclick=async()=>{if(!last)return;try{await navigator.clipboard.writeText(textResult(last));$('copyBtn').textContent='Copied!';setTimeout(()=>$('copyBtn').textContent='Copy results',1500)}catch(e){$('message').textContent='Copy failed. Use Download instead.'}};
$('downloadBtn').onclick=()=>{if(!last)return;const a=document.createElement('a'),url=URL.createObjectURL(new Blob([textResult(last)],{type:'text/plain'}));a.href=url;a.download='newton-raphson-solution.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
function render(d){$('results').classList.remove('hidden');$('placeholder').classList.add('hidden');$('root').textContent=fmt(d.root);$('residual').textContent=fmt(d.residual);$('count').textContent=d.steps.length;$('status').textContent=d.message;$('status').className=d.converged?'good':'bad';$('rows').replaceChildren();$('steps').replaceChildren();d.steps.forEach(s=>{const tr=document.createElement('tr');[s.iteration,s.x,s.fx,s.derivative,s.nextX,s.error,s.residual].forEach(v=>{const td=document.createElement('td');td.textContent=typeof v==='number'&&v!==s.iteration?fmt(v):String(v);tr.appendChild(td)});$('rows').appendChild(tr);const div=document.createElement('div');div.className='step';const title=document.createElement('strong');title.textContent=`Iteration ${s.iteration}`;div.append(title,document.createElement('br'),document.createTextNode(`xₙ = ${fmt(s.x)}; f(xₙ) = ${fmt(s.fx)}; f′(xₙ) ≈ ${fmt(s.derivative)}`),document.createElement('br'),document.createTextNode(`xₙ₊₁ = ${fmt(s.x)} − (${fmt(s.fx)}) / (${fmt(s.derivative)}) = ${fmt(s.nextX)}`),document.createElement('br'),document.createTextNode(`|Δx| = ${fmt(s.error)}; |f(xₙ₊₁)| = ${fmt(s.residual)}`));$('steps').appendChild(div)});drawGraph(d)}
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
