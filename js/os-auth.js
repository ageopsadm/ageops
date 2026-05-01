/* ============================================================
   AGE OPS — OS-AUTH.JS  (Authentication + User Management)
   ============================================================ */

const AUTH_KEY = 'ageops_session';

/* Built-in users — stored locally for demo, with API sync */
const BUILTIN_USERS = [
  { username:'gustavowng',   password:'15Darth@123', name:'GUSTAVO',      role:'admin',    avatar:'GUS', color:'#ff1a1a' },
  { username:'vraulin',      password:'12345678',    name:'VRAULIN',      role:'admin',    avatar:'VRA', color:'#00aaff' },
  { username:'pedrobarreto', password:'12345678',    name:'PEDRO BARRETO',role:'equipe',   avatar:'PED', color:'#cc44ff' },
  { username:'paulin',       password:'paulin123',   name:'PAULIN',       role:'operador', avatar:'PAU', color:'#00ccff' },
  { username:'vic',          password:'vic123',      name:'VIC',          role:'equipe',   avatar:'VIC', color:'#aa44ff' },
  { username:'amarante',     password:'amarante123', name:'AMARANTE',     role:'equipe',   avatar:'AMA', color:'#ffcc00' },
  { username:'ken',          password:'ken123',      name:'KEN',          role:'operador', avatar:'KEN', color:'#ff6600' }
];

let currentUser = null;

/* ---- SESSION ---- */
function loadSession() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) {
      currentUser = JSON.parse(raw);
      return true;
    }
  } catch(e) {}
  return false;
}

function saveSession(user) {
  currentUser = user;
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

function clearSession() {
  currentUser = null;
  localStorage.removeItem(AUTH_KEY);
}

/* ---- LOGIN ---- */
async function doLogin() {
  const uInput = document.getElementById('loginUser').value.trim().toLowerCase();
  const pInput = document.getElementById('loginPass').value;
  const errEl  = document.getElementById('loginError');
  const btn    = document.getElementById('loginBtn');

  if (!uInput || !pInput) {
    errEl.textContent = '[ PREENCHA USUÁRIO E SENHA ]';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ACESSANDO...';
  errEl.textContent = '';

  // First try API
  let user = null;
  try {
    const res = await fetch(`tables/age_users?search=${encodeURIComponent(uInput)}&limit=20`);
    if (res.ok) {
      const data = await res.json();
      const found = (data.data || []).find(u =>
        u.username && u.username.toLowerCase() === uInput && u.password === pInput
      );
      if (found) {
        user = {
          id: found.id,
          username: found.username,
          name: found.display_name || found.username.toUpperCase(),
          role: found.role || 'equipe',
          avatar: found.avatar_initials || found.username.slice(0,3).toUpperCase(),
          color: found.color || '#00aaff',
          fromApi: true
        };
      }
    }
  } catch(e) { /* fallback to builtin */ }

  // Fallback: builtin users
  if (!user) {
    const found = BUILTIN_USERS.find(u => u.username === uInput && u.password === pInput);
    if (found) {
      user = { ...found, fromApi: false };
    }
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> ACESSAR SISTEMA';

  if (user) {
    saveSession(user);
    bootOS();
  } else {
    errEl.textContent = '[ USUÁRIO OU SENHA INVÁLIDOS ]';
    document.getElementById('loginPass').value = '';
    const box = document.querySelector('.login-box');
    box.style.animation = 'shake .4s ease';
    setTimeout(() => box.style.animation = '', 400);
  }
}

/* ---- LOGOUT ---- */
function doLogout() {
  clearSession();
  location.reload();
}

/* ---- BOOT OS ---- */
function bootOS() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('osMain').style.display = 'flex';

  // Populate user info in sidebar
  const u = currentUser;
  document.getElementById('sidebarAvatar').textContent = u.avatar;
  document.getElementById('sidebarAvatar').style.background = u.color + '22';
  document.getElementById('sidebarAvatar').style.color = u.color;
  document.getElementById('sidebarAvatar').style.borderColor = u.color + '66';
  document.getElementById('sidebarUserName').textContent = u.name;
  document.getElementById('sidebarUserRole').textContent = u.role.toUpperCase();

  document.getElementById('topbarAvatar').textContent = u.avatar;
  document.getElementById('topbarAvatar').style.background = u.color + '22';
  document.getElementById('topbarAvatar').style.color = u.color;
  document.getElementById('topbarAvatar').style.borderColor = u.color + '66';

  // Show admin section if needed
  if (u.role === 'admin') {
    document.getElementById('adminSection').style.display = '';
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'flex');
  }

  // Launch app
  if (typeof initApp === 'function') initApp();
}

/* ---- INIT ---- */
document.addEventListener('DOMContentLoaded', () => {
  // Check existing session
  if (loadSession()) {
    bootOS();
  }
});

/* ---- CSS SHAKE ANIMATION (inject) ---- */
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%,100%{transform:translateX(0)}
    20%{transform:translateX(-10px)}
    40%{transform:translateX(10px)}
    60%{transform:translateX(-8px)}
    80%{transform:translateX(8px)}
  }
`;
document.head.appendChild(shakeStyle);
