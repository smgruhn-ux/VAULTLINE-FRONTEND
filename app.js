const mobileFixes=document.createElement('link');
mobileFixes.rel='stylesheet';
mobileFixes.href='/mobile-fixes.css';
document.head.appendChild(mobileFixes);

import('./app-live.js').then(()=>Promise.all([
  import('./nav-fix.js'),
  import('./color-variants.js')
]));
