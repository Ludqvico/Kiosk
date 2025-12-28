// Preload script per sicurezza
// Non espone nessuna API al renderer per massima sicurezza

window.addEventListener('DOMContentLoaded', () => {
  console.log('Kiosk mode attivo');
});

// Blocca eventi comuni
window.addEventListener('keydown', (e) => {
  // Lascia passare solo eventi normali per il sistema di password
}, false);

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});
