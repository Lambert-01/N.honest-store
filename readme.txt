# N.Honest Supermarket Website

## Overview

The N.Honest Supermarket Website is a comprehensive platform designed to manage and display products, categories, orders, customers, and other essential aspects of a supermarket. It includes an admin panel for managing products, categories, and other settings.

## Features

- **Admin Panel:**
  - Add, edit, and delete products.
  - Manage product categories.
  - View and manage orders.
  - Manage customer information.
  - Generate reports on sales and inventory.
  - Configure store settings and user profiles.

- **User Interface:**
  - Responsive design for various devices.
  - Dynamic product listings with images and descriptions.
  - Cart and checkout functionality (not implemented yet).

- **Backend:**
  - RESTful API for product, category, order, and customer management.
  - Authentication and authorization for secure access to the admin panel.
  - Image uploading and management.

## Technologies Used

- **Frontend:**
  - HTML5
  - CSS3
  - Bootstrap 5
  - Font Awesome
  - Chart.js
  - SweetAlert2
  - Browser Image Compression

- **Backend:**
  - Node.js
  - Express.js
  - MongoDB
  - JWT for Authentication

## Project Structure
N.Honest/
├── css/
│ ├── admin-style.css
│ ├── login.css
│ └── style.css
├── images/
│ ├── f.logo.png
│ └── ...
├── js/
│ ├── admin.js
│ ├── login.js
│ └── script.js
├── uploads/
│ ├── categories/
│ └── products/
├── server/
│ ├── app.js
│ ├── db.js
│ ├── models/
│ │ ├── Categories.js
│ │ ├── Orders.js
│ │ ├── Payment.js
│ │ ├── Product.js
│ │ └── User.js
│ ├── routes/
│ │ ├── api.js
│ │ ├── auth.js
│ │ ├── categories.js
│ │ ├── orders.js
│ │ ├── payment.js
│ │ └── products.js
│ └── mtnMomo.js
├── .env
├── .gitignore
├── index.html
├── admin.html
├── login.html
├── signup.html
├── package.json
└── README.md


## Setup Instructions

### Prerequisites

- Node.js and npm installed on your machine.
- MongoDB installed locally or use a cloud service like MongoDB Atlas.

### Installation

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/your-username/n-honest-supermarket.git 
   cd n-honest-supermarket