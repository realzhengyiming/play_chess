const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'bedroom-space-chess-V3.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
if (!scripts.length) throw new Error('没有在主页面中找到空间棋脚本');
new Function(scripts[0][1])();

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

setTimeout(() => {
  const engine = globalThis.RoomChessEngine;
  assert(engine, 'RoomChessEngine 未导出');
  const serverConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'server_config', 'furniture-config-default.json'), 'utf8'));
  assert(engine.applyFurnitureCatalog(serverConfig.furnitureRules), 'FastAPI 默认家具配置加载失败');
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
    // 13.68㎡在床尾凳改为“10–15cm 缝 + 外侧 0.6m 硬落脚区”后，
    // 不再强迫每个解都塞入床尾凳；较大的 4.2×4.5 房间仍必须覆盖该语义。
    {programId:'bedroom', width:3.6, depth:3.8, required:{bed:1,wardrobe:1,night:2,desk:1,chair:1}, minPlaced:7},
    {programId:'bedroom', width:4.2, depth:4.5, required:{bed:1,wardrobe:1,night:2,desk:1,chair:1,bench:1}, minPlaced:8},
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
    if (testCase.programId === 'bedroom') {
      assert(!solution.decorItems?.some(item => item.kind === 'rug'), `${label}: 卧室不应自动生成地毯`);
      assert(solution.decorItems?.some(item => item.kind === 'activityZone'), `${label}: 剩余连续空地没有生成活动区`);
      assert(solution.decorItems?.some(item => item.kind === 'activityTable'), `${label}: 活动区没有生成轻量互动家具`);
      const benchItem=solution.inventoryItems?.find(item=>item.typeId==='bench'&&solution.poses[item.id]);
      if(benchItem){
        const benchPose=solution.poses[benchItem.id],zone=engine.functionalZones(benchItem,benchPose)[0];
        assert(benchPose.relation==='bed-foot'&&benchPose.relationGap>=.095&&benchPose.relationGap<=.155,`${label}: 床尾凳未按 10–15cm 床尾关系摆放`);
        assert(zone?.depth>=.59&&/外侧落脚区/.test(zone.label),`${label}: 床尾凳外侧没有保留 0.6m 落脚区`);
      }
      for(const item of solution.inventoryItems?.filter(item=>item.typeId==='lounge'&&solution.poses[item.id])||[]){
        assert(solution.poses[item.id].anchor==='wall',`${label}: 硬家具休闲椅没有贴墙`);
      }
    }
    requireTypes(counts, testCase.required, label);
    assert(Object.values(counts).reduce((sum, value) => sum + value, 0) >= testCase.minPlaced, `${label}: 实际落地家具过少`);
    if (counts.diningTable) assert((counts.diningChair || 0) >= 2, `${label}: 出现有餐桌无至少两把餐椅的不完整餐组`);
    if (testCase.enrich) assert(testCase.enrich.some(typeId => counts[typeId]), `${label}: 没有小沙发/休闲/沿墙补齐家具`);
    results.push({room:label, milliseconds:+result.totalTimeMs.toFixed(1), attempts:result.attempts, score:solution.evaluation.total, placed:counts});
  }
  console.table(results.map(row => ({room:row.room, ms:row.milliseconds, attempts:row.attempts, score:row.score, placed:Object.values(row.placed).reduce((a,b)=>a+b,0)})));
  console.log(JSON.stringify(results, null, 2));
  console.log(`PASS: ${results.length} 组卧室/客厅基线场景全部通过`);
}, 0);
