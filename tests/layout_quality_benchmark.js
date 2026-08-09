const fs = require('fs');
const path = require('path');
const {loadRuntimeConfig}=require('./runtime_config');
globalThis.RoomChessConfigContract=require('../assets/js/config-contract.js');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/js/space-chess.js'), 'utf8');
new Function(source)();

const CASES = [
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

  const rows = CASES.map(([programId, shape, width, depth]) => {
    const result = engine.autoSelectInventory({ programId, shape, width, depth });
    const solution = result.probe?.solutions?.[0];
    if (!solution) throw new Error(`${programId}/${shape}/${width}x${depth}: 无方案`);
    const scores = solution.evaluation.scores;
    const diagnostics = solution.evaluation.diagnostics || {};
    const ground = diagnostics.ground || {};
    const wall = diagnostics.wallDetails || {};
    const modules = diagnostics.modules || {};
    return {
      case: `${programId}/${shape}/${width}x${depth}`,
      milliseconds: rounded(result.totalTimeMs),
      attempts: result.attempts,
      nodes: result.totalNodes,
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
      completeModules: modules.completeCount ?? null,
      moduleScore: rounded(modules.score),
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
    if (failures.length) throw new Error(`质量基准失败：${[...new Set(failures.map(row => row.case))].join(', ')}`);
  }

  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    console.table(rows);
    console.log('SUMMARY', report.summary);
  }
}, 0);
