# GitHub Token Troubleshooting

## "I have put classic token but it's not working"

Let's check each common issue:

---

## ✅ Checklist - Go Through Each Step

### 1. **Token Has Correct Scopes** ⚠️ MOST COMMON ISSUE

When creating the token, you MUST check the **`repo`** checkbox:

```
Personal Access Tokens > Generate new token (classic)

Select scopes:
☑️ repo                           <-- THIS MUST BE CHECKED!
   ☑️ repo:status
   ☑️ repo_deployment  
   ☑️ public_repo
   ☑️ repo:invite
   ☑️ security_events
```

**If you didn't check `repo`, the token won't work - you must create a new one!**

---

### 2. **Token Format is Correct**

Your token should:
- Start with `ghp_` (e.g., `ghp_1234567890abcdefghijklmnopqrstuvwxyz`)
- Be around 40-50 characters long
- Have NO spaces before or after it

❌ **Wrong**: `Bearer ghp_xxx` or ` ghp_xxx ` (with spaces)  
✅ **Correct**: `ghp_xxx`

---

### 3. **Token is Added to ALL Environments in Vercel**

In Vercel:
1. Go to your project → **Settings** → **Environment Variables**
2. Find `GITHUB_TOKEN`
3. Make sure ALL THREE boxes are checked:
   - ✅ **Production**
   - ✅ **Preview**  
   - ✅ **Development**

**If not all checked, edit and check all three!**

---

### 4. **Vercel Has Been Redeployed**

After adding/updating the token:
1. Wait 2-3 minutes for automatic redeploy, OR
2. Force redeploy:
   - Go to **Deployments** tab
   - Click **⋯** on latest deployment
   - Click **Redeploy**
   - Wait for "Ready" status

**Environment variables only apply after redeployment!**

---

### 5. **Token Has Access to Repository**

If you created the token from a different account or organization:
- Make sure the token's account has **write access** to `Giridharsalana/Shree-Advaya`
- For organization repos, you may need to authorize the token for the organization

---

## 🔍 How to Verify Your Token Works

### Test 1: Check Token in Command Line

Open terminal and run:

```bash
curl -H "Authorization: Bearer ghp_YOUR_TOKEN_HERE" \
     https://api.github.com/repos/Giridharsalana/Shree-Advaya
```

**Expected Results:**
- ✅ **200 OK + Repository data** = Token works! ✓
- ❌ **401 Unauthorized** = Token is invalid or expired
- ❌ **403 Forbidden** = Token doesn't have `repo` scope
- ❌ **404 Not Found** = Token can't access the repository

### Test 2: Check Vercel Logs

After trying to save in admin panel:
1. Go to Vercel Dashboard → Your project → **Deployments**
2. Click on the latest deployment
3. Click **Functions** tab
4. Click on the function that failed (e.g., `/api/batch`)
5. Look for `[DEBUG]` logs showing:
   - Token presence
   - Token validation results
   - Specific error messages

---

## 🛠️ Step-by-Step Fix

If it's still not working, do this:

### Step 1: Delete Old Token (if exists)
1. GitHub → Settings → Developer settings → Personal access tokens
2. Find your old token, click **Delete**

### Step 2: Create New Token
1. Click **Generate new token (classic)**
2. Name: `Shree-Advaya-Admin`
3. Expiration: `No expiration`
4. **✅ Check `repo` scope** (most important!)
5. Click **Generate token**
6. **COPY THE TOKEN IMMEDIATELY** (you won't see it again)

### Step 3: Update in Vercel
1. Vercel → Your project → Settings → Environment Variables
2. If `GITHUB_TOKEN` exists:
   - Click **⋯** → **Edit**
   - Paste new token
   - Check all three environments
   - Click **Save**
3. If it doesn't exist:
   - Click **Add New**
   - Key: `GITHUB_TOKEN`
   - Value: Your new token
   - Check all three environments
   - Click **Save**

### Step 4: Force Redeploy
1. Go to **Deployments** tab
2. Click **⋯** on latest deployment → **Redeploy**
3. Wait for "Ready" status (1-2 minutes)

### Step 5: Test Again
1. Open admin panel
2. Make a small change
3. Click "Save All Changes"
4. Should work now!

---

## 🆘 Still Not Working?

### Check These:

1. **Is the token definitely a classic token?**
   - Fine-grained tokens work differently and may have issues

2. **Is your GitHub account a collaborator on the repo?**
   - Go to repository → Settings → Collaborators
   - Make sure your account is listed with write access

3. **Are you using the correct repository name?**
   - Should be: `Giridharsalana/Shree-Advaya` (with hyphen)

4. **Check browser console (F12)**
   - Look for the exact error message
   - Share it for more specific help

---

## 📧 Error Messages Explained

| Error | Meaning | Fix |
|-------|---------|-----|
| `403 Resource not accessible` | Token lacks permissions | Create new token with `repo` scope |
| `401 Unauthorized` | Token is invalid/expired | Create new token |
| `404 Not found` | Wrong repo name or no access | Check repository name and access |
| `Token not configured` | Token missing in Vercel | Add `GITHUB_TOKEN` to Vercel env vars |
| `Failed to create blob` | Token can't write to repo | Need `repo` scope on token |

---

## ✨ Quick Reference: Complete Token Setup

```
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token (classic)
3. Name: Shree-Advaya-Admin
4. ☑️ CHECK "repo" SCOPE
5. Generate and COPY token (ghp_...)
6. Vercel → Project → Settings → Environment Variables
7. Add/Edit GITHUB_TOKEN
8. Paste token
9. ☑️ Check Production, Preview, Development
10. Save
11. Wait 2-3 minutes OR force redeploy
12. Test in admin panel
```

That's it! 🎉

