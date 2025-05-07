// Add authentication headers to fetch requests
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// Update the category check endpoint
async function checkCategoryExists(name) {
    try {
        const response = await fetch(`/api/categories/check?name=${encodeURIComponent(name)}`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to check category');
        }
        
        const data = await response.json();
        return data.exists;
    } catch (error) {
        console.error('Error checking category:', error);
        throw error;
    }
} 