export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  // 1. Витягуємо зображення через RapidAPI
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
  const imageUrl = apiData?.medias?.[0]?.url; // <-- Виправлено тут

  if (!imageUrl) {
    return res.status(400).json({ error: "Could not extract image", raw: apiData });
  }

  // 2. Генеруємо текст через OpenAI
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
              image_url: { url: imageUrl }
            }
          ]
        }
      ],
      max_tokens: 300
    })
  });

  const aiData = await openaiRes.json();
  const caption = aiData.choices?.[0]?.message?.content || "No caption generated.";

  // 3. Відправка в Zapier
  const zapierRes = await fetch(process.env.ZAPIER_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageUrl, caption })
  });

  const zapData = await zapierRes.text();

  // 4. Повертаємо результат назад у фронт
  res.status(200).json({ imageUrl, caption, zapierResponse: zapData });
}
