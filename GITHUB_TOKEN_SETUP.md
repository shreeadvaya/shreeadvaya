# GitHub Token Setup Guide

## Issue
Error: `Resource not accessible by personal access token`

This means your GitHub token doesn't have the required permissions to write to the repository.

## Solution: Update GitHub Token Permissions

### Step 1: Create a New GitHub Personal Access Token

1. Go to **GitHub.com** → Click your profile picture (top right) → **Settings**

2. Scroll down to **Developer settings** (bottom of left sidebar)

3. Click **Personal access tokens** → **Tokens (classic)**

4. Click **Generate new token** → **Generate new token (classic)**

5. Fill in the form:
   - **Note**: `Shree-Advaya Admin Panel` (or any name you prefer)
   - **Expiration**: Choose `No expiration` or set a long duration
   - **Select scopes**: ✅ Check **`repo`** (Full control of private repositories)
     - This will automatically check all sub-scopes including:
       - `repo:status`
       - `repo_deployment`
       - `public_repo`
       - `repo:invite`
       - `security_events`

6. Scroll down and click **Generate token**

7. **IMPORTANT**: Copy the token immediately! You won't be able to see it again.
   - It will look like: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Step 2: Update Token in Vercel

1. Go to **Vercel Dashboard**: https://vercel.com/dashboard

2. Select your **Shree-Advaya** project

3. Click **Settings** tab (top navigation)

4. Click **Environment Variables** (left sidebar)

5. Find `GITHUB_TOKEN` variable:
   - If it exists: Click the **⋯** (three dots) → **Edit**
   - If it doesn't exist: Click **Add New**

6. Fill in:
   - **Key**: `GITHUB_TOKEN`
   - **Value**: Paste your new token (starts with `ghp_`)
   - **Environment**: Check all three boxes:
     - ✅ Production
     - ✅ Preview
     - ✅ Development

7. Click **Save**

### Step 3: Redeploy

Vercel will automatically redeploy. Wait 2-3 minutes, then try saving changes in your admin panel again.

Alternatively, force a redeploy:
1. Go to **Deployments** tab
2. Click **⋯** on the latest deployment → **Redeploy**

---

## Verification

After redeployment, test by:
1. Opening your admin panel
2. Making a small change (edit a product description)
3. Click "Save All Changes"
4. You should see: "All changes saved successfully"

## Troubleshooting

### Token Still Not Working?

Check that:
- ✅ Token has **`repo`** scope checked
- ✅ Token is added to **all environments** in Vercel (Production, Preview, Development)
- ✅ You waited 2-3 minutes for Vercel to redeploy
- ✅ Token hasn't expired

### Need Help?

1. Check browser console (F12) for detailed error messages
2. Verify the token works by testing it:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
        https://api.github.com/repos/Giridharsalana/Shree-Advaya
   ```
   - Should return repository info, not a 403 error

---

## Security Notes

- **Never commit the token to your repository**
- Store it only in Vercel's environment variables
- If you accidentally expose it, delete it immediately and create a new one
- Tokens with `repo` scope have full access to your repositories - keep them secure!

