import axios from 'axios';
import { User } from '../types';

export const employeeService = {
  async getEmployees(): Promise<User[]> {
    const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/users`);
    return response.data;
  },

  async getEmployee(id: string): Promise<User> {
    const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/users/${id}`);
    return response.data;
  },

  async createEmployee(formData: FormData): Promise<User> {
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/users`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to create employee.';
      throw new Error(errorMsg);
    }
  },

  async updateEmployee(id: string, formData: FormData): Promise<User> {
    try {
      const response = await axios.put(`${import.meta.env.VITE_API_URL}/api/users/${id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to update employee.';
      throw new Error(errorMsg);
    }
  },

  async deleteEmployee(id: string): Promise<void> {
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/users/${id}`);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to delete employee.';
      throw new Error(errorMsg);
    }
  },
};

export default employeeService;
