const fs = require('fs');
const path = require('path');
const {loadRuntimeConfig}=require('./runtime_config');
globalThis.RoomChessConfigContract=require('../assets/js/config-contract.js');

const root = path.resolve(__dirname, '..');
new Function(fs.readFileSync(path.join(root, 'assets/js/space-chess.js'), 'utf8'))();

const SAMPLE_CASES = [
  {file:'demo-family-100.json', area:100},
  {file:'demo-family-73.json', area:73},
  {file:'case_1_145.json', area:145},
  {file:'case_2_61.4.json', area:61.4},
  {file:'case_3_150.json', area:150},
  {file:'case_4_87.7.json', area:87.7},
  {file:'case_5_53.6.json', area:53.6},
  {file:'case_6_60.json', area:60},
  {file:'case_18_80.json', area:80},
  {file:'case_19_47.9.json', area:47.9},
];
const SUPPORTED = {bedroom:'bedroom', living_room:'living'};
const reportOnly = process.argv.includes('--report-only');
const verbose = process.argv.includes('--verbose');
const assertQuality = process.argv.includes('--assert-quality');
const assertSpeed = process.argv.includes('--assert-speed');

setTimeout(() => {
  const engine = globalThis.RoomChessEngine;
  if (!engine?.prepareRecognizedRooms) throw new Error('页面户型解析函数未导出');
  const {config}=loadRuntimeConfig(root);
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
      engine.applyGlobalConfig(config);
      engine.setLayoutDensityMode('rich');
      engine.setCustomCabinetEnabled(true);
      engine.setProgram(programId);
      engine.setRecognizedRoomOverrideForTest({programId, polygon:room.polygon, openings:room.openings || [], sourceType:room.type});
      const result = engine.autoSelectInventory({programId, shape:'recognized', width:room.width, depth:room.depth});
      engine.setRecognizedRoomOverrideForTest(null);
      const solution = result.probe?.solutions?.[0];
      const label = `${sampleCase.file} #${index + 1} ${room.type}`;
      const expectedDoorTypes = (room.openings || []).filter(opening => String(opening.type).startsWith('door')).map(opening => opening.type);
      const expectedWindows = (room.openings || []).filter(opening => String(opening.type).startsWith('window'));
      const actualDoors = result.scene.doors || [];
      const actualWindows = result.scene.windows || (result.scene.window ? [result.scene.window] : []);
      const actualDoorTypes = actualDoors.map(door => `${door.type}:${door.kind}`);
      actualDoors.forEach(door => observedDoorKinds.add(door.kind));
      if (actualDoors.length !== Math.max(1, expectedDoorTypes.length)) failures.push(`${label}: 应保留 ${expectedDoorTypes.length} 扇识别门，实际 ${actualDoors.length}`);
      expectedDoorTypes.forEach((type, doorIndex) => {
        const expectedKind = /slide|slince|sliding/i.test(type) ? 'slide' : /hole|opening|passage/i.test(type) ? 'opening' : 'swing';
        if (actualDoors[doorIndex]?.kind !== expectedKind) failures.push(`${label}: ${type} 被错误画成 ${actualDoors[doorIndex]?.kind || '缺失'}`);
      });
      actualDoors.forEach((door,doorIndex)=>{
        const shallow=Math.min(Number(door.noGo?.w)||Infinity,Number(door.noGo?.d)||Infinity);
        if(door.kind==='swing'&&Math.abs(shallow-Number(door.width||0))>.03)failures.push(`${label}: 平开门 ${doorIndex+1} 的门前矩形深度未等于门扇半径`);
        if(door.kind==='slide'&&shallow>.37)failures.push(`${label}: 推拉门 ${doorIndex+1} 的门前 buffer ${shallow.toFixed(2)}m 过深`);
      });
      if(expectedWindows.length&&actualWindows.length!==expectedWindows.length)failures.push(`${label}: 应保留 ${expectedWindows.length} 扇识别窗，实际 ${actualWindows.length}`);
      expectedWindows.forEach((opening,windowIndex)=>{
        const expectedMid=opening.mid||opening.center||((opening.a&&opening.b)?{x:(opening.a.x+opening.b.x)/2,y:(opening.a.y+opening.b.y)/2}:null),actualMid=actualWindows[windowIndex]?.mid;
        if(expectedMid&&actualMid&&Math.hypot(Number(expectedMid.x)-actualMid.x,Number(expectedMid.y)-actualMid.y)>.08)failures.push(`${label}: 窗 ${windowIndex+1} 没有保持识别位置`);
      });
      if (!solution) {
        failures.push(`${label}: 无方案`);
        rows.push({room:label, area:+room.area.toFixed(1), ms:+result.totalTimeMs.toFixed(1), attempts:result.attempts, nodes:result.totalNodes, anchors:result.scene.compiledAnchors?.length??0, placed:0, score:'-', ground:'-', wall:'-', relation:'-', path:'-', emptyWall:'-', wallGaps:'-', quality:'-', doors:actualDoorTypes.join('|'), connected:'-', islandM2:'-'});
        return;
      }
      const reach = solution.evaluation.reach || engine.computeReachability(solution, result.scene, [engine.FLOW_RADII[0]]);
      const islandArea = Number(reach.unreachableArea || 0);
      const placed = Object.keys(solution.poses || {}).length;
      const breakdown=engine.traceEvaluationBreakdown(solution.evaluation);
      const deskPose=solution.poses?.desk,deskWindowDistance=deskPose&&actualWindows.length
        ?Math.min(...actualWindows.map(windowRow=>Math.hypot(deskPose.x-windowRow.mid.x,deskPose.y-windowRow.mid.y))):null;
      const deskWidth=deskPose?(deskPose.overrideW||engine.getFurniture().find(item=>item.id==='desk')?.w||0):null;
      const itemById=new Map(engine.getFurniture().map(item=>[item.id,item]));
      const placedTypeCount=typeId=>Object.keys(solution.poses||{}).filter(id=>itemById.get(id)?.typeId===typeId).length;
      const elevatedDecor=(solution.decorItems||[]).filter(row=>!['rug','postDisplayCabinet','activityZone'].includes(row.kind));
      const invalidActivityZones=(solution.decorItems||[]).filter(row=>row.kind==='activityZone'&&(row.layer!=='floor'||row.collision!=='ignore'||row.label!=='中央活动区'));
      const doorJambClearance=Math.max(0,Number(config.layoutConstraints.postLayout.wallComplements.doorJambClearance)||0);
      const minimumCabinetModule=Math.min(...Object.values(config.layoutConstraints.postLayout.wallComplements.programs).map(row=>Number(row.minWidth)||Infinity));
      const undersizedComplements=(solution.decorItems||[]).filter(row=>row.kind==='postDisplayCabinet'&&Number(row.runWidth)+1e-6<minimumCabinetModule);
      const doorSideComplements=(solution.decorItems||[]).filter(row=>row.kind==='postDisplayCabinet'&&actualDoors.some(door=>{
        const endpoints=door.a&&door.b?[door.a,door.b]:[{x:door.x0,y:door.y},{x:door.x1,y:door.y}];
        return endpoints.some(point=>Math.abs(point.x-row.x)<=row.w/2+doorJambClearance&&Math.abs(point.y-row.y)<=row.d/2+doorJambClearance);
      }));
      const wallDetails=solution.evaluation.diagnostics.wallDetails||{},groundDetails=solution.evaluation.diagnostics.ground||{};
      const roomAspect=Math.max(room.width/Math.max(room.depth,.001),room.depth/Math.max(room.width,.001));
      const hotelBedroom=programId==='bedroom'&&room.area>=15&&roomAspect>=1.65;
      rows.push({
        room:label, area:+room.area.toFixed(1), ms:+result.totalTimeMs.toFixed(1), attempts:result.attempts, nodes:result.totalNodes, anchors:result.scene.compiledAnchors?.length??0, placed,
        score:solution.evaluation.total, daylight:breakdown.daylight, deskW:deskWidth==null?'-':+deskWidth.toFixed(2), deskWin:deskWindowDistance==null?'-':+deskWindowDistance.toFixed(2),
        ground:breakdown.ground, wall:breakdown.wall, relation:breakdown.relation, path:breakdown.circulation,
        emptyWall:breakdown.emptyWall, wallGaps:`${breakdown.severeWallGaps}/${breakdown.awkwardWallGaps}`,
        quality:solution.evaluation.qualityPass ? 'pass' : Object.entries(solution.evaluation.scores).filter(([key, value]) => ({modules:solution.evaluation.diagnostics.requiredModuleScore,circulation:55,relation:62,composition:50,storage:50,ground:58,comfort:50,preference:45}[key] ?? -Infinity) > value).map(([key, value]) => `${key}:${value}`).join(','),
        doors:actualDoorTypes.join('|'), minPass:reach.minimumPassage, connected:+reach.connectedRatio.toFixed(3), islandM2:+islandArea.toFixed(3),
      });
      if (!solution.evaluation.qualityPass) qualityWarnings.push(`${label}: 未通过质量门槛`);
      if(programId==='bedroom'&&room.area>=15&&deskWindowDistance!=null&&deskWindowDistance>2.3)failures.push(`${label}: 书桌距窗 ${deskWindowDistance.toFixed(2)}m，超过 2.30m`);
      if(programId==='bedroom'&&room.area>=20&&(deskWidth??0)<1.6)failures.push(`${label}: 20㎡以上卧室仍使用 ${(deskWidth||0).toFixed(2)}m 小书桌，未优先 1.60m 大模数`);
      if((result.scene.compiledAnchors?.length??0)>140)failures.push(`${label}: 语义锚点 ${result.scene.compiledAnchors.length} 个，超过固定预算 140`);
      if(hotelBedroom&&placedTypeCount('tvbench')<1)failures.push(`${label}: 长条卧室缺少酒店式床尾电视柜`);
      if(hotelBedroom&&placedTypeCount('bedroomLoveseat')<1)failures.push(`${label}: 长条卧室明明可行却未挑战正式小沙发`);
      if(hotelBedroom&&room.area>=20&&placedTypeCount('bench')<1)failures.push(`${label}: 20㎡以上长条卧室可行却未放床尾凳`);
      if(hotelBedroom&&room.area>=20&&placedTypeCount('bedroomDisplay')<1)failures.push(`${label}: 20㎡以上长条卧室未用浅展示柜消化空墙`);
      if(hotelBedroom){
        const tvId=Object.keys(solution.poses||{}).find(id=>itemById.get(id)?.typeId==='tvbench');
        if(tvId&&solution.poses[tvId]?.relation!=='bedroom-tv-bed-facing')failures.push(`${label}: 电视柜没有保持床对电视的酒店主轴`);
        const mediaFlanks=(solution.decorItems||[]).filter(row=>/^电视墙[左右]侧薄柜/.test(row.label||''));
        if(room.area<20&&mediaFlanks.length<2)failures.push(`${label}: 电视柜两侧薄收纳柜不足 2 组`);
        if((solution.decorItems||[]).some(row=>row.kind==='activityLoveseat'))failures.push(`${label}: 使用了活动区假沙发，未落正式家具`);
      }
      const targetMediaBedroom=sampleCase.file==='case_1_145.json'&&(index===4||index===5);
      if(targetMediaBedroom&&placedTypeCount('tvbench')<1)failures.push(`${label}: 目标大卧室缺少床对电视媒体组`);
      if(targetMediaBedroom&&placedTypeCount('bedroomLoveseat')<1)failures.push(`${label}: 目标大卧室未优先落正式单人沙发`);
      if(sampleCase.file==='demo-family-100.json'&&index===3){
        const loveseatId=Object.keys(solution.poses||{}).find(id=>itemById.get(id)?.typeId==='bedroomLoveseat');
        if(!loveseatId)failures.push(`${label}: 目标大卧室缺少正式小沙发`);
        else if(solution.poses[loveseatId].anchor!=='wall')failures.push(`${label}: 卧室小沙发没有优先背靠墙`);
      }
      if(sampleCase.file==='case_1_145.json'&&index===4){
        const bedPose=solution.poses?.bed,benchId=Object.keys(solution.poses||{}).find(id=>itemById.get(id)?.typeId==='bench'),benchPose=benchId&&solution.poses[benchId];
        if(!bedPose||!benchPose)failures.push(`${label}: 目标大卧室缺少床尾凳`);
        else {
          const lateral=bedPose.wallDir||{x:1,y:0},offset=Math.abs((benchPose.x-bedPose.x)*lateral.x+(benchPose.y-bedPose.y)*lateral.y);
          if(offset>.08)failures.push(`${label}: 床尾凳偏离床中心轴 ${offset.toFixed(2)}m`);
        }
      }
      if(hotelBedroom&&solution.evaluation.diagnostics.bedroomWallCoherent!==true)failures.push(`${label}: 酒店式媒体组和最长空墙均未满足墙面验收`);
      if(programId==='living'&&result.scene.area>=34){
        const requiredDiningChairs=result.scene.area>=40?4:2;
        if(placedTypeCount('diningTable')<1||placedTypeCount('diningChair')<requiredDiningChairs)failures.push(`${label}: 大客厅缺少真实第二功能区（至少 1 桌 ${requiredDiningChairs} 椅）`);
        const diningId=Object.keys(solution.poses||{}).find(id=>itemById.get(id)?.typeId==='diningTable');
        if(result.scene.area>=40&&diningId&&(solution.poses[diningId].overrideW||itemById.get(diningId)?.w||0)<1.6)failures.push(`${label}: 40㎡以上客厅没有使用 1.6m 大模数餐桌`);
        if(diningId&&(solution.poses[diningId].anchor!=='zone'||solution.poses[diningId].relation!=='dining-zone'))failures.push(`${label}: 大客厅餐桌仍贴墙，没有落在独立餐饮语义区`);
        if((solution.evaluation.diagnostics.diningSeatBalance??1)>.38)failures.push(`${label}: 餐椅没有围绕桌面均衡成组`);
        if((wallDetails.unusedWallRatio??1)>.48)failures.push(`${label}: 可用空墙占比 ${((wallDetails.unusedWallRatio||0)*100).toFixed(1)}%，超过 48%`);
        if((wallDetails.emptyWallScore??0)<.115)failures.push(`${label}: 空墙评分 ${((wallDetails.emptyWallScore||0)*100).toFixed(0)}，低于 11.5`);
        const largestVoidLimit=Number(config.layoutConstraints.qualityPass.largeRoomGround.maxLargestVoidRatio);
        if((groundDetails.largestVoidRatio??1)>largestVoidLimit)failures.push(`${label}: 最大连续空地占比 ${((groundDetails.largestVoidRatio||0)*100).toFixed(1)}%，超过配置上限 ${(largestVoidLimit*100).toFixed(0)}%`);
      }
      if(programId==='bedroom'&&room.area>=10&&room.area<12&&(placedTypeCount('desk')<1||placedTypeCount('chair')<1))failures.push(`${label}: 10–12㎡卧室仍缺少紧凑书桌椅组`);
      if(elevatedDecor.length)failures.push(`${label}: 仍生成非落地陈设 ${elevatedDecor.map(row=>row.kind).join('|')}`);
      if(invalidActivityZones.length)failures.push(`${label}: 中央活动区没有按配置作为地面解释层生成`);
      if(undersizedComplements.length)failures.push(`${label}: 仍生成小于 ${minimumCabinetModule.toFixed(2)}m 的填缝柜 ${undersizedComplements.map(row=>row.label).join('|')}`);
      if(doorSideComplements.length)failures.push(`${label}: 门框旁仍生成定制柜 ${doorSideComplements.map(row=>row.label).join('|')}`);
      if (assertSpeed && result.totalTimeMs > 2000) failures.push(`${label}: 搜索 ${result.totalTimeMs.toFixed(0)}ms，超过 2s 目标`);
      if (verbose) console.dir({label, plans:result.plans, trials:result.trials, alternatives:(result.probe?.solutions||[]).map(row=>({total:row.evaluation.total,qualityPass:row.evaluation.qualityPass,placed:Object.keys(row.poses||{}).length,deskW:row.poses?.desk?.overrideW,sizePolicy:row.evaluation.diagnostics?.sizePolicy})), scores:solution.evaluation.scores, diagnostics:solution.evaluation.diagnostics, poses:Object.keys(solution.poses), decor:(solution.decorItems||[]).map(row=>({kind:row.kind,label:row.label}))}, {depth:5});
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
