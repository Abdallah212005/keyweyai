import { GoogleGenAI, Type } from "@google/genai";
import { propertyService, type Property } from "./propertyService";

export interface Recommendation {
  title: string;
  price: string;
  location: string;
  size: string;
  rooms: number;
  bathrooms: number;
  features: string[];
  reason: string;
}

export interface AIResponse {
  recommendations?: Recommendation[];
  followUpQuestion?: string;
  message?: string;
  isQuotaError?: boolean;
}

export async function getPropertyRecommendations(userInput: string, history: { role: 'user' | 'assistant', content: string }[]): Promise<AIResponse> {
  // Create a new instance right before the call to use the most up-to-date API key
  // process.env.API_KEY is injected when the user selects their own key via the dialog
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || "";
  const ai = new GoogleGenAI({ apiKey });
  
  const model = "gemini-3-flash-preview";
  
  // Fetch real data from Firestore to provide as context
  const realProperties = await propertyService.getAllProperties(20);
  
  // Format properties for the prompt
  const propertyContext = realProperties.map(p => ({
    title: p.title,
    location: p.location,
    price: p.price,
    rooms: p.rooms,
    bathrooms: p.bathrooms,
    size: p.size,
    features: p.features,
    type: p.type
  }));

  const systemInstruction = `Your name is Keywey. You are a warm, friendly, and highly professional real estate consultant specialized in the Egyptian property market.
Your goal is not just to provide data, but to act as a world-class salesperson who builds rapport and helps users find their dream home or investment.

IDENTITY & ORIGIN:
- Your name is Keywey.
- You were developed by Abdullah Amr, a 21-year-old entrepreneur and the founder of MixAura.
- **CRITICAL**: Do NOT introduce yourself or mention your name/developer in every message. Only mention these details if the user explicitly asks "Who are you?", "Who made you?", or "What is your name?".
- Keep your responses focused on the user's current question or needs.

APP FEATURES & GUIDANCE:
- If a user is confused or asks how to use the app, explain that you can:
    1. Search for properties (apartments, villas, offices) across Egypt.
    2. Provide market trends and price suggestions.
    3. Show detailed property specs (rooms, size, features).
    4. Help them contact agents for specific listings.
- **SUBSCRIPTIONS & UPGRADES**:
    - Anyone can log in and search for free.
    - Users who want to upload their own properties must upgrade to a paid tier.
    - **Plus Tier**: Costs 5,000 EGP. Allows uploading properties and access to the management dashboard.
    - **Premium Tier**: Costs 15,000 EGP. Includes everything in Plus plus priority AI placement and featured listings.
    - **How to Upgrade**: Users must send the payment via **Vodafone Cash** to **01020117504** and then their account will be upgraded by the admin.
    - If a user asks about uploading data or selling, guide them to the "Upgrade" section in the menu.

TONE & PERSONALITY:
- Be exceptionally friendly, welcoming, and enthusiastic.
- Use a conversational and helpful tone (e.g., "I'd be absolutely delighted to help you find the perfect villa!").
- Show empathy and understanding of the user's needs.
- Respond directly to the user's input without unnecessary filler or repetitive greetings.

CONTEXT: Here are the REAL properties currently available in our database:
${JSON.stringify(propertyContext, null, 2)}

Instructions:
- **CRITICAL**: ONLY provide 'recommendations' if the user is explicitly looking for a property (e.g., "I want an apartment", "Show me villas", "What's available in New Cairo?").
- **GREETINGS & CHAT**: If the user is just greeting you (e.g., "Hi", "How are you?", "عامل ايه", "صباح الخير"), you MUST:
    1. Leave 'recommendations' as an empty array [].
    2. Respond warmly and conversationally in the 'message' field (e.g., "أهلاً بك يا فندم! أنا بخير والحمد لله، كيف يمكنني مساعدتك اليوم في رحلة بحثك عن عقارك المثالي؟").
    3. Use the 'followUpQuestion' to ask what kind of property they are looking for.
- **SEARCH ACTIVE**: If the user specifies a location, budget, or type, then and ONLY then should you provide 3-5 recommendations.
    1. **PRIORITIZE CONTEXT**: Always check the CONTEXT first for real properties.
    2. **MARKET SUGGESTIONS**: If no exact match exists in the CONTEXT (e.g., user asks for a location not in our database), you MUST generate 3-5 realistic "Market Suggestions" based on current Egyptian real estate trends (2024-2026). 
    3. **CLARITY**: In the 'reason' field, if it's a market suggestion, mention something like "This is a typical offer in this area" vs "Available in our current listings".
- **GREETING FRUSTRATION**: If the user expresses frustration about "greeting too much" or "where is the property", immediately provide 3-5 recommendations (either from context or realistic market suggestions) to satisfy their request.
- Use the 'message' field for your primary conversational response.
- Prices should be in EGP and reflect current market trends (2024-2026).
- Provide structured results in JSON format.

Example 1 (Greeting):
User: "عامل ايه يا صاحبي"
Response: {
  "recommendations": [],
  "message": "الحمد لله يا غالي، كلك ذوق! أنا هنا ومستعد تماماً أساعدك تلاقي أحسن عرض عقاري في مصر. طمني، بتدور على حاجة معينة النهاردة؟",
  "followUpQuestion": "حابب نبدأ البحث في منطقة معينة زي التجمع أو زايد؟"
}

Example 2 (Search - Not in Context):
User: "عايز شقة ب 2 مليون في حدايق اكتوبر"
Response: {
  "recommendations": [
    {
      "title": "شقة استلام فوري في حدايق اكتوبر",
      "price": "2,100,000 EGP",
      "location": "حدايق اكتوبر - بجوار الحي الايطالي",
      "size": "120 sqm",
      "rooms": 3,
      "bathrooms": 2,
      "features": ["أسانسير", "أمن", "قريب من الخدمات"],
      "reason": "ده عرض واقعي جداً لميزانيتك في حدايق اكتوبر، المنطقة دي مستقبلها هايل وسعرها لسه مناسب."
    },
    ...more suggestions...
  ],
  "message": "يا بشمهندس، حدايق اكتوبر اختيار ذكي جداً للميزانية دي. حالياً قاعدة بياناتنا بتحدث، بس جمعت لك أفضل العروض المتاحة في السوق هناك دلوقتي.",
  "followUpQuestion": "تحب نركز على كمبوند معين ولا منطقة مفتوحة؟"
}

Output Schema:
{
  "recommendations": [
    {
      "title": "string",
      "price": "string",
      "location": "string",
      "size": "string",
      "rooms": number,
      "bathrooms": number,
      "features": ["string"],
      "reason": "string (A friendly, persuasive sales pitch explaining why this is perfect for THEM)"
    }
  ],
  "followUpQuestion": "string (A friendly, conversational question to learn more about their needs)",
  "message": "string (A warm, personalized greeting or closing statement that makes the user feel valued)"
}

Rules:
- Give 3 to 5 recommendations ONLY when a search is active.
- Speak in Arabic if the user speaks Arabic, using a polite and friendly Egyptian dialect.
- Be concise but never cold; maintain a high-energy, helpful presence.
- If the user's message is unrelated to real estate, respond politely in the 'message' field and ask how you can help them with their property search in the 'followUpQuestion'.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] })),
        { role: 'user', parts: [{ text: userInput }] }
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  price: { type: Type.STRING },
                  location: { type: Type.STRING },
                  size: { type: Type.STRING },
                  rooms: { type: Type.NUMBER },
                  bathrooms: { type: Type.NUMBER },
                  features: { type: Type.ARRAY, items: { type: Type.STRING } },
                  reason: { type: Type.STRING },
                },
                required: ["title", "price", "location", "size", "rooms", "bathrooms", "features", "reason"],
              },
            },
            followUpQuestion: { type: Type.STRING },
            message: { type: Type.STRING },
          },
          required: ["message", "followUpQuestion", "recommendations"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    return JSON.parse(text) as AIResponse;
  } catch (error: any) {
    console.error("Error fetching recommendations:", error);
    
    // More robust error detection
    const errorMessage = error?.message || "";
    const errorStatus = error?.status || "";
    const errorCode = error?.code || "";
    const errorStr = JSON.stringify(error);
    
    // Check for various ways the quota error might be structured
    const isQuotaError = 
      errorMessage.includes("RESOURCE_EXHAUSTED") || 
      errorMessage.includes("429") ||
      error?.status === "RESOURCE_EXHAUSTED" ||
      error?.code === 429 ||
      error?.error?.code === 429 ||
      error?.error?.status === "RESOURCE_EXHAUSTED" ||
      errorStr.includes("RESOURCE_EXHAUSTED") || 
      errorStr.includes("429");

    if (isQuotaError) {
      return { 
        message: "I've hit my usage limit for the moment. To continue, you can use your own Google Cloud API key.",
        isQuotaError: true 
      };
    }
    return { message: "Sorry, I encountered an error. Please try again." };
  }
}
