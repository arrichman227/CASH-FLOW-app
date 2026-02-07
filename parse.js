export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, apiKey } = req.body;
  if (!text || !apiKey) return res.status(400).json({ error: 'Missing text or apiKey' });

  const today = new Date().toISOString().slice(0, 10);

  const systemPrompt = `You are a financial transaction parser for a Russian-language personal finance app. 
Given user input (text or transcribed voice), extract transaction details and return ONLY valid JSON.

Categories for expenses:
- food (Еда 🍔): еда, обед, завтрак, ужин, кофе, ресторан, кафе, пицца, продукты, магазин, доставка
- transport (Транспорт 🚗): такси, метро, автобус, бензин, каршеринг, парковка, самокат
- shopping (Покупки 🛍️): одежда, обувь, техника, электроника, маркетплейс
- ent (Развлечения 🎬): кино, театр, концерт, игры, подписка, бар, клуб
- health (Здоровье 💊): аптека, лекарства, врач, спортзал, фитнес
- housing (Жильё 🏠): аренда, квартира, коммуналка, жкх, ремонт, ипотека, интернет
- personal (Личное 👤): красота, парикмахерская, косметика, образование, курсы, книги
- travel (Путешествия ✈️): перелёт, отель, билеты, экскурсия, тур
- oexp (Прочее 📦): anything else for expenses

Categories for income:
- salary (Зарплата 💰): зарплата, зп, аванс, оклад
- freelance (Фриланс 💻): фриланс, заказ, проект, подработка
- gifts (Подарки 🎁): подарок, подарили, получил
- oinc (Прочее 💵): доход, кэшбэк, возврат, дивиденды

Today's date: ${today}

Return ONLY this JSON format, no extra text:
{
  "type": "expense" or "income",
  "amount": number,
  "category": "category_id",
  "categoryName": "Русское название",
  "categoryIcon": "emoji",
  "description": "Краткое описание на русском",
  "account": "cash" or "card",
  "date": "YYYY-MM-DD"
}

Rules:
- If user mentions "картой"/"карта" → account: "card", otherwise "cash"
- If user mentions "вчера" → subtract 1 day from today
- If user mentions "позавчера" → subtract 2 days
- Amount must be positive number
- If you can't determine amount, set amount: 0
- Description should be clean and concise in Russian
- Default type is "expense" unless clearly income-related`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{ role: 'user', content: text }],
        system: systemPrompt
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: `API error: ${err}` });
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Extract JSON from response
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (e) {
      return res.status(422).json({ error: 'Failed to parse AI response', raw: content });
    }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
