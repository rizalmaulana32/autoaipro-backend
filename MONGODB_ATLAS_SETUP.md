# MongoDB Atlas Setup Guide

## 🌥️ Why MongoDB Atlas?

- ✅ **Free tier** (512 MB storage)
- ✅ **No installation needed** (cloud-based)
- ✅ **Automatic backups**
- ✅ **Accessible from anywhere**
- ✅ **Easy to scale**

---

## 🚀 Step-by-Step Setup

### Step 1: Create MongoDB Atlas Account

1. Go to: https://www.mongodb.com/cloud/atlas/register
2. Sign up with:
   - Email + Password, OR
   - Google account, OR
   - GitHub account
3. Click "Sign Up"

---

### Step 2: Create a Free Cluster

1. After login, you'll see "Create a deployment"
2. Choose **M0 FREE** tier:
   - Storage: 512 MB
   - Shared RAM
   - **Cost: $0/month**

3. **Cloud Provider & Region**:
   - Provider: Choose **AWS** or **Google Cloud**
   - Region: Choose closest to Japan (e.g., **Tokyo** or **Singapore**)
   - Click "Create Deployment"

4. **Cluster Name** (optional):
   - Default: `Cluster0`
   - Or rename to: `autoaipro-cluster`

5. Click **"Create"**

⏳ **Wait 1-3 minutes** while cluster is being created...

---

### Step 3: Create Database User

1. You'll see "Security Quickstart" popup
2. **Authentication Method**: Username and Password
3. Enter credentials:
   ```
   Username: autoaipro_user
   Password: [Click "Autogenerate Secure Password" or create your own]
   ```

4. **⚠️ IMPORTANT**: Copy the password and save it somewhere safe!
   - You'll need it in the connection string
   - Example: `aB3dEf9GhI2jK5lM`

5. Click **"Create User"**

---

### Step 4: Setup Network Access

1. Still in the Security Quickstart popup
2. **Where would you like to connect from?**
3. Choose: **"My Local Environment"**
4. Click **"Add My Current IP Address"**
   - This adds your current IP to whitelist

5. **For easier testing**, also add **"Allow Access from Anywhere"**:
   - Click "Add IP Address"
   - Enter: `0.0.0.0/0`
   - Description: "Allow from anywhere"
   - Click "Add Entry"

   ⚠️ **Note**: In production, restrict to specific IPs only!

6. Click **"Finish and Close"**

---

### Step 5: Get Connection String

1. Click **"Database"** in left sidebar
2. You'll see your cluster (Cluster0)
3. Click **"Connect"** button

4. Choose connection method: **"Drivers"**

5. **Select Driver and Version**:
   - Driver: **Node.js**
   - Version: **5.5 or later**

6. **Copy the connection string**:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

7. **Replace placeholders**:
   ```
   Original:
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority

   Replace <username> with: autoaipro_user
   Replace <password> with: YOUR_ACTUAL_PASSWORD (from Step 3)

   Example Result:
   mongodb+srv://autoaipro_user:aB3dEf9GhI2jK5lM@cluster0.abc123.mongodb.net/?retryWrites=true&w=majority
   ```

8. **Add database name** (optional but recommended):
   ```
   Add /autoaipro before the ?

   Final:
   mongodb+srv://autoaipro_user:aB3dEf9GhI2jK5lM@cluster0.abc123.mongodb.net/autoaipro?retryWrites=true&w=majority
   ```

---

### Step 6: Update Backend .env File

```bash
# Open your backend .env file
cd /mnt/c/Users/rizal/Documents/autoaipro-backend
notepad .env  # Windows
nano .env     # macOS/Linux
```

**Change this line:**
```env
# OLD (local MongoDB):
MONGODB_URI=mongodb://localhost:27017/autoaipro

# NEW (MongoDB Atlas):
MONGODB_URI=mongodb+srv://autoaipro_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/autoaipro?retryWrites=true&w=majority
```

**Complete example .env:**
```env
PORT=3000
NODE_ENV=development

# MongoDB Atlas connection
MONGODB_URI=mongodb+srv://autoaipro_user:aB3dEf9GhI2jK5lM@cluster0.abc123.mongodb.net/autoaipro?retryWrites=true&w=majority

JWT_SECRET=my-super-secret-key-for-testing-12345
STORAGE_PATH=./storage
MAX_FILE_SIZE=10485760
ALLOWED_ORIGINS=chrome-extension://YOUR_EXTENSION_ID,http://localhost:3000
```

**Save the file!**

---

### Step 7: Test Connection

```bash
# If backend server is running, restart it:
# Press Ctrl+C, then:
npm run dev
```

**You should see:**
```
✅ MongoDB Connected: cluster0-shard-00-00.xxxxx.mongodb.net
🚀 Auto入力Pro Backend Server
🌐 Server running on http://localhost:3000
```

✅ **If you see "MongoDB Connected: cluster0..." - SUCCESS!**

---

### Step 8: Test Database Access

```bash
# Register a test user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"atlastest","email":"atlas@test.com","password":"test123"}'

# Should return:
# {"success":true,"message":"User registered successfully","user":{...}}
```

---

### Step 9: View Data in Atlas (Optional)

1. Go to MongoDB Atlas dashboard
2. Click **"Database"** → **"Browse Collections"**
3. Select database: **autoaipro**
4. You should see collections:
   - `users` (with your test user)
   - `properties` (empty for now)
5. Click on `users` → You'll see your registered user!

---

## 🎉 You're Done!

**What changed:**
- ❌ No more local MongoDB installation needed
- ✅ Using cloud MongoDB Atlas
- ✅ Data stored in the cloud
- ✅ Accessible from anywhere
- ✅ Automatic backups

---

## 🔧 Troubleshooting

### Error: "MongoServerError: bad auth"

**Cause**: Wrong username or password

**Fix**:
1. Go to Atlas → Database Access
2. Edit user or create new one
3. Copy correct password
4. Update MONGODB_URI in .env
5. Restart backend

---

### Error: "MongoServerError: user is not allowed to do action"

**Cause**: User doesn't have permissions

**Fix**:
1. Atlas → Database Access
2. Edit user
3. Built-in Role: **"Read and write to any database"**
4. Update User

---

### Error: "getaddrinfo ENOTFOUND cluster0.xxxxx.mongodb.net"

**Cause**: Network/DNS issue or wrong connection string

**Fix**:
1. Check internet connection
2. Verify connection string is correct
3. Make sure you replaced `<password>` with actual password
4. No spaces in the connection string

---

### Error: "MongoServerError: IP address not allowed"

**Cause**: Your IP is not whitelisted

**Fix**:
1. Atlas → Network Access
2. Click "Add IP Address"
3. Add your current IP or `0.0.0.0/0` (allow all)
4. Wait 1-2 minutes for changes to apply

---

## 📊 MongoDB Atlas Dashboard

**Useful features:**

1. **Collections** - View/edit your data
   - Database → Browse Collections

2. **Metrics** - Monitor usage
   - Database → Metrics

3. **Backups** - Automatic backups (in paid tiers)
   - Backups tab

4. **Users** - Manage database users
   - Database Access

5. **Network** - Manage IP whitelist
   - Network Access

---

## 💰 Free Tier Limits

**M0 Free Tier includes:**
- ✅ 512 MB storage
- ✅ Shared RAM
- ✅ Up to 100 connections
- ✅ Automatic backups (limited)

**When to upgrade:**
- Storage > 512 MB
- Need dedicated resources
- Need advanced features

**Pricing after free tier:**
- M2: $9/month (2 GB)
- M5: $25/month (5 GB)

---

## 🔐 Security Best Practices

1. **Strong Password**
   - Use autogenerated passwords
   - Never commit to git

2. **IP Whitelist**
   - In production: Only allow specific IPs
   - Remove `0.0.0.0/0` in production

3. **Database User Permissions**
   - Create separate users for dev/prod
   - Grant minimum required permissions

4. **Connection String**
   - Store in .env file
   - Add .env to .gitignore
   - Never commit connection strings

---

## 🚀 Next Steps

Now that MongoDB Atlas is setup:

1. ✅ Backend is using cloud database
2. ✅ No local MongoDB needed
3. ✅ Data accessible from anywhere
4. ✅ Ready to deploy to production

**Continue with**: `START_HERE.md` to run the full application!

---

## 📚 Additional Resources

- [MongoDB Atlas Documentation](https://www.mongodb.com/docs/atlas/)
- [Atlas Free Tier](https://www.mongodb.com/pricing)
- [Connection String Format](https://www.mongodb.com/docs/manual/reference/connection-string/)
- [Atlas Security](https://www.mongodb.com/docs/atlas/security/)

---

**Last Updated**: 2025-12-12
**Status**: ✅ Complete guide for MongoDB Atlas setup
