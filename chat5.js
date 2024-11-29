import pkg from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import puppeteer from "puppeteer";
import dotenv from "dotenv";
import fs from "fs";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
// import { RecursiveCharacterTextSplitter } from "langchain/textsplitters";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Document } from "langchain/document";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { createRetrievalChain } from "langchain/chains/retrieval";

// Load environment variables
dotenv.config();

// Set up Google service account credentials
const keyPath = "key.json";
process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;

const { Client, LocalAuth } = pkg;

// Initialize the AI model
const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.API_KEY,
  model: "gemini-1.5-flash",
  temperature: 0,
});

// Text splitter for processing data
// const textSplitter = new RecursiveCharacterTextSplitter({
//   chunkSize: 1000,
//   chunkOverlap: 200,
// });

// Load synthetic data
const syntheticData = fs.readFileSync("synthetic_data.txt", "utf-8");
const docs = new Document({ content: syntheticData, metadata: {} });

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "text-embedding-004",
  taskType: TaskType.RETRIEVAL_DOCUMENT,
  title: "Document title",
  apiKey: process.env.API_KEY,
});

// Initialize vector store and retriever
const vectorstore = await MemoryVectorStore.fromDocuments([docs], embeddings);
const retriever = vectorstore.asRetriever();

// Prompt template for AI interaction
const systemTemplate = `
##Tentang
  Kamu adalah customer service sebuah program beasiswa dari Stargan Mitra Teknologi bernama program Stargan Bisnis Digital, Inovasi, dan Kewirausahaan dengan nama Rai. 

##Tugas
  Tugas kamu adalah menjawab pertanyaan terkait mata kuliah. Kamu hanya menjawab dalam maksimum 1 paragraf saja dengan bahasa Indonesia yang sopan dan ramah tanpa emoticon.

##Panggilan
  Selalu panggil dengan "Kak" atau "Kakak" atau "Juragan" atau "Agan" dan hindari memanggil dengan sebutan "Anda". 

##Batasan
  Jawab hanya yang kamu tahu saja. 
  Tanpa menyebutkan informasi pribadi atau data sensitif.
  kamu dapat meminta pertanyaan lebih spesifik jika diperlukan. tapi jangan terlalu banyak bertanya.
  Arahkan mereka untuk kontak ke team@starganteknologi.com jika terdapat kendala. 

##Rekomendasi
  Kamu juga dapat memberikan rekomendasi mata kuliah dari data yang kamu punya jika mereka menanyakan rekomendasi yang diambil. 
  kamu dapat meminta pertanyaan lebih spesifik jika diperlukan. Tanyakan dulu mengenai kenginan profesi dia
  kamu dapat bertanya tentang ketertarikan di bidangnya, 
  kamu dapat bertanya tentang batasan jumlah mata kuliah yang bisa diambil. 
  Kemudian cocokkan dengan data yang kamu punya. Rekomendasikan setidaknya 5 mata kuliah.

##Call to Action
    Arahkan untuk segera mendaftar ke program Stargan Bisnis Digital, Inovasi, dan Kewirausahaan di starganteknologi.com dan hubungi team@starganteknologi.com jika terdapat kendala.
   
{context}
`;

const prompt = ChatPromptTemplate.fromMessages([
  ["system", systemTemplate],
  ["human", "{input}"],
]);

// AI Chains for Q&A
const questionAnswerChain = await createStuffDocumentsChain({
  llm: model,
  prompt,
});
const ragChain = await createRetrievalChain({
  retriever,
  combineDocsChain: questionAnswerChain,
});

// Error handling utility
function handleError(err) {
  console.error("Error:", err.message || err);
}

// Handle chatbot interactions
async function handleChat(inputMessage) {
  try {
    const contextMessage = systemTemplate.replace("{context}", inputMessage);
    const relevantData = await ragChain.invoke({ input: contextMessage });

    console.log("Relevant data:", relevantData);

    if (relevantData) {
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", relevantData.input, relevantData.answer],
        ["human", "{input}"],
      ]);

      const chain = prompt.pipe(model);

      const responseText = await chain.invoke({
        input: inputMessage,
      });

      console.log("Response text:", responseText);

      return responseText.content;
    }

    return "Maaf, saya tidak memiliki jawaban untuk pertanyaan tersebut.";
  } catch (error) {
    handleError(error);
    return "Maaf, terjadi kesalahan saat memproses permintaan Anda.";
  }
}

// Main function
async function main() {
  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      executablePath: puppeteer.executablePath(),
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  client.on("qr", (qr) => {
    console.log("Scan this QR code with your WhatsApp to log in:");
    qrcode.generate(qr, { small: true });
  });

  client.on("authenticated", () =>
    console.log("WhatsApp client authenticated!")
  );
  client.on("ready", () => console.log("WhatsApp client is ready!"));

  client.on("message", async (msg) => {
    console.log(`Message from ${msg.from}: ${msg.body}`);

    const replyText = await (async () => {
      if (msg.body === "!ping") return "pong";
      if (msg.body.startsWith("!echo ")) return msg.body.slice(6);
      if (msg.body.startsWith("!q ")) {
        const question = msg.body.slice(3);
        return await handleChat(question);
      }
      return null;
    })();

    if (replyText) {
      await msg.reply(replyText);
    }
  });

  client.on("auth_failure", handleError);
  client.on("disconnected", (reason) => {
    console.log("WhatsApp client disconnected:", reason);
    process.exit();
  });

  client.initialize();
}

main();
