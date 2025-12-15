# Auto入力Pro - Backend Server

Backend API server for the Auto入力Pro Chrome Extension. Stores property data from REINS and serves it to the extension for auto-filling portal sites.

## 🏗️ Tech Stack

- **Node.js** + Express.js
- **MongoDB** (Database)
- **JWT** (Authentication)
- **Multer** (File uploads)

## 📋 Prerequisites

Before running the server, install:

1. **Node.js** (v16 or higher)
   - Download: https://nodejs.org/

2. **MongoDB** (v5 or higher)
   - Download: https://www.mongodb.com/try/download/community
   - Or use MongoDB Atlas (cloud): https://www.mongodb.com/cloud/atlas

## 🚀 Installation

### Step 1: Install Dependencies

```bash
cd autoaipro-backend
npm install
```

### Step 2: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env file with your settings
nano .env  # or use any text editor
```

**Important settings in `.env`:**
- `MONGODB_URI`: Your MongoDB connection string
- `JWT_SECRET`: Generate a random secret key (use: `openssl rand -base64 32`)
- `PORT`: Server port (default: 3000)
- `ALLOWED_ORIGINS`: Your Chrome extension ID (get from chrome://extensions)

### Step 3: Start MongoDB

**Option A: Local MongoDB**
```bash
# macOS (with Homebrew)
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Windows
net start MongoDB
```

**Option B: MongoDB Atlas (Cloud)**
1. Create free account at https://www.mongodb.com/cloud/atlas
2. Create cluster
3. Get connection string
4. Update `MONGODB_URI` in `.env`

### Step 4: Start Server

**Development mode (with auto-restart):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

You should see:
```
✅ MongoDB Connected: localhost
🚀 Auto入力Pro Backend Server
📍 Environment: development
🌐 Server running on http://localhost:3000
```

## 📡 API Endpoints

### Authentication

**Register User**
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "user123",
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Login**
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "user123",
  "password": "securepassword"
}

Response:
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "user123",
    "email": "user@example.com"
  }
}
```

**Get Current User**
```http
GET /api/auth/me
Authorization: Bearer <token>
```

### Properties

**Create Property (Upload)**
```http
POST /api/properties
Authorization: Bearer <token>
Content-Type: multipart/form-data

Fields:
- propertyData: JSON string with all property fields
- html: HTML file
- pdf: PDF file (optional)
- images: Image files (optional, max 20)
```

**Get All Properties**
```http
GET /api/properties
Authorization: Bearer <token>

Response:
{
  "success": true,
  "count": 10,
  "properties": [...]
}
```

**Get Single Property**
```http
GET /api/properties/:id
Authorization: Bearer <token>

Response:
{
  "success": true,
  "property": {
    ...propertyFields,
    "html_content": "<html>...</html>"
  }
}
```

**Update Property**
```http
PUT /api/properties/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "rent": "14.5",
  "managementFee": "1.0"
}
```

**Delete Property**
```http
DELETE /api/properties/:id
Authorization: Bearer <token>
```

### Health Check

```http
GET /api/health

Response:
{
  "status": "ok",
  "message": "Auto入力Pro Backend Server is running",
  "timestamp": "2025-12-12T10:00:00.000Z"
}
```

## 📁 Project Structure

```
autoaipro-backend/
├── config/
│   └── database.js          # MongoDB connection
├── models/
│   ├── User.js              # User model
│   └── Property.js          # Property model
├── routes/
│   ├── auth.js              # Authentication routes
│   └── properties.js        # Property CRUD routes
├── middleware/
│   └── auth.js              # JWT authentication middleware
├── storage/                 # Uploaded files (auto-created)
│   ├── html/
│   ├── images/
│   └── pdfs/
├── .env                     # Environment variables (create from .env.example)
├── .env.example             # Example environment variables
├── .gitignore
├── index.js                 # Main server file
├── package.json
└── README.md
```

## 🔐 Security Notes

1. **Change JWT Secret**: Use a strong random secret in production
2. **HTTPS**: Use HTTPS in production (not HTTP)
3. **CORS**: Configure `ALLOWED_ORIGINS` properly
4. **File Size**: Adjust `MAX_FILE_SIZE` if needed
5. **Validation**: Input validation is implemented for auth routes

## 🧪 Testing the API

Use **Postman** or **curl** to test:

```bash
# Health check
curl http://localhost:3000/api/health

# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@test.com","password":"test123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test123"}'

# Get properties (replace TOKEN with actual token from login)
curl http://localhost:3000/api/properties \
  -H "Authorization: Bearer TOKEN"
```

## 🐛 Troubleshooting

**MongoDB Connection Error**
- Ensure MongoDB is running
- Check `MONGODB_URI` in `.env`
- For Atlas, check network access and IP whitelist

**CORS Error**
- Add your Chrome extension ID to `ALLOWED_ORIGINS` in `.env`
- Find extension ID in `chrome://extensions`

**File Upload Error**
- Check storage directories exist (auto-created on start)
- Check file size limit (`MAX_FILE_SIZE` in `.env`)
- Ensure file types are allowed

**Port Already in Use**
- Change `PORT` in `.env` to different port (e.g., 3001)
- Or kill process using port 3000:
  ```bash
  # Find process
  lsof -i :3000
  # Kill it
  kill -9 <PID>
  ```

## 📦 Deployment

See deployment guide in the main documentation.

Quick options:
- **DigitalOcean App Platform** (easiest)
- **Heroku** (free tier available)
- **AWS EC2** (more control)
- **Railway** (simple deployment)

## 📝 License

MIT
