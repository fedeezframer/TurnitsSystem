self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json()||{}}catch{data={body:event.data?.text()||''}}
  event.waitUntil(self.registration.showNotification(data.title||'Turnits',{
    body:data.body||data.message||'',icon:'/apple-touch-icon.png',badge:'/favicon-light.png',
    tag:data.tag,data:{url:data.url||data.data?.url||'/panel'},
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();let url;
  try{url=new URL(event.notification.data?.url||'/panel',self.location.origin)}catch{url=new URL('/panel',self.location.origin)}
  if(['turnits.com','www.turnits.com'].includes(url.hostname))url=new URL(url.pathname+url.search,self.location.origin);
  if(url.origin!==self.location.origin)url=new URL('/panel',self.location.origin);
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{
    const tab=windows.find(w=>new URL(w.url).origin===self.location.origin);
    if(tab){await tab.navigate(url.href);return tab.focus()}return self.clients.openWindow(url.href);
  }));
});
