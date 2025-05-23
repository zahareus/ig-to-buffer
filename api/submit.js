
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  // 1. Витягуємо картинку (дуже базовий HTML-парсер)
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  });
  const html = await response.text();

  const imageRegex = /property="og:image" content="(.*?)"/;
  const match = html.match(imageRegex);
  const imageUrl = match?.[1];

  if (!imageUrl) {
    return res.status(400).json({ error: 'Could not extract image' });
  }

  // 2. Запит до OpenAI
  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `Create a short, philosophical English caption with emoji for this Instagram photo. Then on a new line add 3-5 popular context-based hashtags.` },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }
      ],
      max_tokens: 300
    })
  });

  const aiData = await openaiRes.json();
  const text = aiData.choices?.[0]?.message?.content || "No result";

  // 3. Відправка в Zapier
  const zapierRes = await fetch(process.env.ZAPIER_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageUrl, caption: text })
  });

  const zapData = await zapierRes.text();

  // 4. Результат назад у браузер
  res.status(200).json({ imageUrl, caption: text, zapierResponse: zapData });
}
