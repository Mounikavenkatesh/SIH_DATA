import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
});

export const fetchHealth = async () => {
  const res = await api.get('/health');
  return res.data;
};

export const fetchConfig = async () => {
  const res = await api.get('/config');
  return res.data;
};

export const fetchHotspots = async (params = {}) => {
  const res = await api.get('/hotspots', { params });
  return res.data;
};

export const fetchHotspotById = async (id) => {
  const res = await api.get(`/hotspots/${id}`);
  return res.data;
};

export const fetchStatistics = async () => {
  const res = await api.get('/statistics');
  return res.data;
};

export const fetchHistory = async () => {
  const res = await api.get('/hotspots/history');
  return res.data;
};

export const analyzeHotspot = async (payload) => {
  const res = await api.post('/analyze', payload);
  return res.data;
};

export default api;
