import { GoogleGenerativeAI } from "@google/generative-ai"

const apiKey = process.env.GEMINI_API_KEY

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set")
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null

export const getGeminiModel = () => {
  if (!genAI) {
    throw new Error("Gemini AI is not configured. Please set GEMINI_API_KEY.")
  }
  return genAI.getGenerativeModel({ model: "gemini-3-flash-preview" })
}

export const generateAIResponse = async (
  prompt: string,
  systemInstruction: string
): Promise<string> => {
  const model = getGeminiModel()

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    systemInstruction: systemInstruction,
  })

  const response = result.response
  return response.text()
}

export const streamAIResponse = async (
  prompt: string,
  systemInstruction: string
) => {
  const model = getGeminiModel()

  const result = await model.generateContentStream({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    systemInstruction: systemInstruction,
  })

  return result.stream
}
