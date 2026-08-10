const fs = require('fs');
const path = require('path');
const {loadRuntimeConfig} = require('./runtime_config');

globalThis.RoomChessConfigContract = require('../assets/js/config-contract.js');
const root = path.resolve(__dirname, '..');
new Function(fs.readFileSync(path.join(root, 'assets/js/space-chess.js'), 'utf8'))();

setTimeout(() => {
  const engine = globalThis.RoomChessEngine;
  const {config} = loadRuntimeConfig(root);
  const payload = JSON.parse(fs.readFileSync(path.join(root, 'samples/demo-family-100.json'), 'utf8'));
  const room = engine.prepareRecognizedRooms(payload, 100)[7];

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
  if (!solution) throw new Error('40.11㎡目标客厅没有生成方案');

  const items = new Map(engine.getFurniture().map(item => [item.id, item]));
  const unsupported = Object.entries(solution.poses || {}).filter(([id, pose]) =>
    (pose.anchor === 'wall' || Number.isInteger(pose.wallIndex) && pose.wallIndex >= 0)
      && !engine.fullBackWallSupport(items.get(id), pose, result.scene));
  if (unsupported.length) {
    throw new Error(`仍有背边悬空家具：${unsupported.map(([id]) => id).join(', ')}`);
  }

  const tvPose = solution.poses.tv;
  if (!tvPose || !engine.fullBackWallSupport(items.get('tv'), tvPose, result.scene)) {
    throw new Error('电视柜没有完整背靠连续墙段');
  }
  const wall = result.scene.walls[tvPose.wallIndex];
  const tv = items.get('tv');
  const along = (tvPose.x - wall.a.x) * wall.dir.x + (tvPose.y - wall.a.y) * wall.dir.y;
  const span = tvPose.overrideW || tv.w;
  console.table([{
    furniture: '电视柜',
    wall: tvPose.wallIndex + 1,
    wallLength: wall.length.toFixed(3),
    backStart: (along - span / 2).toFixed(3),
    backEnd: (along + span / 2).toFixed(3),
    supported: true,
  }]);
  console.log(`PASS: ${Object.keys(solution.poses).length} 件家具的墙锚点均由完整连续背墙支撑`);
}, 0);
