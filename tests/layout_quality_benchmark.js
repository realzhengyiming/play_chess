const fs = require('fs');
const path = require('path');
const {loadRuntimeConfig}=require('./runtime_config');
globalThis.RoomChessConfigContract=require('../assets/js/config-contract.js');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/js/space-chess.js'), 'utf8');
new Function(source)();

const CASES = [
  ['bedroom', 'rect', 3.4, 3.6],
  ['bedroom', 'rect', 3.2, 4.7],
  ['bedroom', 'rect', 3.6, 3.8],
  ['bedroom', 'lshape', 4.2, 4.6],
  ['bedroom', 'cut', 4.2, 4.5],
  ['bedroom', 'notch', 4.6, 5.0],
  ['living', 'rect', 4.2, 3.8],
  ['living', 'rect', 4.8, 4.2],
  ['living', 'rect', 5.8, 4.8],
  ['living', 'lshape', 5.8, 4.8],
  ['living', 'cut', 6.2, 5.0],
  ['living', 'notch', 6.4, 5.2],
  ['living', 'rect', 7.2, 5.5],
];
const caseFilter=process.argv.find(arg=>arg.startsWith('--case='))?.slice('--case='.length);
const ACTIVE_CASES=caseFilter?CASES.filter(([programId,shape,width,depth])=>`${programId}/${shape}/${width}x${depth}`===caseFilter):CASES;

const percentile = (values, ratio) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))];
};

const rounded = value => Number.isFinite(value) ? +value.toFixed(3) : null;

setTimeout(() => {
  const engine = globalThis.RoomChessEngine;
  if (!engine) throw new Error('RoomChessEngine 未导出');
  const {config,configPath}=loadRuntimeConfig(root);
  if (!engine.applyGlobalConfig(config)) throw new Error(`当前全局配置加载失败：${configPath}`);
  engine.setLayoutDensityMode('rich');
  engine.setCustomCabinetEnabled(true);

  const rows = ACTIVE_CASES.map(([programId, shape, width, depth]) => {
    const result = engine.autoSelectInventory({ programId, shape, width, depth });
    const solution = result.probe?.solutions?.[0];
    if (!solution) throw new Error(`${programId}/${shape}/${width}x${depth}: 无方案`);
    const scores = solution.evaluation.scores;
    const diagnostics = solution.evaluation.diagnostics || {};
    const ground = diagnostics.ground || {};
    const wall = diagnostics.wallDetails || {};
    const modules = diagnostics.modules || {};
    const sizePolicy = diagnostics.sizePolicy || {};
    const placedIds=Object.keys(solution.poses||{}),decor=solution.decorItems||[];
    return {
      case: `${programId}/${shape}/${width}x${depth}`,
      milliseconds: rounded(result.totalTimeMs),
      attempts: result.attempts,
      nodes: result.totalNodes,
      anchors: result.scene.compiledAnchors?.length ?? 0,
      placed: Object.keys(solution.poses || {}).length,
      total: solution.evaluation.total,
      qualityPass: Boolean(solution.evaluation.qualityPass),
      function: scores.function,
      modules: scores.modules ?? null,
      ground: scores.ground,
      wall: scores.storage,
      relation: scores.relation,
      circulation: scores.circulation,
      composition: scores.composition,
      largestVoidRatio: rounded(ground.largestVoidRatio),
      unreachableFreeRatio: rounded(ground.unreachableFreeRatio),
      narrowPocketRatio: rounded(ground.narrowPocketRatio),
      floorBalanceDistance: rounded(ground.balanceDistance),
      deadPockets: ground.deadPockets ?? null,
      wallCornerSlivers: wall.cornerSlivers ?? null,
      wallInternalSlivers: wall.internalSlivers ?? null,
      wallSevereGaps: wall.severeGaps ?? null,
      unusedWallRatio:rounded(wall.unusedWallRatio),
      emptyWallScore:rounded(wall.emptyWallScore),
      largeRoomWallCoherent:diagnostics.largeRoomWallCoherent ?? null,
      largeRoomGroundCoherent:diagnostics.largeRoomGroundCoherent ?? null,
      completeModules: modules.completeCount ?? null,
      moduleScore: rounded(modules.score),
      regression:{
        hasBench:placedIds.some(id=>id==='bench'||id.startsWith('bench')),
        hasTvbench:placedIds.some(id=>id==='tvbench'||id.startsWith('tvbench')),
        hasArm:placedIds.some(id=>id.startsWith('arm')),
        hasDiningTable:Boolean(solution.poses?.diningTable),
        diningChairs:placedIds.filter(id=>id.startsWith('diningChair')).length,
        diningWall:solution.poses?.diningTable?.candidateRuleId==='dining-wall',
        diningWidth:rounded(solution.poses?.diningTable?.overrideW),
        deskWidth:rounded(solution.poses?.desk?.overrideW),
        deskTarget:rounded(sizePolicy.details?.find(row=>row.typeId==='desk')?.targetWidth),
        maxPostWallRun:rounded(Math.max(0,...decor.filter(row=>row.kind==='postDisplayCabinet').map(row=>Number(row.runWidth)||0))),
        elevatedDecor:decor.filter(row=>!['rug','postDisplayCabinet'].includes(row.kind)).map(row=>row.kind),
      },
      ...(process.argv.includes('--debug') ? {
        emptyGround: engine.evaluateFull({ poses: {} }, result.scene).diagnostics.ground,
        incompleteModules: modules.incomplete || [],
        poses: Object.fromEntries(Object.entries(solution.poses || {}).map(([id, pose]) => [id, {
          x: rounded(pose.x), y: rounded(pose.y), wall: pose.wallIndex, relation: pose.relation,
          width: rounded(pose.overrideW), wallEndGap: rounded(pose.wallEndGap), wallClosureGap: rounded(pose.wallClosureGap), rule: pose.candidateRuleId,
        }])),
        trials: result.trials,
      } : {}),
    };
  });

  const times = rows.map(row => row.milliseconds);
  const report = {
    generatedAt: new Date().toISOString(),
    deterministic: true,
    cases: rows,
    summary: {
      count: rows.length,
      p50Ms: rounded(percentile(times, 0.50)),
      p95Ms: rounded(percentile(times, 0.95)),
      maxMs: rounded(Math.max(...times)),
      totalMs: rounded(times.reduce((sum, value) => sum + value, 0)),
      qualityPasses: rows.filter(row => row.qualityPass).length,
    },
  };

  if (process.argv.includes('--assert-quality')) {
    const failures = rows.filter(row => !row.qualityPass || row.wallSevereGaps > 0 || row.ground < 58 || row.wall < 50);
    const grandLiving = rows.find(row => row.case === 'living/rect/7.2x5.5');
    if (grandLiving && grandLiving.modules < 85) failures.push(grandLiving);
    const compactBedroom=rows.find(row=>row.case==='bedroom/rect/3.4x3.6');
    if(compactBedroom&&!compactBedroom.regression.hasBench)failures.push(compactBedroom);
    if(compactBedroom&&(compactBedroom.regression.deskWidth??0)<1.2)failures.push(compactBedroom);
    const mediaBedroom=rows.find(row=>row.case==='bedroom/rect/3.6x3.8');
    if(mediaBedroom&&!mediaBedroom.regression.hasTvbench)failures.push(mediaBedroom);
    const compactDining=rows.find(row=>row.case==='living/rect/4.8x4.2');
    if(compactDining&&(!compactDining.regression.hasArm||!compactDining.regression.hasDiningTable||compactDining.regression.diningChairs<1||!compactDining.regression.diningWall))failures.push(compactDining);
    if(compactDining&&compactDining.placed<8)failures.push(compactDining);
    if(grandLiving&&(grandLiving.regression.diningWidth??0)<1.6)failures.push(grandLiving);
    for(const row of rows)if(row.anchors>140)failures.push(row);
    for(const row of rows)if((row.regression.maxPostWallRun??0)>.81)failures.push(row);
    for(const row of rows)if(row.regression.elevatedDecor.length)failures.push(row);
    if (failures.length) throw new Error(`质量基准失败：${[...new Set(failures.map(row => row.case))].join(', ')}`);
  }

  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    console.table(rows);
    console.log('SUMMARY', report.summary);
  }
}, 0);
