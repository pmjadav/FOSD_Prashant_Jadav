const nav=document.getElementById('navLinks'), menu=document.getElementById('menuToggle');
if(menu) menu.addEventListener('click',()=>nav.classList.toggle('open'));
const theme=document.getElementById('themeToggle');
if(theme){theme.addEventListener('click',()=>{document.body.classList.toggle('dark');localStorage.setItem('fosd-dark',document.body.classList.contains('dark'))});if(localStorage.getItem('fosd-dark')==='true')document.body.classList.add('dark')}
const search=document.getElementById('siteSearch');
if(search){search.addEventListener('input',()=>{const q=search.value.toLowerCase().trim();document.querySelectorAll('[data-search]').forEach(el=>el.style.display=(!q||el.dataset.search.toLowerCase().includes(q))?'':'none')})}
document.querySelectorAll('.pdf-placeholder').forEach(a=>a.addEventListener('click',e=>{if(a.dataset.status==='soon'){e.preventDefault();alert('PDF placeholder\n\nUpload the corresponding PDF to:\n'+a.dataset.file+'\n\nThe link is already prepared for GitHub Pages.');}}));
