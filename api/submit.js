export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  // 1. Витягуємо зображення і автора
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
  const imageUrl = apiData?.medias?.[0]?.url;
  const author = apiData?.owner?.username;

  if (!imageUrl || !author) {
    return res.status(400).json({ error: "Could not extract image or author", raw: apiData });
  }

  // 2. Завантажуємо зображення → конвертуємо в base64
  const imageRes = await fetch(imageUrl);
  const imageBuffer = await imageRes.arrayBuffer();
  const base64 = Buffer.from(imageBuffer).toString('base64');
  const mime = 'image/jpeg'; // або image/png, якщо треба

  const base64url = `data:${mime};base64,${base64}`;

  // 3. Генеруємо опис через OpenAI Vision (base64-режим)
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
            {
              type: "text",
              text: `Create a short, philosophical English caption with emoji for this Instagram photo. Then on a new line add 3-5 popular context-based hashtags.`
            },
            {
              type: "image_url",
              image_url: { url: base64url }
            }
          ]
        }
      ],
      max_tokens: 300
    })
  });

  const aiData = await openaiRes.json();
  const caption = aiData.choices?.[0]?.message?.content || "No caption generated.";

  // 4. Відправка в Zapier
  const zapierRes = await fetch(process.env.ZAPIER_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageUrl, caption, author })
  });

  const zapData = await zapierRes.text();

  // 5. Віддаємо результат
  res.status(200).json({ imageUrl, caption, author, zapierResponse: zapData });
}
