import pkg from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import puppeteer from "puppeteer";
import dotenv from "dotenv";
import fs from "fs/promises";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ChatPromptTemplate,  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Document } from "langchain/document";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";


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
  temperature: 0.0,
});

async function initializeVectorStore() {
  // Load synthetic data asynchronously
  const syntheticData = await fs.readFile("synthetic_data.txt", "utf-8");

  console.log("Loaded synthetic data:", syntheticData);

  // Ensure syntheticData is not empty
  if (!syntheticData) {
    throw new Error("Synthetic data is empty");
  }

  const docs = new Document({
    pageContent: syntheticData,
    metadata: {},
    id: "1",
  });

  console.log("Loaded docs:", docs);

  // Split data into smaller chunks
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ["\n\n", "\n", " ", ""],
  });

  const documents = await textSplitter.splitDocuments([docs]);

  // give each document an id
  documents.forEach((doc, i) => {
    doc.id = `doc-${i}`;
  });

  console.log("Loaded documents:", documents);

  // Initialize embeddings
  const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "text-embedding-004",
    taskType: TaskType.RETRIEVAL_DOCUMENT,
    title: "Document title",
    apiKey: process.env.API_KEY,
  });

  // Create a vector store from the documents.
  //const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());
  // Create vector store and retriever
  const vectorStore = await MemoryVectorStore.fromDocuments(
    documents,
    embeddings
  );
  return vectorStore.asRetriever();
}

async function initializeRAGChain(retriever) {
  // Define the system template
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
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
  ]);

  // Create the question-answering chain
  const questionAnswerChain = await createStuffDocumentsChain({
    llm: model,
    prompt,
  });

  // Create the RAG chain
  return createRetrievalChain({
    retriever,
    combineDocsChain: questionAnswerChain,
  });
}

async function handleChat(ragChain, inputMessage) {
  try {
    const relevantData = await ragChain.invoke({ input: inputMessage });

    console.log("Input:", inputMessage);
    console.log("Relevant data:", relevantData);

    if (relevantData && relevantData.answer) {
      console.log("Response:", relevantData.answer);
      return relevantData.answer;
    }

    return "Maaf, saya tidak memiliki jawaban untuk pertanyaan tersebut.";
  } catch (error) {
    console.error("Error in handleChat:", error);
    return "Maaf, terjadi kesalahan saat memproses permintaan Anda.";
  }
}

async function main() {
  const retriever = await initializeVectorStore();
  const ragChain = await initializeRAGChain(retriever);

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
    console.log(msg.id);
    const replyText = await (async () => {
      if (msg.body === "!ping") return "pong";
      if (msg.body.startsWith("!echo ")) return msg.body.slice(6);
      if (msg.body.startsWith("!q ")) {
        const question = msg.body.slice(3);
        return await handleChat(ragChain, question);
      }
      return null;
    })();

    if (replyText) {
      await msg.reply(replyText);
    }
  });

  client.on("auth_failure", (err) => {
    console.error("Authentication failure:", err);
  });
  client.on("disconnected", (reason) => {
    console.log("WhatsApp client disconnected:", reason);
    process.exit();
  });

  client.initialize();
}

main().catch((err) => console.error("Error in main:", err));
