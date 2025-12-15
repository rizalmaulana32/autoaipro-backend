# Deployment Guide - Production

This guide covers deploying the Auto入力Pro backend to a production server.

---

## 🎯 Deployment Options

### Option 1: DigitalOcean Droplet (Recommended)
- **Cost**: $6-12/month
- **Difficulty**: Medium
- **Control**: Full control
- **Best for**: Production use

### Option 2: Heroku
- **Cost**: Free tier available (~$7/month for production)
- **Difficulty**: Easy
- **Control**: Limited
- **Best for**: Testing, small scale

### Option 3: AWS EC2
- **Cost**: $5-20/month
- **Difficulty**: Hard
- **Control**: Full control
- **Best for**: Enterprise

### Option 4: Railway
- **Cost**: Free trial, $5+/month
- **Difficulty**: Very Easy
- **Control**: Medium
- **Best for**: Quick deployment

---

## 🚀 Option 1: DigitalOcean Droplet

### Step 1: Create Droplet

1. Sign up at https://www.digitalocean.com
2. Create Droplet:
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: Basic ($6/month - 1GB RAM)
   - **Datacenter**: Choose closest to Japan
   - **Authentication**: SSH key (recommended) or password
   - **Hostname**: autoaipro-backend

3. Note the IP address (e.g., `123.45.67.89`)

### Step 2: Initial Server Setup

```bash
# SSH into server
ssh root@123.45.67.89

# Update system
apt update && apt upgrade -y

# Create non-root user
adduser autoaipro
usermod -aG sudo autoaipro

# Switch to new user
su - autoaipro
```

### Step 3: Install Node.js

```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x
```

### Step 4: Install MongoDB

```bash
# Import MongoDB GPG key
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install MongoDB
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify
sudo systemctl status mongod
```

### Step 5: Install Nginx (Reverse Proxy)

```bash
# Install Nginx
sudo apt install -y nginx

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Step 6: Setup Domain (Optional but Recommended)

If you have a domain (e.g., `api.yourdomain.com`):

1. Add A record in your DNS provider:
   ```
   Type: A
   Name: api
   Value: 123.45.67.89
   TTL: 3600
   ```

2. Wait for DNS propagation (5-30 minutes)

3. Test:
   ```bash
   ping api.yourdomain.com
   # Should resolve to your server IP
   ```

### Step 7: Deploy Application

```bash
# Create app directory
cd /home/autoaipro
mkdir autoaipro-backend
cd autoaipro-backend

# Clone or copy your backend files
# Option A: Using git
git clone https://github.com/yourusername/autoaipro-backend.git .

# Option B: Using SCP from your local machine
# (Run this on your local machine, not server)
scp -r /path/to/autoaipro-backend/* autoaipro@123.45.67.89:/home/autoaipro/autoaipro-backend/
```

If copying manually (Option B):
```bash
# On local machine
cd /path/to/autoaipro-backend
tar -czf backend.tar.gz .
scp backend.tar.gz autoaipro@123.45.67.89:/home/autoaipro/

# On server
cd /home/autoaipro
tar -xzf backend.tar.gz -C autoaipro-backend
cd autoaipro-backend
```

### Step 8: Configure Environment

```bash
# Create .env file
nano .env
```

**Production `.env`:**
```env
PORT=3000
NODE_ENV=production

# MongoDB (local)
MONGODB_URI=mongodb://localhost:27017/autoaipro

# Generate strong secret: openssl rand -base64 64
JWT_SECRET=YOUR_SUPER_LONG_RANDOM_SECRET_KEY_HERE

# Storage
STORAGE_PATH=/home/autoaipro/autoaipro-backend/storage
MAX_FILE_SIZE=10485760

# CORS - Add your extension ID and domain
ALLOWED_ORIGINS=chrome-extension://YOUR_EXTENSION_ID,https://api.yourdomain.com
```

### Step 9: Install Dependencies

```bash
# Install production dependencies
npm install --production

# Or if using npm ci
npm ci --production
```

### Step 10: Setup PM2 (Process Manager)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start application with PM2
pm2 start index.js --name autoaipro-backend

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Run the command it outputs (starts with sudo)

# Check status
pm2 status
pm2 logs autoaipro-backend
```

### Step 11: Configure Nginx

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/autoaipro
```

**Nginx config (HTTP - for testing):**
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;  # Or use your IP: 123.45.67.89

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/autoaipro /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Step 12: Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d api.yourdomain.com

# Follow prompts:
# - Enter email
# - Agree to ToS
# - Choose redirect (option 2)

# Test auto-renewal
sudo certbot renew --dry-run
```

Nginx will be automatically updated with HTTPS configuration.

### Step 13: Setup Firewall

```bash
# Allow SSH
sudo ufw allow OpenSSH

# Allow HTTP and HTTPS
sudo ufw allow 'Nginx Full'

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### Step 14: Test Deployment

```bash
# From your local machine
curl https://api.yourdomain.com/api/health

# Should return:
# {"status":"ok","message":"Auto入力Pro Backend Server is running","timestamp":"..."}
```

### Step 15: Update Extension

Update `scripts/api_client.js`:
```javascript
// Change from:
const API_BASE_URL = 'http://localhost:3000/api';

// To:
const API_BASE_URL = 'https://api.yourdomain.com/api';
```

---

## 🚀 Option 2: Heroku (Easiest)

### Step 1: Prepare Project

```bash
# Add Procfile
echo "web: node index.js" > Procfile

# Add engines to package.json
{
  "engines": {
    "node": "18.x",
    "npm": "9.x"
  }
}
```

### Step 2: Create Heroku App

```bash
# Install Heroku CLI
curl https://cli-assets.heroku.com/install.sh | sh

# Login
heroku login

# Create app
heroku create autoaipro-backend

# Add MongoDB
heroku addons:create mongolab:sandbox
```

### Step 3: Configure Environment

```bash
# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(openssl rand -base64 64)
heroku config:set ALLOWED_ORIGINS=chrome-extension://YOUR_EXTENSION_ID
```

### Step 4: Deploy

```bash
# Initialize git if not already
git init
git add .
git commit -m "Initial commit"

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

### Step 5: Test

```bash
# Get app URL
heroku open

# Test API
curl https://autoaipro-backend.herokuapp.com/api/health
```

---

## 🚀 Option 3: Railway (Fastest)

### Step 1: Sign Up

1. Go to https://railway.app
2. Sign up with GitHub

### Step 2: Deploy

1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Connect your repository
4. Railway auto-detects Node.js and deploys

### Step 3: Add MongoDB

1. Click "New" → "Database" → "Add MongoDB"
2. Copy connection string from Variables tab

### Step 4: Configure Environment

1. Go to Variables tab
2. Add:
   ```
   NODE_ENV=production
   JWT_SECRET=your-secret-key
   MONGODB_URI=mongodb://... (from MongoDB plugin)
   ALLOWED_ORIGINS=chrome-extension://YOUR_EXTENSION_ID
   ```

### Step 5: Get Domain

1. Go to Settings → Generate Domain
2. Note the URL (e.g., `autoaipro-backend.up.railway.app`)

---

## 🔧 Post-Deployment

### Monitor Application

**PM2 (DigitalOcean):**
```bash
# View logs
pm2 logs autoaipro-backend

# Monitor CPU/Memory
pm2 monit

# Restart app
pm2 restart autoaipro-backend

# View detailed info
pm2 show autoaipro-backend
```

**Heroku:**
```bash
# View logs
heroku logs --tail

# Scale dynos
heroku ps:scale web=1

# Restart
heroku restart
```

### Backup Database

**MongoDB (DigitalOcean):**
```bash
# Create backup script
nano /home/autoaipro/backup.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/autoaipro/backups"
mkdir -p $BACKUP_DIR

mongodump --db autoaipro --out $BACKUP_DIR/backup_$DATE

# Keep only last 7 days
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} \;
```

```bash
# Make executable
chmod +x /home/autoaipro/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
```

Add line:
```
0 2 * * * /home/autoaipro/backup.sh
```

### Update Application

**PM2 (DigitalOcean):**
```bash
cd /home/autoaipro/autoaipro-backend

# Pull latest code
git pull

# Install dependencies
npm install --production

# Restart with PM2
pm2 restart autoaipro-backend
```

**Heroku:**
```bash
# Just push to git
git push heroku main
```

---

## 🔐 Security Checklist

- [ ] Change default MongoDB port (27017 → custom)
- [ ] Enable MongoDB authentication
- [ ] Use strong JWT secret (64+ characters)
- [ ] Enable HTTPS (SSL certificate)
- [ ] Configure firewall (UFW)
- [ ] Disable root SSH login
- [ ] Setup fail2ban
- [ ] Regular security updates
- [ ] Monitor logs for suspicious activity
- [ ] Backup database regularly

---

## 📊 Monitoring

### Setup Monitoring Tools

**Option 1: PM2 Plus** (Recommended for PM2)
```bash
pm2 link YOUR_SECRET_KEY YOUR_PUBLIC_KEY
```

**Option 2: New Relic**
```bash
npm install newrelic
# Configure newrelic.js
```

**Option 3: Uptime Robot**
- Free uptime monitoring
- https://uptimerobot.com
- Monitor: `https://api.yourdomain.com/api/health`

---

## 💰 Cost Estimates

| Service | Storage | Bandwidth | Cost/Month |
|---------|---------|-----------|------------|
| DigitalOcean Droplet | 25 GB SSD | 1 TB | $6 |
| Heroku Hobby | 10 GB | 2 TB | $7 |
| Railway Starter | 100 GB | 100 GB | $5 |
| AWS t2.micro | 30 GB EBS | 15 GB | ~$10 |

**MongoDB Atlas (Cloud DB):**
- Free tier: 512 MB
- Shared: $9/month (2 GB)
- Dedicated: $57/month (10 GB)

---

## 🆘 Troubleshooting

**Application won't start:**
```bash
# Check logs
pm2 logs autoaipro-backend --lines 100

# Common issues:
# - MongoDB not running
# - Wrong MongoDB URI
# - Missing .env file
# - Port already in use
```

**502 Bad Gateway:**
```bash
# Check if app is running
pm2 status

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log

# Restart Nginx
sudo systemctl restart nginx
```

**Can't connect from extension:**
```bash
# Check CORS settings
# Check HTTPS vs HTTP
# Check extension has correct URL
# Check firewall allows port 80/443
```

---

## 📚 Resources

- [DigitalOcean Tutorials](https://www.digitalocean.com/community/tutorials)
- [PM2 Documentation](https://pm2.keymetrics.io/docs)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [MongoDB Manual](https://www.mongodb.com/docs/manual/)
- [Let's Encrypt](https://letsencrypt.org/)
