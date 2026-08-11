(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.BedroomRoomTopology=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const EPS=1e-6;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const round=(value,digits=4)=>Number(value.toFixed(digits));
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const signedArea=points=>points.reduce((sum,a,index)=>{const b=points[(index+1)%points.length];return sum+a.x*b.y-b.x*a.y;},0)/2;
  const polygonArea=points=>Math.abs(signedArea(points));
  const rect=(x,y,w,d,extra={})=>({x,y,w,d,...extra});

  function pointOnSegment(point,a,b,tolerance=1e-5){
    const cross=(point.x-a.x)*(b.y-a.y)-(point.y-a.y)*(b.x-a.x);
    if(Math.abs(cross)>tolerance)return false;
    return point.x>=Math.min(a.x,b.x)-tolerance&&point.x<=Math.max(a.x,b.x)+tolerance&&point.y>=Math.min(a.y,b.y)-tolerance&&point.y<=Math.max(a.y,b.y)+tolerance;
  }

  function pointInPolygon(point,polygon){
    for(let index=0;index<polygon.length;index++)if(pointOnSegment(point,polygon[index],polygon[(index+1)%polygon.length]))return true;
    let inside=false;
    for(let index=0,prior=polygon.length-1;index<polygon.length;prior=index++){
      const a=polygon[index],b=polygon[prior];
      if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
    }
    return inside;
  }

  function pointSegmentDistance(point,a,b){
    const dx=b.x-a.x,dy=b.y-a.y,length2=dx*dx+dy*dy||1;
    const t=clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/length2,0,1);
    return Math.hypot(point.x-(a.x+t*dx),point.y-(a.y+t*dy));
  }

  function rectInsidePolygon(value,polygon,margin=0){
    const halfW=Math.max(0,value.w/2-margin),halfD=Math.max(0,value.d/2-margin);
    const xs=[value.x-halfW,value.x,value.x+halfW],ys=[value.y-halfD,value.y,value.y+halfD];
    return xs.every(x=>ys.every(y=>pointInPolygon({x,y},polygon)));
  }

  function polygonCentroid(points){
    const area=signedArea(points);
    if(Math.abs(area)<EPS)return {x:points.reduce((sum,p)=>sum+p.x,0)/points.length,y:points.reduce((sum,p)=>sum+p.y,0)/points.length};
    let x=0,y=0;
    for(let index=0;index<points.length;index++){
      const a=points[index],b=points[(index+1)%points.length],cross=a.x*b.y-b.x*a.y;
      x+=(a.x+b.x)*cross;y+=(a.y+b.y)*cross;
    }
    return {x:x/(6*area),y:y/(6*area)};
  }

  function cardinalName(normal){
    if(Math.abs(normal.y)>Math.abs(normal.x))return normal.y>0?'上侧墙':'下侧墙';
    return normal.x>0?'左侧墙':'右侧墙';
  }

  function compileWalls(polygon){
    const walls=[];
    for(let sourceIndex=0;sourceIndex<polygon.length;sourceIndex++){
      const a=polygon[sourceIndex],b=polygon[(sourceIndex+1)%polygon.length],length=distance(a,b);
      if(length<EPS)continue;
      const dir={x:(b.x-a.x)/length,y:(b.y-a.y)/length},mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      const candidate={x:-dir.y,y:dir.x},probe={x:mid.x+candidate.x*.03,y:mid.y+candidate.y*.03};
      const normal=pointInPolygon(probe,polygon)?candidate:{x:-candidate.x,y:-candidate.y};
      const horizontal=Math.abs(dir.y)<1e-4,vertical=Math.abs(dir.x)<1e-4;
      walls.push({index:walls.length,sourceIndex,a:{...a},b:{...b},mid,length,dir,normal,horizontal,vertical,orthogonal:horizontal||vertical,label:`墙段 ${walls.length+1} · ${cardinalName(normal)}`});
    }
    return walls;
  }

  function openingOnWall(opening,walls){
    const center={x:(opening.points[0].x+opening.points[1].x)/2,y:(opening.points[0].y+opening.points[1].y)/2};
    return walls.slice().sort((a,b)=>pointSegmentDistance(center,a.a,a.b)-pointSegmentDistance(center,b.a,b.b))[0];
  }

  function compileOpenings(rows,walls){
    return (rows||[]).filter(row=>Array.isArray(row.points)&&row.points.length>=2).map((row,index)=>{
      const points=row.points.slice(0,2).map(point=>({x:Number(point.x),y:Number(point.y)})),wall=openingOnWall({points},walls);
      const projections=points.map(point=>(point.x-wall.a.x)*wall.dir.x+(point.y-wall.a.y)*wall.dir.y),start=clamp(Math.min(...projections),0,wall.length),end=clamp(Math.max(...projections),0,wall.length);
      const type=String(row.type||'').toLowerCase(),kind=type.includes('window')?'window':type.includes('door')?'door':'opening';
      return {id:`opening-${index+1}`,sourceIndex:row.index??index,type:row.type||kind,kind,points,wallIndex:wall.index,start,end,width:Math.max(.01,end-start),center:{x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2}};
    });
  }

  function doorZone(door,walls){
    const wall=walls[door.wallIndex],depth=Math.max(.82,Math.min(1.05,door.width*1.05)),center={x:door.center.x+wall.normal.x*depth/2,y:door.center.y+wall.normal.y*depth/2};
    return wall.horizontal?rect(center.x,center.y,door.width,depth,{openingId:door.id}):rect(center.x,center.y,depth,door.width,{openingId:door.id});
  }

  function syntheticOpening(wall,kind,width,offset=.12){
    const actual=Math.min(width,Math.max(.55,wall.length-.16)),start=clamp(offset,.04,Math.max(.04,wall.length-actual-.04)),end=start+actual;
    const point=t=>({x:wall.a.x+wall.dir.x*t,y:wall.a.y+wall.dir.y*t});
    return {type:kind==='door'?'door_open':'window',kind,points:[point(start),point(end)]};
  }

  function createRoom(input={}){
    const polygon=(input.polygon||[]).map(point=>({x:Number(point.x),y:Number(point.y)}));
    if(polygon.length<3)throw new Error('房间多边形至少需要 3 个点');
    const xs=polygon.map(p=>p.x),ys=polygon.map(p=>p.y),width=Math.max(...xs)-Math.min(...xs),depth=Math.max(...ys)-Math.min(...ys),walls=compileWalls(polygon);
    if(walls.some(wall=>!wall.orthogonal))throw new Error('当前异形模块棋先支持正交多边形，检测到斜墙');
    let sourceOpenings=(input.openings||[]).map(row=>({...row,points:(row.points||[]).map(point=>({x:Number(point.x),y:Number(point.y)}))}));
    if(!sourceOpenings.some(row=>String(row.type||'').toLowerCase().includes('door'))){
      const wall=walls.slice().sort((a,b)=>b.length-a.length)[0];sourceOpenings.push(syntheticOpening(wall,'door',Number(input.doorWidth)||.9));
    }
    const openings=compileOpenings(sourceOpenings,walls),doors=openings.filter(row=>row.kind==='door'),windows=openings.filter(row=>row.kind==='window');
    for(const door of doors){door.zone=doorZone(door,walls);const wall=walls[door.wallIndex];door.entry={x:door.center.x+wall.normal.x*Math.min(.25,door.width*.3),y:door.center.y+wall.normal.y*Math.min(.25,door.width*.3)};}
    const area=polygonArea(polygon),centroid=polygonCentroid(polygon),rectangularity=area/Math.max(.001,width*depth),concave=polygon.some((point,index)=>{
      const prior=polygon[(index-1+polygon.length)%polygon.length],next=polygon[(index+1)%polygon.length],cross=(point.x-prior.x)*(next.y-point.y)-(point.y-prior.y)*(next.x-point.x);
      return Math.sign(cross)!==Math.sign(signedArea(polygon));
    });
    return {width,depth,area,polygon,walls,openings,doors,windows,door:doors[0],window:windows[0],centroid,rectangularity,concave,shape:rectangularity>.985?'rectangle':'orthogonal-polygon',topology:{wallCount:walls.length,cornerCount:polygon.length,concave,rectangularity,openingCount:openings.length,doorCount:doors.length,windowCount:windows.length}};
  }

  function rectangularRoom(width,depth,options={}){
    const W=clamp(Number(width)||3.6,2.7,8),D=clamp(Number(depth)||3.8,2.7,8),doorWidth=clamp(Number(options.doorWidth)||.9,.7,Math.min(1.4,W-.08)),doorOffset=clamp(Number(options.doorOffset)||.1,.04,Math.max(.04,W-doorWidth-.04));
    const windowWidth=clamp(Number(options.windowWidth)||Math.min(1.5,W*.42),.7,Math.max(.7,W-.2)),windowCenter=clamp(Number(options.windowCenter)||W/2,windowWidth/2+.05,W-windowWidth/2-.05);
    return createRoom({polygon:[{x:0,y:0},{x:W,y:0},{x:W,y:D},{x:0,y:D}],openings:[{type:'window',points:[{x:windowCenter-windowWidth/2,y:0},{x:windowCenter+windowWidth/2,y:0}]},{type:'door_open',points:[{x:doorOffset+doorWidth,y:D},{x:doorOffset,y:D}]}]});
  }

  function wallLocalRect(row,wall,t,extra={}){
    const along=t+row.u,inward=row.v,center={x:wall.a.x+wall.dir.x*along+wall.normal.x*inward,y:wall.a.y+wall.dir.y*along+wall.normal.y*inward};
    const horizontal=wall.horizontal,rotation=horizontal?(wall.dir.x>0?0:180):(wall.dir.y>0?90:270);
    return rect(center.x,center.y,horizontal?row.w:row.d,horizontal?row.d:row.w,{rotation,...extra});
  }

  function wallDistance(point,room){return Math.min(...room.walls.map(wall=>pointSegmentDistance(point,wall.a,wall.b)));}
  function wallsOppose(a,b){return a.normal.x*b.normal.x+a.normal.y*b.normal.y<-.9;}

  return {EPS,round,rect,polygonArea,signedArea,pointInPolygon,pointSegmentDistance,rectInsidePolygon,compileWalls,createRoom,rectangularRoom,wallLocalRect,wallDistance,wallsOppose};
});
