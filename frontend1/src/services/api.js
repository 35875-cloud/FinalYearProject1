import axios from 'axios';

function getBaseURL() {
  const userId = localStorage.getItem('userId');
  const nodeConfig = {
    'USR900001': 5001,
    'USR900002': 5002,
    'USR900003': 5003,
    'USR900004': 5004,
    'USR900005': 5005,
    'USR900006': 5006,
  };
  const port = nodeConfig[userId] || 5000;
  return `http://localhost:${port}/api`;
}

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const userId = localStorage.getItem('userId');
  const nodeConfig = {
    'USR900001': 5001,
    'USR900002': 5002,
    'USR900003': 5003,
    'USR900004': 5004,
    'USR900005': 5005,
    'USR900006': 5006,
  };
  const port = nodeConfig[userId] || 5000;
  config.baseURL = `http://localhost:${port}/api`;

  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
