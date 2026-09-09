const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let items = [];
let knownPeople = []; // [{name, permanent}]
let restrictedPeople = new Set();
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
const hideFromRow = document.getElementById('hideFromRow');
const hideFromSelect = document.getElementById('hideFromSelect');
const occasionFilterRow = document.getElementById('occasionFilterRow');
const occasionFilterSelect = document.getElementById('occasionFilter');

const identityBtn = document.getElementById('identityBtn');
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

const adminBtn = document.getElementById('adminBtn');
const pinModal = document.getElementById('pinModal');
const pinInput = document.getElementById('pinInput');
const pinSubmitBtn = document.getElementById('pinSubmitBtn');
const pinError = document.getElementById('pinError');
const pinCancelBtn = document.getElementById('pinCancelBtn');
const manageModal = document.getElementById('manageModal');
const managePeopleList = document.getElementById('managePeopleList');
const manageEmptyMsg = document.getElementById('manageEmptyMsg');
const manageCloseBtn = document.getElementById('manageCloseBtn');
const manageAddPersonInput = document.getElementById('manageAddPersonInput');
const manageAddPersonBtn = document.getElementById('manageAddPersonBtn');

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
  return !!(item.hidden_from && identity && identity !== '__all__' && item.hidden_from === identity);
}
function isOwnItem(item){
  return !!(identity && identity !== '__all__' && item.person === identity);
}
function distinctPeople(){
  const set = new Set(knownPeople.map(p=>p.name));
  items.forEach(i=>set.add(i.person));
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
  if(!identity) return 'Who are you?';
  if(identity === '__all__') return 'Seeing everything';
  return `You're ${identity}`;
}
function refreshIdentityUI(){
  identityBtn.textContent = identityDisplayLabel();
}
function openIdentityModal(){
  identityOptions.innerHTML = '';
  distinctPeople().filter(p=>!restrictedPeople.has(p)).forEach(p=>{
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `I'm ${p}`;
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
  updateSurpriseDefault();
}
identityBtn.addEventListener('click', openIdentityModal);
identityNewBtn.addEventListener('click', ()=>{
  const v = identityNewInput.value.trim();
  if(!v) return;
  if(restrictedPeople.has(v)){
    alert(`"${v}" isn't set up as a viewer on this list right now. Ask a family admin if that should change.`);
    return;
  }
  registerPerson(v);
  setIdentity(v);
});
identityShowAllBtn.addEventListener('click', ()=>setIdentity('__all__'));
document.getElementById('identitySkipBtn').addEventListener('click', closeIdentityModal);

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

// --- admin PIN + manage people ---
adminBtn.addEventListener('click', ()=>{
  pinInput.value = '';
  pinError.style.display = 'none';
  pinModal.style.display = 'flex';
  pinInput.focus();
});
pinCancelBtn.addEventListener('click', ()=>{ pinModal.style.display = 'none'; });
pinSubmitBtn.addEventListener('click', submitPin);
pinInput.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') submitPin(); });
function submitPin(){
  if(pinInput.value === ADMIN_PIN){
    pinModal.style.display = 'none';
    openManageModal();
  } else {
    pinError.style.display = 'block';
  }
}

function openManageModal(){
  renderManageList();
  manageModal.style.display = 'flex';
}
manageCloseBtn.addEventListener('click', ()=>{ manageModal.style.display = 'none'; });

function renderManageList(){
  managePeopleList.innerHTML = '';
  const people = distinctPeople();
  manageEmptyMsg.style.display = people.length === 0 ? 'block' : 'none';

  people.forEach(p=>{
    const known = knownPeople.find(k=>k.name===p);
    const isPermanent = !!(known && known.permanent);
    const isAllowed = !restrictedPeople.has(p);

    const row = document.createElement('div');
    row.className = 'manage-row';
    row.innerHTML = `
      <label class="check-row">
        <input type="checkbox" ${isAllowed ? 'checked' : ''}>
        <span>${escapeHtml(p)}</span>
      </label>
      ${isPermanent
        ? '<span class="permanent-badge">Permanent</span>'
        : '<button type="button" class="manage-remove" aria-label="Remove person">&times;</button>'}
    `;
    row.querySelector('input').addEventListener('change', (e)=>{
      if(e.target.checked){
        allowIdentity(p);
      } else {
        restrictIdentity(p);
      }
    });
    const removeBtn = row.querySelector('.manage-remove');
    if(removeBtn){
      removeBtn.addEventListener('click', ()=>{
        if(confirm(`Remove ${p} from the people list? Existing items for them stay, but they'll stop showing as a dropdown option or standing card once those are gone.`)){
          removePerson(p);
        }
      });
    }
    managePeopleList.appendChild(row);
  });
}

manageAddPersonBtn.addEventListener('click', ()=>{
  const v = manageAddPersonInput.value.trim();
  if(!v) return;
  registerPerson(v);
  manageAddPersonInput.value = '';
});
manageAddPersonInput.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter'){ e.preventDefault(); manageAddPersonBtn.click(); }
});

async function restrictIdentity(person){
  const { error } = await db.from('restricted_identities').insert([{ person }]);
  if(error) setSyncStatus('error');
}
async function allowIdentity(person){
  const { error } = await db.from('restricted_identities').delete().eq('person', person);
  if(error) setSyncStatus('error');
}
async function registerPerson(name){
  if(!name) return;
  if(knownPeople.some(p=>p.name===name)) return;
  const { error } = await db.from('people').insert([{ name, permanent: false }]);
  if(error) setSyncStatus('error');
}
async function removePerson(name){
  const { error } = await db.from('people').delete().eq('name', name);
  if(error) setSyncStatus('error');
}

// --- add-form: person select ---
let hasSetInitialSurpriseDefault = false;
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
  if(!hasSetInitialSurpriseDefault){
    updateSurpriseDefault();
    hasSetInitialSurpriseDefault = true;
  }
}
function syncPersonNewVisibility(){
  if(personSelect.value === '__new__' || personSelect.options.length === 0){
    personNewInput.style.display = '';
  } else {
    personNewInput.style.display = 'none';
  }
  updateSurpriseLabel();
}
personSelect.addEventListener('change', ()=>{ syncPersonNewVisibility(); updateSurpriseDefault(); });
personNewInput.addEventListener('input', ()=>{ updateSurpriseLabel(); updateSurpriseDefault(); });

function currentPersonValue(){
  if(personSelect.options.length === 0 || personSelect.value === '__new__'){
    return personNewInput.value.trim();
  }
  return personSelect.value;
}
function updateSurpriseLabel(){
  // Label stays static now; the specific target is chosen in the hide-from selector.
}
function updateSurpriseDefault(){
  const p = currentPersonValue();
  if(!p) return;
  // Default ON when adding for someone else; default OFF for your own list (hiding from yourself makes no sense)
  surpriseInput.checked = (p !== identity);
  syncHideFromVisibility();
}
function populateHideFromSelect(){
  const people = distinctPeople();
  const prev = hideFromSelect.value;
  hideFromSelect.innerHTML = '';
  people.forEach(p=>{
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    hideFromSelect.appendChild(opt);
  });
  if(prev && people.includes(prev)){
    hideFromSelect.value = prev;
  }
}
function syncHideFromVisibility(){
  hideFromRow.style.display = surpriseInput.checked ? 'block' : 'none';
  if(surpriseInput.checked){
    populateHideFromSelect();
    const p = currentPersonValue();
    if(p && Array.from(hideFromSelect.options).some(o=>o.value===p)){
      hideFromSelect.value = p;
    }
  }
}
surpriseInput.addEventListener('change', syncHideFromVisibility);

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
  toggleDetails.textContent = showing ? '+ Add details (note, occasion, priority)' : '- Hide details';
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
  // Own items never show got/claimed styling, no matter their real state
  li.className = 'item' + (!opts.ownItem && it.got ? ' got' : '');

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
  const visible = items.filter(i=>{
    if(isHiddenFromMe(i)) return false;
    if(!itemMatchesOccasionFilter(i)) return false;
    if(isOwnItem(i)) return true; // always shown to the owner, regardless of claimed/got
    return !i.got;
  });

  const byPerson = groupByPerson(visible);
  // Every known person gets a standing card, even with zero visible items right now
  distinctPeople().forEach(p=>{
    if(!byPerson[p]) byPerson[p] = [];
  });

  const names = Object.keys(byPerson);
  if(names.length === 0){
    emptyMsg.style.display = 'block';
    return;
  }
  emptyMsg.style.display = 'none';

  names.sort((a,b)=>a.localeCompare(b)).forEach(person=>{
    const isOwnCard = identity && identity !== '__all__' && person === identity;
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
    if(list.length === 0){
      const li = document.createElement('li');
      li.className = 'item empty-item';
      li.innerHTML = `<span class="empty-item-text">No open wishes right now</span>`;
      ul.appendChild(li);
    } else {
      list.forEach(it=> ul.appendChild(buildItemLi(it, {
        ownItem: isOwnCard,
        showTick: !isOwnCard,
        confirmDelete: true
      })));
    }
    board.appendChild(card);
  });
}

function renderHistory(){
  historyBoard.innerHTML = '';
  // Never surface an owner's own items here, even after they're claimed/gotten
  const visible = items.filter(i=>i.got && !isHiddenFromMe(i) && !isOwnItem(i));

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
async function loadPeople(){
  const { data, error } = await db.from('people').select('*');
  if(!error){
    knownPeople = data || [];
  }
}

function subscribePeopleRealtime(){
  db.channel('people_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'people' }, payload=>{
      if(payload.eventType === 'INSERT'){
        knownPeople.push(payload.new);
      } else if(payload.eventType === 'UPDATE'){
        const idx = knownPeople.findIndex(p=>p.name === payload.new.name);
        if(idx !== -1) knownPeople[idx] = payload.new;
      } else if(payload.eventType === 'DELETE'){
        knownPeople = knownPeople.filter(p=>p.name !== payload.old.name);
      }
      renderAll();
      if(manageModal.style.display !== 'none'){
        renderManageList();
      }
    })
    .subscribe();
}

async function loadRestricted(){
  const { data, error } = await db.from('restricted_identities').select('person');
  if(!error){
    restrictedPeople = new Set((data||[]).map(r=>r.person));
  }
}

function subscribeRestrictedRealtime(){
  db.channel('restricted_identities_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'restricted_identities' }, payload=>{
      if(payload.eventType === 'INSERT'){
        restrictedPeople.add(payload.new.person);
      } else if(payload.eventType === 'DELETE'){
        restrictedPeople.delete(payload.old.person);
      }
      if(manageModal.style.display !== 'none'){
        renderManageList();
      }
    })
    .subscribe();
}

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
  const idsToClear = items.filter(i=>i.got && !isHiddenFromMe(i) && !isOwnItem(i)).map(i=>i.id);
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
    hidden_from: surpriseInput.checked ? (hideFromSelect.value || null) : null
  };

  registerPerson(person);
  addItem(record);

  itemInput.value = '';
  noteInput.value = '';
  priorityInput.checked = false;
  updateSurpriseDefault();
  occasionSelect.value = '';
  occasionNewInput.value = '';
  occasionNewInput.style.display = 'none';
  if(personSelect.value === '__new__'){
    personNewInput.value = '';
  }
  itemInput.focus();
});

async function init(){
  await loadPeople();
  subscribePeopleRealtime();
  await loadRestricted();
  subscribeRestrictedRealtime();
  await loadItems();
  subscribeRealtime();
}
init();
