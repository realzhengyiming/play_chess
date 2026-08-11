(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.BedroomRecognizedRoomAdapter=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const round=(value,digits=4)=>Number(value.toFixed(digits));
  const pointLike=value=>Array.isArray(value)?value.length>=2&&Number.isFinite(Number(value[0]))&&Number.isFinite(Number(value[1])):value&&Number.isFinite(Number(value.x))&&Number.isFinite(Number(value.y));
  const asPoint=value=>Array.isArray(value)?{x:Number(value[0]),y:Number(value[1])}:{x:Number(value.x),y:Number(value.y)};
  const directRing=value=>{let ring=value;while(Array.isArray(ring)&&ring.length===1&&Array.isArray(ring[0]))ring=ring[0];return Array.isArray(ring)&&ring.length>=3&&ring.slice(0,Math.min(3,ring.length)).every(pointLike)?ring:null;};
  const polygonArea=points=>Math.abs(points.reduce((sum,a,index)=>{const b=points[(index+1)%points.length];return sum+a.x*b.y-b.x*a.y;},0))/2;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function simplifyRing(points){
    let rows=points.slice(),changed=true;
    while(changed&&rows.length>4){changed=false;const next=[];for(let index=0;index<rows.length;index++){const a=rows[(index-1+rows.length)%rows.length],b=rows[index],c=rows[(index+1)%rows.length],cross=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);if(Math.abs(cross)<1e-5){changed=true;continue;}next.push(b);}rows=next.length>=3?next:rows;}
    return rows;
  }
  function pointSegmentDistance(point,a,b){const dx=b.x-a.x,dy=b.y-a.y,length2=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/length2));return Math.hypot(point.x-(a.x+t*dx),point.y-(a.y+t*dy));}

  function collectBedrooms(root){
    const rooms=[];
    const visit=value=>{
      if(value==null)return;
      if(Array.isArray(value)){
        const type=String(value[0]||'').toLowerCase(),ring=directRing(value[1]);
        if(type==='bedroom'&&ring){rooms.push({type,rawPolygon:ring,source:value});return;}
        value.forEach(visit);return;
      }
      if(typeof value!=='object')return;
      const type=String(value.room_type||value.roomType||value.type||value.category||'').toLowerCase();
      const ring=directRing(value.polygon||value.room_polygon||value.points||value.contour||value.outline||value.vertices||value.boundary);
      if(type==='bedroom'&&ring){rooms.push({type,rawPolygon:ring,source:value});return;}
      Object.values(value).forEach(visit);
    };
    visit(root);const seen=new Set();return rooms.filter(room=>{const key=JSON.stringify(room.rawPolygon);if(seen.has(key))return false;seen.add(key);return true;});
  }

  function prepareBedrooms(payload,inputArea){
    const root=payload?.data||payload||{},rooms=collectBedrooms(root.room_data??root.rooms??root);
    const rawOpenings=(Array.isArray(root.close_data)?root.close_data:[]).map((row,index)=>({type:String(row?.[0]||''),points:(Array.isArray(row?.[1])?row[1]:[]).filter(pointLike).slice(0,2).map(asPoint),index})).filter(row=>row.points.length===2);
    const pixelRooms=rooms.map(room=>{const points=room.rawPolygon.map(asPoint),xs=points.map(p=>p.x),ys=points.map(p=>p.y);return {room,points,span:Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)),rawArea:polygonArea(points)};});
    const totalRawArea=pixelRooms.filter(row=>row.span>20).reduce((sum,row)=>sum+row.rawArea,0),apiScale=Number(root.scale_rate),scale=Number.isFinite(apiScale)&&apiScale>0?apiScale:(totalRawArea>0&&Number(inputArea)>0?Math.sqrt(Number(inputArea)/totalRawArea):1);
    return pixelRooms.map((row,index)=>{
      const actualScale=row.span<=20?1:scale,rawMinX=Math.min(...row.points.map(p=>p.x)),rawMinY=Math.min(...row.points.map(p=>p.y));
      let polygon=row.points.map(point=>({x:round((point.x-rawMinX)*actualScale),y:round((point.y-rawMinY)*actualScale)}));
      if(polygon.length>3&&distance(polygon[0],polygon[polygon.length-1])<1e-5)polygon.pop();
      polygon=simplifyRing(polygon);
      const width=Math.max(...polygon.map(p=>p.x)),depth=Math.max(...polygon.map(p=>p.y)),area=polygonArea(polygon),rectangularity=area/Math.max(.001,width*depth);
      const rawEdges=row.points.map((a,edgeIndex)=>({a,b:row.points[(edgeIndex+1)%row.points.length]}));
      const openings=rawOpenings.filter(opening=>opening.points.every(point=>Math.min(...rawEdges.map(edge=>pointSegmentDistance(point,edge.a,edge.b)))<=2.5)).map(opening=>({...opening,points:opening.points.map(point=>({x:round((point.x-rawMinX)*actualScale),y:round((point.y-rawMinY)*actualScale)}))}));
      const edges=polygon.map((a,edgeIndex)=>({a,b:polygon[(edgeIndex+1)%polygon.length]}));
      const orthogonal=edges.every(edge=>Math.abs(edge.a.x-edge.b.x)<1e-4||Math.abs(edge.a.y-edge.b.y)<1e-4),supported=orthogonal&&area>=5;
      const topologyKind=rectangularity>=.985?'矩形':rectangularity>=.90?'轻异形':'明显异形';
      return {id:`bedroom-${index+1}`,label:`卧室 ${index+1}`,polygon,openings,width,depth,area,rectangularity,orthogonal,topologyKind,supported,reason:supported?`可进入${topologyKind}模块棋`:'当前检测到斜墙或房间面积异常'};
    });
  }

  return {prepareBedrooms,polygonArea};
});
