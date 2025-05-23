// === api/submit.js ===
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, author: manualAuthor } = req.body;

  // CASE 1: Instagram URL
  const isInstagram = url.includes('instagram.com');

  let imageUrl = null;
  let author = manualAuthor || null;

  if (isInstagram) {
    const apiRes = await fetch("https://auto-download-all-in-one-big.p.rapidapi.com/v1/social/autolink", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": "auto-download-all-in-one-big.p.rapidapi.com"
      },
      body: JSON.stringify({ url })
    });

    const apiData = await apiRes.json();
    imageUrl = apiData?.medias?.[0]?.url;
    author = apiData?.owner?.username;

    if (!imageUrl || !author) {
      return res.status(400).json({ error: "Could not extract image or author", raw: apiData });
    }
  } else {
    // CASE 2: Direct image URL
    const head = await fetch(url, { method: 'HEAD' });
    const contentType = head.headers.get('content-type') || '';

    if (!head.ok || !contentType.startsWith('image/')) {
      return res.status(400).json({ error: 'Provided URL is not a valid image or not reachable.' });
    }

    imageUrl = url;
    if (!author) {
      return res.status(400).json({ error: 'Author name required for non-Instagram image.' });
    }
  }

  // Download and encode image as base64
  const imageRes = await fetch(imageUrl);
  const imageBuffer = await imageRes.arrayBuffer();
  const base64 = Buffer.from(imageBuffer).toString('base64');
  const mime = 'image/jpeg';
  const base64url = `data:${mime};base64,${base64}`;

  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze the photo and write two short philosophical English sentences inspired by it. Use emojis contextually. Then on a new line, add 3–5 relevant and popular Instagram hashtags.`
            },
            {
              type: "image_url",
              image_url: { url: base64url }
            }
          ]
        }
      ],
      max_tokens: 400
    })
  });

  const aiData = await openaiRes.json();
  const caption = aiData.choices?.[0]?.message?.content || "No caption generated.";

  const zapierRes = await fetch(process.env.ZAPIER_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageUrl, caption, author })
  });

  const zapData = await zapierRes.text();
  res.status(200).json({ imageUrl, caption, author, zapierResponse: zapData });
}
