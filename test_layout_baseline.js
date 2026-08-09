const fs = require('fs');
const path = require('path');
const {loadRuntimeConfig}=require('./tests/runtime_config');
globalThis.RoomChessConfigContract=require('./assets/js/config-contract.js');

const htmlPath = path.join(__dirname, 'bedroom-space-chess-V3.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const scriptSource = (() => {
  const external = html.match(/<script[^>]+src=["']([^"']*space-chess\.js)["'][^>]*><\/script>/i);
  if (external) return fs.readFileSync(path.resolve(__dirname, external[1]), 'utf8');
  const inline = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)][0];
  if (inline) return inline[1];
  throw new Error('没有在主页面中找到空间棋脚本');
})();
new Function(scriptSource)();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function actualCounts(solution) {
  const counts = {};
  for (const id of Object.keys(solution?.poses || {})) {
    const typeId = solution.inventoryItems?.find(item => item.id === id)?.typeId;
    if (typeId) counts[typeId] = (counts[typeId] || 0) + 1;
  }
  return counts;
}

function requireTypes(counts, required, label) {
  for (const [typeId, minimum] of Object.entries(required)) {
    assert((counts[typeId] || 0) >= minimum, `${label}: ${typeId} 实际 ${(counts[typeId] || 0)} < ${minimum}`);
  }
}

function assertRetainedNodesHaveChildren(beamTree, label) {
  assert(beamTree, `${label}: 没有记录 Beam 搜索树`);
  const childParentIds = new Set();
  for (const round of beamTree.rounds || []) {
    for (const node of round.nodes || []) childParentIds.add(node.parentId);
  }
  for (const output of beamTree.outputs || []) childParentIds.add(output.parentId);
  const orphanRetained = (beamTree.rounds || [])
    .flatMap(round => round.nodes || [])
    .filter(node => node.status === 'retained' && !childParentIds.has(node.id));
  assert(!orphanRetained.length, `${label}: 存在 ${orphanRetained.length} 个标成“进入下一回合”但没有真实子分支的节点`);
}

function assertScoreAndPruneObservability(engine, solution, beamTree, label) {
  const breakdown = engine.traceEvaluationBreakdown(solution.evaluation);
  for (const key of ['ground','wall','relation','circulation','alignment','daylight','emptyWall','corner','severeWallGaps','awkwardWallGaps']) {
    assert(Number.isFinite(breakdown[key]), `${label}: 步骤评分缺少 ${key}`);
  }
  for (const round of beamTree?.rounds || []) {
    assert(Number.isFinite(round.rejectSummary?.flow), `${label}: Beam 回合缺少通路剪枝计数`);
    assert(Number.isFinite(round.rejectSummary?.island), `${label}: Beam 回合缺少孤岛剪枝计数`);
  }
}

function assertOptionalRepeatedTypeCanSkipAndContinue(solution, beamTree, typeId, label) {
  const itemById = new Map((solution.inventoryItems || []).map(item => [item.id, item]));
  const rounds = (beamTree?.rounds || []).filter(round => itemById.get(round.itemId)?.typeId === typeId);
  if (rounds.length < 2) return;
  const laterRound = rounds[1];
  const skipped = (laterRound.nodes || []).filter(node => node.skipped);
  assert(skipped.length, `${label}: ${typeId} 的第二数量槽没有生成“跳过”分支`);
  const childParentIds = new Set();
  for (const round of beamTree.rounds || []) for (const node of round.nodes || []) childParentIds.add(node.parentId);
  for (const output of beamTree.outputs || []) childParentIds.add(output.parentId);
  assert(skipped.some(node => childParentIds.has(node.id)), `${label}: ${typeId} 的跳过分支没有继续搜索后续家具`);
}

setTimeout(() => {
  const engine = globalThis.RoomChessEngine;
  assert(engine, 'RoomChessEngine 未导出');
  const {config:serverConfig,configPath}=loadRuntimeConfig(__dirname);
  assert(engine.applyGlobalConfig(serverConfig), `FastAPI 当前全局配置加载失败：${configPath}`);
  engine.setLayoutDensityMode('rich');

  // 户型识别后的尺寸测试必须缩放真实多边形和门窗，而不是只修改右上角数字。
  engine.setProgram('bedroom');
  engine.setRecognizedRoomOverrideForTest({programId:'bedroom',polygon:[{x:2,y:1},{x:5,y:1},{x:5,y:5},{x:2,y:5}],openings:[{type:'door',points:[{x:2,y:4},{x:2,y:5}]}]});
  const recognizedScaled=engine.makeScene('recognized',4.5,5,1.44);
  assert(Math.abs(recognizedScaled.width-5.4)<.001&&Math.abs(recognizedScaled.depth-6)<.001,'识别轮廓宽深/面积倍率未生效');
  assert(Math.abs(recognizedScaled.openings[0].points[1].y-recognizedScaled.openings[0].points[0].y-1.5)<.001,'识别门洞没有随轮廓同步缩放');
  engine.setRecognizedRoomOverrideForTest(null);

  const cases = [
    {programId:'bedroom', width:3.2, depth:4.7, required:{bed:1,wardrobe:1,night:2,desk:1,chair:1}, minPlaced:7, enrich:['bedroomLoveseat','lounge','bench','bedroomDisplay','bedroomInfillCabinet']},
    // 13.68㎡在床尾凳改为“10–15cm 缝 + 外侧 0.42m 共享落脚区”后，
    // 不再强迫每个解都塞入床尾凳；较大的 4.2×4.5 房间仍必须覆盖该语义。
    {programId:'bedroom', width:3.6, depth:3.8, required:{bed:1,wardrobe:1,night:2,desk:1,chair:1}, minPlaced:7},
    // 填缝柜已改为搜索完成后的墙面补全，不再计入 Beam 的硬家具落地数。
    {programId:'bedroom', width:4.2, depth:4.5, required:{bed:1,wardrobe:1,night:2,desk:1,chair:1,bench:1}, minPlaced:7},
    {programId:'living', width:4.2, depth:3.8, required:{sofa:1,tv:1,coffee:1,arm:1}, minPlaced:6},
    {programId:'living', width:5.8, depth:4.8, required:{sofa:1,tv:1,coffee:1,arm:1}, minPlaced:7},
    {programId:'living', width:7.2, depth:5.5, required:{sofa:1,tv:1,coffee:1,arm:1}, minPlaced:10}
  ];

  const results = [];
  for (const testCase of cases) {
    const result = engine.autoSelectInventory({...testCase, shape:'rect'});
    const solution = result.probe.solutions[0];
    const counts = actualCounts(solution);
    const label = `${testCase.programId} ${testCase.width}x${testCase.depth}`;
    assert(result.feasible && solution, `${label}: 没有最终方案`);
    assert(solution.evaluation?.qualityPass, `${label}: 严格质量验收未通过`);
    assertRetainedNodesHaveChildren(result.probe.beamTree, label);
    assertScoreAndPruneObservability(engine, solution, result.probe.beamTree, label);
    if (testCase.programId === 'bedroom') assertOptionalRepeatedTypeCanSkipAndContinue(solution, result.probe.beamTree, 'night', label);
    if (testCase.programId === 'bedroom') {
      assert(!solution.decorItems?.some(item => item.kind === 'rug'), `${label}: 卧室不应自动生成地毯`);
      assert(!solution.decorItems?.some(item => ['activityZone','activityTable','activityCushion','activityChair','activityLoveseat'].includes(item.kind)), `${label}: 不应再用活动区图形或免碰撞家具解释空白`);
      const benchItem=solution.inventoryItems?.find(item=>item.typeId==='bench'&&solution.poses[item.id]);
      if(benchItem){
        const benchPose=solution.poses[benchItem.id],zone=engine.functionalZones(benchItem,benchPose)[0];
        assert(benchPose.relation==='bed-foot'&&benchPose.relationGap>=.095&&benchPose.relationGap<=.155,`${label}: 床尾凳未按 10–15cm 床尾关系摆放`);
        assert(zone?.depth>=.41&&/共享落脚区/.test(zone.label),`${label}: 床尾凳外侧没有保留约 0.42m 共享落脚区`);
      }
      for(const item of solution.inventoryItems?.filter(item=>item.typeId==='lounge'&&solution.poses[item.id])||[]){
        assert(solution.poses[item.id].anchor==='wall',`${label}: 硬家具休闲椅没有贴墙`);
      }
    }
    requireTypes(counts, testCase.required, label);
    const postLayoutFurniture=(solution.decorItems||[]).filter(item=>item.collision==='post-layout').length;
    assert(Object.values(counts).reduce((sum, value) => sum + value, 0)+postLayoutFurniture >= testCase.minPlaced, `${label}: 实际落地家具过少 ${JSON.stringify(counts)} + 末轮柜 ${postLayoutFurniture}`);
    if (counts.diningTable) assert((counts.diningChair || 0) >= 2, `${label}: 出现有餐桌无至少两把餐椅的不完整餐组`);
    if ((counts.infillCabinet || 0) >= 2) {
      const infillWalls = solution.inventoryItems
        .filter(item => item.typeId === 'infillCabinet' && solution.poses[item.id])
        .map(item => solution.poses[item.id].wallIndex);
      assert(new Set(infillWalls).size === infillWalls.length, `${label}: 多组定制柜重复占用同一面墙`);
    }
    if (testCase.enrich) assert(testCase.enrich.some(typeId => counts[typeId])||postLayoutFurniture>0, `${label}: 没有小沙发/休闲/沿墙补齐家具`);
    results.push({room:label, milliseconds:+result.totalTimeMs.toFixed(1), attempts:result.attempts, score:solution.evaluation.total, placed:counts});
  }

  // 用户明确选中床尾凳时，若几何上存在合法位置，必须保留真实放置分支；
  // 不能因为它是 0–1 可选家具或较晚的局部评分而只留下“跳过”。
  engine.setProgram('bedroom');
  const selectedBenchSnapshot={
    counts:Object.fromEntries(Object.keys(engine.CONFIGS.bedroom.counts).map(id=>[id,0])),
    dimensions:Object.fromEntries(Object.entries(engine.CONFIGS.bedroom.dimensions).map(([id,dims])=>[id,{...dims}]))
  };
  Object.assign(selectedBenchSnapshot.counts,{bed:1,night:2,bench:1,wardrobe:1,desk:1,chair:1});
  engine.applyProgramSnapshot('bedroom',selectedBenchSnapshot);
  const selectedBenchProbe=engine.search(engine.makeScene('rect',3.6,3.8,1),{beamWidth:72,topK:6,recordBeamTree:true});
  const selectedBenchSolution=selectedBenchProbe.solutions.find(solution=>{
    const itemById=new Map(engine.getFurniture().map(item=>[item.id,item.typeId]));
    return Object.keys(solution.poses||{}).some(id=>itemById.get(id)==='bench');
  });
  assert(selectedBenchSolution,'显式选择床尾凳且房间可容纳时，搜索只保留了跳过分支');

  // L 型会客组必须镜像：边几只能在非贵妃侧，单椅继续位于边几前方；
  // 电视柜始终对准沙发主体中心，不能随贵妃位横向偏移。
  engine.applyFurnitureCatalog(serverConfig.furnitureRules);
  for(const shape of ['l-left','l-right']){
    engine.applyProgramSnapshot('living',{
      counts:{...engine.CONFIGS.living.counts,sofa:1,side:1,arm:1,tv:1,coffee:1},
      dimensions:Object.fromEntries(Object.entries(engine.CONFIGS.living.dimensions).map(([id,dims])=>[id,{...dims}])),
      sofaPreset:shape
    });
    const items=engine.getFurniture(),sofa=items.find(item=>item.typeId==='sofa'),side=items.find(item=>item.typeId==='side'),arm=items.find(item=>item.typeId==='arm'),tv=items.find(item=>item.typeId==='tv'),scene=engine.makeScene('rect',6,5,1),sofaPose={x:3,y:1.3,rotation:0,normal:{x:0,y:1},wallDir:{x:1,y:0},anchor:'zone',overrideShape:shape,overrideW:2.8,overrideD:1.65},state={poses:{[sofa.id]:sofaPose}};
    const sideRows=engine.generateCandidates(side,state,scene).filter(row=>!row.pose.skip),expectedSide=shape==='l-left'?'right':'left';
    assert(sideRows.length&&sideRows.every(row=>row.pose.relationSide===expectedSide),`${shape}: 边几没有只保留非贵妃侧`);
    state.poses[side.id]=sideRows[0].pose;
    const armRows=engine.generateCandidates(arm,state,scene).filter(row=>!row.pose.skip);
    assert(armRows.some(row=>row.pose.relationTarget===side.id&&row.pose.relationSide==='front'),`${shape}: 单椅没有形成“边几前方”组合链候选`);
    const tvRows=engine.generateCandidates(tv,{poses:{[sofa.id]:sofaPose}},scene).filter(row=>row.pose.relation==='sofa-facing');
    assert(tvRows.length&&tvRows.every(row=>Math.abs(row.pose.x-sofaPose.x)<1e-6),`${shape}: 电视柜没有对准沙发主体中心`);
  }

  // 3.54×6.60m 大单间必须用正式硬家具会客组完成空间，不再用活动区解释空白。
  engine.applyFurnitureCatalog(serverConfig.furnitureRules);engine.setLayoutDensityMode('rich');
  const studioResult=engine.autoSelectInventory({programId:'bedroom',shape:'rect',width:3.54,depth:6.60}),studioSolution=studioResult.probe.solutions[0],studioCounts=actualCounts(studioSolution),studioItems=new Map(studioSolution.inventoryItems.map(item=>[item.typeId,item])),studioLoveseat=studioItems.get('bedroomLoveseat'),studioTv=studioItems.get('tvbench');
  requireTypes(studioCounts,{bedroomLoveseat:1,bedroomTeaTable:1,tvbench:1},'大单间会客组');
  const mediaPair=studioSolution.poses[studioTv.id].relation==='bedroom-media-facing'||
    (studioSolution.poses[studioLoveseat.id].relation==='bedroom-seat-media-facing'&&studioSolution.poses[studioLoveseat.id].relationTarget===studioTv.id);
  assert(mediaPair,'大单间小沙发与电视柜没有形成正对关系');
  assert(!studioSolution.decorItems?.some(item=>item.kind==='activityZone'),'大单间仍用活动区图形解释空白');

  // 第一个户型识别样例中的 1 号长条卧室：墙段很多但面积不算大。
  // 这里专门防止定制柜预算再次退化成“只按面积最多下一次”。
  const sample = JSON.parse(fs.readFileSync(path.join(__dirname, 'samples', 'demo-family-100.json'), 'utf8')).data;
  const rawRoom = sample.room_data[0][1].slice(0, -1);
  const minX = Math.min(...rawRoom.map(point => point[0]));
  const minY = Math.min(...rawRoom.map(point => point[1]));
  const scale = sample.scale_rate;
  const normalizePoint = point => ({x:(point[0]-minX)*scale, y:(point[1]-minY)*scale});
  let recognizedPolygon = rawRoom.map(normalizePoint);
  const signedArea = recognizedPolygon.reduce((sum, point, index) => {
    const next = recognizedPolygon[(index + 1) % recognizedPolygon.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2;
  if (signedArea < 0) recognizedPolygon = recognizedPolygon.reverse();
  const relevantOpenings = [
    {type:'window', points:[[294.90188694000244,726],[205,726]].map(normalizePoint)},
    {type:'door', points:[[252.09811305999756,402],[291.05555555555554,402]].map(normalizePoint)}
  ];
  engine.setProgram('bedroom');
  engine.setRecognizedRoomOverrideForTest({programId:'bedroom', polygon:recognizedPolygon, openings:relevantOpenings});
  const recognizedResult = engine.autoSelectInventory({programId:'bedroom', width:2.95, depth:6.92, shape:'recognized'});
  engine.setRecognizedRoomOverrideForTest(null);
  const recognizedSolution = recognizedResult.probe.solutions[0];
  assert(recognizedResult.feasible && recognizedSolution, '户型样例长条卧室：没有最终方案');
  const recognizedCounts = actualCounts(recognizedSolution);
  const recognizedInfills = (recognizedSolution.decorItems || []).filter(item => item.kind === 'postDisplayCabinet');
  assert(!(recognizedSolution.inventoryItems || []).some(item=>item.typeId==='bedroomInfillCabinet'), '户型样例长条卧室：填缝柜仍进入了 Beam 硬家具库存');
  // 预算是上限而不是强制数量：长条房间若硬家具已经占满合法墙段，可以为 0；
  // 关键是填缝不得为了凑数重新进入 Beam 或覆盖已完成的家具/通道。
  const repeatedCabinetBody=recognizedInfills.some((left,index)=>recognizedInfills.slice(index+1).some(right=>
    left.wallIndex===right.wallIndex&&Math.abs(left.x-right.x)<(left.w+right.w)/2-.005&&Math.abs(left.y-right.y)<(left.d+right.d)/2-.005));
  assert(!repeatedCabinetBody, '户型样例长条卧室：后处理定制柜重复占用同一墙段');
  results.push({room:'recognized bedroom #1', milliseconds:+recognizedResult.totalTimeMs.toFixed(1), attempts:recognizedResult.attempts, score:recognizedSolution.evaluation.total, placed:recognizedCounts});

  console.table(results.map(row => ({room:row.room, ms:row.milliseconds, attempts:row.attempts, score:row.score, placed:Object.values(row.placed).reduce((a,b)=>a+b,0)})));
  console.log(JSON.stringify(results, null, 2));
  console.log(`PASS: ${results.length} 组卧室/客厅基线场景全部通过`);
}, 0);
