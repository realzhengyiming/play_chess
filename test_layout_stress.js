const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'bedroom-space-chess-V3.html'), 'utf8');
const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)][0];
if (!script) throw new Error('主页面脚本不存在');
new Function(script[1])();

const fail = message => { throw new Error(message); };
const countTypes = solution => {
  const byId = new Map((solution.inventoryItems || []).map(item => [item.id, item.typeId]));
  const counts = {};
  for (const id of Object.keys(solution.poses || {})) {
    const typeId = byId.get(id); if (typeId) counts[typeId] = (counts[typeId] || 0) + 1;
  }
  return counts;
};

setTimeout(() => {
  const engine = globalThis.RoomChessEngine;
  const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'server_config', 'furniture-config-default.json'), 'utf8'));
  if (!engine.applyFurnitureCatalog(baseline.furnitureRules)) fail('默认配置加载失败');
  engine.setLayoutDensityMode('rich');
  engine.setCustomCabinetEnabled(true);

  const cases = [
    ['bedroom','rect',2.9,3.5], ['bedroom','rect',3.2,3.6], ['bedroom','rect',3.6,3.8],
    ['bedroom','rect',4.0,4.2], ['bedroom','rect',4.6,5.0], ['bedroom','lshape',4.2,4.6],
    ['bedroom','cut',4.2,4.5], ['bedroom','notch',4.6,5.0],
    ['living','rect',3.8,3.6], ['living','rect',4.2,3.8], ['living','rect',5.0,4.2],
    ['living','rect',5.8,4.8], ['living','rect',6.5,5.0], ['living','rect',7.2,5.5],
    ['living','lshape',5.8,4.8], ['living','cut',6.2,5.0], ['living','notch',6.4,5.2]
  ];
  const rows = [];
  for (const [programId,shape,width,depth] of cases) {
    const label = `${programId}/${shape}/${width}×${depth}`;
    const result = engine.autoSelectInventory({programId,shape,width,depth});
    const solution = result.probe?.solutions?.[0];
    if (!result.feasible || !solution) fail(`${label}: 无方案`);
    if (!solution.evaluation?.qualityPass) fail(`${label}: 质量验收失败`);
    const counts = countTypes(solution), placed = Object.values(counts).reduce((a,b)=>a+b,0);
    const core = programId === 'bedroom' ? ['bed','wardrobe'] : ['sofa','tv','coffee'];
    for (const typeId of core) if (!(counts[typeId] > 0)) fail(`${label}: 缺少核心家具 ${typeId}`);
    if (counts.night) {
      const nightIds = solution.inventoryItems.filter(item => item.typeId === 'night').map(item => item.id).filter(id => solution.poses[id]);
      if (nightIds.some(id => solution.poses[id].relation !== 'bed-side')) fail(`${label}: 床头柜没有使用 bed-side 关系`);
    }
    if (counts.bench) {
      const bench = solution.inventoryItems.find(item => item.typeId === 'bench' && solution.poses[item.id]);
      if (solution.poses[bench.id].relation !== 'bed-foot') fail(`${label}: 床尾凳没有使用 bed-foot 关系`);
    }
    if (counts.chair && counts.desk) {
      const chair = solution.inventoryItems.find(item => item.typeId === 'chair' && solution.poses[item.id]);
      if (solution.poses[chair.id].relation !== 'desk-front') fail(`${label}: 工作椅没有朝向书桌`);
    }
    if (counts.diningTable && (counts.diningChair || 0) < 2) fail(`${label}: 餐桌没有成组餐椅`);
    if (programId === 'bedroom') {
      if (solution.decorItems?.some(item => item.kind === 'rug')) fail(`${label}: 卧室出现地毯`);
      if (width * depth >= 12 && !solution.decorItems?.some(item => item.kind === 'activityZone')) fail(`${label}: 未解释剩余活动空间`);
    }
    if (result.totalTimeMs > 10000) fail(`${label}: 搜索超过 10 秒 (${result.totalTimeMs.toFixed(0)} ms)`);
    rows.push({label,ms:+result.totalTimeMs.toFixed(1),attempts:result.attempts,placed,score:solution.evaluation.total,activity:solution.decorItems?.some(item=>item.kind==='activityZone')?'yes':'-'});
  }
  console.table(rows);
  console.log(`PASS: ${rows.length} 个尺寸/轮廓压力场景全部通过，总耗时 ${rows.reduce((sum,row)=>sum+row.ms,0).toFixed(1)} ms`);
}, 0);
