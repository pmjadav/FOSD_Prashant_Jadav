(function(){
 const root=document.documentElement;
 const saved=localStorage.getItem('fosd-theme');
 if(saved) root.setAttribute('data-theme',saved);
 const theme=document.getElementById('themeToggle');
 if(theme) theme.addEventListener('click',()=>{const next=root.getAttribute('data-theme')==='dark'?'light':'dark'; if(next==='light') root.removeAttribute('data-theme'); else root.setAttribute('data-theme','dark'); localStorage.setItem('fosd-theme',next);});
 const menu=document.getElementById('menuToggle'), nav=document.getElementById('navLinks');
 if(menu&&nav) menu.addEventListener('click',()=>nav.classList.toggle('open'));
 const search=document.getElementById('siteSearch');
 if(search){search.addEventListener('input',()=>{const q=search.value.toLowerCase().trim(); document.querySelectorAll('[data-search]').forEach(el=>{el.style.display=!q||el.dataset.search.toLowerCase().includes(q)?'flex':'';});});}
})();
