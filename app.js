const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let items = [];
let identity = localStorage.getItem('wishes_identity'); // person name, '__all__', or null
let occasionFilter = 'all';

// --- DOM refs ---
const board = document.getElementById('board');
const emptyMsg = document.getElementById('emptyMsg');
const syncStatus = document.getElementById('syncStatus');
const addForm = document.getElementById('addForm');
const personSelect = document.getElementById('personSelect');
const personNewInput = document.getElementById('personNewInput');
const itemInput = document.getElementById('itemInput');
const toggleDetails = document.getElementById('toggleDetails');
const detailsFields = document.getElementById('detailsFields');
const noteInput = document.getElementById('noteInput');
const occasionSelect = document.getElementById('occasionSelect');
const occasionNewInput = document.getElementById('occasionNewInput');
const priorityInput = document.getElementById('priorityInput');
const surpriseInput = document.getElementById('surpriseInput');
const surpriseLabel = document.getElementById('surpriseLabel');
const occasionFilterRow = document.getElementById('occasionFilterRow');
const occasionFilterSelect = document.getElementById('occasionFilter');

const identityBtn = document.getElementById('identityBtn');
const identityLabel = document.getElementById('identityLabel');
const identityModal = document.getElementById('identityModal');
const identityOptions = document.getElementById('identityOptions');
const identityNewInput = document.getElementById('identityNewInput');
const identityNewBtn = document.getElementById('identityNewBtn');
const identityShowAllBtn = document.getElementById('identityShowAllBtn');

const historyBtn = document.getElementById('historyBtn');
const backToMain = document.getElementById('backToMain');
const mainView = document.getElementById('mainView');
const historyView = document.getElementById('historyView');
const historyBoard = document.getElementById('historyBoard');
const historyEmptyMsg = document.getElementById('historyEmptyMsg');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// --- helpers ---
function checkIconSVG(){
  return '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
}
function escapeHtml(s){
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
function isUrl(s){
  return /^https?:\/\//i.test((s||'').trim());
}
function isHiddenFromMe(item){
  return !!(item.surprise && identity && identity !== '__all__' && item.person === identity);
}
function distinctPeople(){
  const set = new Set(items.map(i=>i.person));
  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}
function distinctOccasions(){
  const set = new Set(items.filter(i=>i.occasion).map(i=>i.occasion));
  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}

function setSyncStatus(state){
  syncStatus.classList.remove('live','error');
  if(state === 'live'){
    syncStatus.textContent = 'Live';
    syncStatus.classList.add('live');
  } else if(state === 'error'){
    syncStatus.textContent = 'Connection error';
    syncStatus.classList.add('error');
  } else {
    syncStatus.textContent = 'Connecting…';
  }
}

// --- identity ---
function identityDisplayLabel(){
  if(!identity) return '—';
  if(identity === '__all__') return 'Everyone';
  return identity;
}
function refreshIdentityUI(){
  identityLabel.textContent = identityDisplayLabel();
}
function openIdentityModal(){
  identityOptions.innerHTML = '';
  distinctPeople().forEach(p=>{
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = p;
    b.addEventListener('click', ()=>setIdentity(p));
    identityOptions.appendChild(b);
  });
  identityNewInput.value = '';
  identityModal.style.display = 'flex';
}
function closeIdentityModal(){
  identityModal.style.display = 'none';
}
function setIdentity(value){
  identity = value;
  localStorage.setItem('wishes_identity', value);
  refreshIdentityUI();
  closeIdentityModal();
  renderAll();
}
identityBtn.addEventListener('click', openIdentityModal);
identityNewBtn.addEventListener('click', ()=>{
  const v = identityNewInput.value.trim();
  if(v) setIdentity(v);
});
identityShowAllBtn.addEventListener('click', ()=>setIdentity('__all__'));

// --- history view toggle ---
historyBtn.addEventListener('click', ()=>{
  mainView.style.display = 'none';
  historyView.style.display = 'block';
  renderHistory();
});
backToMain.addEventListener('click', ()=>{
  historyView.style.display = 'none';
  mainView.style.display = 'block';
});

// --- add-form: person select ---
function refreshPersonSelect(){
  const prev = personSelect.value;
  personSelect.innerHTML = '';
  distinctPeople().forEach(p=>{
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    personSelect.appendChild(opt);
  });
  const newOpt = document.createElement('option');
  newOpt.value = '__new__';
  newOpt.textContent = '+ New person…';
  personSelect.appendChild(newOpt);

  if(prev && Array.from(personSelect.options).some(o=>o.value===prev)){
    personSelect.value = prev;
  } else if(personSelect.options.length){
    personSelect.selectedIndex = 0;
  }
  syncPersonNewVisibility();
}
function syncPersonNewVisibility(){
  if(personSelect.value === '__new__' || personSelect.options.length === 0){
    personNewInput.style.display = '';
  } else {
    personNewInput.style.display = 'none';
  }
  updateSurpriseLabel();
}
personSelect.addEventListener('change', syncPersonNewVisibility);
personNewInput.addEventListener('input', updateSurpriseLabel);

function currentPersonValue(){
  if(personSelect.options.length === 0 || personSelect.value === '__new__'){
    return personNewInput.value.trim();
  }
  return personSelect.value;
}
function updateSurpriseLabel(){
  const p = currentPersonValue();
  surpriseLabel.textContent = p ? `Keep this a surprise from ${p}` : 'Keep this a surprise from them';
}

// --- add-form: occasion select ---
function refreshOccasionSelect(){
  const preset = ['', 'Christmas', 'Birthday', 'Just because'];
  const extras = distinctOccasions().filter(o=>!preset.includes(o));
  extras.forEach(o=>{
    if(!Array.from(occasionSelect.options).some(opt=>opt.value===o)){
      const opt = document.createElement('option');
      opt.value = o;
      opt.textContent = o;
      occasionSelect.insertBefore(opt, occasionSelect.querySelector('option[value="__new__"]'));
    }
  });
}
occasionSelect.addEventListener('change', ()=>{
  occasionNewInput.style.display = occasionSelect.value === '__new__' ? '' : 'none';
});
function currentOccasionValue(){
  if(occasionSelect.value === '__new__'){
    return occasionNewInput.value.trim();
  }
  return occasionSelect.value;
}

// --- add-form: details toggle ---
toggleDetails.addEventListener('click', ()=>{
  const showing = detailsFields.style.display !== 'none';
  detailsFields.style.display = showing ? 'none' : 'block';
  toggleDetails.textContent = showing ? '+ Add details (note, occasion, priority, surprise)' : '- Hide details';
});

// --- occasion filter ---
function refreshOccasionFilterOptions(){
  const occasions = distinctOccasions();
  const prev = occasionFilterSelect.value;
  occasionFilterSelect.innerHTML = '<option value="all">All</option><option value="__none__">No occasion</option>';
  occasions.forEach(o=>{
    const opt = document.createElement('option');
    opt.value = o;
    opt.textContent = o;
    occasionFilterSelect.appendChild(opt);
  });
  if(Array.from(occasionFilterSelect.options).some(o=>o.value===prev)){
    occasionFilterSelect.value = prev;
  }
  occasionFilterRow.style.display = occasions.length > 0 ? 'flex' : 'none';
}
occasionFilterSelect.addEventListener('change', ()=>{
  occasionFilter = occasionFilterSelect.value;
  renderBoard();
});

// --- rendering ---
function itemMatchesOccasionFilter(item){
  if(occasionFilter === 'all') return true;
  if(occasionFilter === '__none__') return !item.occasion;
  return item.occasion === occasionFilter;
}

function buildItemLi(it, opts){
  opts = opts || {};
  const li = document.createElement('li');
  li.className = 'item' + (it.got ? ' got' : '');

  const tickHtml = opts.showTick === false ? '' :
    `<button class="tick" aria-label="Mark as got">${checkIconSVG()}</button>`;

  li.innerHTML = `
    ${tickHtml}
    <div class="label-wrap">
      <span class="label"></span>
      <div class="meta"></div>
    </div>
    ${opts.showUndo ? '<button class="undo-btn">Undo</button>' : ''}
    <button class="del" aria-label="Remove">&times;</button>
  `;

  li.querySelector('.label').textContent = (it.priority ? '⭐ ' : '') + it.item;

  const meta = li.querySelector('.meta');
  if(it.occasion){
    const b = document.createElement('span');
    b.className = 'badge';
    b.textContent = it.occasion;
    meta.appendChild(b);
  }
  if(it.note){
    if(isUrl(it.note)){
      const a = document.createElement('a');
      a.href = it.note;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'note-link';
      a.textContent = 'View link ↗';
      meta.appendChild(a);
    } else {
      const n = document.createElement('span');
      n.className = 'note-text';
      n.textContent = it.note;
      meta.appendChild(n);
    }
  }

  if(opts.showTick !== false){
    li.querySelector('.tick').addEventListener('click', ()=>toggleGot(it.id, it.got));
  }
  if(opts.showUndo){
    li.querySelector('.undo-btn').addEventListener('click', ()=>toggleGot(it.id, it.got));
  }
  li.querySelector('.del').addEventListener('click', ()=>{
    if(opts.confirmDelete){
      if(!confirm(`Remove "${it.item}" permanently?`)) return;
    }
    deleteItem(it.id);
  });

  return li;
}

function groupByPerson(list){
  const byPerson = {};
  list.forEach(it=>{
    if(!byPerson[it.person]) byPerson[it.person] = [];
    byPerson[it.person].push(it);
  });
  return byPerson;
}

function renderBoard(){
  board.innerHTML = '';
  const visible = items.filter(i=>!i.got && !isHiddenFromMe(i) && itemMatchesOccasionFilter(i));

  if(visible.length === 0){
    emptyMsg.style.display = 'block';
    return;
  }
  emptyMsg.style.display = 'none';

  const byPerson = groupByPerson(visible);
  Object.keys(byPerson).sort((a,b)=>a.localeCompare(b)).forEach(person=>{
    const list = byPerson[person].sort((a,b)=>{
      if(!!a.priority !== !!b.priority) return a.priority ? -1 : 1;
      return new Date(a.created_at) - new Date(b.created_at);
    });

    const card = document.createElement('div');
    card.className = 'person-card';
    card.innerHTML = `
      <div class="person-head">
        <span>${escapeHtml(person)}</span>
        <span class="count">${list.length}</span>
      </div>
      <ul class="items"></ul>
    `;
    const ul = card.querySelector('ul.items');
    list.forEach(it=> ul.appendChild(buildItemLi(it, {})));
    board.appendChild(card);
  });
}

function renderHistory(){
  historyBoard.innerHTML = '';
  const visible = items.filter(i=>i.got && !isHiddenFromMe(i));

  if(visible.length === 0){
    historyEmptyMsg.style.display = 'block';
    return;
  }
  historyEmptyMsg.style.display = 'none';

  const byPerson = groupByPerson(visible);
  Object.keys(byPerson).sort((a,b)=>a.localeCompare(b)).forEach(person=>{
    const list = byPerson[person].sort((a,b)=> new Date(b.created_at) - new Date(a.created_at));
    const card = document.createElement('div');
    card.className = 'person-card';
    card.innerHTML = `
      <div class="person-head">
        <span>${escapeHtml(person)}</span>
        <span class="count">${list.length}</span>
      </div>
      <ul class="items"></ul>
    `;
    const ul = card.querySelector('ul.items');
    list.forEach(it=> ul.appendChild(buildItemLi(it, { showTick:false, showUndo:true, confirmDelete:true })));
    historyBoard.appendChild(card);
  });
}

function renderAll(){
  refreshIdentityUI();
  refreshPersonSelect();
  refreshOccasionSelect();
  refreshOccasionFilterOptions();
  renderBoard();
  if(historyView.style.display !== 'none'){
    renderHistory();
  }
}

// --- data ops ---
async function loadItems(){
  const { data, error } = await db.from('wishlist_items').select('*').order('created_at', { ascending: true });
  if(error){
    setSyncStatus('error');
    return;
  }
  items = data || [];
  setSyncStatus('live');
  renderAll();

  if(!identity){
    openIdentityModal();
  }
}

function subscribeRealtime(){
  db.channel('wishlist_items_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'wishlist_items' }, payload=>{
      if(payload.eventType === 'INSERT'){
        items.push(payload.new);
      } else if(payload.eventType === 'UPDATE'){
        const idx = items.findIndex(i=>i.id === payload.new.id);
        if(idx !== -1) items[idx] = payload.new;
      } else if(payload.eventType === 'DELETE'){
        items = items.filter(i=>i.id !== payload.old.id);
      }
      renderAll();
    })
    .subscribe(status=>{
      if(status === 'SUBSCRIBED') setSyncStatus('live');
      else if(status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setSyncStatus('error');
    });
}

async function addItem(record){
  const { error } = await db.from('wishlist_items').insert([record]);
  if(error) setSyncStatus('error');
}

async function toggleGot(id, currentGot){
  const { error } = await db.from('wishlist_items').update({ got: !currentGot }).eq('id', id);
  if(error) setSyncStatus('error');
}

async function deleteItem(id){
  const { error } = await db.from('wishlist_items').delete().eq('id', id);
  if(error) setSyncStatus('error');
}

async function clearHistory(){
  const idsToClear = items.filter(i=>i.got && !isHiddenFromMe(i)).map(i=>i.id);
  if(idsToClear.length === 0) return;
  if(!confirm(`Permanently delete ${idsToClear.length} item(s) from history? This can't be undone.`)) return;
  const { error } = await db.from('wishlist_items').delete().in('id', idsToClear);
  if(error) setSyncStatus('error');
}
clearHistoryBtn.addEventListener('click', clearHistory);

// --- form submit ---
addForm.addEventListener('submit', function(e){
  e.preventDefault();
  const person = currentPersonValue();
  const item = itemInput.value.trim();
  if(!person || !item) return;

  const record = {
    person,
    item,
    got: false,
    note: noteInput.value.trim() || null,
    occasion: currentOccasionValue() || null,
    priority: !!priorityInput.checked,
    surprise: !!surpriseInput.checked
  };

  addItem(record);

  itemInput.value = '';
  noteInput.value = '';
  priorityInput.checked = false;
  surpriseInput.checked = false;
  occasionSelect.value = '';
  occasionNewInput.value = '';
  occasionNewInput.style.display = 'none';
  if(personSelect.value === '__new__'){
    personNewInput.value = '';
  }
  itemInput.focus();
});

loadItems();
subscribeRealtime();
