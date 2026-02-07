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
- food (Еда): еда, обед, завтрак, ужин, кофе, ресторан, кафе, пицца, продукты, магазин, доставка
- transport (Транспорт): такси, метро, автобус, бензин, каршеринг, парковка, самокат
- shopping (Покупки): одежда, обувь, техника, электроника, маркетплейс
- ent (Развлечения): кино, театр, концерт, игры, подписка, бар, клуб
- health (Здоровье): аптека, лекарства, врач, спортзал, фитнес
- housing (Жильё): аренда, квартира, коммуналка, жкх, ремонт, ипотека, интернет
- personal (Личное): красота, парикмахерская, косметика, образование, курсы
- travel (Путешествия): перелёт, отель, билеты, экскурсия, тур
- oexp (Прочее): anything else

Categories for income:
- salary (Зарплата): зарплата, зп, аванс, оклад
- freelance (Фриланс): фриланс, заказ, проект, подработка
- gifts (Подарки): подарок, подарили, получил
- oinc (Прочее): доход, кэшбэк, возврат, дивиденды

Today: ${today}

Return ONLY raw JSON, no markdown, no backticks:
{"type":"expense","amount":0,"category":"food","categoryName":"Еда","categoryIcon":"🍔","description":"Описание","account":"cash","date":"${today}"}

Rules: "картой" -> account:"card", "вчера" -> date minus 1 day, default type is "expense"`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 200,
        temperature: 0,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    let parsed;
    try {
      const clean = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : clean);
    } catch (e) {
      return res.status(422).json({ error: 'Parse failed', raw: content });
    }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
