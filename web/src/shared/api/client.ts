import axios from "axios";
import { getAccessTokenValue } from "./token";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

api.interceptors.request.use(async (config) => {
  const token = await getAccessTokenValue();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});
