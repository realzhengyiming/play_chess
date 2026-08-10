'use strict';

const fs=require('fs');
const path=require('path');
globalThis.RoomChessConfigContract=require('../assets/js/config-contract.js');

const root=path.resolve(__dirname,'..');
const userConfigPath=process.argv[2]||'C:/Users/94859/Desktop/2d资源/room-chess-我的浏览器配置 (2).json';
new Function(fs.readFileSync(path.join(root,'assets/js/space-chess.js'),'utf8'))();

const rect=(item,pose)=>{
  const localW=pose.overrideW||item.w,localD=pose.overrideD||item.d,swapped=pose.rotation%180!==0;
  return {x:pose.x,y:pose.y,w:swapped?localD:localW,d:swapped?localW:localD};
};
const overlaps=(a,b)=>Math.abs(a.x-b.x)<(a.w+b.w)/2-1e-6&&Math.abs(a.y-b.y)<(a.d+b.d)/2-1e-6;

setTimeout(()=>{
  const engine=globalThis.RoomChessEngine,config=JSON.parse(fs.readFileSync(userConfigPath,'utf8')),failures=[],rows=[];
  const run=({programId,shape,width,depth,areaMultiplier=1,roomOverride=null})=>{
    engine.applyGlobalConfig(config);engine.setLayoutDensityMode('rich');engine.setCustomCabinetEnabled(true);engine.setProgram(programId);engine.setRecognizedRoomOverrideForTest(roomOverride);
    const result=engine.autoSelectInventory({programId,shape,width,depth,areaMultiplier});engine.setRecognizedRoomOverrideForTest(null);
    if(!result.probe?.solutions?.[0])throw new Error(`${programId} 无方案`);
    return {result,solution:result.probe.solutions[0],items:new Map(engine.getFurniture().map(item=>[item.id,item]))};
  };

  const bedroom=run({programId:'bedroom',shape:'rect',width:3.6,depth:3.8});
  const bedId=Object.keys(bedroom.solution.poses).find(id=>bedroom.items.get(id)?.typeId==='bed');
  const benchId=Object.keys(bedroom.solution.poses).find(id=>bedroom.items.get(id)?.typeId==='bench');
  if(bedId&&benchId){
    const bed=bedroom.solution.poses[bedId],bench=bedroom.solution.poses[benchId],axis=bed.wallDir||{x:1,y:0},offset=Math.abs((bench.x-bed.x)*axis.x+(bench.y-bed.y)*axis.y);
    if(offset>.08)failures.push(`床尾凳仍偏离床中心轴 ${offset.toFixed(2)}m`);
    rows.push({case:'3.6×3.8 bedroom',score:bedroom.solution.evaluation.total,benchRule:bench.candidateRuleId,benchOffset:+offset.toFixed(3),arm:'-',dining:'-',decor:(bedroom.solution.decorItems||[]).map(row=>row.label).join('|'),ms:+bedroom.result.totalTimeMs.toFixed(1)});
  }else failures.push('3.6×3.8 卧室没有同时摆下床和床尾凳');
  const tinyBedroom=(bedroom.solution.decorItems||[]).filter(row=>row.kind==='postDisplayCabinet'&&Number(row.runWidth)<.6-1e-6);
  if(tinyBedroom.length)failures.push(`卧室仍生成小填缝柜：${tinyBedroom.map(row=>row.label).join('|')}`);

  const payload=JSON.parse(fs.readFileSync(path.join(root,'samples','demo-family-100.json'),'utf8'));
  const room=engine.prepareRecognizedRooms(payload,100)[7];
  const living=run({programId:'living',shape:'recognized',width:room.width,depth:room.depth,areaMultiplier:1.79,roomOverride:{programId:'living',polygon:room.polygon,openings:room.openings||[],sourceType:room.type}});
  const poses=living.solution.poses,itemById=living.items;
  const armIds=Object.keys(poses).filter(id=>itemById.get(id)?.typeId==='arm');
  const orphanArms=armIds.filter(id=>['arm-open-zone','arm-wall','conversation-open-zone'].includes(poses[id].candidateRuleId)||['arm-open-zone','conversation-open-zone'].includes(poses[id].relation));
  if(!armIds.length)failures.push('71.8㎡厅堂未形成“主沙发→边几→单人沙发”座位链');
  else if(!armIds.some(id=>(poses[id].candidateRuleId||poses[id].relation)==='arm-side-front'))failures.push('厅堂单人沙发没有通过边几接入会客组');
  if(orphanArms.length)failures.push(`仍出现孤立/面壁单人沙发：${orphanArms.join('|')}`);
  const find=typeId=>Object.keys(poses).find(id=>itemById.get(id)?.typeId===typeId),tableId=find('diningTable'),sofaId=find('sofa'),tvId=find('tv');
  if(!tableId)failures.push('71.8㎡客厅没有餐桌');
  if(tableId&&sofaId&&tvId){
    const table=rect(itemById.get(tableId),poses[tableId]),group={...table,w:table.w+1.24,d:table.d+1.24},sofa=poses[sofaId],tv=poses[tvId],dx=Math.abs(sofa.x-tv.x),dy=Math.abs(sofa.y-tv.y),corridor=dx>=dy?{x:(sofa.x+tv.x)/2,y:(sofa.y+tv.y)/2,w:dx,d:1.18}:{x:(sofa.x+tv.x)/2,y:(sofa.y+tv.y)/2,w:1.18,d:dy};
    if(overlaps(group,corridor))failures.push('餐桌椅包络仍侵入沙发—电视会客主轴');
  }
  const tinyLiving=(living.solution.decorItems||[]).filter(row=>row.kind==='postDisplayCabinet'&&!/^电视墙/.test(row.label||'')&&Number(row.runWidth)<1.1-1e-6);
  if(tinyLiving.length)failures.push(`客厅仍生成小填缝柜：${tinyLiving.map(row=>row.label).join('|')}`);
  rows.push({case:'recognized living ×1.79',score:living.solution.evaluation.total,benchRule:'-',benchOffset:'-',arm:armIds.map(id=>poses[id].candidateRuleId||poses[id].relation).join('|')||'none',dining:tableId?`${poses[tableId].x.toFixed(2)},${poses[tableId].y.toFixed(2)} ${poses[tableId].candidateRuleId||poses[tableId].relation}`:'missing',decor:(living.solution.decorItems||[]).map(row=>row.label).join('|'),ms:+living.result.totalTimeMs.toFixed(1)});

  console.table(rows);
  if(process.argv.includes('--verbose'))console.dir({livingScene:{width:living.result.scene.width,depth:living.result.scene.depth,area:living.result.scene.area},livingPoses:Object.fromEntries(Object.entries(poses).map(([id,pose])=>[id,{typeId:itemById.get(id)?.typeId,x:+pose.x.toFixed(2),y:+pose.y.toFixed(2),rotation:pose.rotation,rule:pose.candidateRuleId||pose.relation}]))},{depth:5});
  if(failures.length)throw new Error(`用户配置布局回归失败：\n- ${failures.join('\n- ')}`);
  console.log('PASS: 用户规则终局权重、床尾居中、会客主轴分区、孤立单椅和最小柜体模数均通过');
},0);
