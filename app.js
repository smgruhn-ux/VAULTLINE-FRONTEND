const mobileFixes=document.createElement('link');
mobileFixes.rel='stylesheet';
mobileFixes.href='/mobile-fixes.css';
document.head.appendChild(mobileFixes);

import('./app-live.js').then(()=>import('./nav-fix.js'));
