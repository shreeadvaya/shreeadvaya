export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'No code provided' });
  }

  try {
    // Exchange code for token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const data = await tokenResponse.json();

    if (data.error) {
      return res.status(400).json({ error: data.error_description });
    }

    // Send token back to CMS
    res.send(`
      <!DOCTYPE html>
      <html>
        <body>
          <script>
            window.opener.postMessage(
              'authorization:github:success:${JSON.stringify({ token: data.access_token, provider: 'github' })}',
              window.location.origin
            );
            window.close();
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
