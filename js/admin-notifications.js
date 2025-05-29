class AdminNotifications {
    constructor() {
        this.ws = null;
        this.notificationCount = 0;
        this.notifications = [];
        this.maxNotifications = 50;
        this.init();
    }

    init() {
        // Get admin token from localStorage
        const token = localStorage.getItem('adminToken');
        if (!token) {
            console.error('No admin token found');
            return;
        }

        // Initialize WebSocket connection
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}?token=${token}`;
        
        this.ws = new WebSocket(wsUrl);
        this.setupWebSocketHandlers();
        this.setupUIHandlers();
    }

    setupWebSocketHandlers() {
        this.ws.onopen = () => {
            console.log('Connected to notification server');
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'notification') {
                    this.handleNewNotification(data.data);
                }
            } catch (error) {
                console.error('Error handling notification:', error);
            }
        };

        this.ws.onclose = () => {
            console.log('Disconnected from notification server');
            // Attempt to reconnect after 5 seconds
            setTimeout(() => this.init(), 5000);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    setupUIHandlers() {
        // Update notification badge
        this.updateNotificationBadge();

        // Setup notification panel handlers
        const notificationPanel = document.getElementById('notification-panel');
        const notificationBell = document.getElementById('notification-bell');
        const closeNotificationPanel = document.getElementById('close-notification-panel');

        if (notificationBell) {
            notificationBell.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleNotificationPanel();
            });
        }

        if (closeNotificationPanel) {
            closeNotificationPanel.addEventListener('click', () => {
                this.closeNotificationPanel();
            });
        }

        // Close panel on outside click
        document.addEventListener('mousedown', (e) => {
            if (notificationPanel && notificationPanel.classList.contains('open') && 
                !notificationPanel.contains(e.target) && e.target.id !== 'notification-bell') {
                this.closeNotificationPanel();
            }
        });

        // Close panel on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && notificationPanel && notificationPanel.classList.contains('open')) {
                this.closeNotificationPanel();
            }
        });
    }

    handleNewNotification(notification) {
        // Add notification to the list
        this.notifications.unshift(notification);
        
        // Keep only the latest maxNotifications
        if (this.notifications.length > this.maxNotifications) {
            this.notifications = this.notifications.slice(0, this.maxNotifications);
        }

        // Increment notification count
        this.notificationCount++;
        
        // Update UI
        this.updateNotificationBadge();
        this.updateNotificationList();
        
        // Show toast notification
        this.showToast(notification);

        // Play notification sound
        this.playNotificationSound();
    }

    updateNotificationBadge() {
        const badge = document.querySelector('.notification-badge');
        if (badge) {
            badge.textContent = this.notificationCount;
            badge.style.display = this.notificationCount > 0 ? 'block' : 'none';
        }
    }

    updateNotificationList() {
        const notificationList = document.getElementById('notification-list');
        if (!notificationList) return;

        notificationList.innerHTML = this.notifications.map(notification => `
            <div class="notification-item ${notification.read ? 'read' : ''}" data-id="${notification.id}">
                <span class="notification-icon">
                    <i class="fas ${this.getNotificationIcon(notification.type)}"></i>
                </span>
                <div class="notification-content">
                    <div class="notification-title">${notification.title}</div>
                    <div class="notification-desc small">${notification.message}</div>
                    <div class="notification-time">${this.formatTime(notification.timestamp)}</div>
                </div>
            </div>
        `).join('');

        // Add click handlers to notification items
        notificationList.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', () => this.handleNotificationClick(item));
        });
    }

    getNotificationIcon(type) {
        const icons = {
            'order': 'fa-shopping-cart text-primary',
            'stock': 'fa-box-open text-warning',
            'system': 'fa-bell text-danger',
            'message': 'fa-envelope text-success'
        };
        return icons[type] || 'fa-bell text-primary';
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        // Less than a minute
        if (diff < 60000) {
            return 'Just now';
        }
        // Less than an hour
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes} min ago`;
        }
        // Less than a day
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours} hours ago`;
        }
        // Less than a week
        if (diff < 604800000) {
            const days = Math.floor(diff / 86400000);
            return `${days} days ago`;
        }
        // Otherwise return the date
        return date.toLocaleDateString();
    }

    handleNotificationClick(item) {
        const notificationId = item.dataset.id;
        const notification = this.notifications.find(n => n.id === notificationId);
        
        if (notification && !notification.read) {
            notification.read = true;
            this.notificationCount = Math.max(0, this.notificationCount - 1);
            this.updateNotificationBadge();
            item.classList.add('read');
        }

        // Handle notification action based on type
        if (notification.type === 'order') {
            // Navigate to order details
            window.location.href = `#orders-section`;
            this.closeNotificationPanel();
        }
    }

    toggleNotificationPanel() {
        const panel = document.getElementById('notification-panel');
        if (panel) {
            panel.classList.toggle('open');
        }
    }

    closeNotificationPanel() {
        const panel = document.getElementById('notification-panel');
        if (panel) {
            panel.classList.remove('open');
        }
    }

    showToast(notification) {
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas ${this.getNotificationIcon(notification.type)}"></i>
                <div class="toast-message">
                    <div class="toast-title">${notification.title}</div>
                    <div class="toast-desc">${notification.message}</div>
                </div>
            </div>
        `;

        document.body.appendChild(toast);
        
        // Show toast
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        // Remove toast after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 5000);
    }

    playNotificationSound() {
        // Create and play notification sound
        const audio = new Audio('/sounds/notification.mp3');
        audio.play().catch(error => {
            console.log('Error playing notification sound:', error);
        });
    }
}

// Initialize notifications when document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.adminNotifications = new AdminNotifications();
}); 