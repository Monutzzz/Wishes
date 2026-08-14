const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let items = [];
const board = document.getElementById('board');
const emptyMsg = document.getElementById('emptyMsg');
const syncStatus = document.getElementById('syncStatus');
const addForm = document.getElementById('addForm');
const personInput = document.getElementById('personInput');
const itemInput = document.getElementById('itemInput');

function checkIconSVG(){
  return '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
}

function escapeHtml(s){
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
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

function render(){
  board.innerHTML = '';

  if(items.length === 0){
    emptyMsg.style.display = 'block';
    return;
  }
  emptyMsg.style.display = 'none';

  const byPerson = {};
  items.forEach(it=>{
    if(!byPerson[it.person]) byPerson[it.person] = [];
    byPerson[it.person].push(it);
  });

  Object.keys(byPerson).sort((a,b)=>a.localeCompare(b)).forEach(person=>{
    const list = byPerson[person].sort((a,b)=>{
      if(a.got !== b.got) return a.got ? 1 : -1;
      return new Date(a.created_at) - new Date(b.created_at);
    });

    const gotCount = list.filter(i=>i.got).length;
    const card = document.createElement('div');
    card.className = 'person-card';
    card.innerHTML = `
      <div class="person-head">
        <span>${escapeHtml(person)}</span>
        <span class="count">${gotCount}/${list.length}</span>
      </div>
      <ul class="items"></ul>
    `;

    const ul = card.querySelector('ul.items');
    list.forEach(it=>{
      const li = document.createElement('li');
      li.className = 'item' + (it.got ? ' got' : '');
      li.innerHTML = `
        <button class="tick" aria-label="Mark as got">${checkIconSVG()}</button>
        <span class="label"></span>
        <button class="del" aria-label="Remove">&times;</button>
      `;
      li.querySelector('.label').textContent = it.item;
      li.querySelector('.tick').addEventListener('click', ()=>toggleGot(it.id, it.got));
      li.querySelector('.del').addEventListener('click', ()=>deleteItem(it.id));
      ul.appendChild(li);
    });

    board.appendChild(card);
  });
}

async function loadItems(){
  const { data, error } = await db.from('wishlist_items').select('*').order('created_at', { ascending: true });
  if(error){
    setSyncStatus('error');
    return;
  }
  items = data || [];
  setSyncStatus('live');
  render();
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
      render();
    })
    .subscribe(status=>{
      if(status === 'SUBSCRIBED') setSyncStatus('live');
      else if(status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setSyncStatus('error');
    });
}

async function addItem(person, item){
  const { error } = await db.from('wishlist_items').insert([{ person, item, got: false }]);
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

addForm.addEventListener('submit', function(e){
  e.preventDefault();
  const person = personInput.value.trim();
  const item = itemInput.value.trim();
  if(!person || !item) return;
  addItem(person, item);
  itemInput.value = '';
  itemInput.focus();
});

loadItems();
subscribeRealtime();
