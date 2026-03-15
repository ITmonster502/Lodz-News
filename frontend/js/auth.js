const STORAGE_KEY = 'lodz_news_user';

function setUser(user) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

function getUser() {
  const user = localStorage.getItem(STORAGE_KEY);
  return user ? JSON.parse(user) : null;
}

function logout() {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

async function login(email, password) {
  const data = await loginUser({ email, password });
  if (data) {
    setUser(data);
    return true;
  }
  return false;
}

async function register(username, email, password) {
  const data = await registerUser({ username, email, password });
  if (data) {
    setUser(data);
    return true;
  }
  return false;
}

function updateAuthUI() {
  const user = getUser();
  const authLinks = document.getElementById('auth-links');
  const lang = localStorage.getItem('lang') || 'pl';
  
  // Simple translation helper for auth
  const t = {
    pl: { login: "Zaloguj", logout: "Wyloguj", admin: "PANEL ADM" },
    en: { login: "Login", logout: "Logout", admin: "ADMIN PANEL" },
    ru: { login: "Войти", logout: "Выйти", admin: "АДМИН ПАНЕЛЬ" }
  }[lang];

  if (authLinks) {
    if (user) {
      authLinks.innerHTML = `
        <span style="margin-right:15px; font-weight:bold;">${user.username}</span>
        ${user.role === 'admin' || user.role === 'editor' ? `<a href="admin.html" class="btn-primary" style="margin-right:15px; padding: 5px 15px; font-size: 0.8rem;">${t.admin}</a>` : ''}
        <a href="#" onclick="logout()" style="color: var(--primary);">${t.logout}</a>
      `;
    } else {
      authLinks.innerHTML = `<a href="login.html" class="btn-primary" style="padding: 5px 15px; font-size: 0.8rem;">${t.login}</a>`;
    }
  }
}
