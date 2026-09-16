// Vaultline storefront entry point.
// Load the approved editorial imagery after the base styles so these placements win cleanly.
const editorialStyles=document.createElement('link');
editorialStyles.rel='stylesheet';
editorialStyles.href='/editorial-overrides.css?v=20260916-1';
document.head.appendChild(editorialStyles);
import('./app-live.js').then(()=>import('./color-variants.js'));
