export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const imageUrl = 'https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png';
  const author = 'test_case_author';

  // 1. Завантажуємо зображення → конвертуємо в base64
  const imageRes = await fetch(imageUrl);
  const imageBuffer = await imageRes.arrayBuffer();
  const base64 = Buffer.from(imageBuffer).toString('base64');
  const mime = 'image/png';

  const base64url = `data:${mime};base64,${base64}`;

  // 2. Надсилаємо в OpenAI Vision
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
              text: `Create a short, philosophical English caption with emoji for this PNG image. Then on a new line add 3-5 popular context-based hashtags.`
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

  // 3. Відправляємо у Zapier
  const zapierRes = await fetch(process.env.ZAPIER_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageUrl, caption, author })
  });

  const zapData = await zapierRes.text();

  // 4. Віддаємо результат
  res.status(200).json({ imageUrl, caption, author, zapierResponse: zapData });
}
