(function(root,factory){
  const patterns=typeof module==='object'&&module.exports?require('../data/bedroom-patterns.js'):root.BedroomChessPatterns;
  const topology=typeof module==='object'&&module.exports?require('./bedroom-room-topology.js'):root.BedroomRoomTopology;
  const api=factory(patterns||[],topology);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.BedroomModuleEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(PATTERNS,TOPO){
  'use strict';

  const EPS=1e-6;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const round=(value,digits=3)=>Number(value.toFixed(digits));
  const nowMs=()=>typeof performance!=='undefined'?performance.now():Date.now();
  const SIZE_RANK={S:1,S2:1.65,M:2,L:3};
  const COLORS={sleep:'#3376a9',storage:'#9a704d',infill:'#bd7c42',work:'#16806e',media:'#475a67',lounge:'#c28a43',dressing:'#a86f8c'};
  let furnitureCapability=new Map(),furnitureCapabilityMeta={source:'内置稳定模数',count:0};

  function configureFurniture(config,source='旧版全局家具配置'){
    const value=config?.config||config,library=Array.isArray(value?.furnitureLibrary)?value.furnitureLibrary:[];
    furnitureCapability=new Map(library.filter(row=>row.program==='bedroom'&&row.id&&row.geometry).map(row=>[row.id,row]));
    furnitureCapabilityMeta={source:furnitureCapability.size?`${value.profileName||source} · v${value.schemaVersion||'?'}`:'内置稳定模数',count:furnitureCapability.size};return {...furnitureCapabilityMeta};
  }
  function furnitureGeometry(id,targetWidth,fallbackWidth,fallbackDepth){
    const rule=furnitureCapability.get(id),geometry=rule?.geometry,variants=Array.isArray(geometry?.variants)?geometry.variants.filter(row=>Number(row.width)>0&&Number(row.depth)>0):[];
    const chosen=variants.length?variants.reduce((best,row)=>Math.abs(Number(row.width)-targetWidth)<Math.abs(Number(best.width)-targetWidth)?row:best):geometry;
    const width=Number(chosen?.width),depth=Number(chosen?.depth);return {w:width>0?width:fallbackWidth,d:depth>0?depth:fallbackDepth,configured:Boolean(rule)};
  }
  function furnitureCapabilityStatus(){return {...furnitureCapabilityMeta};}

  const rect=TOPO.rect;
  const overlaps=(a,b,padding=0)=>Math.abs(a.x-b.x)<(a.w+b.w)/2+padding-EPS&&Math.abs(a.y-b.y)<(a.d+b.d)/2+padding-EPS;
  const inside=(value,room,margin=0)=>TOPO.rectInsidePolygon(value,room.polygon,margin);

  function makeRoom(width=3.6,depth=3.8,options={}){
    return TOPO.rectangularRoom(width,depth,options);
  }

  function makePolygonRoom(room){return TOPO.createRoom({polygon:room.polygon,openings:room.openings});}

  function roomSignature(room){
    const long=Math.max(room.width,room.depth),short=Math.min(room.width,room.depth),aspect=long/short;
    return {area:room.area,aspect,longAxis:room.width>=room.depth?'horizontal':'vertical',long,short,shape:room.shape,wallCount:room.walls.length,concave:room.concave,rectangularity:room.rectangularity};
  }

  function patternFitness(pattern,signature){
    const match=pattern.match||{};
    let score=100;
    if(signature.area<Number(match.minArea||0))score-=(Number(match.minArea)-signature.area)*14;
    if(signature.area>Number(match.maxArea||Infinity))score-=(signature.area-Number(match.maxArea))*7;
    if(signature.aspect<Number(match.minAspect||0))score-=(Number(match.minAspect)-signature.aspect)*60;
    if(signature.aspect>Number(match.maxAspect||Infinity))score-=(signature.aspect-Number(match.maxAspect))*45;
    if(pattern.id==='hotel-long-axis')score+=(signature.aspect-1)*22;
    if(pattern.id==='suite-zoned')score+=(signature.area-16)*2.4;
    if(pattern.id==='standard-perimeter')score+=Math.max(0,1.5-signature.aspect)*12;
    return round(score,2);
  }

  function classifyRoom(room){
    const signature=roomSignature(room);
    const ranked=PATTERNS.map(pattern=>({pattern,fitness:patternFitness(pattern,signature)})).sort((a,b)=>b.fitness-a.fitness);
    return {signature,ranked,pattern:ranked[0]?.pattern||PATTERNS[0]};
  }

  function template(type,size){
    if(type==='sleep'){
      const single=size==='S'||size==='S2',bedTarget=single?1.2:size==='M'?1.5:1.8,bedGeometry=furnitureGeometry('bed',bedTarget,bedTarget,2),bedW=bedGeometry.w,bedD=bedGeometry.d,nightTarget=single?.38:size==='M'?.45:.5,nightGeometry=furnitureGeometry('night',nightTarget,nightTarget,nightTarget),nightW=nightGeometry.w,nightD=nightGeometry.d,nights=size==='S'?1:2;
      const items=[];
      if(nights===1){items.push({type:'bed',label:'单人床',u:nightW/2,v:bedD/2,w:bedW,d:bedD});items.push({type:'night',label:'床头柜',u:-bedW/2,v:nightD/2,w:nightW,d:nightD});}
      else {items.push({type:'bed',label:single?'单人床':'双人床',u:0,v:bedD/2,w:bedW,d:bedD});items.push({type:'night',label:'床头柜',u:-(bedW+nightW)/2,v:nightD/2,w:nightW,d:nightD});items.push({type:'night',label:'床头柜',u:(bedW+nightW)/2,v:nightD/2,w:nightW,d:nightD});}
      if(size==='L'){const bench=furnitureGeometry('bench',Math.min(1.35,bedW*.78),Math.min(1.35,bedW*.78),.42);items.push({type:'bench',label:'床尾凳',u:0,v:bedD+bench.d/2+.12,w:bench.w,d:bench.d});}
      return {type,size,label:'睡眠组',span:bedW+nightW*nights,depth:size==='L'?3.0:2.72,items,zones:[{label:'床侧与床尾共享区',u:0,v:bedD+.32,w:Math.max(bedW,bedW+nightW*nights-.16),d:size==='L'?1.05:.62}],color:COLORS[type],tall:false};
    }
    if(type==='storage'){
      const target=size==='S'?1.2:size==='M'?1.8:2.4,geometry=furnitureGeometry('wardrobe',target,target,.6),width=geometry.w;
      return {type,size,label:'收纳组',span:width,depth:1.35,items:[{type:'wardrobe',label:`衣柜 ${width.toFixed(1)}m`,u:0,v:geometry.d/2,w:width,d:geometry.d}],zones:[{label:'衣柜共享取用区',u:0,v:.98,w:width,d:.72}],color:COLORS[type],tall:true};
    }
    if(type==='work'){
      const target=size==='S'?.9:size==='M'?1.2:1.6,desk=furnitureGeometry('desk',target,target,.58),chair=furnitureGeometry('chair',.5,.5,.5),width=desk.w;
      return {type,size,label:'工作组',span:Math.max(width,chair.w),depth:1.55,items:[{type:'desk',label:`书桌 ${width.toFixed(1)}m`,u:0,v:desk.d/2,w:width,d:desk.d},{type:'chair',label:'工作椅',u:0,v:.92,w:chair.w,d:chair.d}],zones:[{label:'工作椅后退区',u:0,v:1.27,w:Math.max(.78,width*.72),d:.55}],color:COLORS[type],tall:false};
    }
    if(type==='media'){
      const target=size==='S'?1.2:size==='M'?1.8:2.4,geometry=furnitureGeometry('tvbench',target,target,.4),width=geometry.w;
      return {type,size,label:'床尾媒体组',span:width,depth:.95,items:[{type:'tvbench',label:`电视柜 ${width.toFixed(1)}m`,u:0,v:geometry.d/2,w:width,d:geometry.d}],zones:[{label:'设备取用与观看区',u:0,v:.67,w:width,d:.55}],color:COLORS[type],tall:false};
    }
    if(type==='dressing'){
      const target=size==='S'?.8:size==='M'?1.1:1.4,vanity=furnitureGeometry('vanity',target,target,.5),stool=furnitureGeometry('vanityStool',.44,.44,.44),width=vanity.w;
      return {type,size,label:'梳妆组',span:Math.max(width,stool.w),depth:1.45,items:[{type:'vanity',label:`梳妆台 ${width.toFixed(1)}m`,u:0,v:vanity.d/2,w:width,d:vanity.d},{type:'stool',label:'梳妆凳',u:0,v:.85,w:stool.w,d:stool.d}],zones:[{label:'梳妆使用区',u:0,v:1.18,w:Math.max(.72,width*.72),d:.54}],color:COLORS[type],tall:false};
    }
    const lounge=furnitureGeometry('lounge',.72,.72,.72),loveseat=furnitureGeometry('bedroomLoveseat',size==='M'?1.25:1.55,size==='M'?1.25:1.55,.72),tea=furnitureGeometry('bedroomTeaTable',size==='M'?.56:.72,size==='M'?.56:.72,.48),span=size==='S'?lounge.w+.65:Math.max(loveseat.w,tea.w)+.45;
    const items=size==='S'
      ?[{type:'lounge',label:'休闲椅',u:-.23,v:lounge.d/2,w:lounge.w,d:lounge.d},{type:'side',label:'边几',u:.42,v:.48,w:.42,d:.42}]
      :[{type:'loveseat',label:'卧室小沙发',u:0,v:loveseat.d/2,w:loveseat.w,d:loveseat.d},{type:'tea',label:'小茶几',u:0,v:1.05,w:tea.w,d:tea.d}];
    return {type,size,label:'休闲组',span,depth:1.62,items,zones:[{label:'休闲共享区',u:0,v:1.2,w:span,d:.72}],color:COLORS[type],tall:false};
  }

  const wallFor=(room,index)=>room.walls.find(row=>row.index===Number(index));
  const wallLength=(wallIndex,room)=>wallFor(room,wallIndex)?.length||0;
  const toRoomRect=(row,wallIndex,t,room,extra={})=>TOPO.wallLocalRect(row,wallFor(room,wallIndex),t,extra);

  function criticalCenters(wallIndex,tpl,room){
    const wall=wallFor(room,wallIndex),length=wall.length,margin=tpl.span/2+.04;
    const values=[margin,length/2,length-margin];
    for(const opening of room.openings.filter(row=>row.wallIndex===wallIndex)){
      const gap=opening.kind==='door'?.08:.06;
      values.push(opening.start-tpl.span/2-gap,opening.end+tpl.span/2+gap,(opening.start+opening.end)/2);
    }
    return [...new Set(values.filter(value=>value>=margin-EPS&&value<=length-margin+EPS).map(value=>round(value,3)))];
  }

  function windowConflict(module,room){
    if(!module.template.tall)return false;
    return room.windows.some(window=>window.wallIndex===module.wallIndex&&module.t+module.template.span/2>window.start+EPS&&module.t-module.template.span/2<window.end-EPS);
  }

  function concaveVertex(room,point){
    const offset=.045,samples=[[offset,offset],[offset,-offset],[-offset,offset],[-offset,-offset]];return samples.filter(([dx,dy])=>TOPO.pointInPolygon({x:point.x+dx,y:point.y+dy},room.polygon)).length>=3;
  }

  function badConcaveCabinetOrientation(module,room){
    if(!['storage','infill'].includes(module.type))return false;const wall=wallFor(room,module.wallIndex),half=module.template.span/2,corners=[];
    if(module.t-half<.13)corners.push(wall.a);if(wall.length-(module.t+half)<.13)corners.push(wall.b);
    for(const point of corners){if(!concaveVertex(room,point))continue;const adjacent=room.walls.filter(other=>other.index!==wall.index&&(Math.hypot(other.a.x-point.x,other.a.y-point.y)<.02||Math.hypot(other.b.x-point.x,other.b.y-point.y)<.02));if(adjacent.some(other=>other.length>=wall.length+.45))return true;}
    return false;
  }

  function moduleCenter(module){
    const primaryTypes={sleep:['bed'],media:['tvbench'],lounge:['loveseat','lounge'],storage:['wardrobe'],work:['desk'],dressing:['vanity'],infill:['custom-cabinet']},preferred=primaryTypes[module.type]||[];
    const item=preferred.map(type=>module.items.find(row=>row.type===type)).find(Boolean)||module.items[0];
    return item?{x:item.x,y:item.y}:{x:0,y:0};
  }

  function relationRules(pattern){return Array.isArray(pattern?.relations)?pattern.relations:[];}
  function moduleFacing(module,room){const wall=wallFor(room,module.wallIndex),normal=wall?.normal||{x:0,y:1};return module.type==='work'?{x:-normal.x,y:-normal.y}:normal;}
  function moduleInterface(module,room){
    const wall=wallFor(room,module.wallIndex),normal=wall?.normal||{x:0,y:1},labels={sleep:'床尾方向',storage:'柜门方向',infill:'柜门方向',media:'屏幕正面',lounge:'座椅正面',work:'书桌使用面',dressing:'使用方向'};
    // 工作关系评分使用“人坐着看向桌面”的视线（朝墙），家具方向图层则显示
    // “书桌可使用的一面”（朝房间）。两者语义相反，不能再共用一根箭头。
    return {center:moduleCenter(module),facing:module.type==='work'?normal:moduleFacing(module,room),relationFacing:moduleFacing(module,room),label:labels[module.type]||'使用正面'};
  }

  function facingRelationScore(subject,target,rule,room,state){
    const from=moduleCenter(subject),to=moduleCenter(target),dx=to.x-from.x,dy=to.y-from.y,distance=Math.hypot(dx,dy)||EPS,axis={x:dx/distance,y:dy/distance},subjectFacing=moduleFacing(subject,room),targetFacing=moduleFacing(target,room),subjectWall=wallFor(room,subject.wallIndex);
    const dot=(a,b)=>a.x*b.x+a.y*b.y,subjectAim=clamp(dot(subjectFacing,axis),0,1),targetAim=clamp(dot(targetFacing,{x:-axis.x,y:-axis.y}),0,1),mutual=(subjectAim+targetAim)/2,orientation=clamp((1-dot(subjectFacing,targetFacing))/2,0,1),directional=Math.sqrt(subjectAim*targetAim);
    const lateral=Math.abs(dot({x:to.x-from.x,y:to.y-from.y},subjectWall?.dir||{x:1,y:0})),tolerance=Math.max(.25,Number(rule.alignmentTolerance)||1.2),alignment=1/(1+(lateral/tolerance)**2),minimum=Number(rule.minDistance)||1.2,maximum=Number(rule.maxDistance)||6;
    const distanceScore=distance<minimum?clamp(1-(minimum-distance)/minimum,0,1):distance>maximum?clamp(1-(distance-maximum)/maximum,0,1):1;
    let inside=true,blocked=false;
    for(let index=1;index<10;index++){
      const point={x:from.x+dx*index/10,y:from.y+dy*index/10};if(!TOPO.pointInPolygon(point,room.polygon)){inside=false;break;}
      if((state?.items||[]).some(item=>item.moduleId!==subject.id&&item.moduleId!==target.id&&Math.abs(point.x-item.x)<item.w/2-EPS&&Math.abs(point.y-item.y)<item.d/2-EPS))blocked=true;
    }
    // “正对”是双向语义：媒体正面看向目标，同时床尾/沙发正面也必须看向媒体。
    // 中心线偏移是软衰减，但任一端转成 90° 时 directional 归零，不再被误称为正对。
    const sight=inside?(blocked?0.25:1):0,quality=alignment*.42+mutual*.18+distanceScore*.22+sight*.18,gate=directional*Math.sqrt(orientation),total=quality*gate;
    return {score:clamp(total,0,1),from,to,distance,lateral,alignment,subjectAim,targetAim,directional,mutual,orientation,distanceScore,sight,blocked,inside};
  }

  function openingPrivacyConflict(subject,opening,rule,room,state){
    const from=moduleCenter(subject),points=opening.points||[],fallback=points.length?{x:points.reduce((sum,p)=>sum+p.x,0)/points.length,y:points.reduce((sum,p)=>sum+p.y,0)/points.length}:room.centroid,to=opening.entry||fallback,dx=to.x-from.x,dy=to.y-from.y,distance=Math.hypot(dx,dy)||EPS,axis={x:dx/distance,y:dy/distance},facing=moduleFacing(subject,room),wall=wallFor(room,subject.wallIndex),dot=(a,b)=>a.x*b.x+a.y*b.y;
    const aim=clamp(dot(facing,axis),0,1),lateral=Math.abs(dot({x:dx,y:dy},wall?.dir||{x:1,y:0})),tolerance=Math.max(.25,Number(rule.alignmentTolerance)||.8),alignment=1/(1+(lateral/tolerance)**2),maximum=Math.max(2,Number(rule.maxDistance)||6),distanceFactor=.55+.45*clamp(1-distance/maximum,0,1);
    let inside=true,blocked=false;for(let index=1;index<10;index++){const point={x:from.x+dx*index/10,y:from.y+dy*index/10};if(!TOPO.pointInPolygon(point,room.polygon)){inside=false;break;}if((state?.items||[]).some(item=>item.moduleId!==subject.id&&Math.abs(point.x-item.x)<item.w/2-EPS&&Math.abs(point.y-item.y)<item.d/2-EPS))blocked=true;}
    const visibility=inside?(blocked?0.35:1):0,conflict=aim*Math.sqrt(alignment)*distanceFactor*visibility;
    return {conflict:clamp(conflict,0,1),from,to,distance,aim,lateral,alignment,distanceFactor,visibility,blocked,inside};
  }

  function evaluateRelations(state,room,pattern){
    const details=[];
    for(const rule of relationRules(pattern)){
      if(rule.type==='avoid-facing-opening'){
        const subjects=state.modules.filter(module=>module.type===rule.subject),openings=(rule.openingKind==='window'?room.windows:room.doors)||[],pairs=[];
        for(const subject of subjects)for(const opening of openings)pairs.push({subject,opening,metrics:openingPrivacyConflict(subject,opening,rule,room,state)});
        pairs.sort((a,b)=>b.metrics.conflict-a.metrics.conflict);const worst=pairs[0],fallback=subjects.length?0:(rule.required?0:1),score=worst?1-worst.metrics.conflict:fallback;
        details.push({id:rule.id,type:rule.type,subjectType:rule.subject,targetTypes:[rule.openingKind||'door'],...(worst?.metrics||{}),score,rawScore:worst?.metrics.conflict??null,conflict:worst?.metrics.conflict||0,active:false,subjectId:worst?.subject.id||null,targetId:worst?.opening.id||null,targetType:rule.openingKind||'door'});continue;
      }
      const subjects=state.modules.filter(module=>module.type===rule.subject),targets=state.modules.filter(module=>(rule.targets||[]).includes(module.type)),pairs=[];
      for(const subject of subjects)for(const target of targets)if(subject.id!==target.id){const metrics=facingRelationScore(subject,target,rule,room,state),preference=Number(rule.targetWeights?.[target.type]??1);pairs.push({subject,target,metrics,preference,weightedScore:metrics.score*preference});}
      const avoidance=rule.type==='avoid-facing';pairs.sort((a,b)=>avoidance?b.metrics.score-a.metrics.score:b.weightedScore-a.weightedScore);const best=pairs[0];
      const fallback=subjects.length?0:(rule.required?0:1),score=best?(avoidance?1-best.metrics.score:best.weightedScore):fallback,minimum=Number(rule.minActiveScore)||.4,active=!avoidance&&!!best&&score>=minimum;
      details.push({id:rule.id,type:rule.type,subjectType:rule.subject,targetTypes:rule.targets||[],...(best?.metrics||{}),score,rawScore:best?.metrics.score??null,preference:best?.preference??1,conflict:avoidance?(best?.metrics.score||0):0,active,subjectId:best?.subject.id||null,targetId:best?.target.id||null,targetType:best?.target.type||null});
    }
    return {score:details.length?details.reduce((sum,row)=>sum+row.score,0)/details.length:1,details};
  }

  function relationCentersForModule(type,state,wall,room,pattern){
    const values=[];
    for(const rule of relationRules(pattern)){
      if(rule.type.startsWith('avoid-'))continue;
      let counterparts=[];
      if(rule.subject===type)counterparts=state.modules.filter(module=>(rule.targets||[]).includes(module.type));
      else if((rule.targets||[]).includes(type))counterparts=state.modules.filter(module=>module.type===rule.subject);
      for(const counterpart of counterparts){const otherWall=wallFor(room,counterpart.wallIndex);if(!TOPO.wallsOppose(wall,otherWall))continue;const center=moduleCenter(counterpart),projection=(center.x-wall.a.x)*wall.dir.x+(center.y-wall.a.y)*wall.dir.y;for(const offset of rule.candidateOffsets||[0,-.35,.35])values.push(round(projection+Number(offset),3));}
    }
    return values;
  }

  function relationMerit(module,state,room,pattern){
    const combined={modules:[...state.modules,module],items:[...state.items,...module.items]},scores=[];
    for(const rule of relationRules(pattern)){
      if(rule.type==='avoid-facing-opening'){
        if(rule.subject!==module.type)continue;const openings=(rule.openingKind==='window'?room.windows:room.doors)||[];if(openings.length)scores.push(1-Math.max(...openings.map(opening=>openingPrivacyConflict(module,opening,rule,room,combined).conflict)));continue;
      }
      if(rule.subject!==module.type&&!(rule.targets||[]).includes(module.type))continue;
      const subjects=combined.modules.filter(row=>row.type===rule.subject),targets=combined.modules.filter(row=>(rule.targets||[]).includes(row.type)),pairScores=[];
      for(const subject of subjects)for(const target of targets)if(subject.id!==target.id&&(subject.id===module.id||target.id===module.id)){const facing=facingRelationScore(subject,target,rule,room,combined).score;pairScores.push({facing,weighted:facing*Number(rule.targetWeights?.[target.type]??1)});}
      if(pairScores.length)scores.push(rule.type==='avoid-facing'?1-Math.max(...pairScores.map(row=>row.facing)):Math.max(...pairScores.map(row=>row.weighted)));
    }
    // 关系分用于同一功能模块的选位排序，不应压过“多下一个有用模块”。
    return scores.length?round((scores.reduce((sum,value)=>sum+value,0)/scores.length-.35)*18,2):0;
  }

  function moduleRejectReason(module,state,room){
    if(module.items.some(item=>!inside(item,room)))return 'outside';
    if(badConcaveCabinetOrientation(module,room))return 'corner-facing';
    if(module.items.some(item=>room.doors.some(door=>overlaps(item,door.zone,.01))))return 'door';
    if(windowConflict(module,room))return 'window';
    for(const item of module.items){
      if(state.items.some(other=>overlaps(item,other,.025)))return 'furniture';
      if(state.zones.some(zone=>overlaps(item,zone,.01)))return 'usage-zone';
    }
    for(const zone of module.zones){
      if(!inside(zone,room))return 'zone-outside';
      if(state.items.some(other=>overlaps(zone,other,.01)))return 'zone-furniture';
    }
    return null;
  }

  function crossWallShadow(module,room){
    let total=0;
    for(const zone of module.zones||[])for(const wall of room.walls){
      if(wall.index===module.wallIndex)continue;
      const dx=zone.x-wall.a.x,dy=zone.y-wall.a.y,normalDistance=dx*wall.normal.x+dy*wall.normal.y,normalHalf=Math.abs(wall.normal.x)*zone.w/2+Math.abs(wall.normal.y)*zone.d/2;
      if(normalDistance-normalHalf>.12||normalDistance+normalHalf<-.02)continue;
      const along=dx*wall.dir.x+dy*wall.dir.y,alongHalf=Math.abs(wall.dir.x)*zone.w/2+Math.abs(wall.dir.y)*zone.d/2,start=clamp(along-alongHalf,0,wall.length),end=clamp(along+alongHalf,0,wall.length);
      if(end>start+EPS)total+=end-start;
    }
    return round(total,3);
  }

  function moduleMerit(module,state,room,moduleRule,pattern){
    let score=SIZE_RANK[module.size]*7+module.items.length*4;
    const wall=wallFor(room,module.wallIndex),length=wall.length,endGap=Math.min(module.t-module.template.span/2,length-(module.t+module.template.span/2));
    score+=endGap<.09?9:Math.abs(module.t-length/2)<.08?5:0;
    const sleep=state.modules.find(row=>row.type==='sleep');
    if(module.type==='sleep'){
      const nearDoor=room.doors.some(door=>door.wallIndex===module.wallIndex);score+=nearDoor?-18:6;
      if(room.windows.some(window=>window.wallIndex===module.wallIndex))score-=6;
    }
    if(module.type==='storage'){
      score+=room.windows.some(window=>window.wallIndex===module.wallIndex)?-12:5;
      if(sleep&&sleep.wallIndex!==module.wallIndex)score+=8;
    }
    if(module.type==='work')score+=room.windows.some(window=>window.wallIndex===module.wallIndex)?20:6;
    if(module.type==='lounge'&&sleep&&module.wallIndex!==sleep.wallIndex)score+=7;
    score+=new Set([...state.modules.map(row=>row.wallIndex),module.wallIndex]).size*1.8;
    module.crossWallShadow=crossWallShadow(module,room);if(module.template.tall)score-=module.crossWallShadow*22;
    score+=relationMerit(module,state,room,pattern);
    return round(score,2);
  }

  function candidatesForModule(moduleRule,state,room,stats,pattern){
    const rows=[],diagnostic=stats.moduleDiagnostics[moduleRule.type]||(stats.moduleDiagnostics[moduleRule.type]={raw:0,legal:0,sent:0,rejected:{}});
    for(const size of moduleRule.sizes||['M','S','L']){
      const tpl=template(moduleRule.type,size);
      for(const wall of room.walls){
        const relationCenters=relationCentersForModule(moduleRule.type,state,wall,room,pattern),centers=[...new Set([...criticalCenters(wall.index,tpl,room),...relationCenters])],margin=tpl.span/2+.04;
        for(const t of centers.filter(value=>value>=margin-EPS&&value<=wall.length-margin+EPS)){
          stats.rawActions++;diagnostic.raw++;
          const id=`${moduleRule.type}-${size}-wall-${wall.index}-${t}`;
          const extra={moduleId:id,moduleType:moduleRule.type,color:tpl.color};
          const items=tpl.items.map(row=>toRoomRect(row,wall.index,t,room,{...extra,type:row.type,label:row.label}));
          const zones=tpl.zones.map(row=>toRoomRect(row,wall.index,t,room,{...extra,label:row.label,zone:true}));
          const module={id,type:moduleRule.type,size,label:tpl.label,wallIndex:wall.index,wallLabel:wall.label,t,items,zones,template:tpl};
          const rejectReason=moduleRejectReason(module,state,room);
          if(rejectReason){stats.rejectedActions++;diagnostic.rejected[rejectReason]=(diagnostic.rejected[rejectReason]||0)+1;continue;}
          diagnostic.legal++;
          module.relationDerived=relationCenters.includes(t);module.merit=moduleMerit(module,state,room,moduleRule,pattern);rows.push(module);
        }
      }
    }
    rows.sort((a,b)=>b.merit-a.merit);
    const retained=rows.slice(0,Math.max(1,Number(moduleRule.candidateLimit)||8));diagnostic.sent+=retained.length;return retained;
  }

  function infillCandidates(state,room,stats){
    const rows=[],diagnostic=stats.moduleDiagnostics.infill||(stats.moduleDiagnostics.infill={raw:0,legal:0,sent:0,rejected:{}}),space=wallSpaceMetrics(state,room),maxWidth=room.area>=30?2.4:1.8;
    for(const bay of space.bays.slice(0,8)){
      const wall=wallFor(room,bay.wallIndex),available=bay.end-bay.start,width=Math.floor(Math.min(maxWidth,available-.06)*10)/10;
      if(width<.4)continue;
      const centers=[bay.start+width/2+.03,bay.end-width/2-.03].filter(value=>value-width/2>=bay.start-EPS&&value+width/2<=bay.end+EPS);
      for(const [depth,tall,label] of [[.6,true,'定制高柜'],[.35,false,'定制薄柜']])for(const t of [...new Set(centers.map(value=>round(value,3)))]){
        diagnostic.raw++;stats.rawActions++;
        const id=`infill-${width.toFixed(1)}-${depth.toFixed(2)}-wall-${wall.index}-${t}`,extra={moduleId:id,moduleType:'infill',color:COLORS.infill};
        const itemSpec={type:'custom-cabinet',label:`${label} ${width.toFixed(1)}m`,u:0,v:depth/2,w:width,d:depth},zoneSpec={label:'定制柜取用区',u:0,v:depth+.31,w:width,d:.62};
        const template={type:'infill',size:'CUSTOM',label:'定制柜收纳组',span:width,depth:depth+.62,items:[itemSpec],zones:[zoneSpec],color:COLORS.infill,tall};
        const module={id,type:'infill',size:`${width.toFixed(1)}m`,label:'定制柜收纳组',wallIndex:wall.index,wallLabel:wall.label,t,items:[toRoomRect(itemSpec,wall.index,t,room,{...extra,type:itemSpec.type,label:itemSpec.label})],zones:[toRoomRect(zoneSpec,wall.index,t,room,{...extra,label:zoneSpec.label,zone:true})],template};
        const rejectReason=moduleRejectReason(module,state,room);
        if(rejectReason){stats.rejectedActions++;diagnostic.rejected[rejectReason]=(diagnostic.rejected[rejectReason]||0)+1;continue;}
        diagnostic.legal++;const closureGap=Math.max(0,available-width);module.crossWallShadow=crossWallShadow(module,room);module.merit=round(width*12+(closureGap<.14?12:0)+(t-width/2-bay.start<.08||bay.end-(t+width/2)<.08?5:0)-module.crossWallShadow*24,2);rows.push(module);
      }
    }
    rows.sort((a,b)=>b.merit-a.merit);const retained=rows.slice(0,6);diagnostic.sent+=retained.length;return retained;
  }

  function stateSignature(state){
    return state.modules.map(module=>`${module.type}:${module.size}:${module.wallIndex}:${round(module.t,1)}`).join('|');
  }

  function functionalSignature(state){
    return state.modules.filter(module=>module.type!=='infill').map(module=>{
      const length=Math.max(EPS,module.template?.span||1),positionBand=Math.round(module.t/length);
      return `${module.type}@${module.wallIndex}:${positionBand}`;
    }).sort().join('|');
  }

  function retainDiverseBeam(states,beamWidth){
    const ranked=[...states].sort((a,b)=>b.score-a.score),selected=[],selectedStates=new Set(),seenFunctions=new Set();
    // 先为不同功能组合保留一条棋路，防止高分同质局面过早挤掉可继续展开的分支。
    for(const state of ranked){const signature=functionalSignature(state);if(seenFunctions.has(signature))continue;seenFunctions.add(signature);selected.push(state);selectedStates.add(state);if(selected.length>=beamWidth)return selected;}
    for(const state of ranked){if(selectedStates.has(state))continue;selected.push(state);if(selected.length>=beamWidth)break;}
    return selected;
  }

  function copyStateWithModule(state,module){
    return {
      modules:[...state.modules,module],items:[...state.items,...module.items],zones:[...state.zones,...module.zones],
      score:state.score+module.merit,trace:[...state.trace,{type:module.type,label:module.label,size:module.size,wallIndex:module.wallIndex,wallLabel:module.wallLabel,merit:module.merit,skipped:false}]
    };
  }

  function upgradeSleepAttachments(states,room,pattern,stats,beamWidth){
    const started=nowMs(),sleepRule=(pattern.modules||[]).find(rule=>rule.type==='sleep'),rows=[...states];if(!sleepRule)return states;
    for(const state of states){
      const prior=state.modules.find(module=>module.type==='sleep'&&module.size==='S');if(!prior)continue;
      const tpl=template('sleep','S2'),wall=wallFor(room,prior.wallIndex),t=round(prior.t+.19,3),margin=tpl.span/2+.04;if(t<margin-EPS||t>wall.length-margin+EPS)continue;
      const id=`sleep-S2-wall-${wall.index}-${t}`,extra={moduleId:id,moduleType:'sleep',color:tpl.color},items=tpl.items.map(row=>toRoomRect(row,wall.index,t,room,{...extra,type:row.type,label:row.label})),zones=tpl.zones.map(row=>toRoomRect(row,wall.index,t,room,{...extra,label:row.label,zone:true}));
      const modulesWithout=state.modules.filter(module=>module.id!==prior.id),base={modules:modulesWithout,items:modulesWithout.flatMap(module=>module.items),zones:modulesWithout.flatMap(module=>module.zones)},module={id,type:'sleep',size:'S2',label:tpl.label,wallIndex:wall.index,wallLabel:wall.label,t,items,zones,template:tpl,attachmentUpgrade:true};
      if(moduleRejectReason(module,base,room))continue;
      module.merit=moduleMerit(module,base,room,sleepRule,pattern);stats.nodes++;
      const modules=state.modules.map(row=>row.id===prior.id?module:row),trace=state.trace.map(move=>move.type==='sleep'&&!move.skipped?{...move,size:'S2',merit:module.merit,label:module.label,attachmentUpgrade:true}:move);
      rows.push({modules,items:modules.flatMap(row=>row.items),zones:modules.flatMap(row=>row.zones),score:state.score-Number(prior.merit||0)+module.merit+4,trace});
    }
    const retained=retainDiverseBeam(rows,beamWidth);stats.rounds.push({moduleType:'sleep-attachment',candidates:rows.length,retained:retained.length,timeUs:Math.max(1,Math.round((nowMs()-started)*1000))});return retained;
  }

  function flowMetrics(state,room,step=.12){
    const radius=.25,cols=Math.max(1,Math.floor(room.width/step)),rows=Math.max(1,Math.floor(room.depth/step));
    const free=new Uint8Array(cols*rows),seen=new Uint8Array(cols*rows),index=(x,y)=>y*cols+x;
    let freeCount=0;
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const px=(x+.5)*room.width/cols,py=(y+.5)*room.depth/rows;
      const point={x:px,y:py},wallSafe=TOPO.pointInPolygon(point,room.polygon)&&TOPO.wallDistance(point,room)>=radius;
      const inDoorApproach=room.doors.some(door=>TOPO.pointInPolygon(point,room.polygon)&&Math.abs(px-door.zone.x)<=door.zone.w/2&&Math.abs(py-door.zone.y)<=door.zone.d/2);
      const blocked=state.items.some(item=>Math.abs(px-item.x)<=item.w/2+radius-EPS&&Math.abs(py-item.y)<=item.d/2+radius-EPS);
      if((wallSafe||inDoorApproach)&&!blocked){free[index(x,y)]=1;freeCount++;}
    }
    const entry=room.door?.entry||room.centroid,seedX=clamp(Math.floor(entry.x/room.width*cols),0,cols-1),seedY=clamp(Math.floor(entry.y/room.depth*rows),0,rows-1);
    let seed=index(seedX,seedY);
    if(!free[seed]){
      let best=-1,bestDistance=Infinity;
      for(let y=Math.max(0,seedY-3);y<rows;y++)for(let x=Math.max(0,seedX-4);x<=Math.min(cols-1,seedX+4);x++)if(free[index(x,y)]){
        const distance=Math.hypot(x-seedX,y-seedY);if(distance<bestDistance){best=index(x,y);bestDistance=distance;}
      }
      seed=best;
    }
    const queue=seed>=0?[seed]:[];if(seed>=0)seen[seed]=1;let cursor=0,reachable=0;
    while(cursor<queue.length){const cell=queue[cursor++],x=cell%cols,y=Math.floor(cell/cols);reachable++;
      for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(nx>=0&&nx<cols&&ny>=0&&ny<rows){const next=index(nx,ny);if(free[next]&&!seen[next]){seen[next]=1;queue.push(next);}}
    }
    const zoneReach=state.zones.map(zone=>{
      for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const cell=index(x,y);if(!seen[cell])continue;const px=(x+.5)*room.width/cols,py=(y+.5)*room.depth/rows;if(Math.abs(px-zone.x)<=zone.w/2&&Math.abs(py-zone.y)<=zone.d/2)return true;}
      return false;
    });
    return {connectedRatio:freeCount?reachable/freeCount:0,accessRatio:zoneReach.length?zoneReach.filter(Boolean).length/zoneReach.length:1,reachable,freeCount};
  }

  function centerOpenness(state,room){
    const sample=rect(room.centroid.x,room.centroid.y,room.width*.36,room.depth*.36),points=[];
    for(let xi=0;xi<5;xi++)for(let yi=0;yi<5;yi++)points.push({x:sample.x-sample.w/2+(xi+.5)*sample.w/5,y:sample.y-sample.d/2+(yi+.5)*sample.d/5});
    const roomPoints=points.filter(point=>TOPO.pointInPolygon(point,room.polygon));
    return roomPoints.length?roomPoints.filter(point=>!state.items.some(item=>Math.abs(point.x-item.x)<=item.w/2&&Math.abs(point.y-item.y)<=item.d/2)).length/roomPoints.length:0;
  }

  function mergeIntervals(rows,length){
    const sorted=rows.map(row=>[clamp(Math.min(...row),0,length),clamp(Math.max(...row),0,length)]).filter(row=>row[1]-row[0]>EPS).sort((a,b)=>a[0]-b[0]),merged=[];
    for(const row of sorted){const prior=merged[merged.length-1];if(prior&&row[0]<=prior[1]+EPS)prior[1]=Math.max(prior[1],row[1]);else merged.push(row.slice());}
    return merged;
  }

  function subtractIntervals(base,blockers){
    let rows=base.map(row=>row.slice());
    for(const [start,end] of blockers){const next=[];for(const [a,b] of rows){if(end<=a+EPS||start>=b-EPS){next.push([a,b]);continue;}if(start>a+EPS)next.push([a,start]);if(end<b-EPS)next.push([end,b]);}rows=next;}
    return rows;
  }

  function wallSpaceMetrics(state,room){
    let usableLength=0,residualLength=0,usefulUnusedLength=0;const bays=[];
    for(const wall of room.walls){
      const structural=mergeIntervals(room.openings.filter(row=>row.wallIndex===wall.index).map(row=>[row.start,row.end]),wall.length),usable=subtractIntervals([[0,wall.length]],structural),modules=mergeIntervals(state.modules.filter(row=>row.wallIndex===wall.index).map(row=>[row.t-row.template.span/2,row.t+row.template.span/2]),wall.length),residual=subtractIntervals(usable,modules);
      usableLength+=usable.reduce((sum,row)=>sum+row[1]-row[0],0);residualLength+=residual.reduce((sum,row)=>sum+row[1]-row[0],0);
      for(const interval of residual){const length=interval[1]-interval[0];if(length<.55)continue;usefulUnusedLength+=length;bays.push({wallIndex:wall.index,wallLabel:wall.label,start:round(interval[0]),end:round(interval[1]),length:round(length)});}
    }
    bays.sort((a,b)=>b.length-a.length);const utilization=usableLength?clamp(1-residualLength/usableLength,0,1):1,wasteRatio=usableLength?clamp(usefulUnusedLength/usableLength,0,1):0;
    return {utilization,wasteRatio,usableLength:round(usableLength),residualLength:round(residualLength),usefulUnusedLength:round(usefulUnusedLength),largestBay:bays[0]||null,bays:bays.slice(0,12)};
  }

  function opportunityMetrics(state,room,pattern,stats=null){
    const wallSpace=wallSpaceMetrics(state,room),placedTypes=new Set(state.modules.map(module=>module.type)),opportunities=[],checked=new Set();
    for(const rule of pattern.modules||[]){
      if(placedTypes.has(rule.type))continue;let best=null;
      for(const size of rule.sizes||['M','S','L']){
        const tpl=template(rule.type,size),half=tpl.span/2;
        for(const bay of wallSpace.bays){
          if(bay.length<tpl.span+.08)continue;const wall=wallFor(room,bay.wallIndex),centers=[bay.start+half+.04,(bay.start+bay.end)/2,bay.end-half-.04];
          for(const t of [...new Set(centers.map(value=>round(value,3)))]){
            const signature=`${rule.type}:${size}:${wall.index}:${t}`;if(checked.has(signature))continue;checked.add(signature);if(stats)stats.opportunityChecks=(stats.opportunityChecks||0)+1;
            const id=`opportunity-${signature}`,extra={moduleId:id,moduleType:rule.type,color:tpl.color},items=tpl.items.map(row=>toRoomRect(row,wall.index,t,room,{...extra,type:row.type,label:row.label})),zones=tpl.zones.map(row=>toRoomRect(row,wall.index,t,room,{...extra,label:row.label,zone:true})),module={id,type:rule.type,size,label:tpl.label,wallIndex:wall.index,wallLabel:wall.label,t,items,zones,template:tpl};
            if(moduleRejectReason(module,state,room))continue;const candidate={type:rule.type,label:tpl.label,size,wallIndex:wall.index,wallLabel:wall.label,t,bay:{start:bay.start,end:bay.end,length:bay.length},itemCount:items.length,required:!!rule.required};
            if(!best||SIZE_RANK[size]>SIZE_RANK[best.size]||SIZE_RANK[size]===SIZE_RANK[best.size]&&bay.length>best.bay.length)best=candidate;
          }
        }
      }
      if(best)opportunities.push(best);
    }
    const formalPenalty=opportunities.reduce((sum,row)=>sum+(row.required?3:row.type==='work'||row.type==='lounge'||row.type==='dressing'||row.type==='media'?2.2:1.4),0),penalty=clamp(formalPenalty,0,6),opportunityScore=clamp(1-penalty/6,0,1);
    const usedWalls=new Set(opportunities.map(row=>`${row.wallIndex}:${row.bay.start}:${row.bay.end}`)),unassignedBays=wallSpace.bays.filter(bay=>bay.length>=1.4&&!usedWalls.has(`${bay.wallIndex}:${bay.start}:${bay.end}`)).slice(0,5);
    return {count:opportunities.length,penalty:round(penalty,2),score:opportunityScore,items:opportunities,unassignedBays,checked:checked.size};
  }

  function evaluateState(state,room,pattern){
    const flow=flowMetrics(state,room),required=(pattern.modules||[]).filter(row=>row.required),placedTypes=new Set(state.modules.map(row=>row.type));
    const requiredRatio=required.length?required.filter(row=>placedTypes.has(row.type)).length/required.length:1;
    const extraCapacity=room.area>28?Math.min(4,Math.floor((room.area-24)/10)):0,capacityTarget=pattern.modules.length+extraCapacity,moduleUnits=state.modules.reduce((sum,module)=>sum+(module.type==='infill'?.35:module.type==='sleep'&&module.size==='S2'?1.18:1),0),moduleRatio=capacityTarget?clamp(moduleUnits/capacityTarget,0,1):1;
    const wallSpread=new Set(state.modules.map(row=>row.wallIndex)).size/Math.min(Math.max(1,room.walls.length),Math.max(1,state.modules.length));
    const open=centerOpenness(state,room),wallSpace=wallSpaceMetrics(state,room),relations=evaluateRelations(state,room,pattern),bodyArea=state.items.reduce((sum,item)=>sum+item.w*item.d,0),density=bodyArea/room.area;
    // 默认采用“丰富优先”卧室目标：通行与可达继续作为硬门槛，
    // 但通过硬门槛后，完整功能模块应明显胜过无意义的大面积留白。
    const densityTarget=room.area>=45?.28:room.area>=30?.32:room.area>=20?.36:room.area>=14?.34:.28,densityScore=clamp(1-Math.abs(density-densityTarget)/Math.max(.14,densityTarget),0,1),spaceUse=densityScore*.55+wallSpace.utilization*.45;
    const cabinetWallShadow=state.modules.filter(module=>['storage','infill'].includes(module.type)).reduce((sum,module)=>sum+Number(module.crossWallShadow||0),0),wallShadowPenalty=clamp(cabinetWallShadow*4,0,6);
    const score=requiredRatio*24+moduleRatio*27+flow.connectedRatio*17+flow.accessRatio*13+wallSpace.utilization*6+relations.score*6+wallSpread*3+open+densityScore*3-wallShadowPenalty;
    const spaceUsePass=room.area<30||spaceUse>=.48,capacityPass=room.area<30||moduleRatio>=.78,qualityPass=requiredRatio>=1-EPS&&flow.connectedRatio>=.82&&flow.accessRatio>=.99&&spaceUsePass&&capacityPass;
    return {total:round(score,1),qualityPass,requiredRatio,moduleRatio,moduleUnits:round(moduleUnits,2),capacityTarget,capacityPass,wallSpread,centerOpen:open,density,densityTarget,densityScore,spaceUse,spaceUsePass,wallSpace,cabinetWallShadow:round(cabinetWallShadow),wallShadowPenalty:round(wallShadowPenalty,2),relations,flow};
  }

  function runInfillEndgame(states,room,pattern,stats,beamWidth){
    const rounds=room.area>=45?4:room.area>=28?3:room.area>=14?2:1,endgameWidth=Math.min(8,beamWidth);let frontier=states.slice(0,endgameWidth);
    for(let roundIndex=0;roundIndex<rounds;roundIndex++){
      const roundStarted=nowMs();
      const hashes=new Map();
      for(const state of frontier){
        hashes.set(`${stateSignature(state)}|stop`,state);
        for(const module of infillCandidates(state,room,stats)){
          stats.nodes++;const child=copyStateWithModule(state,module),key=stateSignature(child),prior=hashes.get(key);
          if(!prior||prior.score<child.score)hashes.set(key,child);
        }
      }
      const ranked=[...hashes.values()].map(state=>({...state,evaluation:evaluateState(state,room,pattern)})).sort((a,b)=>Number(b.evaluation.qualityPass)-Number(a.evaluation.qualityPass)||b.evaluation.total-a.evaluation.total||b.score-a.score);
      frontier=ranked.slice(0,endgameWidth);stats.rounds.push({moduleType:'infill',round:roundIndex+1,candidates:ranked.length,retained:frontier.length,timeUs:Math.max(1,Math.round((nowMs()-roundStarted)*1000))});
      if(!ranked.some(state=>state.trace.filter(move=>move.type==='infill').length>roundIndex))break;
    }
    return frontier;
  }

  function search(roomInput,options={}){
    const room=roomInput?.width?roomInput:makeRoom(options.width,options.depth,options);
    const diagnosis=classifyRoom(room),pattern=PATTERNS.find(row=>row.id===options.patternId)||diagnosis.pattern;
    const beamWidth=Math.max(4,Math.min(32,Number(options.beamWidth)||16)),started=nowMs();
    const stats={nodes:0,rawActions:0,rejectedActions:0,duplicates:0,opportunityChecks:0,beamWidth,rounds:[],moduleDiagnostics:{}};
    const lockedModules=Array.isArray(options.lockedModules)?options.lockedModules.map(module=>({...module,items:(module.items||[]).map(item=>({...item})),zones:(module.zones||[]).map(zone=>({...zone})),locked:true})):[];
    let beam=[{modules:lockedModules,items:lockedModules.flatMap(module=>module.items),zones:lockedModules.flatMap(module=>module.zones),score:lockedModules.reduce((sum,module)=>sum+Number(module.merit||0),0),trace:lockedModules.map(module=>({type:module.type,label:`锁定 ${module.label}`,size:module.size,wallIndex:module.wallIndex,wallLabel:module.wallLabel,merit:Number(module.merit||0),locked:true}))}];
    for(const moduleRule of pattern.modules){
      const roundStarted=nowMs(),next=[],hashes=new Map();
      if(lockedModules.some(module=>module.type===moduleRule.type)){stats.rounds.push({moduleType:moduleRule.type,candidates:1,retained:1,locked:true,timeUs:Math.max(1,Math.round((nowMs()-roundStarted)*1000))});continue;}
      for(const state of beam){
        const candidates=candidatesForModule(moduleRule,state,room,stats,pattern);
        for(const module of candidates){
          stats.nodes++;const child=copyStateWithModule(state,module),key=stateSignature(child),prior=hashes.get(key);
          if(prior&&prior.score>=child.score){stats.duplicates++;continue;}hashes.set(key,child);
        }
        if(!moduleRule.required){
          const skipped={...state,modules:[...state.modules],items:[...state.items],zones:[...state.zones],score:state.score-4,trace:[...state.trace,{type:moduleRule.type,label:`跳过${moduleRule.type}`,size:null,wallIndex:null,wallLabel:null,merit:-4,skipped:true}]};
          const key=stateSignature(skipped)+`|skip-${moduleRule.type}`,prior=hashes.get(key);if(!prior||prior.score<skipped.score)hashes.set(key,skipped);
        }
      }
      next.push(...hashes.values());beam=retainDiverseBeam(next,beamWidth);
      stats.rounds.push({moduleType:moduleRule.type,candidates:next.length,retained:beam.length,timeUs:Math.max(1,Math.round((nowMs()-roundStarted)*1000))});
      if(moduleRule.type==='sleep'&&beam.length)beam=upgradeSleepAttachments(beam,room,pattern,stats,beamWidth);
      if(!beam.length)break;
    }
    if(beam.length&&options.infill!==false)beam=runInfillEndgame(beam,room,pattern,stats,beamWidth);
    const finalizeStarted=nowMs(),evaluated=beam.map(state=>{const evaluation=evaluateState(state,room,pattern),opportunities=opportunityMetrics(state,room,pattern,stats),baseTotal=evaluation.total;return {...state,evaluation:{...evaluation,baseTotal,total:round(baseTotal-opportunities.penalty,1),opportunities}};}).sort((a,b)=>Number(b.evaluation.qualityPass)-Number(a.evaluation.qualityPass)||b.evaluation.total-a.evaluation.total);
    const solutions=[],seen=new Set();
    for(const state of evaluated){const signature=state.modules.map(row=>`${row.type}:${row.wallIndex}:${row.size}`).join('|');if(seen.has(signature))continue;seen.add(signature);solutions.push(state);if(solutions.length>=3)break;}
    stats.rounds.push({moduleType:'finalize',candidates:evaluated.length,retained:solutions.length,timeUs:Math.max(1,Math.round((nowMs()-finalizeStarted)*1000))});const ended=nowMs();stats.timeMs=ended-started;stats.totalTimeUs=Math.round(stats.timeMs*1000);
    return {room,diagnosis,pattern,solutions,stats};
  }

  function searchPortfolio(roomInput,options={}){
    const room=roomInput?.width?roomInput:makeRoom(options.width,options.depth,options),diagnosis=classifyRoom(room),started=nowMs(),maxPatterns=Math.max(1,Math.min(3,Number(options.maxPatterns)||2)),fitnessWindow=Number(options.fitnessWindow)||35,timeBudgetMs=Math.max(80,Number(options.timeBudgetMs)||240),bestFitness=diagnosis.ranked[0]?.fitness||0;
    const candidates=diagnosis.ranked.filter((row,index)=>index<maxPatterns&&bestFitness-row.fitness<=fitnessWindow),runs=[],states=[];
    for(const ranked of candidates){
      if(runs.length&&nowMs()-started>=timeBudgetMs)break;const result=search(room,{...options,patternId:ranked.pattern.id}),fitnessScore=clamp(1-(bestFitness-ranked.fitness)/Math.max(1,fitnessWindow*2),0,1);
      runs.push({patternId:ranked.pattern.id,patternLabel:ranked.pattern.label,fitness:ranked.fitness,fitnessScore,timeMs:result.stats.timeMs,nodes:result.stats.nodes,rawActions:result.stats.rawActions,solutions:result.solutions.length,stats:result.stats});
      for(const state of result.solutions){const portfolioScore=round(state.evaluation.total+fitnessScore*3,2);states.push({...state,pattern:ranked.pattern,patternFitness:ranked.fitness,portfolioScore,searchStats:result.stats,evaluation:{...state.evaluation,portfolioScore}});}
    }
    states.sort((a,b)=>Number(b.evaluation.qualityPass)-Number(a.evaluation.qualityPass)||b.portfolioScore-a.portfolioScore||b.evaluation.total-a.evaluation.total);const solutions=[],seen=new Set();
    for(const state of states){const signature=state.modules.map(row=>`${row.type}:${row.wallIndex}:${row.size}`).join('|');if(seen.has(signature))continue;seen.add(signature);solutions.push(state);if(solutions.length>=3)break;}
    const winner=solutions[0],winnerRun=runs.find(run=>run.patternId===winner?.pattern.id)||runs[0],ended=nowMs(),stats={...(winnerRun?.stats||{}),nodes:runs.reduce((sum,row)=>sum+row.nodes,0),rawActions:runs.reduce((sum,row)=>sum+row.rawActions,0),rejectedActions:runs.reduce((sum,row)=>sum+Number(row.stats.rejectedActions||0),0),opportunityChecks:runs.reduce((sum,row)=>sum+Number(row.stats.opportunityChecks||0),0),timeMs:ended-started,totalTimeUs:Math.round((ended-started)*1000),portfolio:true,portfolioRuns:runs.map(({stats:ignored,...row})=>row)};
    return {room,diagnosis,pattern:winner?.pattern||diagnosis.pattern,solutions,stats,portfolio:{runs:stats.portfolioRuns,timeBudgetMs,fitnessWindow}};
  }

  return {PATTERNS,makeRoom,makePolygonRoom,roomSignature,classifyRoom,template,search,searchPortfolio,flowMetrics,evaluateRelations,evaluateState,opportunityMetrics,moduleInterface,configureFurniture,furnitureCapabilityStatus};
});
