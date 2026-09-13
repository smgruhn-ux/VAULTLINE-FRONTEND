const nav = document.querySelector('#site-nav');
const toggle = document.querySelector('.nav-toggle');

function closeMenu(){
  if(!nav || !toggle) return;
  nav.classList.remove('open');
  toggle.setAttribute('aria-expanded','false');
}

nav?.querySelectorAll('a[href^="#"]').forEach(link=>{
  link.addEventListener('click',()=>{
    closeMenu();
  });
});

window.addEventListener('hashchange',closeMenu);
