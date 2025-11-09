export default function handler(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = `${req.headers.origin || 'https://' + req.headers.host}/api/callback`;
  
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo,user&redirect_uri=${encodeURIComponent(redirectUri)}`;
  
  res.redirect(githubAuthUrl);
}
