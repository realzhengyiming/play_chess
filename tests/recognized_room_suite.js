const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
new Function(fs.readFileSync(path.join(root, 'assets/js/space-chess.js'), 'utf8'))();

const SAMPLE_CASES = [
  {file:'demo-family-100.json', area:100},
  {file:'demo-family-73.json', area:73},
];
const SUPPORTED = {bedroom:'bedroom', living_room:'living'};
const reportOnly = process.argv.includes('--report-only');
const verbose = process.argv.includes('--verbose');
const assertQuality = process.argv.includes('--assert-quality');

setTimeout(() => {
  const engine = globalThis.RoomChessEngine;
  if (!engine?.prepareRecognizedRooms) throw new Error('页面户型解析函数未导出');
  const config = JSON.parse(fs.readFileSync(path.join(root, 'server_config/furniture-config-default.json'), 'utf8'));
  const rows = [];
  const failures = [];
  const qualityWarnings = [];
  const observedDoorKinds = new Set();

  for (const sampleCase of SAMPLE_CASES) {
    const payload = JSON.parse(fs.readFileSync(path.join(root, 'samples', sampleCase.file), 'utf8'));
    const rooms = engine.prepareRecognizedRooms(payload, sampleCase.area);
    rooms.forEach((room, index) => {
      const programId = SUPPORTED[room.type];
      if (!programId || !room.polygon) return;
      engine.applyFurnitureCatalog(config.furnitureRules);
      if (config.designQualityRules && engine.applyDesignQualityRules) engine.applyDesignQualityRules(config.designQualityRules);
      engine.setLayoutDensityMode('rich');
      engine.setCustomCabinetEnabled(true);
      engine.setProgram(programId);
      engine.setRecognizedRoomOverrideForTest({programId, polygon:room.polygon, openings:room.openings || [], sourceType:room.type});
      const result = engine.autoSelectInventory({programId, shape:'recognized', width:room.width, depth:room.depth});
      engine.setRecognizedRoomOverrideForTest(null);
      const solution = result.probe?.solutions?.[0];
      const label = `${sampleCase.file} #${index + 1} ${room.type}`;
      const expectedDoorTypes = (room.openings || []).filter(opening => String(opening.type).startsWith('door')).map(opening => opening.type);
      const actualDoors = result.scene.doors || [];
      const actualDoorTypes = actualDoors.map(door => `${door.type}:${door.kind}`);
      actualDoors.forEach(door => observedDoorKinds.add(door.kind));
      if (actualDoors.length !== Math.max(1, expectedDoorTypes.length)) failures.push(`${label}: 应保留 ${expectedDoorTypes.length} 扇识别门，实际 ${actualDoors.length}`);
      expectedDoorTypes.forEach((type, doorIndex) => {
        const expectedKind = /slide|slince|sliding/i.test(type) ? 'slide' : /hole|opening|passage/i.test(type) ? 'opening' : 'swing';
        if (actualDoors[doorIndex]?.kind !== expectedKind) failures.push(`${label}: ${type} 被错误画成 ${actualDoors[doorIndex]?.kind || '缺失'}`);
      });
      if (!solution) {
        failures.push(`${label}: 无方案`);
        rows.push({room:label, area:+room.area.toFixed(1), ms:+result.totalTimeMs.toFixed(1), placed:0, score:'-', quality:'-', doors:actualDoorTypes.join('|'), connected:'-', islandM2:'-'});
        return;
      }
      const reach = solution.evaluation.reach || engine.computeReachability(solution, result.scene, [engine.FLOW_RADII[0]]);
      const islandArea = Number(reach.unreachableArea || 0);
      const placed = Object.keys(solution.poses || {}).length;
      rows.push({
        room:label, area:+room.area.toFixed(1), ms:+result.totalTimeMs.toFixed(1), placed,
        score:solution.evaluation.total,
        quality:solution.evaluation.qualityPass ? 'pass' : Object.entries(solution.evaluation.scores).filter(([key, value]) => ({modules:solution.evaluation.diagnostics.requiredModuleScore,circulation:55,relation:62,composition:50,storage:50,ground:58,comfort:50,preference:45}[key] ?? -Infinity) > value).map(([key, value]) => `${key}:${value}`).join(','),
        doors:actualDoorTypes.join('|'), connected:+reach.connectedRatio.toFixed(3), islandM2:+islandArea.toFixed(3),
      });
      if (!solution.evaluation.qualityPass) qualityWarnings.push(`${label}: 未通过质量门槛`);
      if (verbose && !solution.evaluation.qualityPass) console.dir({label, plans:result.plans, trials:result.trials, scores:solution.evaluation.scores, diagnostics:solution.evaluation.diagnostics, poses:Object.keys(solution.poses)}, {depth:5});
      if (!reach.hardPass) failures.push(`${label}: 存在不可达家具或孤岛`);
      if (islandArea > .08) failures.push(`${label}: 孤岛面积 ${islandArea.toFixed(2)}㎡`);
      if (reach.minimumPassage < .5) failures.push(`${label}: 最小通路低于 0.50m`);
    });
  }

  for (const kind of ['swing','slide','opening']) if (!observedDoorKinds.has(kind)) failures.push(`门型回归未覆盖 ${kind}`);

  console.table(rows);
  if (assertQuality) failures.push(...qualityWarnings);
  if (!reportOnly && failures.length) throw new Error(`户型全样例失败：\n- ${failures.join('\n- ')}`);
  console.log(`${reportOnly ? 'REPORT' : 'PASS'}: ${rows.length} 个可选卧室/客厅已测试，门型/0.50m 通路/孤岛硬规则通过${qualityWarnings.length ? `；另有 ${qualityWarnings.length} 个质量改进项` : ''}${failures.length ? `，硬失败 ${failures.length} 项` : ''}`);
}, 0);
