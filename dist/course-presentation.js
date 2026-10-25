(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CoursePresentation=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const templates={forest:'assets/world-grove.webp',seaside:'assets/away-seaside.png',winter:'assets/away-winter.png'};
 function cleanTitle(value,fallback='学习课程'){
  const title=String(value||'').trim().replace(/^```(?:json|markdown|md|text)?\s*/i,'').replace(/```\s*$/,'').replace(/^[#\s]+/,'').trim();
  return /[\p{L}\p{N}]/u.test(title)?title.slice(0,100):fallback;
 }
 function imageSource(course){
  if(course.template!=='custom')return templates[course.template]||templates.forest;
  const value=String(course.customImage||'').trim();
  if(!value)return '';
  if(/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(value))return value;
  try{const url=new URL(value,'http://localhost/');if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return '';return value;}catch{return '';}
 }
 function applyBackground(element,course){
  element.querySelectorAll('[data-course-background], [data-background-error]').forEach(x=>x.remove());
  element.style.backgroundImage='none';
  const source=imageSource(course),img=element.ownerDocument.createElement('img');
  img.dataset.courseBackground='';img.alt=course.template==='custom'?'AI 生成的课程场景':'课程场景';
  Object.assign(img.style,{position:'absolute',inset:'0',width:'100%',height:'100%',objectFit:'cover',pointerEvents:'none'});
  const fail=()=>{img.remove();const hint=element.ownerDocument.createElement('span');hint.dataset.backgroundError='';hint.textContent='场景图片未能加载，请返回工作台重新选择场景；已生成的题目仍可使用。';Object.assign(hint.style,{position:'absolute',left:'20px',top:'45%',right:'20px',zIndex:'2',padding:'12px',background:'#fffdf8',color:'#3f6252',borderRadius:'12px',fontSize:'12px'});element.appendChild(hint);};
  img.onerror=fail;element.prepend(img);if(source)img.src=source;else fail();return img;
 }
 return {templates,cleanTitle,imageSource,applyBackground};
});
