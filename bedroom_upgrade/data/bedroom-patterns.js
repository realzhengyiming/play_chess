(function(root,factory){
  const value=factory();
  if(typeof module==='object'&&module.exports)module.exports=value;
  root.BedroomChessPatterns=value;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  return [
    {
      id:'standard-perimeter',
      label:'标准外围型',
      description:'床组、收纳组与工作组沿外围完整墙段落位，中央保留连续活动面。',
      match:{minArea:8,maxArea:19,maxAspect:1.55},
      modules:[
        {type:'sleep',required:true,sizes:['M','S','L'],candidateLimit:10},
        {type:'storage',required:true,sizes:['M','S','L'],candidateLimit:8},
        {type:'work',required:false,sizes:['M','S','L'],candidateLimit:8}
      ],
      relations:[
        {id:'sleep-door-privacy',type:'avoid-facing-opening',subject:'sleep',openingKind:'door',required:false,alignmentTolerance:.8,maxDistance:6}
      ]
    },
    {
      id:'hotel-long-axis',
      label:'狭长酒店型',
      description:'床组建立主轴，床尾媒体组占据对墙，收纳和工作模块沿长侧墙展开。',
      match:{minArea:13,minAspect:1.45},
      modules:[
        {type:'sleep',required:true,sizes:['L','M','S'],candidateLimit:10},
        {type:'media',required:true,sizes:['L','M','S'],candidateLimit:8},
        {type:'storage',required:true,sizes:['L','M','S'],candidateLimit:8},
        {type:'work',required:false,sizes:['L','M','S'],candidateLimit:7},
        {type:'lounge',required:false,sizes:['M','S'],candidateLimit:6}
      ],
      relations:[
        {id:'media-view-target',type:'facing-any',subject:'media',targets:['sleep','lounge'],targetWeights:{sleep:1,lounge:.72},required:false,alignmentTolerance:1.2,minDistance:1.4,maxDistance:5.8,minActiveScore:.6,candidateOffsets:[0,-.35,.35,-.7,.7]},
        {id:'work-media-axis',type:'avoid-facing',subject:'work',targets:['media'],required:false,alignmentTolerance:1,minDistance:1,maxDistance:5.8,minActiveScore:.55},
        {id:'sleep-door-privacy',type:'avoid-facing-opening',subject:'sleep',openingKind:'door',required:false,alignmentTolerance:.8,maxDistance:6}
      ]
    },
    {
      id:'suite-zoned',
      label:'大卧室套间型',
      description:'在睡眠、收纳和工作模块之外，继续挑战正式休闲或梳妆模块。',
      match:{minArea:18,maxAspect:1.8},
      modules:[
        {type:'sleep',required:true,sizes:['L','M'],candidateLimit:10},
        {type:'storage',required:true,sizes:['L','M','S'],candidateLimit:8},
        {type:'work',required:true,sizes:['L','M','S'],candidateLimit:8},
        {type:'lounge',required:false,sizes:['L','M','S'],candidateLimit:7},
        {type:'dressing',required:false,sizes:['M','L','S'],candidateLimit:6}
      ],
      relations:[
        {id:'sleep-door-privacy',type:'avoid-facing-opening',subject:'sleep',openingKind:'door',required:false,alignmentTolerance:.8,maxDistance:6}
      ]
    }
  ];
});
