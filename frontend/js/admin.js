document.addEventListener('DOMContentLoaded', async () => {
  const user = getUser();
  if (!user || (user.role !== 'admin' && user.role !== 'editor')) {
    window.location.href = 'index.html';
    return;
  }
  loadAdminDashboard();
  loadAdminCategories();
  setupArticleForm();
  setupCategoryForm();
});

let currentArticlesPage = 1;
const ARTICLES_LIMIT = 15;

async function loadAdminArticles(page = 1) {
  currentArticlesPage = page;
  const articles = await getArticles(`?status=all&limit=${ARTICLES_LIMIT}&page=${page}`);
  const list = document.getElementById('admin-articles-list');
  const pagination = document.getElementById('articles-pagination');
  if (list) {
    if (!articles) {
      list.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Błąd ładowania artykułów.</td></tr>';
      if (pagination) pagination.innerHTML = '';
      return;
    }
    
    // For now, our getArticles might not support limit/page in backend perfectly, 
    // but let's assume it returns the list. 
    // If you want true pagination, we'd need to update articleController.js.
    // For this simple task, let's just render what we get.

    list.innerHTML = articles.length > 0 ? articles.map(art => `
      <tr>
        <td>${art.title}</td>
        <td>${art.category ? art.category.name : 'Brak'}</td>
        <td><span class="status-badge status-${art.status}">${art.status}</span></td>
        <td class="admin-actions">
          <button class="btn-sm btn-edit" onclick="editArticle('${art._id}')">Edytuj</button>
          <button class="btn-sm btn-delete" onclick="handleDeleteArticle('${art._id}')">Usuń</button>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="4" style="text-align:center;">Brak artykułów.</td></tr>';

    if (pagination) {
      const hasPrev = page > 1;
      const hasNext = articles.length === ARTICLES_LIMIT;
      pagination.innerHTML = `
        <button class="btn-sm" style="background: var(--bg-soft); color: var(--text);" ${hasPrev ? '' : 'disabled'} onclick="loadAdminArticles(${page - 1})">← Starsze</button>
        <div style="font-weight: 700; color: var(--text-muted);">Strona ${page}</div>
        <button class="btn-sm" style="background: var(--bg-soft); color: var(--text);" ${hasNext ? '' : 'disabled'} onclick="loadAdminArticles(${page + 1})">Nowsze →</button>
      `;
    }
  }
}

async function loadAdminCategories() {
  const categories = await getCategories();
  const select = document.getElementById('art-category');
  if (select && categories) {
    select.innerHTML = categories.map(cat => `<option value="${cat._id}">${cat.name}</option>`).join('');
  }
}

function openArticleModal() {
  document.getElementById('article-modal').style.display = 'block';
  document.getElementById('modal-title').textContent = 'Dodaj Artykuł';
  document.getElementById('article-form').reset();
  document.getElementById('article-id').value = '';
}

function closeArticleModal() {
  document.getElementById('article-modal').style.display = 'none';
}

function openCategoryModal() {
  document.getElementById('category-modal').style.display = 'block';
  document.getElementById('category-form').reset();
}

function closeCategoryModal() {
  document.getElementById('category-modal').style.display = 'none';
}

async function editArticle(id) {
  const article = await getArticle(id);
  if (article) {
    document.getElementById('article-modal').style.display = 'block';
    document.getElementById('modal-title').textContent = 'Edytuj Artykuł';
    document.getElementById('article-id').value = article._id;
    document.getElementById('art-title').value = article.title;
    document.getElementById('art-category').value = article.category._id;
    document.getElementById('art-content').value = article.content;
    document.getElementById('art-image').value = article.featured_image || '';
    document.getElementById('art-status').value = article.status;
    
    // Set date in datetime-local format
    if (article.published_date) {
      const date = new Date(article.published_date);
      date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
      document.getElementById('art-date').value = date.toISOString().slice(0, 16);
    }
  }
}

function setupArticleForm() {
  const form = document.getElementById('article-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = getUser();
      const articleId = document.getElementById('article-id').value;
      const data = {
        title: document.getElementById('art-title').value,
        category: document.getElementById('art-category').value,
        content: document.getElementById('art-content').value,
        featured_image: document.getElementById('art-image').value,
        status: document.getElementById('art-status').value,
        published_date: document.getElementById('art-date').value || new Date()
      };

      let result;
      if (articleId) {
        result = await updateArticle(articleId, data, user.token);
      } else {
        result = await createArticle(data, user.token);
      }

      if (result) {
        closeArticleModal();
        loadAdminArticles();
      } else {
        alert('Ошибка при сохранении статьи. Проверьте подключение к серверу.');
      }
    });
  }
}

async function handleDeleteArticle(id) {
  if (confirm('Czy na pewno chcesz usunąć ten artykuł?')) {
    const user = getUser();
    const res = await deleteArticle(id, user.token);
    if (res) {
      loadAdminArticles(currentArticlesPage);
    }
  }
}

async function triggerAutoImport(btnEl, limitPerFeed = 10) {
  const user = getUser();
  const btn = btnEl || null;
  const originalText = btn ? btn.textContent : '';
  const last24h = !!document.getElementById('autoimport-last24h')?.checked;
  const hours = last24h ? 24 : 0;
  
  if (btn) {
    btn.textContent = '🔄 Importowanie...';
    btn.disabled = true;
  }

  try {
    const response = await fetch(`${API_URL}/auto-import/trigger?limit=${encodeURIComponent(limitPerFeed)}&hours=${encodeURIComponent(hours)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user.token}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    if (response.ok) {
      const details = Array.isArray(data.feeds)
        ? '\n\n' + data.feeds.map(f => `${f.url} — +${f.imported || 0}, dup:${f.skipped || 0}, old:${f.skippedOld || 0}${f.error ? `, err:${f.error}` : ''}`).join('\n')
        : '';
      alert((data.message || 'Auto-Import done.') + details);
      loadAdminArticles();
    } else {
      alert('Błąd auto-importu: ' + data.message);
    }
  } catch (err) {
    alert('Błąd połączenia с сервером. Убедитесь, что сервер запущен.');
  } finally {
    if (btn) {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }
}

async function uploadImage(input) {
  const file = input.files[0];
  if (!file) return;

  const user = getUser();
  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user.token}`
      },
      body: formData
    });
    const data = await response.json();
    if (response.ok) {
      document.getElementById('art-image').value = data.image;
      alert('Obrazek wgrany pomyślnie!');
    } else {
      alert('Błąd wgrywania: ' + data.message);
    }
  } catch (err) {
    alert('Błąd połączenia при загрузке картинки.');
  }
}

function showSection(section, el) {
  const sections = [
    'dashboard-section',
    'articles-section',
    'categories-section',
    'users-section',
    'comments-section'
  ];
  sections.forEach((id) => {
    const node = document.getElementById(id);
    if (node) node.style.display = 'none';
  });

  const target = document.getElementById(section + '-section');
  if (target) target.style.display = 'block';

  document.querySelectorAll('.admin-sidebar li').forEach((li) => li.classList.remove('active'));
  if (el) el.classList.add('active');

  if (section === 'articles') loadAdminArticles(1);
  if (section === 'categories') loadAdminCategoriesList();
  if (section === 'users') loadAdminUsersList();
  if (section === 'comments') loadAdminCommentsList();
  if (section === 'dashboard') loadAdminDashboard();
}

async function loadAdminDashboard() {
  const user = getUser();
  const stats = await fetchAPI('/articles/stats?status=all', 'GET', null, user.token);
  const users = await fetchAPI('/users', 'GET', null, user.token);
  const container = document.getElementById('dashboard-section');
  
  if (!container || !stats) return;

  const topArticle = stats.topArticle;

  container.innerHTML = `
    <div class="admin-header">
      <h2>Panel Kontrolny</h2>
    </div>
    
    <div class="analytics-grid">
      <div class="stat-card">
        <h3>Łącznie Artykułów</h3>
        <p>${stats.totalArticles}</p>
      </div>
      <div class="stat-card">
        <h3>Łącznie Wyświetleń</h3>
        <p>${stats.totalViews}</p>
      </div>
      <div class="stat-card">
        <h3>Użytkownicy</h3>
        <p>${users ? users.length : '-'}</p>
      </div>
    </div>

    <div class="admin-header" style="margin-top: 40px;">
      <h3>Самая популярная новость</h3>
    </div>
    ${topArticle ? `
      <div class="card" style="display: flex; gap: 20px; padding: 20px; align-items: center; border: 1px solid var(--border); border-radius: var(--radius);">
        <div class="media ${topArticle.featured_image ? '' : 'is-fallback'}" data-kind="${topArticle.category?.name || ''}" style="width: 150px; height: 100px; border-radius: 5px;">
          ${topArticle.featured_image ? `<img src="${topArticle.featured_image}" alt="${topArticle.title}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('is-fallback'); this.style.display='none';" style="width:100%; height:100%; object-fit:cover; border-radius:5px; display:block;">` : ''}
          <div class="img-fallback"><div class="img-fallback-label">${topArticle.category?.name || 'Łódź News'}</div></div>
        </div>
        <div>
          <h4 style="font-family: var(--font-serif); font-size: 1.2rem;">${topArticle.title}</h4>
          <p style="color: var(--primary); font-weight: 700; margin-top: 5px;">${topArticle.views || 0} просмотров</p>
          <a href="article.html?id=${topArticle._id}" class="btn-sm" style="margin-top:10px; display:inline-block; text-decoration:none;">Просмотреть</a>
        </div>
      </div>
    ` : '<p>Brak данных.</p>'}
  `;
}

async function cleanupBrokenArticles(btnEl) {
  if (!confirm('Вы уверены, что хотите удалить все новости с ошибками кодировки (содержащие символы �)?')) return;

  const user = getUser();
  const btn = btnEl || null;
  const originalText = btn ? btn.textContent : '';
  if (btn) {
    btn.textContent = '⏳ Очистка...';
    btn.disabled = true;
  }

  try {
    const response = await fetch(`${API_URL}/articles/cleanup-broken`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${user.token}`
      }
    });
    const data = await response.json();
    if (response.ok) {
      alert(`Успешно удалено ${data.count} поврежденных новостей.`);
      loadAdminArticles();
    } else {
      alert('Ошибка при очистке: ' + (data.message || 'Unknown error'));
    }
  } catch (err) {
    alert('Ошибка соединения с сервером.');
  } finally {
    if (btn) {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }
}

async function loadAdminUsersList() {
  const user = getUser();
  const users = await fetchAPI('/users', 'GET', null, user.token);
  const container = document.getElementById('users-section');
  if (!container) return;

  if (!users) {
    container.innerHTML = '<h2>Użytkownicy</h2><p>Błąd ładowния пользователей.</p>';
    return;
  }

  container.innerHTML = `
    <div class="admin-header">
      <h2>Użytkownicy</h2>
    </div>
    <table class="admin-table">
      <thead>
        <tr>
          <th>Nazwa użytkownika</th>
          <th>Email</th>
          <th>Rola</th>
          <th>Akcje</th>
        </tr>
      </thead>
      <tbody>
        ${users.map(u => `
          <tr>
            <td>${u.username}</td>
            <td>${u.email}</td>
            <td>
              <select onchange="handleUpdateUserRole('${u._id}', this.value)" ${u.role === 'admin' && u.username === user.username ? 'disabled' : ''}>
                <option value="reader" ${u.role === 'reader' ? 'selected' : ''}>Reader</option>
                <option value="editor" ${u.role === 'editor' ? 'selected' : ''}>Editor</option>
                <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
              </select>
            </td>
            <td>
              <button class="btn-sm btn-delete" onclick="handleDeleteUser('${u._id}')" ${u.role === 'admin' ? 'disabled' : ''}>Usuń</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function handleUpdateUserRole(userId, newRole) {
  const user = getUser();
  const res = await fetchAPI(`/users/${userId}/role`, 'PUT', { role: newRole }, user.token);
  if (res) {
    alert('Rola użytkownika została zaktualizowana!');
    loadAdminUsersList();
  }
}

async function handleDeleteUser(userId) {
  if (confirm('Czy na pewno chcesz usunąć tego użytkownika?')) {
    const user = getUser();
    const res = await fetchAPI(`/users/${userId}`, 'DELETE', null, user.token);
    if (res) {
      loadAdminUsersList();
    }
  }
}

async function loadAdminCommentsList() {
  const user = getUser();
  const comments = await getAllComments(user.token);
  const container = document.getElementById('comments-section');
  if (!container) return;

  if (!comments) {
    container.innerHTML = '<h2>Komentarze</h2><p>Błąd ładowania komentarzy.</p>';
    return;
  }

  container.innerHTML = `
    <div class="admin-header">
      <h2>Komentarze</h2>
    </div>
    <table class="admin-table">
      <thead>
        <tr>
          <th>Użytkownik</th>
          <th>Artykuł</th>
          <th>Treść</th>
          <th>Status</th>
          <th>Akcje</th>
        </tr>
      </thead>
      <tbody>
        ${comments.length > 0 ? comments.map(c => `
          <tr>
            <td>${c.user ? c.user.username : 'Gość'}</td>
            <td>${c.article ? c.article.title : 'Brak'}</td>
            <td>${c.content}</td>
            <td><span class="status-badge status-${c.status}">${c.status}</span></td>
            <td class="admin-actions">
              ${c.status !== 'approved' ? `<button class="btn-sm" style="background: #27ae60; color: white;" onclick="handleModerateComment('${c._id}', 'approved')">Zatwierdź</button>` : ''}
              ${c.status !== 'rejected' ? `<button class="btn-sm" style="background: #e67e22; color: white;" onclick="handleModerateComment('${c._id}', 'rejected')">Odrzuć</button>` : ''}
            </td>
          </tr>
        `).join('') : '<tr><td colspan="5" style="text-align:center;">Brak komentarzy.</td></tr>'}
      </tbody>
    </table>
  `;
}

async function handleModerateComment(id, status) {
  const user = getUser();
  const res = await moderateComment(id, status, user.token);
  if (res) loadAdminCommentsList();
}

async function loadAdminCategoriesList() {
  const categories = await getCategories();
  const container = document.getElementById('categories-section');
  if (!container) return;
  
  container.innerHTML = `
    <div class="admin-header">
      <h2>Kategorie</h2>
      <button class="btn-primary" onclick="openCategoryModal()">+ Nowa Kategoria</button>
    </div>
    <table class="admin-table">
      <thead><tr><th>Nazwa</th><th>Slug</th><th>Akcje</th></tr></thead>
      <tbody>
        ${categories ? categories.map(c => `
          <tr>
            <td>${c.name}</td>
            <td>${c.slug}</td>
            <td><button class="btn-sm btn-delete" onclick="handleDeleteCategory('${c._id}')">Usuń</button></td>
          </tr>
        `).join('') : '<tr><td colspan="3" style="text-align:center;">Błąd ładowania kategorii.</td></tr>'}
      </tbody>
    </table>
  `;
}

function setupCategoryForm() {
  const form = document.getElementById('category-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('cat-name').value;
      if (name) {
        const user = getUser();
        const res = await createCategory({ name }, user.token);
        if (res) {
          alert('Kategoria została добавлена!');
          closeCategoryModal();
          loadAdminCategoriesList();
          loadAdminCategories(); // Update selects
        }
      }
    });
  }
}

async function handleDeleteCategory(id) {
  if (confirm('Czy na pewno chcesz usunąć tę kategorię?')) {
    const user = getUser();
    const res = await fetchAPI(`/categories/${id}`, 'DELETE', null, user.token);
    if (res) {
      loadAdminCategoriesList();
      loadAdminCategories();
    }
  }
}
