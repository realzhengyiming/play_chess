const fs = require('fs');
const path = require('path');
const {loadRuntimeConfig} = require('./runtime_config');

globalThis.RoomChessConfigContract = require('../assets/js/config-contract.js');

const root = path.resolve(__dirname, '..');
new Function(fs.readFileSync(path.join(root, 'assets/js/space-chess.js'), 'utf8'))();

const targets = [
  {file: 'case_1_145.json', totalArea: 145, roomIndex: 7},
  {file: 'demo-family-100.json', totalArea: 100, roomIndex: 7},
];

setTimeout(() => {
  const engine = globalThis.RoomChessEngine;
  const {config} = loadRuntimeConfig(root);
  const rules = config.layoutConstraints.postLayout.wallComplements;
  const minimumModule = Number(rules.programs.living.minWidth);
  const jambClearance = Number(rules.doorJambClearance) || 0;
  const failures = [];
  const rows = [];

  for (const target of targets) {
    const payload = JSON.parse(fs.readFileSync(path.join(root, 'samples', target.file), 'utf8'));
    const room = engine.prepareRecognizedRooms(payload, target.totalArea)[target.roomIndex];
    const label = `${target.file} #${target.roomIndex + 1}`;
    if (!room || room.type !== 'living_room') {
      failures.push(`${label}: 目标客厅不存在`);
      continue;
    }

    engine.applyGlobalConfig(config);
    engine.setLayoutDensityMode('rich');
    engine.setCustomCabinetEnabled(true);
    engine.setProgram('living');
    engine.setRecognizedRoomOverrideForTest({
      programId: 'living',
      polygon: room.polygon,
      openings: room.openings || [],
      sourceType: room.type,
    });
    const result = engine.autoSelectInventory({programId: 'living', shape: 'recognized', width: room.width, depth: room.depth});
    engine.setRecognizedRoomOverrideForTest(null);
    const solution = result.probe?.solutions?.[0];
    if (!solution) {
      failures.push(`${label}: 无方案`);
      continue;
    }

    const complements = (solution.decorItems || []).filter(row => row.kind === 'postDisplayCabinet');
    const undersized = complements.filter(row => Number(row.runWidth) + 1e-6 < minimumModule);
    const obsolete = complements.filter(row => /定制收口/.test(row.label || ''));
    const doorSide = complements.filter(row => (result.scene.doors || []).some(door => {
      const endpoints = door.a && door.b
        ? [door.a, door.b]
        : [{x: door.x0, y: door.y}, {x: door.x1, y: door.y}];
      return endpoints.some(point => Math.abs(point.x - row.x) <= row.w / 2 + jambClearance
        && Math.abs(point.y - row.y) <= row.d / 2 + jambClearance);
    }));

    if (!complements.length) failures.push(`${label}: 没有覆盖到定制展示柜生成路径`);
    if (undersized.length) failures.push(`${label}: 仍有小于 ${minimumModule.toFixed(2)}m 的柜体`);
    if (obsolete.length) failures.push(`${label}: 仍出现“定制收口”类型`);
    if (doorSide.length) failures.push(`${label}: 门框旁仍出现定制柜`);
    rows.push({
      room: label,
      area: room.area.toFixed(1),
      furniture: Object.keys(solution.poses || {}).length,
      complements: complements.map(row => row.label).join(' | '),
      quality: solution.evaluation.qualityPass ? 'pass' : 'warn',
      ms: result.totalTimeMs.toFixed(1),
    });
  }

  console.table(rows);
  if (failures.length) throw new Error(`定制柜模数回归失败：\n- ${failures.join('\n- ')}`);
  console.log(`PASS: 小填缝柜类型已移除，所有定制展示柜最小模数为 ${minimumModule.toFixed(2)}m，门框端点留空 ${jambClearance.toFixed(2)}m`);
}, 0);
