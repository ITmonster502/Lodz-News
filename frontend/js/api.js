const API_URL = window.location.protocol === 'file:'
  ? 'http://localhost:5000/api'
  : `${window.location.origin}/api`;

async function fetchAPI(endpoint, method = 'GET', body = null, token = null) {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const config = {
    method,
    headers,
  };
  if (body) {
    config.body = JSON.stringify(body);
  }
  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);
    
    // Check if response is JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      console.error('API Error: Expected JSON but got', contentType);
      return null;
    }

    const data = await response.json();
    if (!response.ok) {
      alert('Błąd API: ' + (data.message || 'Nieznany błąd'));
      throw new Error(data.message || 'Something went wrong');
    }
    return data;
  } catch (error) {
    console.error('API Error:', error.message);
    if (error.message.includes('Failed to fetch')) {
      alert('Błąd: Serwer nie odpowiada. Upewnij się, że npm start działa.');
    }
    return null;
  }
}

// Articles
const getArticles = (query = '') => fetchAPI(`/articles${query}`);
const getTrendingArticles = () => fetchAPI('/articles/trending');
const getArticle = (id) => fetchAPI(`/articles/${id}`);
const createArticle = (data, token) => fetchAPI('/articles', 'POST', data, token);
const updateArticle = (id, data, token) => fetchAPI(`/articles/${id}`, 'PUT', data, token);
const deleteArticle = (id, token) => fetchAPI(`/articles/${id}`, 'DELETE', null, token);

// Categories
const getCategories = () => fetchAPI('/categories');
const createCategory = (data, token) => fetchAPI('/categories', 'POST', data, token);

// Comments
const getComments = (articleId) => fetchAPI(`/comments/${articleId}`);
const getAllComments = (token) => fetchAPI('/comments', 'GET', null, token);
const postComment = (data, token) => fetchAPI('/comments', 'POST', data, token);
const moderateComment = (id, status, token) => fetchAPI(`/comments/${id}/moderate`, 'PUT', { status }, token);

// Users
const registerUser = (data) => fetchAPI('/users/register', 'POST', data);
const loginUser = (data) => fetchAPI('/users/login', 'POST', data);
const getProfile = (token) => fetchAPI('/users/profile', 'GET', null, token);
