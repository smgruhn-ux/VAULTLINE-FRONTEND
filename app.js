// Vaultline storefront entry point.
// Loads the main application then enhancement modules.
import('./app-live.js').then(()=>import('./color-variants.js'));
