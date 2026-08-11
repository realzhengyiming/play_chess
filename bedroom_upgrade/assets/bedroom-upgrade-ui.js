(function(){
  'use strict';
  const engine=globalThis.BedroomModuleEngine;
  const recognizedAdapter=globalThis.BedroomRecognizedRoomAdapter;
  if(!engine)throw new Error('BedroomModuleEngine 未加载');
  const $=id=>document.getElementById(id);
  const ui={
    width:$('roomWidth'),depth:$('roomDepth'),pattern:$('patternSelect'),generate:$('generateBtn'),localReplan:$('localReplanBtn'),reset:$('resetBtn'),export:$('exportBtn'),
    showZones:$('showZones'),showDirections:$('showDirections'),showRelations:$('showRelations'),showGrid:$('showGrid'),board:$('board'),boardStatus:$('boardStatus'),canvasBadge:$('canvasBadge'),
    patternKicker:$('patternKicker'),patternTitle:$('patternTitle'),patternDescription:$('patternDescription'),signature:$('signature'),patternRanking:$('patternRanking'),modulePlan:$('modulePlan'),moduleList:$('moduleList'),opportunitySummary:$('opportunitySummary'),opportunityList:$('opportunityList'),
    solutionStrip:$('solutionStrip'),traceStrip:$('traceStrip'),chessTree:$('chessTree'),metricNodes:$('metricNodes'),metricActions:$('metricActions'),metricBeam:$('metricBeam'),metricTime:$('metricTime'),metricFlow:$('metricFlow'),metricComplete:$('metricComplete'),
    sampleSelect:$('sampleSelect'),loadSample:$('loadSampleBtn'),recognizedFile:$('recognizedJsonFile'),recognizedArea:$('recognizedArea'),recognizedRoomSelect:$('recognizedRoomSelect'),recognitionState:$('recognitionState'),furnitureConfigState:$('furnitureConfigState')
  };
  const PRESETS={compact:[2.9,3.4],standard:[3.6,3.8],long:[3.1,5.6],suite:[5.2,4.8]};
  let result=null,solutionIndex=0,traceIndex=Infinity,recognizedRooms=[],activeRecognizedRoom=null,lockedModules=[];

  for(const pattern of engine.PATTERNS){const option=document.createElement('option');option.value=pattern.id;option.textContent=pattern.label;ui.pattern.appendChild(option);}

  function visibleState(){
    const solution=result?.solutions?.[solutionIndex];if(!solution)return {modules:[],items:[],zones:[]};
    if(traceIndex>=solution.trace.length)return solution;
    const moves=solution.trace.slice(0,traceIndex),count=moves.filter(move=>!move.skipped).length,modules=solution.modules.slice(0,count);
    return {modules,items:modules.flatMap(module=>module.items),zones:modules.flatMap(module=>module.zones)};
  }

  function generate(){
    lockedModules=[];
    const room=activeRecognizedRoom?engine.makePolygonRoom(activeRecognizedRoom):engine.makeRoom(Number(ui.width.value),Number(ui.depth.value));
    result=ui.pattern.value==='auto'?engine.searchPortfolio(room,{beamWidth:16,maxPatterns:2,timeBudgetMs:240}):engine.search(room,{patternId:ui.pattern.value,beamWidth:16});
    solutionIndex=0;traceIndex=result.solutions[0]?.trace.length??0;persistCurrent();render();
  }

  function moduleKey(module){return `${module.type}|${module.wallIndex}|${Number(module.t||0).toFixed(3)}|${module.size}`;}
  function localReplan(){
    if(!result||!lockedModules.length){ui.boardStatus.textContent='请先在“已落模块”中锁定床、柜子或其他模块';return;}
    const room=result.room,pattern=result.solutions[solutionIndex]?.pattern||result.pattern;
    result=engine.search(room,{patternId:pattern.id,beamWidth:16,lockedModules});solutionIndex=0;traceIndex=result.solutions[0]?.trace.length??0;persistCurrent();render();
  }

  function wallLabel(value){if(value?.wallLabel)return value.wallLabel;return Number.isInteger(value?.wallIndex)?`墙段 ${Number(value.wallIndex)+1}`:'—';}

  function savedPayload(){
    if(!result)return null;const solution=result.solutions[solutionIndex]||null,room=result.room;
    const pattern=solution?.pattern||result.pattern;
    return {schemaVersion:'bedroom-space-chess-topology-v2',savedAt:new Date().toISOString(),room:{shape:room.shape,width:room.width,depth:room.depth,area:room.area,polygon:room.polygon,walls:room.walls,openings:room.openings,topology:room.topology},pattern:{id:pattern.id,label:pattern.label},solution};
  }

  function persistCurrent(){try{const payload=savedPayload();if(payload)localStorage.setItem('bedroom-space-chess-topology-v2',JSON.stringify(payload));}catch(error){console.warn('无法保存当前拓扑',error);}}

  function exportCurrent(){
    const payload=savedPayload();if(!payload)return;const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`bedroom-topology-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),500);
  }

  function restoreLast(){
    try{
      const saved=JSON.parse(localStorage.getItem('bedroom-space-chess-topology-v2')||'null');
      if(saved?.schemaVersion!=='bedroom-space-chess-topology-v2'||!Array.isArray(saved.room?.polygon))return false;
      activeRecognizedRoom={polygon:saved.room.polygon,openings:saved.room.openings||[]};ui.width.value=Number(saved.room.width).toFixed(2);ui.depth.value=Number(saved.room.depth).toFixed(2);
      if(engine.PATTERNS.some(row=>row.id===saved.pattern?.id))ui.pattern.value=saved.pattern.id;
      generate();recognitionMessage(`已恢复上次保存的${saved.room.shape==='rectangle'?'矩形':'异形'}拓扑与模块方案。`,'ok');return true;
    }catch(error){console.warn('无法恢复上次拓扑',error);return false;}
  }

  function recognitionMessage(message,kind=''){
    ui.recognitionState.className=`recognition-state ${kind}`.trim();ui.recognitionState.textContent=message;
  }

  async function loadGlobalFurnitureCapability(){
    try{const response=await fetch('/api/furniture-config',{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);const payload=await response.json(),status=engine.configureFurniture(payload,'服务器全局家具配置');ui.furnitureConfigState.textContent=`家具：${status.source} · ${status.count} 种`;ui.furnitureConfigState.classList.add('ok');}
    catch(error){ui.furnitureConfigState.textContent='家具：内置稳定模数';console.warn('全局家具能力包未载入，继续使用稳定模数',error);}
  }

  function loadRecognizedPayload(payload,sourceLabel){
    try{
      activeRecognizedRoom=null;
      recognizedRooms=recognizedAdapter.prepareBedrooms(payload,Number(ui.recognizedArea.value));
      ui.recognizedRoomSelect.disabled=!recognizedRooms.length;
      ui.recognizedRoomSelect.innerHTML='<option value="">选择识别卧室</option>'+recognizedRooms.map((room,index)=>`<option value="${index}">${room.label} · ${room.topologyKind} · ${room.polygon.length} 角 · ${room.area.toFixed(1)}㎡${room.supported?'':'（含斜墙，暂不支持）'}</option>`).join('');
      const supported=recognizedRooms.filter(room=>room.supported).length;
      recognitionMessage(`${sourceLabel}：识别到 ${recognizedRooms.length} 间卧室，其中 ${supported} 间可进入真实多边形模块棋。`,supported?'ok':'warn');
    }catch(error){recognizedRooms=[];ui.recognizedRoomSelect.disabled=true;recognitionMessage(`JSON 解析失败：${error.message}`,'warn');}
  }

  function applyRecognizedRoom(index){
    const room=recognizedRooms[Number(index)];if(!room)return;
    if(!room.supported){recognitionMessage(`${room.label} 暂不进入搜索：${room.reason}。当前不会用外接矩形冒充真实异形结果。`,'warn');return;}
    activeRecognizedRoom=room;
    ui.width.value=room.width.toFixed(2);ui.depth.value=room.depth.toFixed(2);ui.pattern.value='auto';document.querySelectorAll('[data-room]').forEach(row=>row.classList.remove('active'));
    recognitionMessage(`${room.label} 已载入：${room.topologyKind}、${room.polygon.length} 个角、${room.openings.length} 个门窗；按真实轮廓与墙段下模块棋。`,'ok');generate();
  }

  function render(){
    if(!result)return;
    const {room,diagnosis,stats}=result,solution=result.solutions[solutionIndex],pattern=solution?.pattern||result.pattern,searchStats=solution?.searchStats||stats,signature=diagnosis.signature;
    ui.patternKicker.textContent=`${signature.area.toFixed(1)}㎡ · ${signature.shape==='rectangle'?'矩形':'异形'} · ${signature.wallCount} 段墙 · ${signature.longAxis==='horizontal'?'横向主轴':'纵向主轴'}`;
    ui.patternTitle.textContent=pattern.label;ui.patternDescription.textContent=pattern.description;
    ui.boardStatus.textContent=solution?`${stats.portfolioRuns?.length||1} 条棋谱竞赛 · ${solution.evaluation.qualityPass?'通过首轮验收':'需要继续优化'} · ${solution.modules.length} 个完整模块`:'当前棋谱无解';
    ui.canvasBadge.textContent=solution?`方案 ${String.fromCharCode(65+solutionIndex)} · 第 ${Math.min(traceIndex,solution.trace.length)} / ${solution.trace.length} 手`:'无方案';
    ui.signature.innerHTML=[['室内面积',`${signature.area.toFixed(1)}㎡`],['轮廓类型',signature.shape==='rectangle'?'矩形':'正交异形'],['墙段 / 角点',`${signature.wallCount} / ${room.polygon.length}`],['真实门窗',`${room.doors.length} 门 · ${room.windows.length} 窗`],['长宽比',signature.aspect.toFixed(2)],['主轴',signature.longAxis==='horizontal'?'横向':'纵向']].map(([term,value])=>`<div><dt>${term}</dt><dd>${value}</dd></div>`).join('');
    ui.patternRanking.innerHTML=diagnosis.ranked.map(row=>`<div class="rank-row ${row.pattern.id===pattern.id?'active':''}"><span>${row.pattern.label}</span><strong>${row.fitness.toFixed(0)}</strong></div>`).join('');
    const modulePlanRows=[...pattern.modules,{type:'infill',required:false,sizes:['动态宽度'],endgame:true}].map(row=>{const diagnostic=searchStats.moduleDiagnostics[row.type],reasons=diagnostic?Object.entries(diagnostic.rejected).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([reason,count])=>`${rejectLabel(reason)} ${count}`).join('、'):'';return `<li><strong>${moduleLabel(row.type)}</strong> <span>${row.endgame?'残局末手 · 可重复':row.required?'必下':'可跳过'} · ${row.sizes.join('/')}<br>${diagnostic?`候选 ${diagnostic.raw} · 合法 ${diagnostic.legal} · 入搜索 ${diagnostic.sent}${reasons?` · 淘汰：${reasons}`:''}`:'尚无候选诊断'}</span></li>`;}).join('');
    const relationPlanRows=(pattern.relations||[]).map(rule=>rule.type==='avoid-facing-opening'?`<li><strong>隐私规范 · ${moduleLabel(rule.subject)} 回避门口直视</strong> <span>床尾轴线可以指向门，但直对程度越高、距离越近、视线越通透，隐私分越低。</span></li>`:rule.type==='avoid-facing'?`<li><strong>负关系 · ${moduleLabel(rule.subject)} 回避 ${moduleLabel(rule.targets?.[0])}</strong> <span>不应互相正对或占据对方的主使用轴；冲突越强，分数越低。</span></li>`:`<li><strong>正关系 · ${moduleLabel(rule.subject)} 正对</strong> <span>目标优先级：${(rule.targets||[]).map(type=>`${moduleLabel(type)}${rule.targetWeights?.[type]&&rule.targetWeights[type]<1?'（降级）':''}`).join(' / ')}<br>完全正对最高分，轻微偏移平滑降分，不作硬淘汰。</span></li>`).join('');
    ui.modulePlan.innerHTML=modulePlanRows+relationPlanRows;
    ui.metricNodes.textContent=stats.nodes.toLocaleString();ui.metricActions.textContent=stats.rawActions.toLocaleString();ui.metricBeam.textContent=stats.beamWidth;ui.metricTime.textContent=`${stats.timeMs.toFixed(1)} ms`;
    ui.metricFlow.textContent=solution?`${(solution.evaluation.flow.connectedRatio*100).toFixed(0)}%`:'—';ui.metricComplete.textContent=solution?`${(solution.evaluation.spaceUse*100).toFixed(0)}%`:'—';
    renderSolutions();renderTrace();renderSearchTree();renderModules();renderOpportunities();draw();
  }

  function moduleLabel(type){return ({sleep:'睡眠组',storage:'收纳组',infill:'定制柜收纳组',work:'工作组',media:'床尾媒体组',lounge:'休闲组',dressing:'梳妆组'})[type]||type;}
  function relationSummary(evaluation){const details=evaluation?.relations?.details||[];if(!details.length)return '无关系规则';const positives=details.filter(row=>!row.type.startsWith('avoid-')),active=positives.filter(row=>row.active);if(positives.length)return active.length?`${(active.reduce((sum,row)=>sum+row.score,0)/active.length*100).toFixed(0)}%`:'正向未成立';return `规范 ${(evaluation.relations.score*100).toFixed(0)}%`;}
  function rejectLabel(reason){return ({outside:'家具越界',door:'门前区',window:'高柜挡窗','corner-facing':'凹角柜门朝向错误',furniture:'家具碰撞','usage-zone':'侵占使用区','zone-outside':'使用区越界','zone-furniture':'使用区碰家具'})[reason]||reason;}
  function compactItemLabel(item){
    if(item.type==='custom-cabinet')return item.label.includes('薄柜')?'薄柜':'高柜';
    if(item.type==='wardrobe')return '衣柜';
    if(item.type==='tvbench')return '电视柜';
    if(item.type==='night')return '床头柜';
    return item.label;
  }

  function drawItemLabel(ctx,item,p){
    const vertical=p.h>p.w*1.2;
    ctx.save();ctx.fillStyle='white';ctx.textAlign='center';ctx.textBaseline='middle';
    if(vertical){
      const availableWidth=p.w-4,availableHeight=p.h-8;if(availableWidth<9||availableHeight<18){ctx.restore();return;}
      let label=item.label.replace(/\s+/g,''),glyphs=Array.from(label),fontSize=Math.max(6,Math.min(11,availableWidth*.52)),lineHeight=fontSize*1.08;
      while(fontSize>6&&glyphs.length*lineHeight>availableHeight){fontSize-=.5;lineHeight=fontSize*1.08;}
      if(glyphs.length*lineHeight>availableHeight){label=compactItemLabel(item);glyphs=Array.from(label);fontSize=Math.max(6,Math.min(11,availableWidth*.52));lineHeight=fontSize*1.08;}
      if(glyphs.length*lineHeight<=availableHeight){ctx.font=`800 ${fontSize}px system-ui`;const startY=p.y+p.h/2-(glyphs.length-1)*lineHeight/2;glyphs.forEach((glyph,index)=>ctx.fillText(glyph,p.x+p.w/2,startY+index*lineHeight));}
      ctx.restore();return;
    }
    const availableLength=p.w-8,availableThickness=p.h-4;if(availableLength<18||availableThickness<10){ctx.restore();return;}
    let label=item.label,fontSize=Math.max(6,Math.min(12,availableThickness*.42));ctx.font=`800 ${fontSize}px system-ui`;
    while(fontSize>6&&ctx.measureText(label).width>availableLength){fontSize-=.5;ctx.font=`800 ${fontSize}px system-ui`;}
    if(ctx.measureText(label).width>availableLength){label=compactItemLabel(item);fontSize=Math.max(6,Math.min(11,availableThickness*.44));ctx.font=`800 ${fontSize}px system-ui`;while(fontSize>6&&ctx.measureText(label).width>availableLength){fontSize-=.5;ctx.font=`800 ${fontSize}px system-ui`;}}
    if(ctx.measureText(label).width<=availableLength)ctx.fillText(label,p.x+p.w/2,p.y+p.h/2);ctx.restore();
  }

  function renderSolutions(){
    ui.solutionStrip.innerHTML=result.solutions.length?result.solutions.map((solution,index)=>`<button class="solution-card ${index===solutionIndex?'active':''}" data-solution="${index}"><b>${String.fromCharCode(65+index)} · 全局 ${solution.evaluation.total.toFixed(1)}</b><strong>${solution.pattern?.label||result.pattern.label} · ${solution.modules.map(row=>row.label).join(' + ')}</strong><span>${solution.evaluation.portfolioScore?`组合决赛 ${solution.evaluation.portfolioScore.toFixed(1)} · `:''}累计局部 ${solution.score.toFixed(1)} · ${solution.evaluation.qualityPass?'首轮硬验收通过':'待优化'} · 关系 ${relationSummary(solution.evaluation)} · 漏摆机会 ${solution.evaluation.opportunities?.count||0} · 容量 ${solution.evaluation.moduleUnits}/${solution.evaluation.capacityTarget} · 空间利用 ${(solution.evaluation.spaceUse*100).toFixed(0)}%</span></button>`).join(''):'<p>当前棋谱没有产生合法方案，请调整尺寸或切换棋谱。</p>';
    ui.solutionStrip.querySelectorAll('[data-solution]').forEach(button=>button.addEventListener('click',()=>{solutionIndex=Number(button.dataset.solution);traceIndex=result.solutions[solutionIndex].trace.length;persistCurrent();render();}));
  }

  function renderTrace(){
    const solution=result.solutions[solutionIndex];if(!solution){ui.traceStrip.innerHTML='';return;}
    const rows=[{label:'空房间',detail:'识别拓扑与局型',index:0},...solution.trace.map((move,index)=>({label:move.skipped?`跳过 ${moduleLabel(move.type)}`:`${moduleLabel(move.type)} · ${move.size}`,detail:`${move.skipped?'保留空间':wallLabel(move)} · 局部 ${Number(move.merit)>=0?'+':''}${Number(move.merit||0).toFixed(1)}`,index:index+1}))];
    ui.traceStrip.innerHTML=rows.map(row=>`<button class="trace-step ${row.index===traceIndex?'active':''}" data-trace="${row.index}"><strong>${row.index}. ${row.label}</strong><span>${row.detail}</span></button>`).join('');
    ui.traceStrip.querySelectorAll('[data-trace]').forEach(button=>button.addEventListener('click',()=>{traceIndex=Number(button.dataset.trace);renderTrace();renderModules();draw();ui.canvasBadge.textContent=`方案 ${String.fromCharCode(65+solutionIndex)} · 第 ${traceIndex} / ${solution.trace.length} 手`;}));
  }

  function searchStageLabel(round){
    if(round.moduleType==='sleep-attachment')return '睡眠组附件补全';
    if(round.moduleType==='infill')return `定制柜残局 ${round.round||1}`;
    if(round.moduleType==='finalize')return 'Top 3 终局验收';
    return moduleLabel(round.moduleType);
  }

  function renderSearchTree(){
    if(!ui.chessTree||!result)return;const solution=result.solutions[solutionIndex],stats=solution?.searchStats||result.stats;if(!solution){ui.chessTree.innerHTML='<p>当前无可展示棋谱树。</p>';return;}
    const infillMoves=solution.trace.filter(move=>move.type==='infill'&&!move.skipped),stageRows=stats.rounds.map(round=>{
      let chosen='保留空间';
      if(round.moduleType==='finalize')chosen=`选中方案 ${String.fromCharCode(65+solutionIndex)} · 全局 ${solution.evaluation.total.toFixed(1)}`;
      else if(round.moduleType==='sleep-attachment')chosen=solution.modules.some(module=>module.type==='sleep'&&module.size==='S2')?'补全第二个床头柜':'保留原睡眠变例';
      else if(round.moduleType==='infill'){const move=infillMoves[(round.round||1)-1];chosen=move?`${move.size} · ${move.wallLabel||'剩余墙段'}`:'本轮停手';}
      else {const move=solution.trace.find(row=>row.type===round.moduleType);if(move)chosen=move.skipped?`跳过 ${moduleLabel(move.type)}`:`${move.size} · ${move.wallLabel||'语义墙段'}`;}
      const discarded=Math.max(0,Number(round.candidates||0)-Number(round.retained||0));
      return `<div class="tree-level"><div class="tree-rail"></div><div class="tree-stage"><strong>${searchStageLabel(round)}</strong><span>${Number(round.timeUs||0).toLocaleString()} µs</span></div><div class="tree-branch chosen"><small>本方案</small><b>${chosen}</b></div><div class="tree-branch alternatives"><small>搜索层</small><b>${round.candidates} 候选 → ${round.retained} 保留</b><span>本层截断 ${discarded} 条分支</span></div></div>`;
    }).join('');
    const portfolioText=result.stats.portfolio?` · 多棋谱总运行 ${result.stats.timeMs.toFixed(2)} ms`:'';ui.chessTree.innerHTML=`<div class="tree-summary"><strong>本棋谱 ${stats.timeMs.toFixed(2)} ms</strong><span>${Number(stats.totalTimeUs||stats.timeMs*1000).toLocaleString()} µs · ${stats.nodes} 模块节点 · Beam ${stats.beamWidth}${portfolioText}</span></div><div class="tree-root"><strong>空房间</strong><span>拓扑、门窗与局型已识别</span></div>${stageRows}`;
  }

  function renderModules(){
    const state=visibleState(),lockedKeys=new Set(lockedModules.map(moduleKey));ui.moduleList.innerHTML=state.modules.length?state.modules.map(module=>`<div class="module-row ${lockedKeys.has(moduleKey(module))?'locked':''}" style="--module-color:${module.template.color}"><strong>${module.label} · ${module.size} · 局部 +${module.merit.toFixed(1)}</strong><span>${wallLabel(module)} · ${module.items.map(item=>item.label).join('＋')}${['storage','infill'].includes(module.type)&&module.crossWallShadow?` · 封墙 ${module.crossWallShadow.toFixed(2)}m`:''}</span><button type="button" data-lock="${moduleKey(module)}">${lockedKeys.has(moduleKey(module))?'已锁定 · 点击解锁':'锁定此模块'}</button></div>`).join(''):'<p>尚未落下模块。</p>';
    ui.moduleList.querySelectorAll('[data-lock]').forEach(button=>button.addEventListener('click',()=>{const module=state.modules.find(row=>moduleKey(row)===button.dataset.lock),index=lockedModules.findIndex(row=>moduleKey(row)===button.dataset.lock);if(index>=0)lockedModules.splice(index,1);else if(module)lockedModules.push(module);renderModules();draw();}));
  }

  function renderOpportunities(){
    const solution=result?.solutions?.[solutionIndex],opportunities=solution?.evaluation?.opportunities;if(!ui.opportunitySummary||!ui.opportunityList)return;
    if(!opportunities){ui.opportunitySummary.textContent='尚未执行机会裁判。';ui.opportunityList.innerHTML='';return;}
    ui.opportunitySummary.className=`opportunity-summary ${opportunities.count?'warn':'ok'}`;ui.opportunitySummary.innerHTML=opportunities.count?`<strong>发现 ${opportunities.count} 个合法漏摆机会</strong><span>终局已扣 ${opportunities.penalty.toFixed(1)} 分 · 反事实检查 ${opportunities.checked} 个候选</span>`:`<strong>没有发现可合法追加的正式模块</strong><span>${opportunities.unassignedBays.length?`仍有 ${opportunities.unassignedBays.length} 段未指派空墙，但当前正式模块均无法完整落下。`:'剩余空间已由通道、使用区或已落模块解释。'}</span>`;
    const formal=opportunities.items.map(row=>`<div class="opportunity-row formal"><strong>可追加 ${moduleLabel(row.type)} · ${row.size}</strong><span>${row.wallLabel} · 剩余墙段 ${row.bay.length.toFixed(2)}m · 当前仍通过全部几何硬规则</span></div>`).join(''),unassigned=opportunities.unassignedBays.slice(0,3).map(row=>`<div class="opportunity-row neutral"><strong>未指派空墙 ${row.length.toFixed(2)}m</strong><span>${row.wallLabel} · 暂未认定为漏摆</span></div>`).join('');ui.opportunityList.innerHTML=formal+unassigned;
  }

  function draw(){
    const canvas=ui.board,box=canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.max(1,Math.floor(box.width*dpr));canvas.height=Math.max(1,Math.floor(box.height*dpr));
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,box.width,box.height);ctx.fillStyle='#fbfaf6';ctx.fillRect(0,0,box.width,box.height);
    if(!result)return;const room=result.room,state=visibleState(),pad=55,scale=Math.min((box.width-pad*2)/room.width,(box.height-pad*2)/room.depth),ox=(box.width-room.width*scale)/2,oy=(box.height-room.depth*scale)/2;
    const toPx=value=>({x:ox+(value.x-value.w/2)*scale,y:oy+(value.y-value.d/2)*scale,w:value.w*scale,h:value.d*scale});
    const roomPath=()=>{ctx.beginPath();room.polygon.forEach((point,index)=>{const x=ox+point.x*scale,y=oy+point.y*scale;if(index)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.closePath();};
    roomPath();ctx.fillStyle='#fffefa';ctx.fill();
    if(ui.showGrid.checked){
      ctx.save();roomPath();ctx.clip();
      ctx.lineWidth=.5;for(let x=0;x<=room.width+1e-6;x+=.1){ctx.strokeStyle=Math.abs(x-Math.round(x))<.02?'rgba(31,55,46,.17)':'rgba(31,55,46,.055)';ctx.beginPath();ctx.moveTo(ox+x*scale,oy);ctx.lineTo(ox+x*scale,oy+room.depth*scale);ctx.stroke();}
      for(let y=0;y<=room.depth+1e-6;y+=.1){ctx.strokeStyle=Math.abs(y-Math.round(y))<.02?'rgba(31,55,46,.17)':'rgba(31,55,46,.055)';ctx.beginPath();ctx.moveTo(ox,oy+y*scale);ctx.lineTo(ox+room.width*scale,oy+y*scale);ctx.stroke();}
      ctx.restore();
    }
    roomPath();ctx.strokeStyle='#17251f';ctx.lineWidth=4;ctx.lineJoin='round';ctx.stroke();
    for(const opening of room.openings){
      const a=opening.points[0],b=opening.points[1],ax=ox+a.x*scale,ay=oy+a.y*scale,bx=ox+b.x*scale,by=oy+b.y*scale;
      ctx.strokeStyle=opening.kind==='window'?'#38a8bc':'#ff5b38';ctx.lineWidth=opening.kind==='window'?7:5;ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke();
      if(opening.kind==='door'){
        const wall=room.walls[opening.wallIndex],swing=Math.min(opening.width,.95)*scale;ctx.setLineDash([5,4]);ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(ax+wall.normal.x*swing,ay+wall.normal.y*swing);ctx.stroke();ctx.setLineDash([]);
      }
    }
    if(ui.showZones.checked){
      for(const door of room.doors){const p=toPx(door.zone);ctx.fillStyle='rgba(255,91,56,.10)';ctx.strokeStyle='rgba(255,91,56,.82)';ctx.lineWidth=1.5;ctx.setLineDash([7,4]);ctx.fillRect(p.x,p.y,p.w,p.h);ctx.strokeRect(p.x,p.y,p.w,p.h);ctx.setLineDash([]);if(p.w>54&&p.h>24){ctx.fillStyle='#d94728';ctx.font='800 10px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('门前禁占区',p.x+p.w/2,p.y+p.h/2);}}
      for(const zone of state.zones){const p=toPx(zone);ctx.fillStyle='rgba(17,108,92,.045)';ctx.strokeStyle='rgba(17,108,92,.55)';ctx.lineWidth=1.2;ctx.setLineDash([6,4]);ctx.fillRect(p.x,p.y,p.w,p.h);ctx.strokeRect(p.x,p.y,p.w,p.h);ctx.setLineDash([]);}
    }
    for(const item of state.items){const p=toPx(item);ctx.fillStyle=item.color||'#75827d';ctx.strokeStyle='rgba(17,31,25,.64)';ctx.lineWidth=1.2;ctx.beginPath();ctx.roundRect(p.x,p.y,p.w,p.h,Math.min(8,p.w*.12,p.h*.12));ctx.fill();ctx.stroke();drawItemLabel(ctx,item,p);}
    if(ui.showDirections.checked)for(const module of state.modules){
      const face=engine.moduleInterface(module,room),from={x:ox+face.center.x*scale,y:oy+face.center.y*scale},length=Math.max(22,Math.min(42,.48*scale)),to={x:from.x+face.facing.x*length,y:from.y+face.facing.y*length},angle=Math.atan2(to.y-from.y,to.x-from.x);
      ctx.save();ctx.lineCap='round';ctx.strokeStyle='rgba(255,255,255,.92)';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();ctx.strokeStyle='#ff6a3d';ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();ctx.fillStyle='#ff6a3d';ctx.beginPath();ctx.moveTo(to.x,to.y);ctx.lineTo(to.x-9*Math.cos(angle-.48),to.y-9*Math.sin(angle-.48));ctx.lineTo(to.x-9*Math.cos(angle+.48),to.y-9*Math.sin(angle+.48));ctx.closePath();ctx.fill();ctx.font='800 9px system-ui';const textWidth=ctx.measureText(face.label).width+8,labelX=to.x+face.facing.x*10,labelY=to.y+face.facing.y*10;ctx.fillStyle='rgba(255,255,255,.92)';ctx.fillRect(labelX-textWidth/2,labelY-8,textWidth,16);ctx.fillStyle='#d94d27';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(face.label,labelX,labelY);ctx.restore();
    }
    const fullSolution=result.solutions[solutionIndex];if(traceIndex>=fullSolution.trace.length)for(const opportunity of fullSolution.evaluation.opportunities?.items||[]){const wall=room.walls[opportunity.wallIndex],start=opportunity.bay.start,end=opportunity.bay.end,a={x:ox+(wall.a.x+wall.dir.x*start)*scale,y:oy+(wall.a.y+wall.dir.y*start)*scale},b={x:ox+(wall.a.x+wall.dir.x*end)*scale,y:oy+(wall.a.y+wall.dir.y*end)*scale};ctx.strokeStyle='#f08a24';ctx.lineWidth=7;ctx.setLineDash([9,5]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);}
    if(ui.showRelations.checked){const relationState=engine.evaluateRelations(state,room,fullSolution.pattern||result.pattern);for(const relation of relationState.details.filter(row=>row.active)){const from={x:ox+relation.from.x*scale,y:oy+relation.from.y*scale},to={x:ox+relation.to.x*scale,y:oy+relation.to.y*scale};ctx.strokeStyle='rgba(116,68,154,.82)';ctx.lineWidth=2;ctx.setLineDash([8,5]);ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();ctx.setLineDash([]);const mx=(from.x+to.x)/2,my=(from.y+to.y)/2,label=`正对 ${Math.round(relation.score*100)}% → ${moduleLabel(relation.targetType)}`;ctx.font='800 10px system-ui';const labelWidth=ctx.measureText(label).width+12;ctx.fillStyle='rgba(255,255,255,.9)';ctx.fillRect(mx-labelWidth/2,my-9,labelWidth,18);ctx.fillStyle='#74449a';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,mx,my);}}
    ctx.fillStyle='#68736e';ctx.font='800 11px system-ui';ctx.textAlign='center';ctx.fillText(`外包络 ${room.width.toFixed(1)} × ${room.depth.toFixed(1)} m`,ox+room.width*scale/2,oy-14);
  }

  document.querySelectorAll('[data-room]').forEach(button=>button.addEventListener('click',()=>{activeRecognizedRoom=null;document.querySelectorAll('[data-room]').forEach(row=>row.classList.toggle('active',row===button));const [width,depth]=PRESETS[button.dataset.room];ui.width.value=width;ui.depth.value=depth;ui.pattern.value='auto';generate();}));
  ui.generate.addEventListener('click',generate);ui.localReplan.addEventListener('click',localReplan);ui.export.addEventListener('click',exportCurrent);ui.reset.addEventListener('click',()=>{activeRecognizedRoom=null;ui.width.value=3.6;ui.depth.value=3.8;ui.pattern.value='auto';document.querySelectorAll('[data-room]').forEach(row=>row.classList.toggle('active',row.dataset.room==='standard'));generate();});
  for(const input of [ui.width,ui.depth])input.addEventListener('input',()=>{activeRecognizedRoom=null;});
  ui.sampleSelect.addEventListener('change',()=>{const option=ui.sampleSelect.selectedOptions[0];if(option?.dataset.area)ui.recognizedArea.value=option.dataset.area;});
  ui.loadSample.addEventListener('click',async()=>{const file=ui.sampleSelect.value;if(!file){recognitionMessage('请先选择一个内置样例。','warn');return;}try{recognitionMessage(`正在读取 ${file}…`);const response=await fetch(`../samples/${file}`);if(!response.ok)throw new Error(`HTTP ${response.status}`);loadRecognizedPayload(await response.json(),file);}catch(error){recognitionMessage(`内置样例读取失败：${error.message}。直接双击页面时请改用“选择本地 JSON”，或通过静态服务打开。`,'warn');}});
  ui.recognizedFile.addEventListener('change',event=>{const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{loadRecognizedPayload(JSON.parse(reader.result),file.name);}catch(error){recognitionMessage(`JSON 解析失败：${error.message}`,'warn');}};reader.readAsText(file);});
  ui.recognizedRoomSelect.addEventListener('change',()=>{if(ui.recognizedRoomSelect.value!=='')applyRecognizedRoom(ui.recognizedRoomSelect.value);});
  ui.showZones.addEventListener('change',draw);ui.showDirections.addEventListener('change',draw);ui.showRelations.addEventListener('change',draw);ui.showGrid.addEventListener('change',draw);ui.pattern.addEventListener('change',generate);window.addEventListener('resize',draw);new ResizeObserver(draw).observe(ui.board.parentElement);
  (async()=>{await loadGlobalFurnitureCapability();if(!restoreLast())generate();})();
})();
