const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const api = {
  // Get repair orders with filters
  async getRepairOrders(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_URL}/ros?${queryString}`);
    const data = await response.json();
    return data.items || [];
  },
  
  // Get job categories
  async getJobCategories(status = 'FOLLOW_UP_BOARD') {
    const response = await fetch(`${API_URL}/ros?view=categories&status=${status}`);
    const data = await response.json();
    return data.categories || [];
  },
  
  // Save contact interaction
  async saveContact(roId, contactData) {
    const response = await fetch(`${API_URL}/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ro_id: roId,
        contact_data: contactData
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save contact');
    }
    
    return await response.json();
  },
  
  // Get users from Tekmetric
  async getUsers() {
    const response = await fetch(`${API_URL}/users`);
    const data = await response.json();
    return data.users || [];
  },
  
  // Get analytics
  async getAnalytics(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_URL}/analytics?${queryString}`);
    const data = await response.json();
    return data.analytics || null;
  }
};

export default api;
